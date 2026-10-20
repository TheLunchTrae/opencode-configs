import type { TuiPluginApi } from '@opencode-ai/plugin/tui';
import type { Session, SessionStatus } from '@opencode-ai/sdk/v2';
import type { Snapshot } from './client.ts';
import {
  type Delegation,
  type Entry,
  PanelError,
  clean,
  delegations,
  hasResponseData,
  historyLimit,
  lastAssistant,
} from './model.ts';
import { type WorkflowPhase, workflowTimeline } from './workflow-timeline.ts';

export interface WorkflowRow {
  session: Session;
  agent: string;
  model: string;
  variant: string;
  depth: number;
  task?: Delegation;
  unavailable?: boolean;
}
export interface WorkflowData {
  root: Snapshot;
  rows: WorkflowRow[];
  statuses: Partial<Record<string, SessionStatus>>;
  partial: boolean;
  phases: WorkflowPhase[];
}

export async function loadWorkflow(
  api: TuiPluginApi,
  sessionID: string,
  signal: AbortSignal,
  fullHistory = true,
): Promise<WorkflowData> {
  const client = api.client;
  const options = { signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15_000)]) };
  const [session, messages] = await Promise.all([
    client.session.get({ sessionID }, options),
    client.session.messages({ sessionID, ...(fullHistory ? {} : { limit: historyLimit }) }, options),
  ]);
  if (
    Boolean(session.error) ||
    Boolean(messages.error) ||
    !hasResponseData(session.data) ||
    !hasResponseData(messages.data)
  ) {
    throw new PanelError('Could not read this session. It may have been deleted or the server is unavailable.');
  }
  const root: Snapshot = {
    session: session.data,
    entries: messages.data,
    limited: !fullHistory && messages.data.length >= historyLimit,
  };
  const status = await client.session.status({}, options);
  const rows: WorkflowRow[] = [];
  const statusFailed = Boolean(status.error);
  const statusesAvailable = Boolean(status.data);
  let partial = statusFailed || !statusesAvailable;
  const seen = new Set<string>();
  const histories = new Map<string, readonly Entry[]>([[sessionID, root.entries]]);
  const queue: { session: Session; depth: number; task?: Delegation }[] = [{ session: root.session, depth: 0 }];
  while (queue.length > 0 && rows.length < 24 && !signal.aborted) {
    const item = queue.shift();
    if (item === undefined) {
      break;
    }
    if (seen.has(item.session.id)) {
      continue;
    }
    seen.add(item.session.id);
    const history =
      item.depth === 0
        ? { data: root.entries, error: undefined }
        : await client.session.messages({ sessionID: item.session.id, ...(fullHistory ? {} : { limit: 20 }) }, options);
    const unavailable = Boolean(history.error) || !hasResponseData(history.data);
    histories.set(item.session.id, history.data ?? []);
    const last = lastAssistant(history.data ?? []);
    const agent = clean(last?.agent ?? item.session.agent ?? item.task?.agent);
    const variant = clean(last?.variant);
    rows.push({
      ...item,
      agent: agent.length > 0 ? agent : 'Agent unavailable',
      model: last !== undefined ? clean(`${last.providerID}/${last.modelID}`) : 'No recorded model in loaded history',
      variant: variant.length > 0 ? variant : 'Not recorded',
      unavailable,
    });
    partial ||= unavailable;
    if (item.depth >= 2) {
      continue;
    }
    const children = await client.session.children({ sessionID: item.session.id }, options);
    const childrenUnavailable = Boolean(children.error) || !hasResponseData(children.data);
    if (childrenUnavailable) {
      partial = true;
      continue;
    }
    const tasks = delegations(history.data ?? []);
    for (const session of children.data ?? []) {
      if (queue.length + rows.length >= 24) {
        partial = true;
        break;
      }
      if (!seen.has(session.id)) {
        queue.push({ session, depth: item.depth + 1, task: tasks.find((task) => task.sessionID === session.id) });
      }
    }
  }
  const statuses = { ...status.data };
  // V1 removes idle sessions from the status map. Missing entries in a successful response mean idle.
  if (!statusFailed && statusesAvailable) {
    for (const row of rows) {
      statuses[row.session.id] ??= { type: 'idle' };
    }
  }
  const phases = fullHistory ? workflowTimeline(sessionID, histories, rows) : [];
  partial ||= phases.some((phase) => phase.assignments.some((assignment) => assignment.row === undefined));
  return { root, rows, statuses, phases, partial: partial || queue.length > 0 };
}
