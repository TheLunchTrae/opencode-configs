import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { type TestContext, test } from 'node:test';
import { configurationDirectory, loadConfiguration, parseConfiguration } from '../extensions/composer/configuration.ts';
import {
  type AgentSettings,
  agentGroup,
  agentGroups,
  applyDefaults,
  readOptions,
  readSettings,
  resolveChoice,
} from '../extensions/composer/settings.ts';

async function directory(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'composer-settings-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('dedicated settings normalize typed groups and reject unsupported namespaces and malformed prompt settings', () => {
  const settings = readSettings({
    groups: {
      agents: { developers: { modelRef: 'preset:balanced', prompt: { append: ['Guidance'] } } },
      commands: {},
      skills: {},
    },
    modelPresets: { balanced: { model: 'fixture/fast', variant: 'high' } },
    promptSources: { shared: './references' },
    agentPrompts: { 'team/lead': { inheritDefaults: false, append: ['Lead'] } },
  });
  assert.equal(settings.groups.developers.modelRef, 'preset:balanced');
  assert.deepEqual(settings.groups.developers.prompt, { append: ['Guidance'] });
  assert.deepEqual(settings.promptDefaults, {});
  assert.deepEqual(settings.agentPrompts['team/lead'], { inheritDefaults: false, append: ['Lead'] });
  assert.throws(() => readSettings({ groups: { commands: { build: {} } } }), /reserved/);
  assert.throws(() => readSettings({ groups: { skills: { reviewer: {} } } }), /reserved/);
  assert.throws(() => readSettings({ groups: { other: {} } }), /namespaces/);
  assert.throws(() => readSettings({ promptDefaults: { append: 'wrong' } }), /arrays/);
  assert.throws(() => readSettings({ promptDefaults: { inheritDefaults: false } }), /Prompt settings/);
  assert.throws(() => readSettings({ agentPrompts: { lead: { inheritGroups: 'wrong' } } }), /boolean/);
  assert.throws(
    () => readSettings({ groups: { agents: { reviewer: { modelRef: 'preset:absent' } } } }),
    /does not exist/,
  );
  assert.throws(() => readOptions({ configFile: 'composer.jsonc', groups: {} }), /configFile/);
});

test('ordered memberships merge fields and explicit agent models keep their precedence', () => {
  const settings = readSettings({
    groups: {
      agents: {
        base: { modelRef: 'preset:balanced' },
        developers: { model: 'fixture/next' },
        reviewers: { modelRef: 'opencode:small_model', variant: 'low' },
      },
    },
    modelPresets: { balanced: { model: 'fixture/fast', variant: 'high' } },
  });
  const context = { modelPresets: settings.modelPresets, native: { small_model: 'fixture/small' } };
  const agents: Record<string, AgentSettings> = {
    worker: { groups: ['base', 'developers'] },
    reviewer: { options: { groups: ['base', 'reviewers'] }, variant: 'medium' },
    pinned: { groups: ['base'], model: 'fixture/pinned' },
    legacy: { agent_group: 'reviewers' },
  };
  applyDefaults(agents, settings.groups, context);
  assert.equal(resolveChoice({ groups: ['base', 'developers'] }, settings.groups, context).modelRef, undefined);
  assert.equal(resolveChoice({ groups: ['base', 'developers'] }, settings.groups, context).variant, 'high');
  assert.equal(agents.worker.model, 'fixture/next');
  assert.equal(agents.worker.variant, 'high');
  assert.equal(agents.reviewer.model, 'fixture/small');
  assert.equal(agents.reviewer.variant, 'medium');
  assert.equal(agents.pinned.model, 'fixture/pinned');
  assert.equal('variant' in agents.pinned, false);
  assert.equal(agents.legacy.model, 'fixture/small');
  assert.deepEqual(agentGroups({ groups: [], agent_group: 'base' }), []);
  assert.deepEqual(agentGroups({ options: { agent_group: 'base' } }), ['base']);
  assert.equal(agentGroup({ groups: ['base', 'developers'] }), 'developers');
  assert.throws(() => agentGroups({ groups: ['base', 'base'] }), /duplicate/);
  assert.throws(() => agentGroups({ options: { groups: 'base' } }), /ordered array/);
  assert.throws(() => resolveChoice({ groups: ['missing'] }, settings.groups, context), /unknown Composer group/);
  assert.equal(resolveChoice({ agent_group: 'legacy-new-team' }, settings.groups, context).source, 'native');
});

test('loader resolves paths from the dedicated file and rereads external edits without a cache', async (t) => {
  const root = await directory(t);
  const path = join(root, 'composer.jsonc');
  await writeFile(
    path,
    '// Keep comments.\n{"groups":{"agents":{},"commands":{},"skills":{}},"promptSources":{"shared":"./references"},}\n',
  );
  const initial = await loadConfiguration({ configFile: 'composer.jsonc', reloadToken: 'token' }, root);
  assert.equal(initial.file?.path, path);
  assert.match(initial.file.text, /Keep comments/);
  assert.equal(initial.settings.promptSources.shared, join(root, 'references'));
  await writeFile(path, '{"promptDefaults":{"append":["Updated"]}}');
  assert.deepEqual((await loadConfiguration({ configFile: path }, '/unused')).settings.promptDefaults, {
    append: ['Updated'],
  });
  assert.deepEqual(configurationDirectory({ OPENCODE_CONFIG_DIR: root, XDG_CONFIG_HOME: '/unused' }), root);
  assert.equal(configurationDirectory({ XDG_CONFIG_HOME: root }), join(root, 'opencode'));
  assert.equal(configurationDirectory({ XDG_CONFIG_HOME: 'relative' }), configurationDirectory({}));
  await assert.rejects(loadConfiguration({ configFile: path, groups: {} }, root), /cannot be mixed/);
  await assert.rejects(loadConfiguration({ configFile: 'missing.jsonc' }, root), /Could not read/);
  await symlink(path, join(root, 'linked.jsonc'));
  await assert.rejects(loadConfiguration({ configFile: 'linked.jsonc' }, root), /regular file/);
});

test('JSONC parser rejects duplicate keys at any depth and invalid root objects', () => {
  assert.deepEqual(parseConfiguration('{"groups":{"agents":{},},}'), { groups: { agents: {} } });
  assert.throws(() => parseConfiguration('{"groups":{},"groups":{}}'), /duplicate/);
  assert.throws(() => parseConfiguration('{"agentPrompts":{"lead":{"append":[],"append":[]}}}'), /duplicate/);
  assert.throws(() => parseConfiguration('[]'), /invalid/);
  assert.throws(() => parseConfiguration('{'), /invalid/);
});
