import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Agent, Config, Session } from '@opencode-ai/sdk/v2';
import type { PluginInput } from '@opencode-ai/plugin';
import type { ToolContext } from '@opencode-ai/plugin/tool';
import type { TuiPluginApi } from '@opencode-ai/plugin/tui';
import {
  type Bookmark,
  type Entry,
  activity,
  bookmarkKey,
  clean,
  configFacts,
  contextRecords,
  delegations,
  handoff,
  lastAssistant,
  readBookmarks,
  stageReport,
} from '../extensions/session-tools/model.ts';
import { bookmarkStore } from '../extensions/session-tools/storage.ts';
import { loadWorkflow } from '../extensions/session-tools/workflow-data.ts';
import { WorkflowStatusPlugin } from '../extensions/session-tools/server.ts';
import configPlugin, { savedConfigComposerConfiguration } from '../extensions/session-tools/config.ts';
import contextPlugin from '../extensions/session-tools/context.ts';

test('saved Config Composer inspection reads matching local settings and rejects remote filesystem mismatches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'config-composer-inspector-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const local = join(root, 'local');
  const remote = join(root, 'remote');
  await mkdir(local);
  await mkdir(remote);
  const previous = process.env.OPENCODE_CONFIG_DIR;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = previous;
    }
  });
  process.env.OPENCODE_CONFIG_DIR = local;
  const config: Config = {
    plugin: [['./extensions/config-composer/server.ts', { configFile: './config-composer.jsonc' }]],
  };
  const api = (directory: string) => ({ state: { path: { config: directory } } }) as unknown as TuiPluginApi;
  await writeFile(
    join(local, 'config-composer.jsonc'),
    JSON.stringify({ groups: { agents: { developers: { model: 'fixture/local' } }, skills: {}, commands: {} } }),
  );
  const saved = await savedConfigComposerConfiguration(api(local), config);
  assert.equal(saved?.source, join(local, 'config-composer.jsonc'));
  assert.equal(saved.settings?.groups.developers.model, 'fixture/local');
  const mismatch = await savedConfigComposerConfiguration(api(remote), config);
  assert.equal(mismatch?.settings, undefined);
  assert.equal(mismatch?.source, undefined);
  assert.match(mismatch?.unavailable ?? '', /filesystems do not match/);
  await writeFile(join(local, 'config-composer.jsonc'), '{broken');
  const invalid = await savedConfigComposerConfiguration(api(local), config);
  assert.equal(invalid?.settings, undefined);
  assert.match(invalid?.unavailable ?? '', /unavailable/);
  assert.equal(
    await savedConfigComposerConfiguration(api(local), {
      plugin: [['./extensions/config-composer/server.ts', { groups: { developers: { model: 'fixture/legacy' } } }]],
    }),
    undefined,
    'inline settings keep the legacy inspector path',
  );
});

const session = (id = 'session-a', parentID?: string): Session => ({
  id,
  parentID,
  slug: id,
  projectID: 'project-a',
  directory: '/project',
  title: 'Add structured output',
  version: '1.18.29',
  time: { created: 1, updated: 2 },
});
const entry = (time: number, parts: unknown[] = [], info: Record<string, unknown> = {}): Entry =>
  ({
    info: {
      id: `message-${time}`,
      sessionID: 'session-a',
      role: 'assistant',
      agent: 'lead',
      parentID: 'user-1',
      mode: 'build',
      path: { cwd: '/project', root: '/project' },
      cost: 0,
      providerID: 'fixture',
      modelID: 'alpha',
      time: { created: time, completed: time + 1 },
      tokens: { input: 10, output: 2, reasoning: 0, cache: { read: 5, write: 0 } },
      ...info,
    },
    parts,
  }) as Entry;
const reportPart = (stage = 'review', agent = 'lead', state = 'completed') => ({
  type: 'tool',
  tool: 'workflow_status',
  state: {
    status: state,
    input: {},
    time: { start: 1, end: 2 },
    metadata: { workflowPanel: { version: 1, stage, summary: 'Current task', agent } },
  },
});
const mark = (id = 'bookmark-a'): Bookmark => ({
  id,
  label: 'Output contract',
  note: 'JSON only on stdout.',
  kind: 'Decision',
  sessionID: 'session-a',
  messageID: 'message-1',
  created: 1,
  selected: true,
});

test('only completed, attributed workflow reports establish the latest recorded stage', () => {
  const valid = entry(10, [reportPart('implementation')]);
  const later = entry(20, [reportPart('review')]);
  assert.equal(stageReport([later, valid])?.stage, 'review');
  assert.equal(stageReport([valid, entry(30, [reportPart('complete', 'other')])])?.stage, 'implementation');
  assert.equal(stageReport([entry(30, [reportPart('complete')], { role: 'user' })]), undefined);
  assert.equal(stageReport([entry(30, [reportPart('complete', 'lead', 'error')])]), undefined);
  assert.equal(stageReport([entry(30, [reportPart('fabricated')])]), undefined);
});

test('idle, waiting, and task completion remain distinct', () => {
  assert.equal(activity({ type: 'idle' }, 0, 0), 'Idle');
  assert.equal(activity({ type: 'busy' }, 1, 0), 'Question waiting');
  assert.equal(activity({ type: 'busy' }, 0, 1), 'Permission waiting');
  assert.equal(activity(undefined, 0, 0), 'Status unavailable');
  const task = (state: string) => ({
    type: 'tool',
    tool: 'task',
    state: {
      status: state,
      metadata: { sessionId: 'child' },
      input: { subagent_type: 'reviewer', description: 'Check output' },
      time: { start: 100, end: 800 },
    },
  });
  assert.equal(delegations([entry(10, [task('completed')])])[0]?.duration, 700);
  assert.equal(delegations([entry(10, [task('completed')]), entry(20, [task('running')])])[0]?.state, 'running');
});

test('context records require actual attachments and completed tool evidence', () => {
  const records = contextRecords([
    entry(1, [
      { type: 'file', filename: 'input.ts', url: 'file:///input.ts' },
      {
        type: 'tool',
        tool: 'read',
        state: { status: 'completed', input: { filePath: 'read.ts' }, time: { compacted: 2 } },
      },
      { type: 'tool', tool: 'read', state: { status: 'error', input: { filePath: 'failed.ts' } } },
      { type: 'tool', tool: 'skill', state: { status: 'completed', input: { name: 'checkpoint' }, time: {} } },
      { type: 'tool', tool: 'skill', state: { status: 'pending', input: { name: 'not-loaded' } } },
      { type: 'compaction', auto: true },
    ]),
    entry(
      3,
      [
        { type: 'text', text: 'Summary' },
        { type: 'text', text: 'More summary' },
      ],
      { summary: true },
    ),
  ]);
  assert.deepEqual(
    records.filter((item) => item.kind === 'file').map((item) => item.label),
    ['input.ts', 'read.ts'],
  );
  assert.deepEqual(
    records.filter((item) => item.kind === 'skill').map((item) => item.label),
    ['checkpoint'],
  );
  assert.equal(records.filter((item) => item.label === 'Summary recorded').length, 1);
  assert.match(records.find((item) => item.label === 'Automatic compaction requested')!.evidence, /Request recorded/);
});

test('config inspection separates global, merged, agent, group, and observed settings without exposing secrets', () => {
  const agent = {
    name: 'reviewer',
    model: { providerID: 'fixture', modelID: 'pinned' },
    variant: 'high',
    options: { agent_group: 'reviewers', apiKey: 'DO_NOT_DISPLAY' },
  } as unknown as Agent;
  const config = {
    model: 'fixture/project',
    provider: { private: { options: { apiKey: 'DO_NOT_DISPLAY' } } },
    plugin: [['/config/extensions/config-composer/server.ts', { groups: { reviewers: { model: 'fixture/group' } } }]],
  } as Config;
  const facts = configFacts(agent, config, { model: 'fixture/global' }, [
    entry(1, [], { agent: 'reviewer', modelID: 'older' }),
    entry(3, [], { agent: 'other', modelID: 'unrelated' }),
    entry(2, [], { agent: 'reviewer', modelID: 'observed' }),
  ]);
  const value = (label: string) => facts.find((item) => item.label === label)?.value;
  assert.equal(value('Agent default (server-resolved)'), 'fixture/pinned');
  assert.equal(value('Workspace default (merged)'), 'fixture/project');
  assert.equal(value('Global file default'), 'fixture/global');
  assert.equal(value('Last recorded model for this agent'), 'fixture/observed');
  assert.equal(value('Configured group default'), 'fixture/group');
  assert.ok(!JSON.stringify(facts).includes('DO_NOT_DISPLAY'));
  assert.match(facts.find((item) => item.label === 'Group inheritance')!.value, /does not prove/);
  assert.match(facts.find((item) => item.label === 'Origin file')!.value, /not exposed/);
  assert.equal(lastAssistant([entry(2), entry(1)])?.id, 'message-2');
});

test('bookmarks persist by project, workspace, directory, and session without overwriting corrupt data', () => {
  const values = new Map<string, unknown>();
  const api = {
    kv: {
      ready: true,
      get: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, structuredClone(value)),
    },
  } as Pick<TuiPluginApi, 'kv'>;
  const store = bookmarkStore(api, { session: session() });
  store.write((items) => [...items, mark()]);
  assert.equal(bookmarkStore(api, { session: session() }).read()[0]?.label, 'Output contract');
  assert.deepEqual(bookmarkStore(api, { session: session('other') }).read(), []);
  assert.deepEqual(bookmarkStore(api, { session: { ...session(), projectID: 'other' } }).read(), []);
  assert.notEqual(bookmarkKey(session()), bookmarkKey({ ...session(), workspaceID: 'other' }));
  assert.notEqual(bookmarkKey(session()), bookmarkKey({ ...session(), directory: '/other' }));
  const invalid = { version: 2, bookmarks: [] };
  values.set(bookmarkKey(session()), invalid);
  assert.throws(() => store.write(() => []), /preserved/);
  assert.equal(values.get(bookmarkKey(session())), invalid);
});

test('invalid and duplicate bookmarks are rejected rather than silently replaced', () => {
  assert.throws(() => readBookmarks({ version: 1, bookmarks: [mark(), mark()] }, 'session-a'), /invalid/);
  assert.throws(
    () => readBookmarks({ version: 1, bookmarks: [{ ...mark(), sessionID: 'other' }] }, 'session-a'),
    /invalid/,
  );
  assert.throws(() => readBookmarks({ version: 1, bookmarks: [{ ...mark(), created: NaN }] }, 'session-a'), /invalid/);
  assert.throws(() => readBookmarks({ version: 1, bookmarks: [{ ...mark(), label: ' ' }] }, 'session-a'), /invalid/);
});

test('handoff drafts include only selected notes and preserve checkpoint evidence requirements', () => {
  const text = handoff(session(), [mark(), { ...mark('excluded'), note: 'EXCLUDED_NOTE', selected: false }]);
  assert.match(text, /JSON only on stdout/);
  assert.ok(!text.includes('EXCLUDED_NOTE'));
  for (const field of [
    'Plan/spec location',
    'Verification limits',
    'Source evidence',
    'file owners',
    'working directory',
    'Review findings',
    'remaining budget',
    'next bounded action',
  ]) {
    assert.ok(text.includes(field));
  }
  assert.match(text, /not permission grants/);
  assert.match(text, /Source session: session-a; message: message-1/);
  assert.throws(
    () =>
      handoff(
        session(),
        Array.from({ length: 21 }, (_, i) => mark(String(i))),
      ),
    /at most 20/,
  );
});

test('metadata sanitizer strips terminal controls and enforces the length limit', () => {
  assert.equal(clean('before\x1b]52;c;SECRET\x07\x1b[31mafter\x00'), 'beforeafter');
  assert.equal(clean('hello\nworld', 7), 'hello\nw');
});

test('workflow status tool rejects subagents and emits persistent metadata for configured primary leads', async () => {
  const hooks = await WorkflowStatusPlugin({} as PluginInput);
  await hooks.config!({ agent: { lead: { mode: 'primary' }, reviewer: { mode: 'subagent' } } });
  const context = { agent: 'lead', abort: new AbortController().signal } as ToolContext;
  const tool = hooks.tool!.workflow_status;
  const result = await tool.execute({ stage: 'review', summary: 'Reviewing output' }, context);
  assert.equal(typeof result, 'object');
  assert.deepEqual(typeof result === 'object' && result.metadata?.workflowPanel, {
    version: 1,
    stage: 'review',
    summary: 'Reviewing output',
    agent: 'lead',
  });
  await assert.rejects(
    () => tool.execute({ stage: 'complete', summary: 'Done' }, { ...context, agent: 'reviewer' }),
    /primary/,
  );
  await assert.rejects(() => tool.execute({ stage: 'review', summary: '\x00' }, context), /visible/);
});

test('workflow collection preserves partial results and never follows a child cycle', async () => {
  const controller = new AbortController();
  let statusAvailable = true;
  const api = {
    lifecycle: { signal: controller.signal },
    client: {
      session: {
        get: async () => ({ data: session() }),
        messages: async ({ sessionID }: { sessionID: string }) =>
          sessionID === 'session-a' ? { data: [entry(1)] } : { error: 'deleted' },
        status: async () => (statusAvailable ? { data: {} } : { error: 'unavailable' }),
        children: async ({ sessionID }: { sessionID: string }) => ({
          data: sessionID === 'session-a' ? [session('child', 'session-a')] : [session()],
        }),
      },
    },
  } as unknown as TuiPluginApi;
  const result = await loadWorkflow(api, 'session-a', controller.signal);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[1]?.unavailable, true);
  assert.equal(result.partial, true);
  assert.equal(result.statuses['session-a']?.type, 'idle');
  statusAvailable = false;
  assert.equal((await loadWorkflow(api, 'session-a', controller.signal)).statuses['session-a'], undefined);
});

test('config and context register commands and open mocked menus with completed-request usage', async () => {
  const commands = new Map<string, () => Promise<void>>();
  let shown: { title: string; options: { title: string; value: string; description?: string }[] } | undefined;
  const api = {
    lifecycle: { signal: new AbortController().signal },
    route: { current: { name: 'session', params: { sessionID: 'session-a' } } },
    keymap: {
      registerLayer: ({ commands: items }: { commands: { name: string; run: () => Promise<void> }[] }) => {
        items.forEach((item) => commands.set(item.name, item.run));
        return () => {};
      },
    },
    ui: {
      dialog: { replace: (render: () => unknown) => render() },
      DialogSelect: (props: typeof shown) => {
        shown = props;
      },
      toast: () => assert.fail('Unexpected error toast'),
    },
    client: {
      app: { agents: async () => ({ data: [{ name: 'lead', mode: 'primary', options: {}, permission: [] }] }) },
      config: { get: async () => ({ data: { model: 'fixture/default' } }) },
      global: { config: { get: async () => ({ data: { model: 'fixture/global' } }) } },
      session: {
        get: async () => ({ data: session() }),
        messages: async () => ({
          data: [
            entry(1),
            entry(2, [], {
              time: { created: 2 },
              tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            }),
          ],
        }),
      },
    },
  } as unknown as TuiPluginApi;
  await configPlugin.tui(api);
  await contextPlugin.tui(api);
  await commands.get('effective-config.open')!();
  assert.equal(shown?.title, 'Effective config: agent');
  assert.equal(shown.options[0]?.title, 'lead');
  await commands.get('context-inspector.open')!();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The command can replace the captured dialog.
  assert.equal(shown?.title, 'Context inspector');
  assert.match(shown.options[0]?.description ?? '', /10 input/);
});
