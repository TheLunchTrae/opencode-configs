import { type Plugin, tool } from '@opencode-ai/plugin';
import { execFile } from 'node:child_process';
import { isBlockedPath, secretExcludePathspecs } from '../extensions/security/secret-paths.ts';

const z = tool.schema;

const OPERATIONS = ['status', 'diff', 'changed-files', 'log', 'show', 'blame', 'merge-base'] as const;
type Operation = (typeof OPERATIONS)[number];

// Revision syntax used for commits, refs, ranges, reflog entries, and `rev:path` object names.
const REVISION_PATTERN = /^[\w./~^@{}:-]+$/;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

// Settings that keep inspection independent of configured helper programs and avoid index writes.
const SAFE_CONFIG = [
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.pager=cat',
  '-c',
  'diff.external=',
  '-c',
  'log.showSignature=false',
  '-c',
  'color.ui=never',
];
const NO_HELPERS = ['--no-ext-diff', '--no-textconv'];

class GitInspectError extends Error {}

const fail = (message: string): never => {
  throw new GitInspectError(message);
};

const checkRevision = (value: string): string => {
  if (value.startsWith('-') || !REVISION_PATTERN.test(value)) {
    fail(`Unsupported revision "${value}". Use a commit, ref, or range without options or whitespace.`);
  }
  const colon = value.indexOf(':');
  if (colon !== -1) {
    const path = value.slice(colon + 1);
    const blocked = isBlockedPath(path);
    if (blocked !== undefined) {
      fail(`Revision "${value}" reads a sensitive path (pattern ${blocked}).`);
    }
  }
  return value;
};

const checkPath = (value: string): string => {
  if (value.length === 0 || value.includes('\0')) {
    fail('Paths must be nonempty.');
  }
  const blocked = isBlockedPath(value);
  if (blocked !== undefined) {
    fail(`Path "${value}" is sensitive (pattern ${blocked}).`);
  }
  return value;
};

// Literal magic disables globbing and pathspec magic in a supplied path.
const literal = (path: string): string => `:(literal)${path}`;

interface Request {
  operation: Operation;
  revision?: string | undefined;
  paths?: string[] | undefined;
  staged?: boolean | undefined;
  stat?: boolean | undefined;
  patch?: boolean | undefined;
  maxCount?: number | undefined;
}

const gitArguments = (request: Request): string[] => {
  const revision = request.revision === undefined ? undefined : checkRevision(request.revision);
  const files = (request.paths ?? []).map(checkPath);
  const paths = files.map(literal);
  const content = ['--', ...paths, ...secretExcludePathspecs];
  const names = paths.length > 0 ? ['--', ...paths] : [];
  const revisions = revision === undefined ? [] : [revision];
  switch (request.operation) {
    case 'status':
      return ['status', '--short', '--branch', ...names];
    case 'diff':
      return [
        'diff',
        ...NO_HELPERS,
        ...(request.staged === true ? ['--cached'] : []),
        ...(request.stat === true ? ['--stat'] : []),
        ...revisions,
        ...content,
      ];
    case 'changed-files':
      return ['diff', '--name-status', ...(request.staged === true ? ['--cached'] : []), ...revisions, ...names];
    case 'log':
      return [
        'log',
        ...NO_HELPERS,
        `--max-count=${String(request.maxCount ?? 20)}`,
        '--date=iso',
        ...(request.stat === true ? ['--stat'] : []),
        ...(request.patch === true ? ['--patch'] : []),
        ...revisions,
        ...content,
      ];
    case 'show': {
      const target = revision ?? 'HEAD';
      // A `rev:path` object read has no diff to limit; checkRevision already vetted its path.
      const objectRead = target.includes(':');
      return [
        'show',
        ...NO_HELPERS,
        ...(request.stat === true ? ['--stat'] : []),
        target,
        ...(objectRead ? [] : content),
      ];
    }
    case 'blame':
      if (files.length !== 1) {
        return fail('blame requires exactly one path.');
      }
      return ['blame', '--no-textconv', ...revisions, '--', ...files];
    case 'merge-base': {
      const parts = revision?.split('...');
      if (parts?.length !== 2 || parts.some((part) => part.length === 0)) {
        return fail('merge-base requires a revision in the form A...B.');
      }
      return ['merge-base', ...parts];
    }
  }
};

const runGit = (cwd: string, args: string[], signal: AbortSignal): Promise<string> =>
  new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_OPTIONAL_LOCKS: '0',
      GIT_TERMINAL_PROMPT: '0',
      GIT_PAGER: 'cat',
    };
    delete env.GIT_EXTERNAL_DIFF;
    execFile(
      'git',
      [...SAFE_CONFIG, '--no-pager', ...args],
      { cwd, env, signal, timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
      (error, stdout, stderr) => {
        if (error !== null) {
          const detail = stderr.trim() !== '' ? stderr.trim() : error.message;
          reject(new GitInspectError(`git ${args[0] ?? ''} failed: ${detail}`));
          return;
        }
        resolve(stdout);
      },
    );
  });

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode's plugin factory requires a Promise result.
export const GitInspectPlugin: Plugin = async () => ({
  tool: {
    git_inspect: tool({
      description:
        'Read-only Git inspection: status, diff, changed-files, log, show, blame, or merge-base. ' +
        'Use revision for a commit, ref, or range such as main...HEAD, and paths to limit output. ' +
        'Content of sensitive paths such as .env files and keys is excluded. No commands or options can be added.',
      args: {
        operation: z.enum(OPERATIONS).describe('Git operation to run.'),
        revision: z
          .string()
          .optional()
          .describe('Commit, ref, or range. show also accepts rev:path. merge-base requires A...B.'),
        paths: z.array(z.string()).max(50).optional().describe('Repository paths that limit the output.'),
        staged: z.boolean().optional().describe('diff or changed-files: compare the index instead of the worktree.'),
        stat: z.boolean().optional().describe('diff, log, or show: include a diffstat.'),
        patch: z.boolean().optional().describe('log: include patches.'),
        maxCount: z.number().int().min(1).max(200).optional().describe('log: maximum commits, default 20.'),
      },
      async execute(args, context) {
        const output = await runGit(context.directory, gitArguments(args), context.abort);
        return output.length > 0 ? output : `git ${args.operation}: no output`;
      },
    }),
  },
});
