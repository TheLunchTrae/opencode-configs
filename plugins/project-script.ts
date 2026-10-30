import { type Plugin, tool } from '@opencode-ai/plugin';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

const z = tool.schema;

type Runner = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'composer' | 'make';
interface Script {
  runner: Runner;
  name: string;
}

const TIMEOUT_MS = 10 * 60_000;
const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
const SCRIPT_NAME = /^[\w:.@/-]+$/;
// Windows runs .cmd and .bat shims through cmd.exe, so arguments there are limited to characters it treats literally.
const WINDOWS_SAFE_ARGUMENT = /^[\w@+=:,./-]+$/;
const MAKE_TARGET = /^([a-z0-9][\w.-]*)\s*:(?![:=])/i;

class ProjectScriptError extends Error {}

const fail = (message: string): never => {
  throw new ProjectScriptError(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (path: string): Promise<Record<string, unknown> | undefined> => {
  if (!existsSync(path)) {
    return undefined;
  }
  const value: unknown = JSON.parse(await readFile(path, 'utf8'));
  return isRecord(value) ? value : undefined;
};

const scriptNames = (manifest: Record<string, unknown> | undefined): string[] => {
  const scripts = manifest?.scripts;
  return isRecord(scripts) ? Object.keys(scripts) : [];
};

const packageRunner = (directory: string, manifest: Record<string, unknown>): Runner => {
  const declared = typeof manifest.packageManager === 'string' ? manifest.packageManager.split('@')[0] : undefined;
  if (declared === 'pnpm' || declared === 'yarn' || declared === 'bun' || declared === 'npm') {
    return declared;
  }
  if (existsSync(join(directory, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(directory, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(directory, 'bun.lock')) || existsSync(join(directory, 'bun.lockb'))) {
    return 'bun';
  }
  return 'npm';
};

const discover = async (directory: string): Promise<Script[]> => {
  const scripts: Script[] = [];
  const manifest = await readJson(join(directory, 'package.json'));
  if (manifest !== undefined) {
    const runner = packageRunner(directory, manifest);
    scripts.push(...scriptNames(manifest).map((name) => ({ runner, name })));
  }
  const composer = await readJson(join(directory, 'composer.json'));
  scripts.push(...scriptNames(composer).map((name) => ({ runner: 'composer' as const, name })));
  for (const file of ['GNUmakefile', 'makefile', 'Makefile']) {
    const path = join(directory, file);
    if (!existsSync(path)) {
      continue;
    }
    const targets = new Set<string>();
    for (const line of (await readFile(path, 'utf8')).split(/\r?\n/)) {
      const target = MAKE_TARGET.exec(line)?.[1];
      if (target !== undefined) {
        targets.add(target);
      }
    }
    scripts.push(...[...targets].map((name) => ({ runner: 'make' as const, name })));
    break;
  }
  return scripts.filter((script) => SCRIPT_NAME.test(script.name));
};

const commandLine = (script: Script, args: readonly string[]): [string, string[]] => {
  switch (script.runner) {
    case 'npm':
      return ['npm', ['run', script.name, ...(args.length > 0 ? ['--', ...args] : [])]];
    case 'pnpm':
    case 'yarn':
    case 'bun':
      return [script.runner, ['run', script.name, ...args]];
    case 'composer':
      return ['composer', ['run-script', script.name, ...(args.length > 0 ? ['--', ...args] : [])]];
    case 'make':
      return ['make', [script.name]];
  }
};

const resolveDirectory = async (worktree: string, base: string, requested: string | undefined): Promise<string> => {
  const target = requested === undefined ? base : resolve(base, requested);
  const [root, actual] = await Promise.all([
    realpath(worktree),
    realpath(target).catch(() => fail('Directory not found.')),
  ]);
  const path = relative(root, actual);
  if (path.startsWith('..') || isAbsolute(path)) {
    fail('The directory must be inside the project worktree.');
  }
  return actual;
};

const run = (
  command: string,
  args: string[],
  cwd: string,
  signal: AbortSignal,
): Promise<{ code: number | string; output: string }> =>
  new Promise((resolvePromise) => {
    const windows = process.platform === 'win32';
    execFile(
      command,
      args,
      { cwd, signal, timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true, shell: windows },
      (error, stdout, stderr) => {
        const output = [stdout, stderr].filter((text) => text.length > 0).join('\n');
        if (error === null) {
          resolvePromise({ code: 0, output });
          return;
        }
        const code = typeof error.code === 'number' || typeof error.code === 'string' ? error.code : 'failed';
        resolvePromise({ code, output: output.length > 0 ? output : error.message });
      },
    );
  });

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode's plugin factory requires a Promise result.
export const ProjectScriptPlugin: Plugin = async () => ({
  tool: {
    project_script: tool({
      description:
        'Run a script the project declares: a package.json script (with its package manager), a composer.json ' +
        'script, or a Makefile target. Each run asks for project_script permission. Omit script to list scripts. ' +
        'Arguments pass to the script without a shell. Use bash only for commands that are not declared scripts.',
      args: {
        script: z.string().optional().describe('Declared script or target name. Omit to list available scripts.'),
        runner: z
          .enum(['npm', 'pnpm', 'yarn', 'bun', 'composer', 'make'])
          .optional()
          .describe('Choose the source when the same name is declared more than once.'),
        args: z.array(z.string()).max(20).optional().describe('Extra script arguments. Not supported for make.'),
        directory: z.string().optional().describe('Project-relative directory containing the manifest.'),
      },
      async execute(input, context) {
        const directory = await resolveDirectory(context.worktree, context.directory, input.directory);
        const scripts = await discover(directory);
        if (input.script === undefined) {
          return scripts.length > 0
            ? scripts.map((script) => `${script.runner}:${script.name}`).join('\n')
            : 'No declared scripts found.';
        }
        const matches = scripts.filter(
          (script) => script.name === input.script && (input.runner === undefined || script.runner === input.runner),
        );
        if (matches.length !== 1) {
          return fail(
            matches.length === 0
              ? `"${input.script}" is not a declared script in ${directory}.`
              : `"${input.script}" is declared by ${matches.map((script) => script.runner).join(' and ')}; set runner.`,
          );
        }
        const [script] = matches;
        const extra = input.args ?? [];
        if (script.runner === 'make' && extra.length > 0) {
          fail('Makefile targets do not accept extra arguments.');
        }
        if (extra.some((arg) => arg.includes('\0'))) {
          fail('Arguments cannot contain NUL characters.');
        }
        if (process.platform === 'win32' && extra.some((arg) => !WINDOWS_SAFE_ARGUMENT.test(arg))) {
          fail('On Windows, arguments are limited to letters, digits, and @+=:,./_- characters.');
        }
        const [command, args] = commandLine(script, extra);
        const display = [command, ...args].join(' ');
        const key = [`${script.runner}:${script.name}`, ...extra].join(' ');
        // A saved approval covers this exact script and argument list, not a command prefix.
        await context.ask({
          permission: 'project_script',
          patterns: [key],
          always: [key],
          metadata: { command: display, directory },
        });
        context.metadata({ title: display });
        const result = await run(command, args, directory, context.abort);
        const status = result.code === 0 ? 'exit code 0' : `exit code ${String(result.code)}`;
        return {
          title: display,
          output: `$ ${display}\n${result.output}\n[${status}]`,
          metadata: { exit: result.code },
        };
      },
    }),
  },
});
