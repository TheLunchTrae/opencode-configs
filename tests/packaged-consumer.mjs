import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only the disposable fixture receives a tarball dependency. Production references use the selected npm name.
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
  assert.equal(manifest.dependencies['@lunchbox/opencode-config-composer'], '0.0.0');
  assert.equal(manifest.dependencies['opencode-config-composer'], undefined);
  manifest.dependencies['@lunchbox/opencode-config-composer'] = `file:${artifact}`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const installed = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox/opencode-config-composer/package.json'), 'utf8'),
  );
  assert.equal(installed.name, '@lunchbox/opencode-config-composer');
  assert.equal(installed.version, '0.0.0');
  assert.deepEqual(Object.keys(installed.exports), ['.', './server', './tui']);
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
