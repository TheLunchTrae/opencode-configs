import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import typescript from '@babel/preset-typescript';
import solid from 'babel-preset-solid';
import { build } from 'esbuild';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const repository = resolve(workspace, '..');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await json(resolve(workspace, 'package.json'));
// These specifiers are supplied by OpenCode 1.19's OpenTUI runtime bridge.
const external = [
  'solid-js',
  'solid-js/store',
  '@opentui/core',
  '@opentui/solid',
  '@opentui/solid/components',
  '@opentui/solid/jsx-runtime',
  '@opentui/solid/jsx-dev-runtime',
  '@opentui/keymap',
];
const safeName = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
const destinations = new Set();
assert.ok(Array.isArray(manifest.workspaces), 'List plugin package directories explicitly in workspaces');
for (const directory of [...manifest.workspaces].sort()) {
  assert.ok(safeName(directory), 'Workspace paths must be immediate package directories');
  const root = resolve(workspace, directory);
  const pkg = await json(resolve(root, 'package.json'));
  const artifact = pkg.opencodeArtifact;
  assert.equal(pkg.private, true, `${directory}: local packages must be private`);
  assert.ok(artifact && safeName(artifact.directory), `${directory}: missing artifact directory`);
  assert.ok(!destinations.has(artifact.directory), 'Artifact directories must be unique');
  destinations.add(artifact.directory);
  assert.ok(artifact.entries && Object.keys(artifact.entries).length > 0, 'Declare plugin entries');
  const entries = {};
  for (const [name, source] of Object.entries(artifact.entries)) {
    assert.ok(safeName(name) && typeof source === 'string', 'Invalid plugin entry');
    const path = resolve(root, source);
    const local = relative(root, path);
    assert.ok(local && !local.startsWith('..') && !isAbsolute(local), 'Entry must stay inside its package');
    entries[name] = path;
  }
  const output = resolve(repository, 'extensions', artifact.directory);
  const result = await build({
    absWorkingDir: root,
    entryPoints: entries,
    outdir: output,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    external,
    write: false,
    metafile: true,
    legalComments: 'eof',
    plugins: [
      {
        name: 'opentui-solid',
        setup(builder) {
          builder.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
            const result = await transformAsync(await readFile(path, 'utf8'), {
              filename: path,
              configFile: false,
              babelrc: false,
              presets: [[solid, { moduleName: '@opentui/solid', generate: 'universal' }], typescript],
            });
            assert.ok(result?.code, `No transformed code for ${path}`);
            return { contents: result.code, loader: 'js', resolveDir: dirname(path) };
          });
        },
      },
    ],
  });
  for (const record of Object.values(result.metafile.outputs)) {
    for (const item of record.imports) {
      assert.ok(
        item.external && (external.includes(item.path) || item.path.startsWith('node:')),
        `Unexpected runtime dependency: ${item.path}`,
      );
    }
  }
  const files = Object.fromEntries(
    result.outputFiles.map((file) => [relative(output, file.path).replaceAll('\\', '/'), file.contents]),
  );
  files['package.json'] = Buffer.from(
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        private: true,
        type: 'module',
        license: pkg.license,
        engines: pkg.engines,
        exports: Object.fromEntries(Object.keys(entries).map((name) => [`./${name}`, `./${name}.js`])),
      },
      null,
      2,
    ) + '\n',
  );
  // Each package owns its resource allowlist, including notices for bundled dependencies.
  for (const [name, source] of Object.entries(artifact.resources ?? {})) {
    assert.ok(/^[A-Z0-9][\w.-]*$/i.test(name) && !Object.hasOwn(files, name), 'Invalid resource name');
    assert.equal(typeof source, 'string', 'Resource paths must be strings');
    const path = resolve(root, source);
    const local = relative(repository, path);
    assert.ok(local && !local.startsWith('..') && !isAbsolute(local), 'Resources must stay inside the repository');
    files[name] = await readFile(path);
  }
  const staged = await mkdtemp(resolve(tmpdir(), 'opencode-plugin-pack-'));
  try {
    for (const name of Object.keys(files).sort()) {
      await writeFile(resolve(staged, name), files[name]);
    }
    assert.ok(process.env.npm_execpath, 'Run package:plugins through npm');
    const packed = spawnSync(
      process.execPath,
      [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts', '--offline'],
      {
        cwd: staged,
        encoding: 'utf8',
      },
    );
    assert.ifError(packed.error);
    assert.equal(packed.status, 0, packed.stderr);
    const [info] = JSON.parse(packed.stdout);
    assert.deepEqual(info.files.map((file) => file.path).sort(), Object.keys(files).sort(), 'Unexpected packed files');
    await mkdir(dirname(output), { recursive: true });
    await copyFile(resolve(staged, info.filename), `${output}.tgz`);
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
  console.log(`Packed ${pkg.name}: ${relative(repository, output)}.tgz`);
}
