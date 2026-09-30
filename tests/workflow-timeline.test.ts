import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Session } from '@opencode-ai/sdk/v2';
import type { Entry } from '../extensions/session-tools/model.ts';
import { type WorkflowRow, loadWorkflow } from '../extensions/session-tools/workflow-data.ts';
import { initialPrompt, phaseLabel, workflowTimeline } from '../extensions/session-tools/workflow-timeline.ts';
import type { TuiPluginApi } from '@opencode-ai/plugin/tui';

const session = (id: string, parentID?: string): Session => ({
  id,
  parentID,
  slug: id,
  projectID: 'project',
  directory: '/project',
  title: id,
  version: '1.18.29',
  time: { created: 0, updated: 100 },
});
const row = (id: string, depth = 1): WorkflowRow => ({
  session: session(id, depth > 0 ? 'root' : undefined),
  agent: 'developer',
  model: 'fixture/model',
  variant: 'high',
  depth,
});
const entry = (id: string, time: number, parts: unknown[], role = 'assistant'): Entry =>
  ({
    info: { id, role, sessionID: 'root', agent: 'lead', time: { created: time } },
    parts,
  }) as Entry;
const report = (id: string, time: number, stage: string, summary = stage) => ({
  id,
  type: 'tool',
  tool: 'workflow_status',
  state: {
    status: 'completed',
    input: {},
    time: { start: time, end: time },
    metadata: { workflowPanel: { version: 1, stage, summary, agent: 'lead' } },
  },
});
const task = (
  id: string,
  time: number,
  child = 'developer',
  prompt = id,
  ended: number | null = time + 10,
  background = false,
) => ({
  id,
  type: 'tool',
  tool: 'task',
  state: {
    status: ended !== null ? 'completed' : 'running',
    input: { subagent_type: 'developer', description: id, prompt },
    time: { start: time, ...(ended !== null ? { end: ended } : {}) },
    metadata: { sessionId: child, background },
  },
});

test('phase occurrences retain entry identity and update repeated same-stage reports', () => {
  const histories = new Map([
    [
      'root',
      [
        entry('message-7', 70, [report('part-7', 70, 'complete')]),
        entry('message-2', 20, [report('part-2', 20, 'planning', 'Plan reviewed')]),
        entry('message-1', 10, [report('part-1', 10, 'planning')]),
        entry('message-3', 30, [report('part-3', 30, 'implementation')]),
        entry('message-4', 40, [report('part-4', 40, 'review')]),
        entry('message-5', 50, [report('part-5', 50, 'implementation')]),
        entry('message-6', 60, [report('part-6', 60, 'blocked')]),
      ],
    ],
  ]);
  const phases = workflowTimeline('root', histories, [row('root', 0)]);
  assert.deepEqual(phases.map(phaseLabel), ['Planning 1', 'Dev 1', 'Review 1', 'Dev 2', 'Blocked 1', 'Complete 1']);
  assert.equal(phases[0]?.id, 'root:part-1');
  assert.equal(phases[0]?.summary, 'Plan reviewed');
  assert.equal(phases[0]?.started, 10);
  assert.equal(phases[0]?.ended, 30);
  assert.deepEqual(workflowTimeline('root', histories, [row('root', 0)]), phases);
});

test('resumed child assignments retain independent prompts, phase identity, and completed status', () => {
  const longPrompt = `First line\n${'x'.repeat(40_000)}\nLast line\x1b]52;c;SECRET\x07`;
  const phases = workflowTimeline(
    'root',
    new Map([
      [
        'root',
        [
          entry('m1', 10, [report('p1', 10, 'implementation')]),
          entry('m2', 20, [task('first-task', 20, 'developer', longPrompt, 25)]),
          entry('m3', 30, [report('p3', 30, 'review')]),
          entry('m4', 40, [report('p4', 40, 'implementation')]),
          entry('m5', 50, [task('second-task', 50, 'developer', 'Repair review findings', null)]),
        ],
      ],
    ]),
    [row('root', 0), row('developer')],
  );
  const first = phases.at(0)?.assignments.at(0);
  const second = phases.at(2)?.assignments.at(0);
  assert.ok(first?.task !== undefined);
  assert.ok(first.row?.task !== undefined);
  assert.ok(second?.task !== undefined);
  assert.equal(first.id, 'root:first-task');
  assert.equal(first.task.state, 'completed');
  assert.equal(first.row.task.state, 'completed');
  assert.equal(first.task.prompt, longPrompt.slice(0, longPrompt.indexOf('\x1b')));
  assert.equal(second.task.state, 'running');
  assert.equal(second.task.prompt, 'Repair review findings');
  assert.equal(first.sessionID, second.sessionID);
  assert.equal(first.latest, false);
  assert.equal(second.latest, true);
});

test('equal timestamps use stable message and part IDs rather than returned message or render row order', () => {
  const phases = workflowTimeline(
    'root',
    new Map([['root', [entry('m1', 10, [task('p2', 10, 'z'), report('p1', 10, 'planning'), task('p3', 10, 'a')])]]]),
    [row('root', 0), row('a'), row('z')],
  );
  assert.deepEqual(phases.map(phaseLabel), ['Planning 1']);
  assert.deepEqual(
    phases[0]?.assignments.map((assignment) => assignment.sessionID),
    ['z', 'a'],
  );
});

test('nested tasks inherit their resumed parent launch phase across phase transitions', () => {
  const phases = workflowTimeline(
    'root',
    new Map([
      [
        'root',
        [
          entry('m10', 10, [report('p10', 10, 'implementation')]),
          entry('m20', 20, [task('launch-1', 20, 'developer', 'Build', 39)]),
          entry('m30', 30, [report('p30', 30, 'review')]),
          entry('m40', 40, [report('p40', 40, 'implementation')]),
          entry('m50', 50, [task('launch-2', 50, 'developer', 'Repair', 90)]),
        ],
      ],
      [
        'developer',
        [entry('m35', 35, [task('nested-1', 35, 'reviewer')]), entry('m60', 60, [task('nested-2', 60, 'reviewer')])],
      ],
    ]),
    [row('root', 0), row('developer'), row('reviewer', 2)],
  );
  assert.deepEqual(
    phases[0]?.assignments.map((assignment) => assignment.id),
    ['root:launch-1', 'developer:nested-1'],
  );
  assert.equal(phases[1]?.assignments.length, 0);
  assert.deepEqual(
    phases[2]?.assignments.map((assignment) => assignment.id),
    ['root:launch-2', 'developer:nested-2'],
  );
  assert.equal(phases[2]?.assignments[1]?.depth, 2);
});

test('background dispatch completion cannot establish which resumed invocation launched nested work', () => {
  const phases = workflowTimeline(
    'root',
    new Map([
      [
        'root',
        [
          entry('m10', 10, [report('p10', 10, 'implementation')]),
          entry('m20', 20, [task('first-background', 20, 'developer', 'Build', 21, true)]),
          entry('m30', 30, [report('p30', 30, 'review')]),
          entry('m40', 40, [report('p40', 40, 'implementation')]),
          entry('m50', 50, [task('second-background', 50, 'developer', 'Repair', 51, true)]),
        ],
      ],
      [
        'developer',
        [
          entry('m35', 35, [task('known-background', 35, 'reviewer')]),
          entry('m60', 60, [task('ambiguous-background', 60, 'reviewer')]),
        ],
      ],
    ]),
    [row('root', 0), row('developer'), row('reviewer', 2)],
  );
  assert.equal(phases[0]?.stage, 'unassigned');
  assert.deepEqual(
    phases[0]?.assignments.map((assignment) => assignment.id),
    ['developer:ambiguous-background'],
  );
  assert.deepEqual(
    phases[1]?.assignments.map((assignment) => assignment.id),
    ['root:first-background', 'developer:known-background'],
  );
  assert.deepEqual(
    phases[3]?.assignments.map((assignment) => assignment.id),
    ['root:second-background'],
  );
});

test('tasks before any report, orphan descendants, and unlinked children remain explicitly unassigned', () => {
  const phases = workflowTimeline(
    'root',
    new Map([
      [
        'root',
        [entry('m1', 1, [task('before-phase', 1, 'missing-child')]), entry('m2', 2, [report('p2', 2, 'planning')])],
      ],
      ['unlinked', [entry('m3', 3, [task('orphan-task', 3, 'nested')])]],
    ]),
    [row('root', 0), row('unlinked'), row('nested', 2)],
  );
  assert.equal(phaseLabel(phases.at(0)!), 'Unassigned');
  assert.deepEqual(
    phases[0]?.assignments.map((assignment) => assignment.sessionID),
    ['missing-child', 'nested', 'unlinked'],
  );
  assert.equal(phases[0]?.assignments[0]?.row, undefined);
  assert.equal(phases[0]?.assignments[2]?.task, undefined);
  assert.equal(phases[0]?.assignments[2]?.latest, true);
});

test('nested calls between completed launches or overlapping launches do not receive a guessed phase', () => {
  const phases = workflowTimeline(
    'root',
    new Map([
      [
        'root',
        [
          entry('m10', 10, [report('p10', 10, 'implementation')]),
          entry('m20', 20, [task('first', 20, 'developer', 'First assignment', 25)]),
          entry('m40', 40, [report('p40', 40, 'review')]),
          entry('m50', 50, [task('second', 50, 'developer', 'Second assignment', 90)]),
          entry('m60', 60, [task('overlap', 60, 'developer', 'Overlapping assignment', null)]),
        ],
      ],
      [
        'developer',
        [entry('m30', 30, [task('between', 30, 'nested')]), entry('m70', 70, [task('ambiguous', 70, 'nested')])],
      ],
    ]),
    [row('root', 0), row('developer'), row('nested', 2)],
  );
  assert.equal(phases[0]?.stage, 'unassigned');
  assert.deepEqual(
    phases[0]?.assignments.map((assignment) => assignment.id),
    ['developer:between', 'developer:ambiguous'],
  );
});

test('only completed, attributed stage reports create timeline phases', () => {
  const wrongAgent = report('wrong-agent', 1, 'planning');
  wrongAgent.state.metadata.workflowPanel.agent = 'different';
  const phases = workflowTimeline(
    'root',
    new Map([
      [
        'root',
        [
          entry('m1', 1, [wrongAgent]),
          entry('m2', 2, [report('invalid-stage', 2, 'invented')]),
          entry('m3', 3, [report('user-report', 3, 'planning')], 'user'),
          entry('m4', 4, [{ ...report('failed', 4, 'planning'), state: { status: 'error' } }]),
          entry('m5', 5, [report('valid', 5, 'planning')]),
        ],
      ],
    ]),
    [row('root', 0)],
  );
  assert.deepEqual(phases.map(phaseLabel), ['Planning 1']);
  assert.equal(phases[0]?.id, 'root:valid');
});

test('initial prompt selects the earliest user message before filtering generated and ignored text', () => {
  const long = `Prompt\n${'x'.repeat(40_000)}`;
  assert.equal(
    initialPrompt([
      entry('later', 20, [{ type: 'text', text: 'Later assignment' }], 'user'),
      entry(
        'first',
        10,
        [
          { type: 'text', text: long },
          { type: 'text', text: 'Generated reference content', synthetic: true },
          { type: 'text', text: 'Ignored', ignored: true },
          { type: 'text', text: 'Second part\x1b[31m' },
        ],
        'user',
      ),
    ]),
    `${long}\nSecond part`,
  );
  assert.equal(
    initialPrompt([
      entry('first', 10, [{ type: 'text', text: 'Generated', synthetic: true }], 'user'),
      entry('later', 20, [{ type: 'text', text: 'Later assignment' }], 'user'),
    ]),
    undefined,
  );
  assert.equal(initialPrompt([]), undefined);
});

test('timeline loader requests complete histories while sidebar polling retains bounded requests', async () => {
  const requests: { sessionID: string; limit?: number }[] = [];
  const rootEntries = Array.from({ length: 210 }, (_, index) =>
    entry(`m${index}`, index, index === 0 ? [report('planning', 0, 'planning')] : []),
  );
  const api = {
    lifecycle: { signal: new AbortController().signal },
    client: {
      session: {
        get: async () => ({ data: session('root') }),
        messages: async (request: { sessionID: string; limit?: number }) => {
          requests.push(request);
          return { data: request.sessionID === 'root' ? rootEntries : [] };
        },
        status: async () => ({ data: {} }),
        children: async ({ sessionID }: { sessionID: string }) => ({
          data: sessionID === 'root' ? [session('child', 'root')] : [],
        }),
      },
    },
  } as unknown as TuiPluginApi;
  const full = await loadWorkflow(api, 'root', api.lifecycle.signal);
  assert.deepEqual(requests, [{ sessionID: 'root' }, { sessionID: 'child' }]);
  assert.equal(full.root.limited, false);
  assert.equal(full.phases[1]?.stage, 'planning');
  requests.length = 0;
  const bounded = await loadWorkflow(api, 'root', api.lifecycle.signal, false);
  assert.deepEqual(requests, [
    { sessionID: 'root', limit: 200 },
    { sessionID: 'child', limit: 20 },
  ]);
  assert.equal(bounded.root.limited, true);
  assert.deepEqual(bounded.phases, []);
});

test('full-history traversal preserves the 24-session bound and marks omitted descendants as partial', async () => {
  const requested: string[] = [];
  const api = {
    lifecycle: { signal: new AbortController().signal },
    client: {
      session: {
        get: async () => ({ data: session('root') }),
        messages: async ({ sessionID }: { sessionID: string }) => {
          requested.push(sessionID);
          return { data: [] };
        },
        status: async () => ({ data: {} }),
        children: async ({ sessionID }: { sessionID: string }) => ({
          data: sessionID === 'root' ? Array.from({ length: 30 }, (_, index) => session(`child-${index}`, 'root')) : [],
        }),
      },
    },
  } as unknown as TuiPluginApi;
  const data = await loadWorkflow(api, 'root', api.lifecycle.signal);
  assert.equal(data.rows.length, 24);
  assert.equal(requested.length, 24);
  assert.equal(data.partial, true);
  assert.equal(data.phases[0]?.assignments.length, 23);
});
