import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Install the shipped lockfile from npm in disposable state, without replacing package dependencies.
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
  const manifest = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies['@lunchbox-labs/opencode-config-composer'], '0.0.3');
  assert.equal(manifest.dependencies['@lunchbox-labs/opencode-prompt-composer'], '0.0.2');
  assert.equal(manifest.dependencies['opencode-config-composer'], undefined);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  const installed = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-config-composer/package.json'), 'utf8'),
  );
  assert.equal(installed.name, '@lunchbox-labs/opencode-config-composer');
  assert.equal(installed.version, '0.0.3');
  const prompt = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-prompt-composer/package.json'), 'utf8'),
  );
  assert.equal(prompt.version, '0.0.2');
  assert.equal(prompt.dependencies[installed.name], undefined, 'Prompt Composer must remain independent');
  assert.equal(installed.dependencies[prompt.name], undefined, 'Config Composer must remain independent');
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
  assert.ok(schema.properties.profiles);
  assert.equal(schema.properties.agent, undefined);
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
    run('npm', ['run', 'typecheck']);
    run('node', [
      '--experimental-strip-types',
      '--test',
      'tests/block-secrets.test.ts',
      'tests/session-tools.test.ts',
      'tests/tui-navigation.test.ts',
      'tests/workflow-timeline.test.ts',
    ]);
    run(process.env.BUN_BIN ?? 'bun', [
      'test',
      '--preload',
      '@opentui/solid/preload',
      './tests/workflow-view.native.ts',
    ]);
  } finally {
    await rename(unavailablePackage, packageDirectory);
  }
  console.log('Local extension type and behavior checks passed with Config Composer unavailable to module resolution.');
  run('npm', ['run', 'check']);
  run('npm', ['run', 'test:native']);
  console.log(
    'Published Config Composer 0.0.3 and Prompt Composer 0.0.2 passed together in an isolated registry consumer.',
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
