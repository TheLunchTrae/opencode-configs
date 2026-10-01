import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only the disposable fixture receives a tarball dependency. Production references stay provisional.
const tarball = process.env.COMPOSER_TARBALL;
assert.ok(tarball, 'Set COMPOSER_TARBALL to the absolute path of the packed extraction artifact.');
assert.ok(tarball.endsWith('.tgz'), 'COMPOSER_TARBALL must name an npm tarball.');
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
  const artifact = join(root, 'composer.tgz');
  await cp(resolve(tarball), artifact);
  const manifestPath = join(consumer, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.dependencies['opencode-config-composer-name-tbd'] = `file:${artifact}`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const installed = JSON.parse(
    await readFile(join(consumer, 'node_modules/opencode-config-composer-name-tbd/package.json'), 'utf8'),
  );
  assert.equal(installed.name, 'opencode-config-composer-name-tbd');
  assert.equal(installed.version, '0.0.0');
  const packageDirectory = join(consumer, 'node_modules', installed.name);
  const unavailablePackage = join(root, 'unavailable-package');
  await rename(packageDirectory, unavailablePackage);
  try {
    run('npm', ['run', 'check']);
    run(process.env.BUN_BIN ?? 'bun', [
      'test',
      '--preload',
      '@opentui/solid/preload',
      './tests/workflow-view.native.ts',
    ]);
  } finally {
    await rename(unavailablePackage, packageDirectory);
  }
  console.log('Local extensions and their complete checks passed with Composer unavailable to module resolution.');
  run('npm', ['run', 'test:native']);
  console.log('Packed consumer checks passed in an isolated fixture. Registry installation was not tested.');
} finally {
  await rm(root, { recursive: true, force: true });
}
