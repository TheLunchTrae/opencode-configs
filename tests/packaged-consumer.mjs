import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'opencode-packaged-consumer-'));
const consumer = join(root, 'consumer');
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: consumer, env: process.env, stdio: 'inherit' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
};
try {
  await cp(repository, consumer, {
    recursive: true,
    filter: (path) => !['.git', 'node_modules'].includes(basename(path)),
  });
  const manifestText = await readFile(join(consumer, 'package.json'), 'utf8');
  const lockText = await readFile(join(consumer, 'package-lock.json'), 'utf8');
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const packageDirectory = join(consumer, 'node_modules/@lunchbox-labs/opencode-config-composer');
  const unavailablePackage = join(root, 'unavailable-package');
  await rename(packageDirectory, unavailablePackage);
  try {
    run('npm', ['run', 'typecheck']);
    run('node', [
      '--experimental-strip-types',
      '--test',
      'tests/block-secrets.test.ts',
      'tests/compaction-task-state.test.ts',
      'tests/scrub-secrets.test.ts',
      'tests/session-tools.test.ts',
      'tests/tui-navigation.test.ts',
    ]);
    run(process.env.BUN_BIN ?? 'bun', [
      'test',
      '--preload',
      '@opentui/solid/preload',
      './tests/bookmarks-view.native.ts',
    ]);
  } finally {
    await rename(unavailablePackage, packageDirectory);
  }
  console.log('Local extensions work without Config Composer in module resolution.');
  run('npm', ['run', 'check']);
  run('npm', ['run', 'test:native:minimum']);
  run('npm', ['run', 'test:native']);
  assert.equal(await readFile(join(consumer, 'package.json'), 'utf8'), manifestText);
  assert.equal(await readFile(join(consumer, 'package-lock.json'), 'utf8'), lockText);
} finally {
  await rm(root, { recursive: true, force: true });
}
