import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  defaultPackagesDirectory,
  parseCacheEntry,
  refreshTaggedPackages,
  registryDistTags,
} from '../extensions/plugin-cache/refresh.ts';

async function packagesFixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'plugin-cache-refresh-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const install = async (entry: string, name: string, version: string) => {
    const directory = join(root, ...entry.split('/'), 'node_modules', ...name.split('/'));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify({ name, version }));
  };
  return { root, install };
}

const exists = async (directory: string, entry: string) => (await readdir(directory)).includes(entry);

test('cache entries are parsed only for dist-tag specs', () => {
  assert.deepEqual(parseCacheEntry('plugin@latest'), { name: 'plugin', tag: 'latest' });
  assert.deepEqual(parseCacheEntry('@scope/plugin@next'), { name: '@scope/plugin', tag: 'next' });
  assert.deepEqual(parseCacheEntry('plugin@beta.2'), { name: 'plugin', tag: 'beta.2' });
  for (const entry of [
    'plugin',
    '@scope/plugin',
    'plugin@1.2.3',
    'plugin@^1.2.0',
    'plugin@~1',
    'plugin@v1.2',
    'plugin@x',
    'plugin@X.1',
    'plugin@*',
    'plugin@>=1',
    'alias@npm:plugin@1.0.0',
    'plugin@github:owner/repo',
    '.stale',
  ]) {
    assert.equal(parseCacheEntry(entry), undefined, entry);
  }
});

test('the default cache directory follows XDG_CACHE_HOME', () => {
  assert.equal(defaultPackagesDirectory({ XDG_CACHE_HOME: '/cache' }), join('/cache', 'opencode', 'packages'));
});

test('tagged packages with a newer tag version are removed and others are kept', async (t) => {
  const { root, install } = await packagesFixture(t);
  await install('stale@latest', 'stale', '1.0.0');
  await install('current@latest', 'current', '2.0.0');
  await install('@scope/scoped@next', '@scope/scoped', '3.0.0-next.1');
  await install('pinned@1.0.0', 'pinned', '1.0.0');
  await install('ranged@^1.0.0', 'ranged', '1.0.0');
  await install('missing-tag@canary', 'missing-tag', '0.1.0');
  await mkdir(join(root, 'incomplete@latest'));
  const requested: string[] = [];
  const tags: Record<string, Record<string, string>> = {
    stale: { latest: '1.1.0' },
    current: { latest: '2.0.0' },
    '@scope/scoped': { latest: '2.0.0', next: '3.0.0-next.2' },
    pinned: { latest: '9.0.0' },
    ranged: { latest: '1.9.0' },
    'missing-tag': { latest: '1.0.0' },
  };
  const refreshed = await refreshTaggedPackages({
    packagesDirectory: root,
    fetchDistTags: (name) => {
      requested.push(name);
      return Promise.resolve(tags[name]);
    },
    warn: () => assert.fail('No warning expected'),
  });
  assert.deepEqual(
    refreshed.map((entry) => [entry.name, entry.tag, entry.installedVersion, entry.availableVersion]).sort(),
    [
      ['@scope/scoped', 'next', '3.0.0-next.1', '3.0.0-next.2'],
      ['stale', 'latest', '1.0.0', '1.1.0'],
    ],
  );
  assert.deepEqual(requested.sort(), ['@scope/scoped', 'current', 'missing-tag', 'stale']);
  assert.equal(await exists(root, 'stale@latest'), false);
  assert.equal(await exists(join(root, '@scope'), 'scoped@next'), false);
  for (const kept of ['current@latest', 'pinned@1.0.0', 'ranged@^1.0.0', 'missing-tag@canary', 'incomplete@latest']) {
    assert.equal(await exists(root, kept), true, kept);
  }
  assert.deepEqual(await readdir(join(root, '.stale')), []);
});

test('registry failures keep the cached package and report a warning', async (t) => {
  const { root, install } = await packagesFixture(t);
  await install('offline@latest', 'offline', '1.0.0');
  await install('unknown@latest', 'unknown', '1.0.0');
  const warnings: unknown[] = [];
  const refreshed = await refreshTaggedPackages({
    packagesDirectory: root,
    fetchDistTags: (name) => (name === 'offline' ? Promise.reject(new Error('offline')) : Promise.resolve(undefined)),
    warn: (_message, extra) => {
      warnings.push(extra);
    },
  });
  assert.deepEqual(refreshed, []);
  assert.deepEqual(warnings, [{ package: 'offline@latest', error: 'offline' }]);
  assert.equal(await exists(root, 'offline@latest'), true);
  assert.equal(await exists(root, 'unknown@latest'), true);
});

test('a missing cache directory refreshes nothing', async () => {
  const refreshed = await refreshTaggedPackages({
    packagesDirectory: join(tmpdir(), `plugin-cache-refresh-missing-${process.pid}-${Date.now()}`),
    fetchDistTags: () => assert.fail('No registry request expected'),
    warn: () => assert.fail('No warning expected'),
  });
  assert.deepEqual(refreshed, []);
});

test('registry dist-tags are read from the abbreviated packument', async (t) => {
  const requests: { url: string | undefined; accept: string | undefined }[] = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, accept: request.headers.accept });
    if (request.url === '/@scope%2fplugin') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ name: '@scope/plugin', 'dist-tags': { latest: '1.2.3', broken: 4 } }));
      return;
    }
    response.statusCode = 404;
    response.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  const fetchDistTags = registryDistTags(`http://127.0.0.1:${String(address.port)}`);
  assert.deepEqual(await fetchDistTags('@scope/plugin'), { latest: '1.2.3' });
  assert.equal(await fetchDistTags('missing'), undefined);
  assert.equal(requests[0]?.accept, 'application/vnd.npm.install-v1+json');
});
