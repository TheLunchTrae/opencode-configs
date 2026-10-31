import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { PluginInput } from '@opencode-ai/plugin';
import tokenEconomizer from '../plugins/tokeneconomizer.ts';

test('disabled and side-call sessions register no upstream hooks or exit listeners', async () => {
  const before = process.listenerCount('exit');
  const originalDisable = process.env.TE_DISABLE;
  const originalSidecall = process.env.TE_SIDECALL;
  try {
    for (const key of ['TE_DISABLE', 'TE_SIDECALL']) {
      delete process.env.TE_DISABLE;
      delete process.env.TE_SIDECALL;
      process.env[key] = ' YES ';
      assert.deepEqual(await tokenEconomizer({} as PluginInput), {});
      assert.equal(process.listenerCount('exit'), before);
    }
  } finally {
    if (originalDisable === undefined) {
      delete process.env.TE_DISABLE;
    } else {
      process.env.TE_DISABLE = originalDisable;
    }
    if (originalSidecall === undefined) {
      delete process.env.TE_SIDECALL;
    } else {
      process.env.TE_SIDECALL = originalSidecall;
    }
  }
});

test('copied runtime serves OpenCode status without a checkout or installed Python package', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'tokeneconomizer-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const vendor = join(root, 'vendor');
  const project = join(root, 'project');
  await mkdir(project);
  await cp(new URL('../vendor/TokenEconomizer', import.meta.url), vendor, { recursive: true });
  const python = process.env.TE_PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
  const result = spawnSync(
    python,
    [join(vendor, 'plugin/scripts/te_bootstrap.py'), 'cli', '--host', 'opencode', 'status', '--json'],
    {
      cwd: project,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONNOUSERSITE: '1',
        TOKENECONOMIZER_HOME: join(root, 'state'),
        TE_MICROSKILLS: 'off',
        TE_LOOPGUARD: 'off',
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout) as { host: string; ledger: { sessions: number } };
  assert.equal(status.host, 'opencode');
  assert.equal(status.ledger.sessions, 0);
});
