import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { type ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { type Entry, stageReport } from '../extensions/session-tools/model.ts';

type FixtureRequest = Record<string, unknown> & {
  tools?: { function?: { name?: string } }[];
  messages?: { role?: string }[];
  stream?: boolean;
};

for (const custom of [false, true]) {
  test(
    `V1 loads session tools from ${custom ? 'OPENCODE_CONFIG_DIR' : 'global config'} and preserves reports after restart`,
    {
      timeout: 90_000,
    },
    async (t) => {
      const root = await mkdtemp(join(tmpdir(), 'opencode-session-tools-'));
      const repo = fileURLToPath(new URL('../', import.meta.url));
      const configRoot = custom ? join(root, 'installation') : join(root, 'config', 'opencode');
      const project = join(root, 'project');
      await mkdir(configRoot, { recursive: true });
      await mkdir(project);
      await cp(join(repo, 'extensions'), join(configRoot, 'extensions'), { recursive: true });
      await cp(join(repo, 'themes'), join(configRoot, 'themes'), { recursive: true });
      // Copy installed dependencies: the native installer can replace or prune symlinked trees.
      const dependencies = await realpath(join(repo, 'node_modules'));
      await cp(dependencies, join(configRoot, 'node_modules'), { recursive: true });
      await cp(join(dirname(dependencies), 'package.json'), join(configRoot, 'package.json'));
      await cp(join(dirname(dependencies), 'package-lock.json'), join(configRoot, 'package-lock.json'));
      const tui = JSON.parse(await readFile(join(repo, 'tui.jsonc'), 'utf8')) as { plugin: string[] };
      tui.plugin = tui.plugin.filter((item: string) => item.startsWith('./extensions/'));
      const composerDirectory = join(configRoot, 'node_modules', 'opencode-config-composer-name-tbd');
      tui.plugin.push(composerDirectory);
      await writeFile(join(configRoot, 'tui.jsonc'), JSON.stringify(tui));
      await writeFile(join(configRoot, 'guidance.md'), 'Report review using workflow_status, then answer briefly.');
      await writeFile(
        join(configRoot, 'config-composer.jsonc'),
        JSON.stringify({
          sourceDirectories: { fixture: '.' },
          agent: { groups: { workflow: { model: 'fixture/model' } } },
          command: {},
          skill: {},
        }),
      );
      const bodies: FixtureRequest[] = [];
      const respond = async (request: IncomingMessage, response: ServerResponse) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          const data: unknown = chunk;
          assert.ok(Buffer.isBuffer(data) || typeof data === 'string');
          chunks.push(typeof data === 'string' ? Buffer.from(data) : data);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString()) as FixtureRequest;
        bodies.push(body);
        const hasTool = body.tools?.some(
          (item: { function?: { name?: string } }) => item.function?.name === 'workflow_status',
        );
        const toolReturned = body.messages?.some((item: { role?: string }) => item.role === 'tool');
        const call = hasTool === true && toolReturned !== true;
        const base = { id: 'fixture-response', model: body.model, created: 1 };
        if (body.stream !== true) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.end(
            JSON.stringify({
              ...base,
              object: 'chat.completion',
              choices: [
                { index: 0, message: { role: 'assistant', content: 'Fixture session' }, finish_reason: 'stop' },
              ],
              usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
            }),
          );
          return;
        }
        response.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const delta = call
          ? {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'fixture-status',
                  type: 'function',
                  function: {
                    name: 'workflow_status',
                    arguments: JSON.stringify({ stage: 'review', summary: 'Review fixture output' }),
                  },
                },
              ],
            }
          : { role: 'assistant', content: 'Workflow report recorded. The review remains in progress.' };
        response.write(
          `data: ${JSON.stringify({
            ...base,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta, finish_reason: null }],
          })}\n\n`,
        );
        response.end(
          `data: ${JSON.stringify({
            ...base,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: call ? 'tool_calls' : 'stop' }],
            usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
          })}\n\ndata: [DONE]\n\n`,
        );
      };
      const provider = createServer((request, response) => {
        respond(request, response).catch((error: unknown) => {
          response.destroy(error instanceof Error ? error : new Error(String(error)));
        });
      });
      provider.listen(0, '127.0.0.1');
      await once(provider, 'listening');
      const address = provider.address();
      assert.ok(address !== null && typeof address !== 'string');
      await writeFile(
        join(configRoot, 'opencode.jsonc'),
        JSON.stringify({
          plugin: [
            './extensions/session-tools/server.ts',
            [composerDirectory, { configFile: 'config-composer.jsonc' }],
          ],
          model: 'fixture/model',
          small_model: 'fixture/model',
          default_agent: 'lead',
          enabled_providers: ['fixture'],
          provider: {
            fixture: {
              npm: '@ai-sdk/openai-compatible',
              options: {
                baseURL: `http://127.0.0.1:${address.port}/v1`,
                apiKey: 'synthetic-test-key',
              },
              models: { model: { name: 'Fixture model', limit: { context: 8192, output: 512 } } },
            },
          },
          agent: {
            lead: {
              mode: 'primary',
              agent_group: 'workflow',
              prompt: '{{include:@fixture/guidance.md}}',
            },
          },
        }),
      );
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        XDG_CONFIG_HOME: join(root, 'config'),
        XDG_DATA_HOME: join(root, 'data'),
        XDG_STATE_HOME: join(root, 'state'),
        XDG_CACHE_HOME: join(root, 'cache'),
        OPENCODE_CONFIG: '',
        OPENCODE_CONFIG_CONTENT: '',
        OPENCODE_TEST_HOME: root,
        OPENCODE_DISABLE_PROJECT_CONFIG: '1',
        OPENCODE_DISABLE_AUTOUPDATE: '1',
        OPENCODE_DISABLE_MODELS_FETCH: '1',
        OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
        OPENCODE_SERVER_PASSWORD: '',
        OPENCODE_DB: join(root, 'db.sqlite'),
      };
      if (custom) {
        env.OPENCODE_CONFIG_DIR = configRoot;
      } else {
        delete env.OPENCODE_CONFIG_DIR;
      }
      let child: ChildProcess | undefined;
      let stopped: Promise<unknown> | undefined;
      let output = '';
      const stop = async () => {
        child?.kill();
        const kill = globalThis.setTimeout(() => child?.kill('SIGKILL'), 3000);
        kill.unref();
        await stopped;
        globalThis.clearTimeout(kill);
        child?.stdout?.destroy();
        child?.stderr?.destroy();
      };
      t.after(async () => {
        await stop();
        provider.closeAllConnections();
        provider.close();
        if (process.env.SESSION_TOOLS_KEEP_FIXTURE === '1') {
          t.diagnostic(`Native fixture (${custom ? 'custom' : 'global'}): ${root}`);
        } else {
          await rm(root, { recursive: true, force: true });
        }
      });
      const start = async () => {
        output = '';
        child = spawn(
          process.env.OPENCODE_BIN ?? 'opencode',
          ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs'],
          { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let launchError: Error | undefined;
        child.on('error', (error) => {
          launchError = error;
        });
        stopped = once(child, 'exit').catch(() => undefined);
        child.stdout!.on('data', (data: Buffer) => {
          output += data.toString();
        });
        child.stderr!.on('data', (data: Buffer) => {
          output += data.toString();
        });
        for (let i = 0; i < 150; i++) {
          if (launchError !== undefined) {
            throw launchError;
          }
          const url = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
          if (url !== undefined && url !== '') {
            return url;
          }
          if (child.exitCode !== null) {
            throw new Error(`Native server exited: ${output.slice(-5000)}`);
          }
          await setTimeout(100);
        }
        throw new Error(`Native startup timed out: ${output.slice(-5000)}`);
      };
      let baseURL = await start();
      const api = async <T>(path: string, body?: unknown): Promise<T> => {
        const response = await fetch(`${baseURL}${path}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', 'x-opencode-directory': project },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        }).catch((error: unknown) => {
          throw new Error(`${path}: ${String(error)}\n${output.slice(-5000)}`);
        });
        assert.ok(response.ok, `${path}: ${await response.clone().text()}\n${output.slice(-3000)}`);
        return (await response.json()) as T;
      };
      assert.equal((await api<{ config: string }>('/path')).config, join(root, 'config', 'opencode'));
      const agents =
        await api<{ name: string; prompt?: string; model?: { providerID: string; modelID: string } }[]>('/agent');
      const lead = agents.find((agent) => agent.name === 'lead');
      assert.equal(lead?.prompt, 'Report review using workflow_status, then answer briefly.');
      assert.deepEqual(lead.model, { providerID: 'fixture', modelID: 'model' });
      const created = await api<{ id: string }>('/session', { title: 'Session tools native fixture' });
      const response = await api<{ info: { error?: unknown } }>(`/session/${created.id}/message`, {
        agent: 'lead',
        parts: [{ type: 'text', text: 'Record the review stage for the fixture.' }],
      });
      assert.equal(response.info.error, undefined, JSON.stringify(response.info.error));
      const entries = await api<Entry[]>(`/session/${created.id}/message`);
      const report = stageReport(entries);
      assert.equal(report?.stage, 'review');
      assert.equal(report.agent, 'lead');
      assert.equal(report.summary, 'Review fixture output');
      assert.ok(
        bodies.some(
          (body) => Array.isArray(body.tools) && body.tools.some((item) => item.function?.name === 'workflow_status'),
        ),
      );
      await writeFile(join(root, 'session-id.txt'), created.id);
      await stop();
      baseURL = await start();
      assert.deepEqual(stageReport(await api<Entry[]>(`/session/${created.id}/message`)), report);
    },
  );
}
