import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));

test('workspace command builds reproducible portable artifacts that run without source or node_modules', async (t) => {
  const build = (timezone = 'UTC') => {
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'package:plugins'], {
      cwd: repository,
      encoding: 'utf8',
      env: { ...process.env, TZ: timezone },
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  const directory = join(repository, 'extensions', 'workflow');
  const archive = join(repository, 'extensions', 'workflow.zip');
  const first = await readFile(archive);
  const shipped = Object.fromEntries(
    await Promise.all((await readdir(directory)).map(async (name) => [name, await readFile(join(directory, name))])),
  );
  build();
  assert.deepEqual(await readFile(archive), first, 'committed ZIP is stale; run package:plugins');
  assert.deepEqual(await readdir(directory), Object.keys(shipped), 'committed artifact inventory is stale');
  for (const [name, bytes] of Object.entries(shipped)) {
    assert.deepEqual(await readFile(join(directory, name)), bytes, `${name}: committed artifact is stale`);
  }
  build('Pacific/Honolulu');
  assert.deepEqual(await readFile(archive), first, 'identical input must produce identical ZIP bytes across timezones');
  const require = createRequire(new URL('../packages/package.json', import.meta.url));
  const { unzipSync } = require('fflate');
  const zipped = unzipSync(first);
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
  assert.deepEqual(Object.keys(zipped).sort(), entries.map((name) => `workflow/${name}`).sort());
  for (const entry of entries) {
    assert.deepEqual(Buffer.from(zipped[`workflow/${entry}`]), await readFile(join(directory, entry)));
  }
  assert.ok(Object.keys(zipped).every((name) => name.startsWith('workflow/') && !name.includes('..')));
  assert.ok(Object.keys(zipped).every((name) => !name.includes('node_modules') && !name.endsWith('.tsx')));
  const root = await mkdtemp(join(tmpdir(), 'workflow artifact with spaces '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'workflow'));
  for (const [name, bytes] of Object.entries(zipped)) {
    await writeFile(join(root, name), bytes);
  }
  assert.deepEqual(await readdir(root), ['workflow']);
  const plugin = (await import(pathToFileURL(join(root, 'workflow', 'server.js')).href)).default;
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
    const local = config.plugin.filter((entry) => entry.startsWith('./extensions/'));
    assert.deepEqual(
      local,
      (name === 'opencode.jsonc' ? ['server'] : ['workflow', 'config', 'context', 'bookmarks']).map(
        (entry) => `./extensions/workflow/${entry}.js`,
      ),
    );
  }
});
