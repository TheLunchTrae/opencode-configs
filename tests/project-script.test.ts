import type { PluginInput } from '@opencode-ai/plugin';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { ProjectScriptPlugin } from '../plugins/project-script.ts';

interface AskInput {
  permission: string;
  patterns: string[];
  always: string[];
  metadata: Record<string, unknown>;
}

let project = '';

const execute = async (
  args: Record<string, unknown>,
  options: { deny?: boolean; directory?: string; asks?: AskInput[] } = {},
) => {
  const hooks = await ProjectScriptPlugin({} as PluginInput);
  const definition = hooks.tool?.project_script;
  assert.ok(definition !== undefined);
  const asks = options.asks ?? [];
  const result = await definition.execute(args, {
    sessionID: 'session',
    messageID: 'message',
    agent: 'builder',
    directory: options.directory ?? project,
    worktree: project,
    abort: new AbortController().signal,
    metadata: () => undefined,
    ask: async (input: AskInput) => {
      asks.push(input);
      if (options.deny === true) {
        throw new Error('denied');
      }
    },
  });
  const output = typeof result === 'string' ? result : result.output;
  return { output, asks };
};

describe('project_script tool', () => {
  before(async () => {
    project = await mkdtemp(join(tmpdir(), 'project-script-'));
    await writeFile(join(project, 'print.mjs'), "console.log('args:' + JSON.stringify(process.argv.slice(2)));\n");
    await writeFile(
      join(project, 'package.json'),
      JSON.stringify({ scripts: { show: 'node print.mjs', broken: 'node -e "process.exit(3)"' } }),
    );
    await writeFile(join(project, 'Makefile'), 'VAR := value\n.PHONY: hello\nhello:\n\t@echo make-ran\n');
    await mkdir(join(project, 'packages', 'pnpm-app'), { recursive: true });
    await writeFile(join(project, 'packages', 'pnpm-app', 'package.json'), JSON.stringify({ scripts: { test: 'x' } }));
    await writeFile(join(project, 'packages', 'pnpm-app', 'pnpm-lock.yaml'), '');
  });

  after(async () => {
    await rm(project, { recursive: true, force: true });
  });

  it('lists declared scripts and Makefile targets', async () => {
    const { output, asks } = await execute({});
    assert.deepEqual(output.split('\n').sort(), ['make:hello', 'npm:broken', 'npm:show']);
    assert.equal(asks.length, 0);
  });

  it('asks with an exact key and passes arguments without a shell', async () => {
    const marker = join(project, 'pwned');
    const { output, asks } = await execute({ script: 'show', args: ['--grep', '$(touch pwned)', 'a b'] });
    assert.match(output, /args:\["--grep","\$\(touch pwned\)","a b"\]/);
    assert.match(output, /\[exit code 0\]/);
    assert.equal(existsSync(marker), false);
    assert.deepEqual(asks, [
      {
        permission: 'project_script',
        patterns: ['npm:show --grep $(touch pwned) a b'],
        always: ['npm:show --grep $(touch pwned) a b'],
        metadata: { command: 'npm run show -- --grep $(touch pwned) a b', directory: asks[0]?.metadata.directory },
      },
    ]);
  });

  it('does not run when permission is denied', async () => {
    await assert.rejects(execute({ script: 'hello' }, { deny: true }), /denied/);
  });

  it('reports a failing script without throwing', async () => {
    const { output } = await execute({ script: 'broken' });
    assert.match(output, /\[exit code 3\]/);
  });

  it('runs Makefile targets and rejects their arguments', async () => {
    const { output } = await execute({ script: 'hello', runner: 'make' });
    assert.match(output, /make-ran/);
    await assert.rejects(execute({ script: 'hello', args: ['-f', 'other'] }), /do not accept/);
  });

  it('rejects undeclared scripts and directories outside the worktree', async () => {
    await assert.rejects(execute({ script: 'rm -rf .' }), /not a declared script/);
    await assert.rejects(execute({ script: 'VAR' }), /not a declared script/);
    await assert.rejects(execute({ directory: '..' }), /inside the project worktree/);
  });

  it('detects the package manager from the lockfile', async () => {
    const asks: AskInput[] = [];
    await assert.rejects(execute({ script: 'test', directory: 'packages/pnpm-app' }, { deny: true, asks }), /denied/);
    assert.equal(asks[0]?.patterns[0], 'pnpm:test');
    assert.equal(asks[0]?.metadata.command, 'pnpm run test');
  });
});
