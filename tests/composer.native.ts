import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { parse } from 'jsonc-parser';
import { nativeBinary } from './native-host.ts';
import { waitForNativeReferences } from './native-references.ts';
import { orderedSkillPermissions } from './native-skill-permissions.ts';
import { effectivePatterns } from './permission-equivalence.ts';
import {
  type Permission,
  expectedModels,
  expectedPolicies,
  globalPermission,
  movedModels,
} from './config-expectations.ts';

interface Agent {
  name: string;
  prompt?: string;
  model?: { providerID: string; modelID: string };
  variant?: string | null;
  options: Record<string, unknown>;
  permission: { permission: string; pattern: string; action: string }[];
}

interface RuntimeMarker {
  version: number;
  id: string;
  definitionId: string;
  status: string;
  diagnostic?: string;
  source: { path: string; canonicalPath: string; fingerprint: string };
  selectionLocator: { root: string; baseFile: string; path: string };
  selection: { path: string; revision: number; choice?: string | null };
  candidate: { profile: string | null };
  revision: { sources: string; effective: string };
}
interface NativeConfig {
  model: string;
  small_model: string;
  default_agent: string;
  permission: Permission;
  agent: Record<
    string,
    { permission?: Permission; disable?: boolean; options?: Record<string, unknown>; model?: string; variant?: string }
  >;
  plugin: (string | [string, { __configComposerRuntime?: RuntimeMarker }])[];
}

const matches = (pattern: string, value: string) =>
  new RegExp(
    `^${pattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
    's',
  ).test(value);
const outcome = (agent: Agent, tool: string, target: string) =>
  agent.permission.findLast((rule) => matches(rule.permission, tool) && matches(rule.pattern, target))?.action ?? 'ask';

// Pre-migration policies stay frozen. Compare ordered effective patterns rather
// than duplicated native fallback rules materialized by the released Composer.
const policyRules = (policy: Permission) =>
  Object.entries(policy).flatMap(([permission, value]) =>
    Object.entries(typeof value === 'string' ? { '*': value } : value).map(([pattern, action]) => ({
      permission,
      pattern,
      action,
    })),
  );
const effectiveToolRules = (rules: Agent['permission'], tool: string) => {
  const relevant = rules.filter((rule) => matches(rule.permission, tool));
  assert.ok(relevant.every((rule) => rule.pattern === '*' || !/[*?]/.test(rule.pattern)));
  const lastFallback = relevant.findLastIndex((rule) => rule.pattern === '*');
  assert.ok(lastFallback >= 0, `${tool}: missing fallback`);
  return relevant.slice(lastFallback).map(({ pattern, action }) => ({ pattern, action }));
};
const toolDisabled = (agent: Agent, tool: string) => {
  const permission = ['edit', 'write', 'apply_patch'].includes(tool) ? 'edit' : tool;
  const last = agent.permission.findLast((rule) => matches(rule.permission, permission));
  return last?.pattern === '*' && last.action === 'deny';
};

// This is the /config transport projection, not the authored or /agent evaluation order.
const nativeGlobalPermission = Object.fromEntries(
  ['read', 'edit', 'bash', 'task', 'github_*', 'playwright_*'].map((key) => [
    key,
    key === 'edit' ? { '*': 'deny' } : globalPermission[key],
  ]),
);

test(
  'OpenCode 1.19 discovers shipped prompts and profiles without provider requests',
  { timeout: 120_000 },
  async (t) => {
    for (const [name, version] of [
      ['config', '0.3.0'],
      ['prompt', '0.1.1'],
    ]) {
      const installed = JSON.parse(
        await readFile(
          new URL(`../node_modules/@lunchbox-labs/opencode-${name}-composer/package.json`, import.meta.url),
          'utf8',
        ),
      ) as { version: string };
      assert.equal(
        installed.version,
        version,
        'Install the published Composer packages from the committed lockfile with npm ci.',
      );
    }
    const root = await mkdtemp(join(tmpdir(), 'opencode-configs-native-'));
    const installation = join(root, 'config', 'opencode');
    const project = join(root, 'project');
    await mkdir(installation, { recursive: true });
    await mkdir(project, { recursive: true });
    for (const path of ['agents', 'commands', 'skills', 'references', 'prompts', 'node_modules']) {
      await cp(new URL(`../${path}`, import.meta.url), join(installation, path), { recursive: true });
    }
    for (const path of ['config-composer.jsonc', 'package.json', 'package-lock.json']) {
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
    // Synthetic credentials expose catalog metadata only. No session or inference endpoint is called.
    config.provider = {
      openai: { options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' } },
      anthropic: { options: { apiKey: 'synthetic-test-key', baseURL: 'http://127.0.0.1:1/v1' } },
    };
    await writeFile(join(installation, 'opencode.jsonc'), JSON.stringify(config));
    const settings = parse(await readFile(join(installation, 'config-composer.jsonc'), 'utf8')) as Record<
      string,
      unknown
    >;
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
      assert.ok(baseURL !== undefined && baseURL !== '', output);
    };
    await waitForServer();
    const api = async <T>(path: string, method = 'GET'): Promise<T> => {
      const response = await fetch(`${baseURL}${path}`, {
        method,
        headers: { 'x-opencode-directory': project },
        signal: AbortSignal.timeout(30_000),
      }).catch((error: unknown) => {
        throw new Error(`${path}: ${String(error)}\n${output.slice(-6000)}`);
      });
      assert.ok(response.ok, `${path}: ${await response.clone().text()}\n${output.slice(-3000)}`);
      return (await response.json()) as T;
    };
    const snapshot = async () => {
      // Native reference discovery finishes after its plugin is marked active.
      // Wait before Agent caches its defaults; keep every permission assertion below.
      let reads = 0;
      await waitForNativeReferences(() => {
        reads++;
        return api<{ data: { name: string; path: string }[] }>('/api/reference');
      }, [{ name: 'agent-references', path: join(installation, 'references', 'agent') }]);
      t.diagnostic(`Native reference discovery ready after ${reads} catalog read(s)`);
      return api<Agent[]>('/agent');
    };
    assert.equal(settings.defaultProfile, 'primary');
    const baseline = await snapshot();
    const original = new Map(baseline.map((agent) => [agent.name, agent]));
    const expectedSkillFiles = [
      ...(await readdir(join(installation, 'skills'), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(installation, 'skills', entry.name, 'SKILL.md')),
      ...['config-composer-create', 'config-composer-explain'].map((name) =>
        join(installation, 'node_modules/@lunchbox-labs/opencode-config-composer/skills', name, 'SKILL.md'),
      ),
    ];
    const discoveredSkills = await api<{ name: string; location: string }[]>('/skill');
    assert.deepEqual(
      discoveredSkills.filter((skill) => skill.location === '<built-in>').map((skill) => skill.name),
      ['customize-opencode'],
    );
    const discoveredFiles = await Promise.all(
      discoveredSkills.filter((skill) => skill.location !== '<built-in>').map((skill) => realpath(skill.location)),
    );
    assert.deepEqual(
      discoveredFiles.sort(),
      (await Promise.all(expectedSkillFiles.map((file) => realpath(file)))).sort(),
      'exact independent skill directory inventory',
    );
    const skillPatterns = discoveredFiles.map((file) => join(dirname(file), '*'));
    const permissionSnapshot = (agent: Agent) =>
      orderedSkillPermissions(agent.permission, skillPatterns, agent.name === 'explore' ? 2 : 1);
    assert.equal(original.get('workflow-lead')?.prompt?.includes('# Lead contract'), true);
    const catalog = await api<{
      all: { id: string; models: Record<string, { variants?: Record<string, unknown> }> }[];
    }>('/provider');
    for (const profile of ['primary', 'openai-latest', 'anthropic-latest']) {
      for (const allocation of Object.values(expectedModels(profile))) {
        assert.ok(allocation.model !== undefined && allocation.variant !== undefined);
        const [provider, id] = allocation.model.split('/');
        const model = catalog.all.find((entry) => entry.id === provider)?.models[id];
        assert.ok(model !== undefined, `${allocation.model}: missing host catalog entry`);
        assert.ok(
          model.variants?.[allocation.variant] !== undefined,
          `${allocation.model}: ${allocation.variant} variant unavailable`,
        );
      }
    }
    const evidence: Record<string, unknown> = {};
    let orderExceptions = 0;
    t.after(async () => {
      if (process.env.CONFIG_CONSUMER_EVIDENCE !== undefined) {
        await writeFile(
          `${process.env.CONFIG_CONSUMER_EVIDENCE}-${process.env.OPENCODE_NATIVE_VERSION}.json`,
          JSON.stringify(
            {
              version: process.env.OPENCODE_NATIVE_VERSION,
              root,
              installation,
              skillPatterns,
              orderExceptions,
              runs: evidence,
            },
            null,
            2,
          ),
        );
      }
    });
    const runtime = async () => {
      const cfg = await api<NativeConfig>('/config');
      const markers = cfg.plugin.flatMap((entry) =>
        typeof entry === 'string' || entry[1].__configComposerRuntime === undefined
          ? []
          : [entry[1].__configComposerRuntime],
      );
      assert.equal(markers.length, 1, 'one Config runtime attestation');
      const marker = markers[0];
      assert.equal(marker.version, 2);
      assert.equal(marker.status, 'applied', marker.diagnostic);
      assert.equal(marker.diagnostic, undefined);
      assert.ok(marker.id !== '' && marker.definitionId !== '');
      assert.match(marker.revision.sources, /^[a-f0-9]{64}$/);
      assert.match(marker.revision.effective, /^[a-f0-9]{64}$/);
      return { cfg, marker };
    };
    const verify = async (profile: string | null, label: string) => {
      const { cfg, marker } = await runtime();
      assert.equal(marker.candidate.profile, profile, label);
      const agents = await snapshot();
      evidence[label] = {
        profile,
        selection: marker.selection.choice,
        runtimeStatus: marker.status,
        fullConfig: cfg,
        fullAgents: agents,
        globals: {
          model: cfg.model,
          small_model: cfg.small_model,
          default_agent: cfg.default_agent,
          permission: cfg.permission,
        },
        config: Object.fromEntries(
          Object.entries(cfg.agent).map(([name, value]) => [
            name,
            Object.fromEntries(
              Object.entries(value).filter(([key]) =>
                ['model', 'variant', 'permission', 'mode', 'options', 'disable'].includes(key),
              ),
            ),
          ]),
        ),
        agents: Object.fromEntries(
          agents.map(({ name, model, variant, permission, options }) => [
            name,
            { model, variant, permission, options },
          ]),
        ),
      };
      const expected = expectedModels(profile);
      assert.equal(agents.length, 32, label);
      assert.deepEqual(agents.map((agent) => agent.name).sort(), Object.keys(expected).sort(), label);
      assert.equal(cfg.model, 'openai/gpt-6-astra');
      assert.equal(cfg.small_model, 'openai/gpt-5.6-luna');
      assert.equal(cfg.default_agent, 'workflow-lead');
      assert.equal(
        JSON.stringify(cfg.permission),
        JSON.stringify(nativeGlobalPermission),
        `${label}: native global permission projection`,
      );
      assert.equal(cfg.agent.build.disable, true);
      assert.equal(cfg.agent.plan.disable, true);
      assert.deepEqual(cfg.agent.title.options, { reasoningEffort: 'low' });
      assert.deepEqual(cfg.agent.compaction.options, { reasoningEffort: 'medium' });
      for (const agent of agents) {
        assert.equal(Object.hasOwn(agent, 'groups'), false, `${label}/${agent.name}: runtime membership metadata`);
        assert.equal(
          Object.hasOwn(agent.options, 'groups'),
          false,
          `${label}/${agent.name}: provider membership metadata`,
        );
        assert.equal(
          Object.hasOwn(cfg.agent[agent.name], 'groups'),
          false,
          `${label}/${agent.name}: config membership metadata`,
        );
        assert.equal(
          Object.hasOwn(cfg.agent[agent.name].options ?? {}, 'groups'),
          false,
          `${label}/${agent.name}: config options membership metadata`,
        );
        const allocation = expected[agent.name];
        const model = allocation.model?.split('/');
        assert.deepEqual(
          agent.model,
          model === undefined ? undefined : { providerID: model[0], modelID: model[1] },
          `${label}/${agent.name}: model`,
        );
        assert.equal(agent.variant ?? undefined, allocation.variant, `${label}/${agent.name}: variant`);
        const frozenRules = [...policyRules(globalPermission), ...policyRules(expectedPolicies[agent.name])];
        const configuredRules = [
          ...policyRules(cfg.permission),
          ...policyRules(cfg.agent[agent.name].permission ?? {}),
        ];
        const tools = [...new Set(frozenRules.map((rule) => rule.permission))].sort();
        assert.deepEqual(
          [...new Set(configuredRules.map((rule) => rule.permission))].sort(),
          tools,
          `${label}/${agent.name}: exact configured tool policy inventory`,
        );
        for (const tool of tools) {
          assert.deepEqual(
            effectivePatterns(configuredRules.filter((rule) => rule.permission === tool)),
            effectivePatterns(frozenRules.filter((rule) => rule.permission === tool)),
            `${label}/${agent.name}/${tool}: complete ordered configured behavior`,
          );
        }
        for (const tool of ['edit', 'task']) {
          assert.deepEqual(
            effectiveToolRules(agent.permission, tool),
            effectiveToolRules(frozenRules, tool),
            `${label}/${agent.name}/${tool}: exhaustive ordered behavior partitions`,
          );
        }
        const previous = original.get(agent.name);
        assert.ok(previous !== undefined);
        if (JSON.stringify(agent.permission) !== JSON.stringify(previous.permission)) {
          orderExceptions++;
          t.diagnostic(
            `${label}/${agent.name}: native skill-grant block order differs; checking exact paths, actions, multiplicity, and boundaries`,
          );
        }
        assert.deepEqual(
          permissionSnapshot(agent),
          permissionSnapshot(previous),
          `${label}/${agent.name}: ordered native permissions`,
        );
        for (const tool of ['edit', 'write', 'apply_patch', 'task']) {
          assert.equal(
            toolDisabled(agent, tool),
            toolDisabled(previous, tool),
            `${label}/${agent.name}/${tool}: visibility`,
          );
        }
        assert.deepEqual(agent.options, previous.options, `${label}/${agent.name}: retained options`);
        assert.equal(agent.prompt, previous.prompt, `${label}/${agent.name}: prompt`);
        assert.notEqual(agent.prompt?.includes('{{include:'), true, `${agent.name}: unresolved directive`);
        assert.equal(outcome(agent, 'task', 'unlisted-agent'), 'deny', agent.name);
        assert.equal(outcome(agent, 'read', 'secrets/token'), 'deny', agent.name);
        assert.equal(outcome(agent, 'bash', 'git reset --hard HEAD'), 'deny', agent.name);
        const shellDenied = ['architect', 'planner', 'architecture-reviewer', 'planning-lead'].includes(agent.name);
        assert.equal(outcome(agent, 'bash', 'git status --short'), shellDenied ? 'deny' : 'allow', agent.name);
        assert.equal(outcome(agent, 'bash', 'npm test'), shellDenied ? 'deny' : 'ask', agent.name);
        const task = expectedPolicies[agent.name].task;
        if (typeof task === 'object') {
          for (const [target, action] of Object.entries(task)) {
            if (target !== '*') {
              assert.equal(outcome(agent, 'task', target), action, `${agent.name}/${target}`);
            }
          }
        }
        if (
          agent.prompt !== undefined &&
          !['workflow-lead', 'planning-lead', 'implementation-lead', 'review-lead'].includes(agent.name) &&
          previous.prompt?.includes('# Common task response') === true
        ) {
          assert.equal(agent.prompt.split('# Common task response').length - 1, 1, `${agent.name}: response envelope`);
          assert.equal(agent.prompt.split('# Research response').length - 1, 1, `${agent.name}: research profile`);
        }
      }
      if (profile === null) {
        for (const name of movedModels) {
          assert.equal(agents.find((agent) => agent.name === name)?.variant ?? undefined, undefined);
        }
      }
      return marker;
    };
    let marker = await verify('primary', 'startup-primary');
    for (const [step, [choice, restart]] of (
      [
        ['openai-latest', false],
        ['anthropic-latest', false],
        ['openai-latest', false],
        ['openai-latest', true],
        [null, false],
        [null, true],
        [undefined, false],
        [undefined, true],
      ] as const
    ).entries()) {
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
      if (restart) {
        await stop();
        output = '';
        baseURL = undefined;
        launchError = undefined;
        child = launch();
        stopped = listen();
        await waitForServer();
      } else {
        await api('/global/dispose', 'POST');
      }
      const previous = marker;
      marker = await verify(
        choice === undefined ? 'primary' : choice,
        `${step + 1}-${choice ?? (choice === null ? 'none' : 'default')}-${restart ? 'restart' : 'rebootstrap'}`,
      );
      assert.equal(marker.selection.choice, choice);
      assert.notEqual(marker.id, previous.id);
      assert.equal(
        marker.definitionId === previous.definitionId,
        !restart,
        'definitions change only on server restart',
      );
      assert.deepEqual(marker.source, previous.source);
      assert.deepEqual(marker.selectionLocator, previous.selectionLocator);
    }
    const commands = await api<{ name: string }[]>('/command');
    assert.ok(commands.some((command) => command.name === 'test-audit'));
    assert.equal(child.exitCode, null);
    await runtime();
    assert.doesNotMatch(output, /Composer not applied|ConfigInvalidError|PluginInitError/);
    t.diagnostic(`All 32 agents verified; host skill-grant order exceptions: ${orderExceptions}`);
  },
);
