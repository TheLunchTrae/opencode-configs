import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { parse } from 'jsonc-parser';
import { nativeBinary } from './native-host.ts';
import { waitForNativeReferences } from './native-references.ts';

interface RuntimeMarker {
  id: string;
  definitionId: string;
  status: string;
  diagnostic?: string;
  selection: { path: string; revision: number; choice?: string | null };
  candidate: { profile: string | null };
}
interface NativeConfig {
  plugin: (string | [string, { __configComposerRuntime?: RuntimeMarker }])[];
}

// Exercise loading and persisted profile transitions through the real server. Personal
// agent inventories, model allocations, and permission maps are not test contracts.
test('native Composer selection applies, clears, and survives server restart', { timeout: 120_000 }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'opencode-configs-native-'));
  const installation = join(root, 'config', 'opencode');
  const project = join(root, 'project');
  await mkdir(installation, { recursive: true });
  await mkdir(project, { recursive: true });
  for (const path of ['agents', 'commands', 'skills', 'references', 'prompts', 'node_modules']) {
    await cp(new URL(`../${path}`, import.meta.url), join(installation, path), { recursive: true });
  }
  for (const path of ['AGENTS.md', 'config-composer.jsonc', 'package.json', 'package-lock.json']) {
    await cp(new URL(`../${path}`, import.meta.url), join(installation, path));
  }
  const config = parse(await readFile(new URL('../opencode.jsonc', import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >;
  config.plugin = [
    join(installation, 'node_modules/@lunchbox-labs/opencode-config-composer'),
    join(installation, 'node_modules/@lunchbox-labs/opencode-prompt-composer'),
  ];
  delete config.shell;
  config.enabled_providers = ['openai', 'anthropic'];
  // No inference endpoints are invoked; credentials and endpoints are synthetic.
  config.provider = {
    openai: { options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' } },
    anthropic: { options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' } },
  };
  await writeFile(join(installation, 'opencode.jsonc'), JSON.stringify(config));
  const settings = parse(await readFile(join(installation, 'config-composer.jsonc'), 'utf8')) as {
    defaultProfile: string;
    agent: Record<string, { options?: Record<string, unknown> }>;
    profiles: Record<string, { agent?: Record<string, { options: { selection: string } }> }>;
  };
  // A synthetic agent observes real application and prompt composition without
  // freezing any personal role, model, or permission configuration into assertions.
  await writeFile(
    join(installation, 'agents', 'selection-check.md'),
    '---\ndescription: Native integration fixture\nmode: subagent\npermission: {"*": deny, skill: allow}\n---\n{{include:selection-check.md}}',
  );
  await writeFile(join(installation, 'prompts', 'selection-check.md'), 'composed-selection');
  await mkdir(join(installation, 'skills', 'selection-check'));
  await writeFile(
    join(installation, 'skills', 'selection-check', 'SKILL.md'),
    '---\nname: selection-check\ndescription: Native skill loading fixture\n---\nnative-skill-body',
  );
  settings.agent['selection-check'] = { options: { selection: 'base' } };
  for (const [name, profile] of Object.entries(settings.profiles)) {
    profile.agent = { ...profile.agent, 'selection-check': { options: { selection: name } } };
  }
  await writeFile(join(installation, 'config-composer.jsonc'), JSON.stringify(settings));
  const environment: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    OPENCODE_TEST_HOME: root,
    OPENCODE_DB: join(root, 'db.sqlite'),
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_DISABLE_PROJECT_CONFIG: '1',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
  };
  const launch = () =>
    spawn(nativeBinary(), ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs'], {
      cwd: project,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  let child = launch();
  let output = '';
  let launchError: Error | undefined;
  const listen = () => {
    child.on('error', (error) => {
      launchError = error;
    });
    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on('data', (data: Buffer) => {
      output += data.toString();
    });
    return once(child, 'exit').catch(() => undefined);
  };
  let stopped = listen();
  const stop = async () => {
    child.kill();
    const kill = globalThis.setTimeout(() => child.kill('SIGKILL'), 3000);
    kill.unref();
    await stopped;
    globalThis.clearTimeout(kill);
  };
  t.after(async () => {
    await stop();
    await rm(root, { recursive: true, force: true });
  });
  let baseURL: string | undefined;
  const waitForServer = async () => {
    for (let attempt = 0; attempt < 150; attempt++) {
      assert.equal(launchError, undefined);
      baseURL = /http:\/\/127\.0\.0\.1:\d+/.exec(output)?.[0];
      if (baseURL !== undefined) {
        break;
      }
      assert.equal(child.exitCode, null, output);
      await setTimeout(100);
    }
    assert.ok(baseURL !== undefined, output);
  };
  await waitForServer();
  const api = async <T>(path: string, method = 'GET'): Promise<T> => {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: { 'x-opencode-directory': project },
      signal: AbortSignal.timeout(30_000),
    });
    assert.ok(response.ok, `${path}: ${await response.clone().text()}\n${output.slice(-3000)}`);
    return (await response.json()) as T;
  };
  const evidence: unknown[] = [];
  const snapshot = async () => {
    await waitForNativeReferences(
      () => api<{ data: { name: string; path: string }[] }>('/api/reference'),
      [{ name: 'agent-references', path: join(installation, 'references', 'agent') }],
    );
    const cfg = await api<NativeConfig>('/config');
    const marker = cfg.plugin
      .flatMap((entry) =>
        typeof entry === 'string' || entry[1].__configComposerRuntime === undefined
          ? []
          : [entry[1].__configComposerRuntime],
      )
      .at(0);
    assert.ok(marker !== undefined, 'Composer did not report applying configuration');
    assert.equal(marker.status, 'applied', marker.diagnostic);
    const agents = await api<{ name: string; options: Record<string, unknown>; prompt?: string }[]>('/agent');
    const selectedAgent = agents.find((agent) => agent.name === 'selection-check');
    assert.equal(
      selectedAgent?.options.selection,
      marker.candidate.profile ?? 'base',
      'selection must change the effective native agent, not only the runtime marker',
    );
    assert.equal(selectedAgent.prompt?.trim(), 'composed-selection', 'native prompt includes must compose');
    // Optional diagnostic capture supports one-off migration inspection, not snapshot assertions.
    if (process.env.CONFIG_CONSUMER_EVIDENCE !== undefined) {
      evidence.push({
        config: cfg,
        agents,
        skills: await api('/skill'),
        commands: await api('/command'),
      });
      await writeFile(
        `${process.env.CONFIG_CONSUMER_EVIDENCE}-${process.env.OPENCODE_NATIVE_VERSION}.json`,
        JSON.stringify({ version: process.env.OPENCODE_NATIVE_VERSION, runs: evidence }, null, 2),
      );
    }
    return marker;
  };
  let marker = await snapshot();
  assert.equal(marker.candidate.profile, settings.defaultProfile);
  const skill = spawnSync(
    nativeBinary(),
    ['debug', 'agent', 'selection-check', '--tool', 'skill', '--params', '{"name":"selection-check"}'],
    { cwd: project, env: environment, encoding: 'utf8', timeout: 30_000 },
  );
  assert.ifError(skill.error);
  assert.equal(skill.status, 0, skill.stderr);
  // The debug command executes the native tool but bypasses session after-hooks.
  // This checks native skill loading, not Prompt Composer's session skill hook.
  assert.match(skill.stdout, /native-skill-body/, 'native skill execution must return the discovered body');
  for (const choice of [...Object.keys(settings.profiles), null, undefined]) {
    const statePath = relative(join(root, 'state'), marker.selection.path);
    assert.ok(
      statePath !== '' && !isAbsolute(statePath) && statePath.split(sep)[0] !== '..',
      'isolated selection path',
    );
    await mkdir(dirname(marker.selection.path), { recursive: true });
    await writeFile(
      marker.selection.path,
      JSON.stringify({
        version: 2,
        revision: marker.selection.revision + 1,
        selection: choice === undefined ? {} : { choice },
      }),
    );
    await api('/global/dispose', 'POST');
    const previous = marker;
    marker = await snapshot();
    assert.equal(marker.selection.choice, choice);
    assert.equal(marker.candidate.profile, choice === undefined ? settings.defaultProfile : choice);
    assert.notEqual(marker.id, previous.id, 'selection must be applied to a new runtime');
    assert.equal(marker.definitionId, previous.definitionId, 'selection uses captured definitions');
    await stop();
    output = '';
    baseURL = undefined;
    launchError = undefined;
    child = launch();
    stopped = listen();
    await waitForServer();
    const restarted = await snapshot();
    assert.equal(restarted.selection.choice, choice, 'selection survives restart');
    assert.equal(restarted.candidate.profile, marker.candidate.profile);
    assert.notEqual(restarted.definitionId, marker.definitionId, 'restart reloads definitions');
    marker = restarted;
  }
  assert.doesNotMatch(output, /Composer not applied|ConfigInvalidError|PluginInitError/);
});
