/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi, TuiPluginModule } from '@opencode-ai/plugin/tui';
import { type Accessor, For, type Setter, Show, createEffect, createSignal, onCleanup } from 'solid-js';
import { activity, clean, stageReport } from './model.ts';
import { type Action, currentSession } from './client.ts';
import { type WorkflowData, type WorkflowRow, loadWorkflow } from './workflow-data.ts';
import { type WorkflowAssignment, type WorkflowPhase, initialPrompt, phaseLabel } from './workflow-timeline.ts';
import { PromptReader, readInitialPrompt, workflowUi } from './workflow-view.tsx';

function feed(api: TuiPluginApi, sessionID: string, fullHistory = true) {
  const [data, setData] = createSignal<WorkflowData>();
  const [failed, setFailed] = createSignal(false);
  const controller = new AbortController();
  let busy = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const markFailed = () => {
    if (!controller.signal.aborted) {
      setFailed(true);
    }
  };
  const refresh = async () => {
    if (controller.signal.aborted || api.lifecycle.signal.aborted) {
      return;
    }
    if (busy) {
      pending = true;
      return;
    }
    busy = true;
    const client = api.client;
    try {
      const result = await loadWorkflow(api, sessionID, controller.signal, fullHistory);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Disposal can abort the signal while the request is pending.
      if (!controller.signal.aborted && client === api.client) {
        setData(result);
        setFailed(false);
      }
    } catch {
      if (client === api.client) {
        markFailed();
      }
    } finally {
      busy = false;
      if (pending) {
        pending = false;
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- Deferred refresh completion runs after the scheduler is initialized.
        schedule();
      }
    }
  };
  const schedule = () => {
    if (timer !== undefined || controller.signal.aborted) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      refresh().catch(markFailed);
    }, 500);
  };
  const unsubscribers = [
    api.event.on('session.status', schedule),
    api.event.on('session.created', schedule),
    api.event.on('session.updated', schedule),
    api.event.on('session.deleted', schedule),
  ];
  const interval = setInterval(() => {
    refresh().catch(markFailed);
  }, 10_000);
  const dispose = () => {
    controller.abort();
    clearInterval(interval);
    clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
  const removeDispose = api.lifecycle.onDispose(dispose);
  onCleanup(() => {
    dispose();
    removeDispose();
  });
  refresh().catch(markFailed);
  return { data, failed, refresh };
}

function rowStatus(api: TuiPluginApi, data: WorkflowData, row: WorkflowRow): string {
  const questions = api.state.session.question(row.session.id).length;
  const permissions = api.state.session.permission(row.session.id).length;
  const status = data.statuses[row.session.id];
  if (questions > 0 || permissions > 0 || status?.type === 'busy' || status?.type === 'retry') {
    return activity(status, questions, permissions);
  }
  if (row.task?.state === 'completed') {
    return 'Delegation completed';
  }
  if (row.task?.state === 'error') {
    return 'Delegation failed';
  }
  return row.unavailable === true ? 'History unavailable' : activity(status, 0, 0);
}

function assignmentStatus(api: TuiPluginApi, data: WorkflowData, assignment: WorkflowAssignment): string {
  if (assignment.task?.background === true) {
    if (assignment.latest === true && assignment.row !== undefined) {
      const row = assignment.row;
      const questions = api.state.session.question(row.session.id).length;
      const permissions = api.state.session.permission(row.session.id).length;
      const status = data.statuses[row.session.id];
      if (questions > 0 || permissions > 0 || status?.type === 'busy' || status?.type === 'retry') {
        return activity(status, questions, permissions);
      }
    }
    if (assignment.task.state === 'error') {
      return 'Delegation failed';
    }
    return assignment.task.state === 'completed' ? 'Background dispatch completed' : 'Delegation running';
  }
  if (assignment.task?.state === 'completed') {
    return 'Delegation completed';
  }
  if (assignment.task?.state === 'error') {
    return 'Delegation failed';
  }
  return assignment.row !== undefined ? rowStatus(api, data, assignment.row) : 'Session unavailable';
}

function details(api: TuiPluginApi, view: ReturnType<typeof workflowUi>, assignment: WorkflowAssignment) {
  const row = assignment.row;
  const task = assignment.task;
  const agent = task?.agent ?? row?.agent ?? 'Subagent';
  view.menu(clean(agent), [
    {
      title: task !== undefined ? 'View assignment prompt' : 'View initial prompt',
      value: 'prompt',
      description: 'Read the prompt in a large view',
      run: () =>
        view.navigation.show(() => (
          <PromptReader
            api={api}
            view={view}
            title={task !== undefined ? 'Assignment prompt' : 'Initial prompt'}
            load={(signal) =>
              task !== undefined ? Promise.resolve(task.prompt) : readInitialPrompt(api, assignment.sessionID, signal)
            }
          />
        )),
    },
    {
      title: 'Open conversation',
      value: 'open',
      description: clean(row?.session.title),
      run: () => {
        view.navigation.close();
        api.route.navigate('session', { sessionID: assignment.sessionID });
      },
    },
    {
      title: 'Last recorded model',
      value: 'model',
      description: row !== undefined ? `${row.model} · ${row.variant}` : 'Session unavailable',
      run: () =>
        view.alert(
          'Recorded model',
          row !== undefined
            ? `${row.model}\nVariant: ${row.variant}\nThis describes the latest recorded turn in the session.`
            : 'No recorded model is available.',
        ),
    },
    {
      title: 'Delegated task',
      value: 'task',
      description: task?.description ?? 'No linked assignment',
      run: () => view.alert('Delegated task', task?.description ?? clean(row?.session.title)),
    },
    {
      title: 'Timing',
      value: 'time',
      description:
        task?.duration !== undefined
          ? `${Math.round(task.duration / 1000)} seconds ${task.background ? 'to dispatch this background assignment' : 'for this assignment'}`
          : task !== undefined
            ? `Assignment started ${new Date(task.started).toLocaleString()}`
            : row !== undefined
              ? `Session created ${new Date(row.session.time.created).toLocaleString()}`
              : 'Timing unavailable',
    },
  ]);
}

interface WorkflowViewState {
  expanded: Accessor<ReadonlyMap<string, boolean>>;
  setExpanded: Setter<ReadonlyMap<string, boolean>>;
  current?: string;
  initialSessionID?: string;
}

function Dialog(props: {
  api: TuiPluginApi;
  sessionID: string;
  view: ReturnType<typeof workflowUi>;
  state: WorkflowViewState;
}) {
  const source = feed(props.api, props.sessionID);
  const isExpanded = (phase: WorkflowPhase, data: WorkflowData) =>
    props.state.expanded().get(phase.id) ?? phase.id === data.phases.at(-1)?.id;
  createEffect(() => {
    const data = source.data();
    const target = props.state.initialSessionID;
    if (data === undefined || target === undefined) {
      return;
    }
    props.state.initialSessionID = undefined;
    const assignment = data.phases
      .flatMap((phase) => phase.assignments)
      .find((item) => item.sessionID === target && item.latest === true);
    const row = data.rows.find((item) => item.session.id === target);
    if (assignment !== undefined) {
      details(props.api, props.view, assignment);
    } else if (row !== undefined) {
      details(props.api, props.view, { id: row.session.id, sessionID: target, depth: row.depth, row });
    }
  });
  const actions = (): Action[] => {
    const data = source.data();
    if (data === undefined) {
      return [
        {
          title: source.failed() ? 'Could not load workflow. Select to retry.' : 'Loading workflow…',
          value: 'retry',
          run: source.refresh,
        },
      ];
    }
    return [
      {
        title: 'Initial request',
        value: 'request',
        description: clean(data.root.session.title),
        run: () =>
          props.view.navigation.show(() => (
            <PromptReader
              api={props.api}
              view={props.view}
              title="Initial request"
              load={() => Promise.resolve(initialPrompt(data.root.entries))}
            />
          )),
      },
      ...data.phases.flatMap((phase): Action[] => [
        {
          title: `${isExpanded(phase, data) ? '▾' : '▸'} ${phaseLabel(phase)}`,
          value: `phase:${phase.id}`,
          description: phase.summary,
          footer: `${phase.assignments.length} assignments${phase.id === data.phases.at(-1)?.id ? ' · current' : ''}`,
          run: () => {
            props.state.setExpanded((current) => new Map(current).set(phase.id, !isExpanded(phase, data)));
          },
        },
        ...(isExpanded(phase, data)
          ? phase.assignments.map((assignment): Action => ({
              title: `${'  '.repeat(assignment.depth)}${assignment.task?.agent ?? assignment.row?.agent ?? 'Subagent'}`,
              value: `assignment:${assignment.id}`,
              description: assignment.task?.description ?? clean(assignment.row?.session.title),
              footer: assignmentStatus(props.api, data, assignment),
              run: () => details(props.api, props.view, assignment),
            }))
          : []),
      ]),
      ...data.rows
        .filter((row) => row.depth === 0)
        .map((row): Action => ({
          title: `Lead: ${row.agent}`,
          value: `lead:${row.session.id}`,
          footer: rowStatus(props.api, data, row),
          run: () => details(props.api, props.view, { id: row.session.id, sessionID: row.session.id, depth: 0, row }),
        })),
      {
        title: 'Refresh',
        value: 'refresh',
        description: source.failed()
          ? 'Refresh failed; displayed data may be stale.'
          : `Recorded phase history.${data.partial ? ' Some child sessions or statuses are unavailable.' : ''}`,
        run: source.refresh,
      },
    ];
  };
  return props.view.navigation.select({
    title: 'Live workflow',
    placeholder: 'Find an agent or task…',
    current: props.state.current,
    get options() {
      return actions();
    },
    onSelect: (option) => {
      props.state.current = option.value;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- ui.run catches action failures and reports them in a toast.
      void props.view.run(() =>
        actions()
          .find((item) => item.value === option.value)
          ?.run?.(),
      );
    },
    onMove: (option) => {
      props.state.current = option.value;
    },
  })();
}

function Sidebar(props: { api: TuiPluginApi; sessionID: string; open: (row?: WorkflowRow) => void }) {
  const source = feed(props.api, props.sessionID, false);
  const report = () => {
    const data = source.data();
    return data !== undefined ? stageReport(data.root.entries) : undefined;
  };
  const theme = () => props.api.theme.current;
  return (
    <box gap={1}>
      <text fg={theme().primary} onMouseUp={() => props.open()}>
        Workflow
      </text>
      <text fg={theme().text}>{report()?.stage ?? 'Stage not reported'}</text>
      <Show when={report()?.summary}>{(summary) => <text fg={theme().textMuted}>{summary()}</text>}</Show>
      <Show when={source.failed()}>
        <text fg={theme().warning}>Refresh failed; data may be stale.</text>
      </Show>
      <For each={source.data()?.rows.slice(0, 5)}>
        {(row) => {
          const status = () => {
            const data = source.data();
            return data !== undefined ? rowStatus(props.api, data, row) : 'Loading';
          };
          return (
            <text fg={theme().textMuted} onMouseUp={() => props.open(row)}>
              {row.agent}: {status()}
            </text>
          );
        }}
      </For>
    </box>
  );
}

export default {
  id: 'workflow-panel',
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires Promise-returning TUI initialization hooks.
  tui: async (api) => {
    const view = workflowUi(api);
    const open = (sessionID = currentSession(api), row?: WorkflowRow) => {
      const [expanded, setExpanded] = createSignal<ReadonlyMap<string, boolean>>(new Map());
      const state: WorkflowViewState = { expanded, setExpanded, initialSessionID: row?.session.id };
      view.navigation.show(() => <Dialog api={api} view={view} sessionID={sessionID} state={state} />, true);
    };
    view.command('workflow-panel.open', 'Live workflow', 'workflow-panel', 'Session', () => open());
    api.slots.register({
      order: 350,
      slots: {
        sidebar_content: (_context, props) => (
          <Show when={props.session_id} keyed>
            {(sessionID: string) => <Sidebar api={api} sessionID={sessionID} open={(row) => open(sessionID, row)} />}
          </Show>
        ),
      },
    });
  },
} satisfies TuiPluginModule;
