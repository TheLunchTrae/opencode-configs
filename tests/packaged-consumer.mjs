import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Install the published packages from the shipped registry lockfile in disposable state.
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
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.dependencies['@lunchbox-labs/opencode-config-composer'], '0.1.0');
  assert.equal(manifest.dependencies['@lunchbox-labs/opencode-prompt-composer'], '0.1.0');
  assert.equal(manifest.dependencies['opencode-config-composer'], undefined);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  assert.equal(await readFile(join(consumer, 'package.json'), 'utf8'), manifestText);
  assert.equal(await readFile(join(consumer, 'package-lock.json'), 'utf8'), lockText);
  const installed = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-config-composer/package.json'), 'utf8'),
  );
  assert.equal(installed.name, '@lunchbox-labs/opencode-config-composer');
  assert.equal(installed.version, '0.1.0');
  const prompt = JSON.parse(
    await readFile(join(consumer, 'node_modules/@lunchbox-labs/opencode-prompt-composer/package.json'), 'utf8'),
  );
  assert.equal(prompt.name, '@lunchbox-labs/opencode-prompt-composer');
  assert.equal(prompt.version, '0.1.0');
  assert.equal(prompt.dependencies?.[installed.name], undefined, 'Prompt Composer must remain independent');
  assert.deepEqual(prompt.dependencies ?? {}, {}, 'Include-only Prompt Composer has no runtime dependencies');
  assert.equal(prompt.exports['./schema.json'], undefined);
  assert.equal(prompt.exports['./editor'], undefined);
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
  assert.ok(schema.properties.agent);
  assert.ok(schema.properties.command);
  assert.ok(schema.properties.groups);
  assert.ok(schema.properties.defaultProfile);
  for (const legacy of ['componentGroups', 'configurationPresets', 'profileShortcuts', 'selection']) {
    assert.equal(schema.properties[legacy], undefined, legacy);
  }
  assert.equal(manifest.engines.opencode, '1.19.x');
  assert.deepEqual(installed.engines, { node: '>=22.18.0' });
  assert.deepEqual(prompt.engines, { node: '>=22.18.0' });
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
  console.log('Local extension type and behavior checks passed with Config Composer unavailable to module resolution.');
  run('npm', ['run', 'check']);
  run('npm', ['run', 'test:native:minimum']);
  run('npm', ['run', 'test:native']);
  assert.equal(await readFile(join(consumer, 'package.json'), 'utf8'), manifestText);
  assert.equal(await readFile(join(consumer, 'package-lock.json'), 'utf8'), lockText);
  console.log(
    'Published Config Composer 0.1.0 and Prompt Composer 0.1.0 passed together at the minimum and current native versions; manifest and lock bytes are unchanged.',
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
