import type { Plugin } from '@opencode-ai/plugin';
import { readFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';

// Blocks edit, write, multiedit, and apply_patch calls that add code comments describing the conversation,
// the prompt, or earlier iterations. Only added comment lines are checked; code, string literals, and prose
// files (Markdown, plain text) are ignored. Detection is heuristic: it reads common line and trailing comment
// syntaxes, not a full parser for each language.
//
// OPENCODE_COMMENT_GUARD selects the mode: unset or `leaks` blocks leaking comments, `all` blocks every new
// comment except tool directives (lint, type-checker, and formatter pragmas), and `off` disables the guard.

type Mode = 'leaks' | 'all' | 'off';

interface FileChange {
  path: string;
  added: string[];
  removed: string[];
}

interface Finding {
  path: string;
  comment: string;
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
  '.gitignore',
  '.dockerignore',
  '.editorconfig',
]);
const HASH_ONLY_BASENAMES = new Set(['dockerfile', 'makefile', 'gemfile', 'rakefile', 'procfile', 'justfile']);
const HASH_AND_SLASH_EXTENSIONS = new Set(['.php']);
const DASH_EXTENSIONS = new Set(['.sql', '.lua', '.hs', '.elm']);

// Phrases that only make sense relative to a conversation, a request, or a previous draft. Each one must stay
// narrow enough that ordinary descriptions of runtime behavior (for example "the user requested a reset") pass.
const LEAK_PATTERNS: readonly RegExp[] = [
  /\b(?:as|like) (?:was )?(?:requested|asked|instructed|discussed)\b/i,
  /\b(?:as|like) (?:you|the user) (?:requested|asked|instructed|suggested|discussed|agreed|wanted)\b/i,
  /\bper (?:our|your|this) (?:discussion|conversation|chat|thread|request|instructions?|prompt|feedback)\b/i,
  /\bper the (?:discussion|conversation|chat|prompt|feedback)\b/i,
  /\bper (?:the )?user(?:'s)? (?:request|instructions?|feedback)\b/i,
  /\byou (?:asked|requested|said|mentioned|suggested)\b/i,
  /\b(?:as|like|what) (?:we|i) (?:discussed|agreed|decided|mentioned|talked about)\b/i,
  /\b(?:our|this|the) (?:conversation|chat|discussion) (?:above|earlier)\b/i,
  /\b(?:earlier|above) in (?:our|this|the) (?:conversation|chat|thread|discussion)\b/i,
  /\b(?:as|per) (?:the|your|this) prompt\b/i,
  /\b(?:our|my|your) (?:previous|last|earlier|prior) (?:iteration|draft|version|attempt|revision|round)\b/i,
  /\bpreviously (?:this|it|we|i) (?:was|were|used|did|returned|called|had)\b/i,
  /^(?:was |were |now )?(?:changed|switched) (?:from|back)\b/i,
  /\bnow uses? .+ instead of\b/i,
  /\b(?:addressing|addresses|per) (?:your|the|review) (?:feedback|review comments?)\b/i,
  /\b(?:claude|the assistant|the ai|chatgpt|copilot) (?:suggested|recommended|wrote|generated|said)\b/i,
];

// Comments that configure tools rather than explain code. They stay allowed in `all` mode.
const DIRECTIVE_PATTERN =
  /^(?:eslint|@ts-|prettier-ignore|biome-ignore|istanbul |c8 |v8 |noqa|type: ?ignore|pylint:|mypy:|pyright:|nolint|go:|#?(?:end)?region\b|nosonar|phpcs|@phpstan|@psalm|rubocop:|deno-|jscpd:|@vitest-environment|@jest-environment|@license|@preserve|<reference |shellcheck |fmt: |isort:|pragma)/i;

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

interface Syntax {
  slash: boolean;
  hash: boolean;
  dash: boolean;
}

const syntaxFor = (path: string): Syntax | undefined => {
  const extension = extname(path).toLowerCase();
  if (PROSE_EXTENSIONS.has(extension)) {
    return undefined;
  }
  const name = basename(path).toLowerCase();
  if (HASH_ONLY_EXTENSIONS.has(extension) || HASH_ONLY_BASENAMES.has(name) || name.startsWith('dockerfile.')) {
    return { slash: false, hash: true, dash: false };
  }
  return {
    slash: true,
    hash: HASH_AND_SLASH_EXTENSIONS.has(extension),
    dash: DASH_EXTENSIONS.has(extension),
  };
};

// A trailing marker counts only outside string literals, judged by quote parity before the marker.
const outsideQuotes = (prefix: string): boolean => {
  const unescaped = prefix.replace(/\\./g, '');
  return ['"', "'", '`'].every((quote) => unescaped.split(quote).length % 2 === 1);
};

const trailingComment = (line: string, marker: RegExp): string | undefined => {
  for (const match of line.matchAll(marker)) {
    const prefix = line.slice(0, match.index);
    if (outsideQuotes(prefix)) {
      return line.slice(match.index + match[0].length);
    }
  }
  return undefined;
};

const commentText = (line: string, syntax: Syntax): string | undefined => {
  const trimmed = line.trim();
  if (syntax.slash) {
    const leading = /^(?:\/{2,}!?|\/\*+!?|\*\/|\*(?!\*?\/)|\{\/\*+|<!--)/.exec(trimmed);
    if (leading !== null) {
      return trimmed.slice(leading[0].length);
    }
  }
  if (syntax.hash && trimmed.startsWith('#') && !PREPROCESSOR_PATTERN.test(trimmed)) {
    return trimmed.replace(/^#+/, '');
  }
  if (syntax.dash && trimmed.startsWith('--')) {
    return trimmed.replace(/^-+/, '');
  }
  if (syntax.slash) {
    const trailing = trailingComment(line, /(?<=\s)(?:\/\/|\/\*)/g);
    if (trailing !== undefined) {
      return trailing;
    }
  }
  if (syntax.hash) {
    return trailingComment(line, /(?<=\s)#(?=\s)/g);
  }
  return undefined;
};

const cleanComment = (text: string): string =>
  text
    .replace(/\*\/\s*\}?$|-->$/, '')
    .trim()
    .replace(/^[-*:\s]+/, '');

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

const parsePatch = (patchText: string): FileChange[] => {
  const changes: FileChange[] = [];
  let current: FileChange | undefined;
  for (const line of splitLines(patchText)) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (header !== null) {
      current = header[1] === 'Delete' ? undefined : { path: header[2].trim(), added: [], removed: [] };
      if (current !== undefined) {
        changes.push(current);
      }
      continue;
    }
    if (current === undefined || line.startsWith('***')) {
      continue;
    }
    if (line.startsWith('+')) {
      current.added.push(line.slice(1));
    } else if (line.startsWith('-')) {
      current.removed.push(line.slice(1));
    }
  }
  return changes;
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
      return [{ path, added: splitLines(asString(args.content)), removed: splitLines(existing) }];
    }
    case 'edit':
      return [{ path, added: splitLines(asString(args.newString)), removed: splitLines(asString(args.oldString)) }];
    case 'multiedit': {
      const edits = Array.isArray(args.edits) ? args.edits.filter(isRecord) : [];
      return edits.map((edit) => ({
        path,
        added: splitLines(asString(edit.newString)),
        removed: splitLines(asString(edit.oldString)),
      }));
    }
    case 'apply_patch':
    case 'patch':
      return parsePatch(firstString(args.patchText, args.patch));
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
    const removed = new Set(change.removed.map((line) => line.trim()));
    for (const line of change.added) {
      if (removed.has(line.trim())) {
        continue;
      }
      const raw = commentText(line, syntax);
      const comment = raw === undefined ? '' : cleanComment(raw);
      if (isBlockedComment(comment, mode)) {
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
