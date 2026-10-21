import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { nativeBinary } from './native-host.ts';

const repository = fileURLToPath(new URL('../', import.meta.url));
const fixtureName = '@private-resolution-probe/workflow-unpublished';
const workflowName = '@lunchbox-labs/opencode-workflow';

// Do not inherit credentials, user npm configuration, or provider configuration.
function environment(root, registry = 'https://registry.npmjs.org') {
  const keys = [
    'PATH',
    'SystemRoot',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'NO_PROXY',
    'NODE_EXTRA_CA_CERTS',
    'SSL_CERT_FILE',
    'SSL_CERT_DIR',
  ];
  return {
    ...Object.fromEntries(keys.filter((key) => process.env[key]).map((key) => [key, process.env[key]])),
    NO_PROXY: [process.env.NO_PROXY, '127.0.0.1', 'localhost'].filter(Boolean).join(','),
    HOME: root,
    APPDATA: join(root, 'appdata'),
    LOCALAPPDATA: join(root, 'localappdata'),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: 'C.UTF-8',
    npm_config_userconfig: join(root, 'empty-npmrc'),
    npm_config_globalconfig: join(root, 'empty-global-npmrc'),
    npm_config_cache: join(root, 'npm-cache'),
    npm_config_registry: registry,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_fetch_retries: '0',
    npm_config_update_notifier: 'false',
    OPENCODE_TEST_HOME: root,
    XDG_DATA_HOME: join(root, 'data'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_STATE_HOME: join(root, 'state'),
    OPENCODE_DB: join(root, 'db.sqlite'),
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_PROJECT_CONFIG: '1',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
  };
}

async function npm(args, cwd, env) {
  assert.ok(process.env.npm_execpath, 'Run native tests through npm');
  const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const [code] = await once(child, 'close');
  assert.equal(code, 0, `npm ${args.join(' ')} failed: ${stderr}`);
  return stdout;
}

async function observe(binary, kind, project, env) {
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  const child =
    kind === 'server'
      ? spawn(binary, ['debug', 'config', '--print-logs'], { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] })
      : spawn('script', ['-q', '-c', `${quote(binary)} --print-logs`, '/dev/null'], {
          cwd: project,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: true,
        });
  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk;
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk;
  });
  try {
    for (let attempt = 0; attempt < 400; attempt++) {
      try {
        return JSON.parse(await readFile(env.PROBE_MARKER, 'utf8'));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      if (child.exitCode !== null) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail(`Native ${kind} did not run the probe: ${logs}`);
  } finally {
    if (child.exitCode === null) {
      if (kind === 'tui') {
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill('SIGTERM');
      }
      await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2000))]);
      if (child.exitCode === null) {
        if (kind === 'tui') {
          process.kill(-child.pid, 'SIGKILL');
        } else {
          child.kill('SIGKILL');
        }
        await once(child, 'exit');
      }
    }
  }
}

test(
  'native plugin resolution distinguishes root tarballs from registry installation',
  { timeout: 180_000 },
  async (t) => {
    const binary = nativeBinary();
    const root = await mkdtemp(join(tmpdir(), 'opencode-resolution-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const setupEnv = environment(root);
    for (const [source, version] of [
      ['local', '1.0.0'],
      ['registry', '99.0.0'],
    ]) {
      const directory = join(root, source);
      await mkdir(directory);
      await writeFile(
        join(directory, 'package.json'),
        JSON.stringify({
          name: fixtureName,
          version,
          private: true,
          type: 'module',
          exports: { './server': './server.js', './tui': './tui.js' },
        }),
      );
      await writeFile(join(directory, 'resource.txt'), source);
      for (const kind of ['server', 'tui']) {
        await writeFile(
          join(directory, `${kind}.js`),
          `import {writeFileSync,readFileSync} from 'node:fs'; export default {id:'resolution-probe-${kind}', async ${kind}(){writeFileSync(process.env.PROBE_MARKER,JSON.stringify({source:readFileSync(new URL('./resource.txt',import.meta.url),'utf8'),url:import.meta.url}));return {};}};`,
        );
      }
      const packed = JSON.parse(await npm(['pack', '--json', '--ignore-scripts'], directory, setupEnv))[0];
      await cp(join(directory, packed.filename), join(root, `${source}.tgz`));
    }
    const bytes = await readFile(join(root, 'registry.tgz'));
    const requests = [];
    const registry = createServer((request, response) => {
      requests.push({ url: request.url, authenticated: Boolean(request.headers.authorization) });
      if (request.url === '/package.tgz') {
        response.end(bytes);
        return;
      }
      if (decodeURIComponent(request.url).includes(fixtureName)) {
        response.setHeader('content-type', 'application/json');
        response.end(
          JSON.stringify({
            name: fixtureName,
            'dist-tags': { latest: '99.0.0' },
            versions: {
              '99.0.0': { name: fixtureName, version: '99.0.0', dist: { tarball: `${registryUrl}/package.tgz` } },
            },
          }),
        );
        return;
      }
      response.statusCode = 404;
      response.end('{}');
    });
    registry.listen(0, '127.0.0.1');
    await once(registry, 'listening');
    t.after(() => new Promise((resolve) => registry.close(resolve)));
    const registryUrl = `http://127.0.0.1:${registry.address().port}`;
    const template = join(root, 'template');
    await mkdir(template);
    await writeFile(
      join(template, 'package.json'),
      JSON.stringify({
        private: true,
        dependencies: {
          [fixtureName]: `file:${join(root, 'local.tgz')}`,
          '@opencode-ai/plugin': process.env.OPENCODE_NATIVE_VERSION,
        },
      }),
    );
    // Public setup dependency only. Every OpenCode run below has fresh caches and a loopback-only registry.
    await npm(['install', '--ignore-scripts'], template, setupEnv);
    const hasPty =
      process.platform === 'linux' && spawnSync('script', ['--version'], { encoding: 'utf8' }).status === 0;
    for (const kind of ['server', 'tui']) {
      for (const mode of ['bare', 'file']) {
        await t.test(
          `${kind}: ${mode} registration`,
          { skip: kind === 'tui' && !hasPty ? 'Native TUI probe requires Linux util-linux script' : false },
          async () => {
            const directory = join(root, `${kind}-${mode}`);
            const config = join(directory, 'config', 'opencode');
            const project = join(directory, 'project');
            await mkdir(config, { recursive: true });
            await mkdir(project);
            await cp(template, config, { recursive: true });
            const spec = mode === 'bare' ? fixtureName : `./node_modules/${fixtureName}/${kind}.js`;
            await writeFile(
              join(config, 'opencode.json'),
              JSON.stringify({ plugin: kind === 'server' ? [spec] : [], enabled_providers: [] }),
            );
            await writeFile(join(config, 'tui.json'), JSON.stringify({ plugin: kind === 'tui' ? [spec] : [] }));
            const env = { ...environment(directory, registryUrl), PROBE_MARKER: join(directory, 'marker.json') };
            const before = requests.length;
            const observed = await observe(binary, kind, project, env);
            const hits = requests.slice(before);
            assert.equal(observed.source, mode === 'bare' ? 'registry' : 'local');
            assert.ok(
              observed.url.includes(mode === 'bare' ? '/cache/opencode/packages/' : '/config/opencode/node_modules/'),
            );
            if (mode === 'bare') {
              assert.ok(hits.some((hit) => decodeURIComponent(hit.url).includes(fixtureName)));
              assert.ok(hits.some((hit) => hit.url === '/package.tgz'));
            } else {
              assert.deepEqual(hits, [], 'Installed-file resolution must not query the registry');
            }
            assert.ok(hits.every((hit) => !hit.authenticated));
          },
        );
      }
    }
    await t.test(
      'installed workflow entries activate in the real TUI',
      { skip: !hasPty ? 'Native TUI probe requires Linux util-linux script' : false },
      async () => {
        const directory = join(root, 'workflow');
        const config = join(directory, 'config', 'opencode');
        const project = join(directory, 'project');
        await mkdir(config, { recursive: true });
        await mkdir(project);
        await cp(template, config, { recursive: true });
        const manifest = JSON.parse(await readFile(join(config, 'package.json'), 'utf8'));
        manifest.dependencies[workflowName] = `file:${join(repository, 'extensions', 'workflow.tgz')}`;
        await writeFile(join(config, 'package.json'), JSON.stringify(manifest));
        const env = { ...environment(directory, registryUrl), PROBE_MARKER: join(directory, 'marker.json') };
        await npm(['install', '--offline', '--ignore-scripts'], config, env);
        const prefix = `./node_modules/${workflowName}/`;
        await writeFile(
          join(config, 'opencode.json'),
          JSON.stringify({ plugin: [`${prefix}server.js`], enabled_providers: [] }),
        );
        await writeFile(
          join(config, 'tui.json'),
          JSON.stringify({
            plugin: ['workflow', 'config', 'context', 'bookmarks']
              .map((entry) => `${prefix}${entry}.js`)
              .concat('./audit.js'),
          }),
        );
        await writeFile(
          join(config, 'audit.js'),
          "import {writeFileSync} from 'node:fs'; export default {id:'workflow-audit',async tui(api){writeFileSync(process.env.PROBE_MARKER,JSON.stringify(api.plugins.list()));}};",
        );
        const before = requests.length;
        const records = await observe(binary, 'tui', project, env);
        const workflow = records.filter((record) => record.spec.includes(`/node_modules/${workflowName}/`));
        assert.deepEqual(
          workflow.map((record) => record.id),
          ['workflow-panel', 'effective-config', 'context-inspector', 'session-bookmarks'],
        );
        assert.ok(workflow.every((record) => record.active && record.enabled && record.source === 'file'));
        assert.deepEqual(requests.slice(before), [], 'Installed workflow must not query the registry');
      },
    );
  },
);
