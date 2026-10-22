import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { parse } from 'jsonc-parser';
import { nativeBinary } from './native-host.ts';
import { establishNativeReferenceBaseline, waitForNativeReferences } from './native-references.ts';

interface Agent {
  name: string;
  prompt?: string;
  model?: { providerID: string; modelID: string };
  variant?: string | null;
  options: Record<string, unknown>;
  permission: { permission: string; pattern: string; action: string }[];
}

test(
  'OpenCode 1.19 discovers shipped prompts and profiles without provider requests',
  { timeout: 120_000 },
  async (t) => {
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
    const child = spawn(nativeBinary(), ['serve', '--hostname', '127.0.0.1', '--port', '0', '--print-logs'], {
      cwd: project,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
    const stopped = once(child, 'exit').catch(() => undefined);
    t.after(async () => {
      child.kill();
      const kill = globalThis.setTimeout(() => child.kill('SIGKILL'), 3000);
      kill.unref();
      await stopped;
      globalThis.clearTimeout(kill);
      await rm(root, { recursive: true, force: true });
    });
    let baseURL: string | undefined;
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
    const api = async <T>(path: string, method = 'GET', signal = AbortSignal.timeout(30_000)): Promise<T> => {
      const response = await fetch(`${baseURL}${path}`, {
        method,
        headers: { 'x-opencode-directory': project },
        signal,
      }).catch((error: unknown) => {
        throw new Error(`${path}: ${String(error)}\n${output.slice(-6000)}`);
      });
      assert.ok(response.ok, `${path}: ${await response.clone().text()}\n${output.slice(-3000)}`);
      return (await response.json()) as T;
    };
    const snapshot = async (signal?: AbortSignal) => {
      // Native reference discovery finishes after its plugin is marked active.
      let reads = 0;
      await waitForNativeReferences(() => {
        reads++;
        return api<{ data: { name: string; path: string }[] }>('/api/reference', 'GET', signal);
      }, [{ name: 'agent-references', path: join(installation, 'references', 'agent') }]);
      t.diagnostic(`Native reference discovery ready after ${reads} catalog read(s)`);
      return api<Agent[]>('/agent', 'GET', signal);
    };
    const baseline = await establishNativeReferenceBaseline(
      snapshot,
      (signal) => api('/global/dispose', 'POST', signal),
      join(installation, 'references', 'agent'),
    );
    const original = new Map(baseline.map((agent) => [agent.name, agent]));
    // Native skill discovery can reorder disjoint trusted-directory grants on restart.
    // Preserve the order of every other rule, including overlapping authored rules.
    const skillGrant = (rule: Agent['permission'][number]) =>
      rule.permission === 'external_directory' &&
      rule.action === 'allow' &&
      (rule.pattern.startsWith(`${installation}/skills/`) ||
        rule.pattern.startsWith(`${installation}/node_modules/@lunchbox-labs/opencode-config-composer/skills/`));
    const permissionSnapshot = (rules: Agent['permission']) => ({
      ordered: rules.filter((rule) => !skillGrant(rule)),
      skills: rules
        .filter(skillGrant)
        .map((rule) => rule.pattern)
        .sort(),
    });
    assert.equal(original.get('workflow-lead')?.model?.modelID, 'gpt-6-astra');
    assert.equal(original.get('typescript-developer')?.model?.modelID, 'gpt-5.6-sol');
    assert.equal(original.get('workflow-lead')?.prompt?.includes('# Lead contract'), true);
    const catalog = await api<{
      all: { id: string; models: Record<string, { variants?: Record<string, unknown> }> }[];
    }>('/provider');
    for (const [provider, ids] of [
      ['openai', ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna']],
      ['anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']],
    ] as const) {
      const models = catalog.all.find((entry) => entry.id === provider)?.models;
      for (const id of ids) {
        assert.ok(models?.[id] !== undefined, `${provider}/${id}: missing host catalog entry`);
        const variants = models[id].variants;
        assert.ok(variants?.medium !== undefined, `${provider}/${id}: medium variant unavailable`);
        assert.ok(variants.high !== undefined, `${provider}/${id}: high variant unavailable`);
      }
    }
    for (const profile of [
      'openai-latest',
      'anthropic-latest',
      'openai-latest',
      'current',
      '',
      'anthropic-latest',
      'current',
    ]) {
      settings.selection = { defaultProfiles: profile !== '' ? [profile] : [], retainOnRestart: false };
      await writeFile(join(installation, 'config-composer.jsonc'), JSON.stringify(settings));
      await api('/global/dispose', 'POST');
      const agents = await snapshot();
      const developer = agents.find((agent) => agent.name === 'typescript-developer');
      assert.ok(developer !== undefined, `${profile}: developer discovery`);
      const expected =
        profile === 'anthropic-latest'
          ? 'claude-sonnet-5-5'
          : profile === 'openai-latest'
            ? 'gpt-6.1-sol'
            : profile === 'current'
              ? 'gpt-5.6-sol'
              : undefined;
      assert.equal(developer.model?.modelID, expected, profile);
      assert.equal(
        developer.variant ?? undefined,
        profile === '' ? undefined : 'medium',
        `${profile}: developer variant`,
      );
      if (profile === 'openai-latest' || profile === 'anthropic-latest') {
        const provider = profile === 'openai-latest' ? 'openai' : 'anthropic';
        const reasoning = provider === 'openai' ? 'gpt-6-astra' : 'claude-opus-5-5';
        const lightweight = provider === 'openai' ? 'gpt-6-luna' : 'claude-haiku-5-5';
        for (const name of [
          'workflow-lead',
          'planning-lead',
          'review-lead',
          'code-reviewer',
          'implementation-lead',
          'doctrine-developer',
          'efcore-developer',
          'performance-optimizer',
        ]) {
          const agent = agents.find((entry) => entry.name === name);
          assert.deepEqual(agent?.model, { providerID: provider, modelID: reasoning }, `${profile}/${name}`);
          assert.equal(agent.variant, 'high', `${profile}/${name}: variant`);
        }
        assert.deepEqual(developer.model, { providerID: provider, modelID: expected });
        assert.deepEqual(agents.find((agent) => agent.name === 'doc-updater')?.model, {
          providerID: provider,
          modelID: lightweight,
        });
      }
      for (const agent of agents) {
        const previous = original.get(agent.name);
        assert.ok(previous !== undefined);
        if (profile === 'current' || (profile !== '' && ['title', 'compaction'].includes(agent.name))) {
          assert.deepEqual(agent.model, previous.model, `${profile}/${agent.name}: retained model`);
          assert.equal(agent.variant, previous.variant, `${profile}/${agent.name}: retained variant`);
        }
        assert.deepEqual(
          permissionSnapshot(agent.permission),
          permissionSnapshot(previous.permission),
          `${profile}/${agent.name}: permissions`,
        );
        assert.deepEqual(agent.options, previous.options, `${profile}/${agent.name}: stale provider parameters`);
        assert.equal(agent.prompt, original.get(agent.name)?.prompt, `${profile}/${agent.name}: prompt`);
        assert.notEqual(agent.prompt?.includes('{{include:'), true, `${agent.name}: unresolved directive`);
        if (
          agent.prompt !== undefined &&
          !['workflow-lead', 'planning-lead', 'implementation-lead', 'review-lead'].includes(agent.name) &&
          previous.prompt?.includes('# Common task response') === true
        ) {
          assert.equal(agent.prompt.split('# Common task response').length - 1, 1, `${agent.name}: response envelope`);
          assert.equal(agent.prompt.split('# Research response').length - 1, 1, `${agent.name}: research profile`);
        }
      }
    }
    const commands = await api<{ name: string }[]>('/command');
    assert.ok(commands.some((command) => command.name === 'test-audit'));
  },
);
