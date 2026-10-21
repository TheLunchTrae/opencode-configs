import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));

test('workspace command packs reproducible offline-installable artifacts without source or workspace dependencies', async (t) => {
  const build = (timezone = 'UTC') => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'package:plugins'], {
      cwd: repository,
      encoding: 'utf8',
      env: { ...process.env, TZ: timezone },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const archive = join(repository, 'extensions', 'workflow.tgz');
  const first = await readFile(archive);
  const lock = JSON.parse(await readFile(join(repository, 'package-lock.json'), 'utf8'));
  assert.equal(
    lock.packages['node_modules/@lunchbox-labs/opencode-workflow'].integrity,
    `sha512-${createHash('sha512').update(first).digest('base64')}`,
    'Refresh the root lockfile after packing changed source',
  );
  build();
  assert.deepEqual(await readFile(archive), first, 'committed tarball is stale; run package:plugins');
  build('Pacific/Honolulu');
  assert.deepEqual(
    await readFile(archive),
    first,
    'identical input must produce identical tarball bytes across timezones',
  );
  const entries = [
    'bookmarks.js',
    'config.js',
    'context.js',
    'server.js',
    'workflow.js',
    'package.json',
    'LICENSE',
    'THIRD-PARTY-NOTICES.txt',
  ];
  const root = await mkdtemp(join(tmpdir(), 'workflow artifact with spaces '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'extensions'));
  await copyFile(archive, join(root, 'extensions', 'workflow.tgz'));
  const manifest = JSON.parse(await readFile(join(repository, 'package.json'), 'utf8'));
  const name = '@lunchbox-labs/opencode-workflow';
  assert.equal(manifest.dependencies[name], 'file:extensions/workflow.tgz');
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ private: true, dependencies: { [name]: manifest.dependencies[name] } }),
  );
  await writeFile(join(root, '.npmrc'), 'registry=http://127.0.0.1:1\n');
  // A fresh empty cache and offline install prove this package needs no registry dependencies or install scripts.
  const result = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      join(root, 'cache'),
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const directory = join(root, 'node_modules', name);
  assert.deepEqual((await readdir(directory)).sort(), entries.sort());
  const installed = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  assert.equal(installed.private, true);
  assert.equal(installed.dependencies, undefined);
  assert.equal(installed.scripts, undefined);
  assert.match(await readFile(join(directory, 'LICENSE'), 'utf8'), /GNU GENERAL PUBLIC LICENSE/);
  assert.match(await readFile(join(directory, 'THIRD-PARTY-NOTICES.txt'), 'utf8'), /Zod/);
  const plugin = (await import(pathToFileURL(join(directory, 'server.js')).href)).default;
  assert.equal(plugin.id, 'workflow-status');
  const hooks = await plugin.server({});
  await hooks.config({ agent: { lead: { mode: 'primary' }, child: { mode: 'subagent' } } });
  const context = { agent: 'lead', abort: new AbortController().signal };
  const report = await hooks.tool.workflow_status.execute({ stage: 'review', summary: 'Artifact report' }, context);
  assert.deepEqual(report.metadata.workflowPanel, {
    version: 1,
    stage: 'review',
    summary: 'Artifact report',
    agent: 'lead',
  });
  await assert.rejects(
    hooks.tool.workflow_status.execute(
      { stage: 'review', summary: 'Denied' },
      {
        ...context,
        agent: 'child',
      },
    ),
    /Only a configured primary lead/,
  );
  for (const name of ['opencode.jsonc', 'tui.jsonc']) {
    const config = JSON.parse(await readFile(join(repository, name), 'utf8'));
    const local = config.plugin.filter((entry) => entry.includes('opencode-workflow'));
    assert.deepEqual(
      local,
      (name === 'opencode.jsonc' ? ['server'] : ['workflow', 'config', 'context', 'bookmarks']).map(
        (entry) => `./node_modules/@lunchbox-labs/opencode-workflow/${entry}.js`,
      ),
    );
  }
});
