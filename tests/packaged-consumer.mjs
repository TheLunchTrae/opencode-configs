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
  assert.equal(manifest.dependencies['@lunchbox-labs/opencode-config-composer'], '0.0.0');
  assert.equal(manifest.dependencies['opencode-config-composer'], undefined);
  manifest.dependencies['@lunchbox-labs/opencode-config-composer'] = `file:${artifact}`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const installed = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-config-composer/package.json'), 'utf8'),
  );
  assert.equal(installed.name, '@lunchbox-labs/opencode-config-composer');
  assert.equal(installed.version, '0.0.1');
  assert.equal(installed.license, 'MIT');
  assert.match(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-config-composer/LICENSE'), 'utf8'),
    /^MIT License\n\nCopyright \(c\) 2026 Lunchbox Labs\n/,
  );
  assert.deepEqual(Object.keys(installed.exports), ['.', './server', './tui', './schema.json']);
  assert.equal(installed.exports['./schema.json'], './schema.json');
  const schema = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-config-composer/schema.json'), 'utf8'),
  );
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties.agent);
  const cli = spawnSync(process.env.OPENCODE_BIN ?? 'opencode', ['--version'], {
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_DATA_HOME: join(root, 'data'),
      XDG_STATE_HOME: join(root, 'state'),
      XDG_CACHE_HOME: join(root, 'cache'),
      OPENCODE_TEST_HOME: root,
      OPENCODE_DB: join(root, 'db.sqlite'),
      OPENCODE_DISABLE_AUTOUPDATE: '1',
    },
  });
  assert.ifError(cli.error);
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout.trim(), installed.engines.opencode, 'native CLI must match the package host baseline');
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
