import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { loadSnapshot, planChange, reloadConfiguration, savePlan } from '../extensions/config-composer/storage.ts';

// Real V1 configuration loading, provider dispatch, and cache invalidation; only the remote model is synthetic.
test(
  'OpenCode composes ordered groups and prompts from dedicated settings and dispatches changes after reload',
  { timeout: 120_000 },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'opencode-groups-native-'));
    const runtime: { child?: ChildProcess; exited?: Promise<unknown> } = {};
    t.after(async () => {
      runtime.child?.kill();
      const forceStop = globalThis.setTimeout(() => runtime.child?.kill('SIGKILL'), 3000);
      forceStop.unref();
      await runtime.exited;
      globalThis.clearTimeout(forceStop);
      runtime.child?.stdout?.destroy();
      runtime.child?.stderr?.destroy();
      await rm(root, { recursive: true, force: true });
    });
    const configRoot = join(root, 'config', 'opencode');
    const project = join(root, 'project');
    const repo = fileURLToPath(new URL('../', import.meta.url));
    await mkdir(join(configRoot, 'agents'), { recursive: true });
    await mkdir(join(configRoot, 'shared-prompts'));
    await mkdir(project);
    await cp(join(repo, 'extensions'), join(configRoot, 'extensions'), { recursive: true });
    const dependencies = await realpath(join(repo, 'node_modules'));
    await cp(dependencies, join(configRoot, 'node_modules'), { recursive: true });
    await cp(join(dirname(dependencies), 'package.json'), join(configRoot, 'package.json'));
    await cp(join(dirname(dependencies), 'package-lock.json'), join(configRoot, 'package-lock.json'));

    const requests: Record<string, unknown>[] = [];
    const provider = createServer((request, response) => {
      const reply = async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          assert.ok(Buffer.isBuffer(chunk));
          chunks.push(chunk);
        }
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString());
        assert.ok(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed));
        const body = parsed as Record<string, unknown>;
        requests.push(body);
        const base = { id: 'synthetic-response', model: body.model, created: 1 };
        const streaming = Boolean(body.stream);
        if (streaming) {
          response.writeHead(200, { 'Content-Type': 'text/event-stream' });
          response.write(
            `data: ${JSON.stringify({
              ...base,
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { role: 'assistant', content: 'verified' }, finish_reason: null }],
            })}\n\n`,
          );
          response.end(
            `data: ${JSON.stringify({
              ...base,
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            })}\n\ndata: [DONE]\n\n`,
          );
        } else {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              ...base,
              object: 'chat.completion',
              choices: [{ index: 0, message: { role: 'assistant', content: 'verified' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          );
        }
      };
      reply().catch((error: unknown) => {
        response.statusCode = 500;
        response.end(String(error));
      });
    });
    provider.listen(0, '127.0.0.1');
    await once(provider, 'listening');
    t.after(() => {
      provider.closeAllConnections();
      provider.close();
    });
    const address = provider.address();
    assert.ok(address !== null && typeof address !== 'string');
    const model = {
      name: 'Synthetic model',
      limit: { context: 8192, output: 256 },
      variants: { low: { reasoningEffort: 'low' }, high: { reasoningEffort: 'high' } },
    };
    const config = {
      plugin: [['./extensions/config-composer/server.ts', { configFile: './config-composer.jsonc' }]],
      model: 'fixture/alpha',
      small_model: 'fixture/alpha',
      default_agent: 'worker',
      enabled_providers: ['fixture'],
      provider: {
        fixture: {
          name: 'Fixture',
          npm: '@ai-sdk/openai-compatible',
          options: { baseURL: `http://127.0.0.1:${address.port}/v1`, apiKey: 'synthetic-test-key' },
          models: { alpha: model, beta: model },
        },
      },
      agent: {
        pinned: { mode: 'subagent', groups: ['base', 'developers'], model: 'fixture/alpha', variant: 'high' },
        'main-follower': { mode: 'primary', groups: ['primary'], prompt: 'Reply briefly.' },
        'small-follower': { mode: 'primary', groups: ['small'], prompt: 'Reply briefly.' },
        compaction: { groups: ['base'] },
      },
    };
    const composer = {
      sourceDirectories: { shared: './shared-prompts' },
      agent: {
        modelPresets: { balanced: { model: 'fixture/alpha', variant: 'low' } },
        prompts: { defaults: { append: ['{{include:@shared/default.md}}'] } },
        groups: {
          base: { model: 'fixture/beta', variant: 'high' },
          developers: { modelRef: 'preset:balanced', prompt: { append: ['GROUP_GUIDANCE'] } },
          primary: { modelRef: 'opencode:model', variant: 'low' },
          small: { modelRef: 'opencode:small_model', variant: 'low' },
        },
      },
      command: {},
      skill: {},
    };
    await writeFile(
      join(configRoot, 'config-composer.jsonc'),
      `// Dedicated settings\n${JSON.stringify(composer, null, 2)}\n`,
    );
    await writeFile(join(configRoot, 'shared-prompts/default.md'), 'GLOBAL_GUIDANCE');
    await writeFile(join(configRoot, 'shared-prompts/worker.md'), 'INITIAL_WORKER_GUIDANCE');
    await writeFile(
      join(configRoot, 'opencode.jsonc'),
      `// Native integration fixture\n${JSON.stringify(config, null, 2)}\n`,
    );
    await writeFile(
      join(configRoot, 'agents/worker.md'),
      '---\nmode: primary\ngroups: [base, developers]\n---\nReply briefly.\n{{include:@shared/worker.md}}\n',
    );
    await writeFile(join(configRoot, 'tui.jsonc'), JSON.stringify({ plugin: ['./extensions/config-composer/tui.ts'] }));
    await writeFile(
      join(project, 'opencode.json'),
      JSON.stringify({ model: 'fixture/beta', small_model: 'fixture/beta' }),
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_DATA_HOME: join(root, 'data'),
      XDG_STATE_HOME: join(root, 'state'),
      XDG_CACHE_HOME: join(root, 'cache'),
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_MODELS_FETCH: '1',
      OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
      OPENCODE_TEST_HOME: root,
      OPENCODE_CONFIG: '',
      OPENCODE_CONFIG_CONTENT: '',
      OPENCODE_SERVER_PASSWORD: '',
      OPENCODE_DB: join(root, 'db.sqlite'),
    };
    delete env.OPENCODE_CONFIG_DIR;
    delete env.OPENCODE_DISABLE_PROJECT_CONFIG;
    const child = spawn(
      process.env.OPENCODE_BIN ?? 'opencode',
      ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs'],
      { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    runtime.child = child;
    runtime.exited = once(child, 'exit').catch(() => undefined);
    let output = '';
    let launchError: Error | undefined;
    child.on('error', (error) => {
      launchError = error;
    });
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });
    let baseURL: string | undefined;
    for (let attempt = 0; attempt < 200; attempt++) {
      if (launchError !== undefined) {
        throw launchError;
      }
      baseURL = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
      if (baseURL !== undefined) {
        break;
      }
      if (child.exitCode !== null) {
        throw new Error(`OpenCode exited: ${output}`);
      }
      await setTimeout(100);
    }
    assert.ok(baseURL !== undefined && baseURL.length > 0, `OpenCode did not start: ${output}`);
    const api = async <T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> => {
      const response = await fetch(`${baseURL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-opencode-directory': project },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }).catch((error: unknown) => {
        throw new Error(`${path}: ${String(error)}\n${output.slice(-6000)}`);
      });
      assert.ok(response.ok, `${path}: ${await response.clone().text()}`);
      const data: unknown = await response.json();
      return data as T;
    };
    interface Agent {
      name: string;
      model: { providerID: string; modelID: string };
      variant?: string;
      options: Record<string, unknown>;
      prompt?: string;
    }
    interface Message {
      info: { modelID: string; error?: unknown };
      parts: { type: string; text?: string }[];
    }
    const agents = await api<Agent[]>('/agent');
    const worker = agents.find((agent) => agent.name === 'worker');
    assert.ok(worker !== undefined);
    assert.deepEqual(worker.model, { providerID: 'fixture', modelID: 'alpha' });
    assert.equal(worker.variant, 'low');
    assert.deepEqual(worker.options.groups, ['base', 'developers']);
    assert.match(worker.prompt ?? '', /INITIAL_WORKER_GUIDANCE/);
    assert.match(worker.prompt ?? '', /GROUP_GUIDANCE/);
    assert.match(worker.prompt ?? '', /GLOBAL_GUIDANCE/);
    const compactionPrompt = agents.find((agent) => agent.name === 'compaction')?.prompt;
    assert.ok(typeof compactionPrompt === 'string' && compactionPrompt.length > 0);
    assert.ok(!compactionPrompt.includes('GLOBAL_GUIDANCE'), 'preserve the promptless built-in configuration');
    for (const name of ['main-follower', 'small-follower']) {
      assert.equal(
        agents.find((agent) => agent.name === name)?.model.modelID,
        'beta',
        'use project defaults, not global file values',
      );
    }
    const providers = await api<{ providers: { id: string; models: Record<string, unknown> }[] }>('/config/providers');
    assert.ok(Boolean(providers.providers.find((item) => item.id === 'fixture')?.models.beta));
    const request = async (agent = 'worker') => {
      const session = await api<{ id: string }>('/session', { title: 'Synthetic integration check' });
      const result = await api<Message>(`/session/${session.id}/message`, {
        agent,
        parts: [{ type: 'text', text: 'Reply with verified.' }],
      });
      assert.equal(result.info.error, undefined, JSON.stringify(result.info.error));
      assert.ok(result.parts.some((part) => part.type === 'text' && part.text === 'verified'));
      return result;
    };
    assert.equal((await request()).info.modelID, 'alpha');
    const beforeReload = requests.find((body) => JSON.stringify(body).includes('INITIAL_WORKER_GUIDANCE'));
    assert.ok(beforeReload !== undefined, 'send expanded prompt text to the provider');
    assert.ok(!JSON.stringify(beforeReload).includes('{{include:'), 'never send unresolved directives');
    assert.equal((await request('main-follower')).info.modelID, 'beta');
    assert.equal((await request('small-follower')).info.modelID, 'beta');
    await savePlan(
      planChange(await loadSnapshot(configRoot), {
        kind: 'preset',
        name: 'balanced',
        choice: { model: 'fixture/beta', variant: 'high' },
      }),
    );
    assert.deepEqual((await loadSnapshot(configRoot)).groups.developers, composer.agent.groups.developers);
    await writeFile(join(configRoot, 'shared-prompts/worker.md'), 'RELOADED_WORKER_GUIDANCE');
    await reloadConfiguration(await loadSnapshot(configRoot), async (plugin) => {
      await api('/global/config', { plugin }, 'PATCH');
    });
    let refreshed = agents;
    for (let attempt = 0; attempt < 100; attempt++) {
      refreshed = await api<Agent[]>('/agent');
      if (refreshed.find((agent) => agent.name === 'worker')?.model.modelID === 'beta') {
        break;
      }
      await setTimeout(100);
    }
    assert.equal(refreshed.find((agent) => agent.name === 'worker')?.model.modelID, 'beta');
    assert.equal(refreshed.find((agent) => agent.name === 'worker')?.variant, 'high');
    assert.equal(refreshed.find((agent) => agent.name === 'pinned')?.model.modelID, 'alpha');
    assert.match(refreshed.find((agent) => agent.name === 'worker')?.prompt ?? '', /RELOADED_WORKER_GUIDANCE/);
    assert.equal(
      refreshed.find((agent) => agent.name === 'worker')?.prompt?.includes('INITIAL_WORKER_GUIDANCE'),
      false,
    );
    assert.equal((await request()).info.modelID, 'beta');
    const reloadedRequest = requests.find((body) => JSON.stringify(body).includes('RELOADED_WORKER_GUIDANCE'));
    assert.ok(reloadedRequest !== undefined, 'reread fragments after token reload');
    assert.ok(!JSON.stringify(reloadedRequest).includes('INITIAL_WORKER_GUIDANCE'));
    await writeFile(
      join(project, 'opencode.json'),
      JSON.stringify({ model: 'fixture/alpha', small_model: 'fixture/alpha' }),
    );
    await reloadConfiguration(await loadSnapshot(configRoot), async (plugin) => {
      await api('/global/config', { plugin }, 'PATCH');
    });
    refreshed = await api<Agent[]>('/agent');
    for (const name of ['main-follower', 'small-follower']) {
      assert.equal(refreshed.find((agent) => agent.name === name)?.model.modelID, 'alpha');
      assert.equal((await request(name)).info.modelID, 'alpha');
    }
    assert.equal(refreshed.find((agent) => agent.name === 'worker')?.model.modelID, 'beta');
    assert.ok(requests.some((body) => body.model === 'alpha'));
    assert.ok(requests.some((body) => body.model === 'beta'));
    assert.ok(
      requests.every(
        (body) =>
          !/agent_group|modelRef|modelPresets|configFile|promptSources|sourceDirectories/.test(JSON.stringify(body)),
      ),
    );
    assert.match(await readFile(join(configRoot, 'opencode.jsonc'), 'utf8'), /^\/\/ Native integration fixture/);
    assert.match(await readFile(join(configRoot, 'config-composer.jsonc'), 'utf8'), /^\/\/ Dedicated settings/);
  },
);
