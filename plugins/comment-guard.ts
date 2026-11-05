import type { Plugin } from '@opencode-ai/plugin';
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

// Blocks edit, write, and apply_patch calls that add code comments describing the conversation, the prompt,
// or earlier iterations. Only added comment lines are checked; code, string literals, and prose files
// (Markdown, plain text) are ignored. Detection is heuristic: it follows common line, block, trailing, and
// Python docstring syntaxes, not a full parser for each language.
//
// OPENCODE_COMMENT_GUARD selects the mode: `all` blocks every new comment except tool directives (lint,
// type-checker, and formatter pragmas), `off` disables the guard, and any other value or no value blocks only
// leaking comments.

type Mode = 'leaks' | 'all' | 'off';

interface ChangedLine {
  text: string;
  added: boolean;
  // Starts a new hunk, so comment block state from earlier lines does not carry over.
  hunkStart?: boolean;
}

interface FileChange {
  path: string;
  lines: ChangedLine[];
}

interface Finding {
  path: string;
  comment: string;
}

interface Syntax {
  slash: boolean;
  hash: boolean;
  dash: boolean;
  docstring: boolean;
}

interface Scan {
  comment: string | undefined;
  blockEnd: string | undefined;
}

const PROSE_EXTENSIONS = new Set(['.md', '.mdx', '.markdown', '.txt', '.rst', '.adoc']);
const HASH_ONLY_EXTENSIONS = new Set([
  '.py',
  '.pyi',
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.rb',
  '.pl',
  '.pm',
  '.r',
  '.yaml',
  '.yml',
  '.toml',
  '.conf',
  '.cfg',
  '.ps1',
  '.psm1',
  '.ex',
  '.exs',
  '.tf',
  '.hcl',
  '.mk',
  '.cmake',
  '.nix',
  '.jl',
  '.coffee',
  '.properties',
]);
// Dotfiles have no extension for `extname`, so they are matched by full name.
const HASH_ONLY_BASENAMES = new Set([
  'dockerfile',
  'containerfile',
  'makefile',
  'gemfile',
  'rakefile',
  'procfile',
  'justfile',
  'cmakelists.txt',
  '.gitignore',
  '.gitattributes',
  '.dockerignore',
  '.prettierignore',
  '.eslintignore',
  '.editorconfig',
  '.npmrc',
  '.env',
]);
const HASH_ONLY_PREFIXES = ['dockerfile.', 'containerfile.', '.env.'];
const HASH_AND_SLASH_EXTENSIONS = new Set(['.php']);
const DASH_EXTENSIONS = new Set(['.sql', '.lua', '.hs', '.elm']);
const DOCSTRING_EXTENSIONS = new Set(['.py', '.pyi']);

// Lines longer than this are treated as generated or minified code and skipped.
const MAX_LINE_LENGTH = 4000;

// Rejects "as requested by the caller" and "as discussed in #123", which cite a source rather than the chat.
const NOT_A_SOURCE = String.raw`(?!\s+(?:by|in|via|at|from|with|for|on|under|below|above)\b)`;

// Phrases that only make sense relative to a conversation, a request, or a previous draft. Each one must stay
// narrow enough that ordinary descriptions of runtime behavior pass.
const LEAK_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:as|like) (?:was )?(?:requested|asked|instructed|discussed)\b${NOT_A_SOURCE}`, 'i'),
  new RegExp(
    String.raw`\b(?:as|like) (?:you|the user) (?:requested|asked|instructed|suggested|discussed|agreed|wanted)\b` +
      NOT_A_SOURCE,
    'i',
  ),
  /\bper (?:our|your) (?:discussion|conversation|chat|instructions?|prompt|feedback)\b/i,
  /\bper (?:this|the) (?:discussion|conversation|chat)\b/i,
  /\bper the feedback\b/i,
  /\bper (?:the )?user(?:'s)? (?:request|instructions?|feedback)\b/i,
  /^(?:as |like )?you (?:asked|requested|said|mentioned|suggested|wanted)\b/i,
  /\byou (?:asked|told) (?:me|us)\b/i,
  /\b(?:as|like|what) (?:we|i) (?:discussed|agreed|decided|mentioned|talked about)\b/i,
  /\b(?:our|this|the) (?:conversation|chat|discussion) (?:above|earlier)\b/i,
  /\b(?:earlier|above) in (?:our|this|the) (?:conversation|chat|thread|discussion)\b/i,
  /^(?:as|per) (?:the|this) prompt\s*[,.:;]/i,
  /\b(?:as|per) your prompt\b/i,
  /\b(?:our|my|your) (?:previous|last|earlier|prior) (?:iteration|draft|revision)\b/i,
  /\bpreviously (?:this|it|we|i) (?:was|were|used|did|returned|called|had)\b/i,
  /^(?:was |were |now )?(?:changed|switched) (?:from|back)\b/i,
  /\bnow uses? .+ instead of\b/i,
  /\b(?:addressing|addresses|per) (?:your|the|review) (?:feedback|review comments?)\b/i,
  /^(?:claude|chatgpt|copilot|the assistant|the ai) (?:suggested|recommended|wrote|generated|said)\b/i,
  /\b(?:claude|chatgpt|copilot) (?:suggested|recommended)\b/i,
];

// Comments that configure tools rather than explain code. They stay allowed in `all` mode.
const DIRECTIVE_PATTERN =
  /^(?:eslint|@ts-|prettier-ignore|biome-ignore|istanbul |c8 |v8 |noqa|type: ?ignore|pylint:|mypy:|pyright:|nolint|go:|#?(?:end)?region\b|nosonar|phpcs|@phpstan|@psalm|rubocop:|deno-|jscpd:|@vitest-environment|@jest-environment|@license|@preserve|@flow\b|<reference |shellcheck |fmt: |isort:|pragma|yaml-language-server:|-\*-|(?:frozen_string_literal|encoding|coding):|markdownlint|cspell:)/i;

const PREPROCESSOR_PATTERN =
  /^#(?:!|\[|include|define|undef|if|ifdef|ifndef|elif|else|endif|pragma|error|warning|line|import)\b/;

const readMode = (): Mode => {
  const value = process.env.OPENCODE_COMMENT_GUARD?.trim().toLowerCase();
  return value === 'all' || value === 'off' ? value : 'leaks';
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const firstString = (...values: unknown[]): string =>
  values.find((value): value is string => typeof value === 'string' && value !== '') ?? '';

const splitLines = (text: string): string[] => text.split(/\r?\n/);

const syntaxFor = (path: string): Syntax | undefined => {
  const name = basename(path).toLowerCase();
  const extension = extname(name);
  if (
    HASH_ONLY_BASENAMES.has(name) ||
    HASH_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    HASH_ONLY_EXTENSIONS.has(extension)
  ) {
    return { slash: false, hash: true, dash: false, docstring: DOCSTRING_EXTENSIONS.has(extension) };
  }
  if (PROSE_EXTENSIONS.has(extension)) {
    return undefined;
  }
  return {
    slash: true,
    hash: HASH_AND_SLASH_EXTENSIONS.has(extension),
    dash: DASH_EXTENSIONS.has(extension),
    docstring: false,
  };
};

// Index of the quote that closes the string opened at `start`, or -1 when the line never closes it,
// as with an apostrophe in prose or a Rust lifetime.
const closingQuote = (line: string, start: number): number => {
  const quote = line[start];
  for (let index = start + 1; index < line.length; index += 1) {
    if (line[index] === '\\') {
      index += 1;
    } else if (line[index] === quote) {
      return index;
    }
  }
  return -1;
};

// Finds a trailing comment marker that follows whitespace and sits outside string literals.
const trailingMarker = (line: string, syntax: Syntax): { index: number; marker: string } | undefined => {
  for (let index = 1; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' || char === "'" || char === '`') {
      const close = closingQuote(line, index);
      if (close !== -1) {
        index = close;
      }
      continue;
    }
    if (!/\s/.test(line[index - 1])) {
      continue;
    }
    const pair = line.slice(index, index + 2);
    if (syntax.slash && (pair === '//' || pair === '/*')) {
      return { index, marker: pair };
    }
    if (syntax.hash && char === '#' && (index + 1 === line.length || /\s/.test(line[index + 1]))) {
      return { index, marker: '#' };
    }
  }
  return undefined;
};

// Text after an opening delimiter; a missing terminator on the same line leaves the block open.
const openBlock = (rest: string, end: string): Scan => {
  const close = rest.indexOf(end);
  return close === -1 ? { comment: rest, blockEnd: end } : { comment: rest.slice(0, close), blockEnd: undefined };
};

const NO_COMMENT: Scan = { comment: undefined, blockEnd: undefined };

// Returns the comment text on a line, if any, and the terminator of a block comment the line leaves open.
const scanLine = (line: string, syntax: Syntax, blockEnd: string | undefined): Scan => {
  if (blockEnd !== undefined) {
    const close = line.indexOf(blockEnd);
    return close === -1 ? { comment: line, blockEnd } : { comment: line.slice(0, close), blockEnd: undefined };
  }
  const trimmed = line.trim();
  if (trimmed.length > MAX_LINE_LENGTH) {
    return NO_COMMENT;
  }
  if (syntax.slash) {
    if (trimmed.startsWith('//')) {
      return { comment: trimmed.replace(/^\/+!?/, ''), blockEnd: undefined };
    }
    const block = /^\{?\/\*+!?/.exec(trimmed);
    if (block !== null) {
      return openBlock(trimmed.slice(block[0].length), '*/');
    }
    if (trimmed.startsWith('<!--')) {
      return openBlock(trimmed.slice(4), '-->');
    }
    // A block comment body whose opening line lies outside the edited text.
    if (/^\*(?:\s+\p{L}|\/|$)/u.test(trimmed)) {
      return { comment: trimmed, blockEnd: undefined };
    }
  }
  if (syntax.docstring) {
    const docstring = /^[ru]?("""|''')/i.exec(trimmed);
    if (docstring !== null) {
      return openBlock(trimmed.slice(docstring[0].length), docstring[1]);
    }
  }
  if (syntax.hash && trimmed.startsWith('#')) {
    return PREPROCESSOR_PATTERN.test(trimmed)
      ? NO_COMMENT
      : { comment: trimmed.replace(/^#+/, ''), blockEnd: undefined };
  }
  if (syntax.dash && trimmed.startsWith('--')) {
    return { comment: trimmed.replace(/^-+/, ''), blockEnd: undefined };
  }
  const trailing = trailingMarker(line, syntax);
  if (trailing === undefined) {
    return NO_COMMENT;
  }
  const rest = line.slice(trailing.index + trailing.marker.length);
  return trailing.marker === '/*' ? openBlock(rest, '*/') : { comment: rest, blockEnd: undefined };
};

const cleanComment = (text: string): string =>
  text
    .trim()
    .replace(/(?:\*\/\s*\}?|-->|"""|''')$/, '')
    .trim()
    .replace(/^[-*!:\s]+/, '');

const isLeak = (comment: string): boolean => LEAK_PATTERNS.some((pattern) => pattern.test(comment));

const isBlockedComment = (comment: string, mode: Mode): boolean => {
  if (comment.length === 0) {
    return false;
  }
  if (mode === 'all') {
    return !DIRECTIVE_PATTERN.test(comment);
  }
  return isLeak(comment);
};

const readExisting = async (path: string): Promise<string> => {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
};

// Marks new lines as added unless the same trimmed text was removed, so kept or moved lines pass.
const markAdded = (path: string, newText: string, oldText: string): FileChange => {
  const removed = new Set(splitLines(oldText).map((line) => line.trim()));
  return { path, lines: splitLines(newText).map((text) => ({ text, added: !removed.has(text.trim()) })) };
};

interface PatchFile {
  path: string;
  lines: ChangedLine[];
  removed: Set<string>;
}

const parsePatch = (patchText: string): FileChange[] => {
  const files: PatchFile[] = [];
  let current: PatchFile | undefined;
  for (const line of splitLines(patchText)) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header !== null) {
      current = header[1] === 'Delete' ? undefined : { path: header[2].trim(), lines: [], removed: new Set() };
      if (current !== undefined) {
        files.push(current);
      }
      continue;
    }
    if (current === undefined || line.startsWith('***')) {
      continue;
    }
    if (line.startsWith('@@')) {
      current.lines.push({ text: '', added: false, hunkStart: true });
    } else if (line.startsWith('+')) {
      current.lines.push({ text: line.slice(1), added: true });
    } else if (line.startsWith('-')) {
      current.removed.add(line.slice(1).trim());
    } else {
      current.lines.push({ text: line.slice(1), added: false });
    }
  }
  return files.map(({ path, lines, removed }) => ({
    path,
    lines: lines.map((line) => ({ ...line, added: line.added && !removed.has(line.text.trim()) })),
  }));
};

const collectChanges = async (
  tool: string,
  args: Record<string, unknown>,
  directory: string,
): Promise<FileChange[]> => {
  const path = firstString(args.filePath, args.file_path, args.path);
  switch (tool) {
    case 'write': {
      const existing = path === '' ? '' : await readExisting(resolve(directory, path));
      return [markAdded(path, asString(args.content), existing)];
    }
    case 'edit':
      return [markAdded(path, asString(args.newString), asString(args.oldString))];
    case 'apply_patch':
      return parsePatch(asString(args.patchText));
    default:
      return [];
  }
};

const findBlockedComments = (changes: FileChange[], mode: Mode): Finding[] => {
  const findings: Finding[] = [];
  for (const change of changes) {
    const syntax = syntaxFor(change.path);
    if (syntax === undefined) {
      continue;
    }
    let blockEnd: string | undefined;
    for (const line of change.lines) {
      if (line.hunkStart === true) {
        blockEnd = undefined;
        continue;
      }
      const scan = scanLine(line.text, syntax, blockEnd);
      blockEnd = scan.blockEnd;
      const comment = scan.comment === undefined ? '' : cleanComment(scan.comment);
      if (line.added && isBlockedComment(comment, mode)) {
        findings.push({ path: change.path, comment });
      }
    }
  }
  return findings;
};

const MAX_REPORTED = 3;
const MAX_COMMENT_LENGTH = 120;

const formatError = (findings: Finding[], mode: Mode): string => {
  const shown = findings
    .slice(0, MAX_REPORTED)
    .map(({ path, comment }) => {
      const text = comment.length > MAX_COMMENT_LENGTH ? `${comment.slice(0, MAX_COMMENT_LENGTH)}...` : comment;
      return `${path === '' ? 'file' : path}: "${text}"`;
    })
    .join('; ');
  const more = findings.length > MAX_REPORTED ? ` (+${String(findings.length - MAX_REPORTED)} more)` : '';
  const rule =
    mode === 'all'
      ? 'New code comments are disabled (OPENCODE_COMMENT_GUARD=all). Remove the comments and retry.'
      : 'Comments must describe the code as it is. Remove references to the conversation, prompt, requests, ' +
        'or earlier versions, then retry.';
  return `blocked by comment-guard plugin: ${shown}${more}. ${rule}`;
};

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode's plugin factory requires a Promise result.
export const CommentGuardPlugin: Plugin = async ({ directory }) => ({
  'tool.execute.before': async (input, output) => {
    const mode = readMode();
    if (mode === 'off') {
      return;
    }
    const rawArgs: unknown = output.args;
    const args = isRecord(rawArgs) ? rawArgs : {};
    const changes = await collectChanges(input.tool.toLowerCase(), args, directory);
    const findings = findBlockedComments(changes, mode);
    if (findings.length > 0) {
      throw new Error(formatError(findings, mode));
    }
  },
});
