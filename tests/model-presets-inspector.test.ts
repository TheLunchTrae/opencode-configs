import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Agent, Config } from '@opencode-ai/sdk/v2';
import { configFacts } from '../extensions/session-tools/model.ts';

const agent = {
  name: 'worker',
  model: { providerID: 'fixture', modelID: 'pinned' },
  variant: 'low',
  options: { agent_group: 'developers', apiKey: 'DO_NOT_DISPLAY' },
} as unknown as Agent;
const config = (options: Record<string, unknown>): Config => ({
  model: 'fixture/workspace',
  small_model: 'fixture/workspace-small',
  plugin: [['/config/extensions/agent-groups/server.ts', options]],
});

test('inspector resolves preset defaults without claiming an explicit agent pin inherited them', () => {
  const input = config({
    modelPresets: { balanced: { model: 'fixture/shared', variant: 'high' } },
    groups: { developers: { modelRef: 'preset:balanced' } },
  });
  const before = JSON.stringify(input);
  const facts = configFacts(agent, input, { model: 'fixture/global' }, []);
  const value = (label: string) => facts.find((fact) => fact.label === label)?.value;
  assert.equal(value('Agent default (server-resolved)'), 'fixture/pinned');
  assert.equal(value('Configured group default'), 'fixture/shared');
  assert.equal(value('Group model source'), 'preset:balanced');
  assert.equal(value('Resolved group variant'), 'high');
  assert.equal(value('Configured variant'), 'low');
  assert.match(value('Group inheritance')!, /does not prove/);
  assert.match(value('Origin file')!, /not exposed/);
  assert.ok(!JSON.stringify(facts).includes('DO_NOT_DISPLAY'));
  assert.equal(JSON.stringify(input), before, 'inspection must remain read-only');
});

test('inspector keeps referenced main and small workspace values distinct from global file values', () => {
  for (const field of ['model', 'small_model'] as const) {
    const input = config({ groups: { developers: { modelRef: `opencode:${field}`, variant: 'high' } } });
    const global = { model: 'fixture/global', small_model: 'fixture/global-small' };
    const facts = configFacts(agent, input, global, []);
    const value = (label: string) => facts.find((fact) => fact.label === label)?.value;
    assert.equal(value('Group model source'), `opencode:${field}`);
    assert.equal(value('Configured group default'), input[field]);
    assert.equal(value('Referenced workspace default'), input[field]);
    assert.equal(value('Referenced global file default'), global[field]);
    for (const missingGlobal of [undefined, null]) {
      const unavailable = configFacts(agent, input, missingGlobal, []);
      assert.equal(unavailable.find((fact) => fact.label === 'Global file default')?.value, 'Unavailable');
      assert.equal(unavailable.find((fact) => fact.label === 'Referenced global file default')?.value, 'Unavailable');
    }
  }
});

test('inspector distinguishes invalid references from an intentional native fallback', () => {
  for (const options of [
    { groups: { developers: { modelRef: 'preset:missing' } } },
    { groups: { developers: { modelRef: 'opencode:invalid' } } },
    {
      modelPresets: { balanced: { model: 'fixture/shared' } },
      groups: { developers: { modelRef: 'preset:balanced', model: 'fixture/other' } },
    },
  ]) {
    const facts = configFacts(agent, config(options), undefined, []);
    assert.match(facts.find((fact) => fact.label === 'Group model resolution')!.value, /^Invalid:/);
    assert.ok(!facts.some((fact) => fact.label === 'Configured group default' && fact.value === 'No group model'));
  }
  const fallback = configFacts({ ...agent, model: null }, config({ groups: { developers: {} } }), undefined, []);
  assert.equal(
    fallback.find((fact) => fact.label === 'Agent default (server-resolved)')?.value,
    'No agent model; OpenCode selects a fallback',
  );
  assert.equal(fallback.find((fact) => fact.label === 'Group model source')?.value, 'OpenCode fallback');
  assert.equal(fallback.find((fact) => fact.label === 'Configured group default')?.value, 'No group model');
});
