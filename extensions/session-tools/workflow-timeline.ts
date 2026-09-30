import type { WorkflowRow } from './workflow-data.ts';
import { type Delegation, type Entry, type Stage, clean, ordered, record, stages } from './model.ts';

export interface RecordedDelegation extends Delegation {
  id: string;
  parentSessionID: string;
  messageID: string;
  prompt?: string;
  started: number;
  ended?: number;
  background: boolean;
}
export interface WorkflowAssignment {
  id: string;
  sessionID: string;
  depth: number;
  row?: WorkflowRow;
  task?: RecordedDelegation;
  latest?: boolean;
}
export interface WorkflowPhase {
  id: string;
  stage: Stage | 'unassigned';
  occurrence: number;
  summary: string;
  started?: number;
  ended?: number;
  assignments: WorkflowAssignment[];
}

interface EventOrder {
  time: number;
  messageID: string;
  partID: string;
}
interface ReportEvent extends EventOrder {
  kind: 'report';
  stage: Stage;
  summary: string;
}
interface TaskEvent extends EventOrder {
  kind: 'task';
  task: RecordedDelegation;
}
type TimelineEvent = ReportEvent | TaskEvent;

function compareEvents(a: EventOrder, b: EventOrder): number {
  const time = a.time - b.time;
  if (time !== 0) {
    return time;
  }
  const message = a.messageID.localeCompare(b.messageID);
  return message !== 0 ? message : a.partID.localeCompare(b.partID);
}

function timelineEvents(sessionID: string, entries: readonly Entry[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const entry of ordered(entries)) {
    if (entry.info.role !== 'assistant') {
      continue;
    }
    for (const part of entry.parts) {
      if (part.type !== 'tool' || part.state.status === 'pending') {
        continue;
      }
      const state = part.state;
      if (part.tool === 'workflow_status' && state.status === 'completed') {
        const data = state.metadata.workflowPanel;
        if (
          record(data) &&
          data.version === 1 &&
          stages.some((stage) => stage === data.stage) &&
          typeof data.summary === 'string' &&
          data.agent === entry.info.agent &&
          Number.isFinite(state.time.end)
        ) {
          const stage = stages.find((value) => value === data.stage);
          if (stage !== undefined) {
            events.push({
              kind: 'report',
              time: state.time.end,
              messageID: entry.info.id,
              partID: part.id,
              stage,
              summary: clean(data.summary),
            });
          }
        }
      }
      const metadata = state.metadata;
      if (
        part.tool !== 'task' ||
        !record(metadata) ||
        typeof metadata.sessionId !== 'string' ||
        metadata.sessionId.length === 0 ||
        !Number.isFinite(state.time.start)
      ) {
        continue;
      }
      const ended = state.status === 'completed' || state.status === 'error' ? state.time.end : undefined;
      const prompt = state.input.prompt;
      const agent = clean(state.input.subagent_type);
      const description = clean(state.input.description);
      const task: RecordedDelegation = {
        id: `${sessionID}:${part.id}`,
        parentSessionID: sessionID,
        messageID: entry.info.id,
        sessionID: metadata.sessionId,
        agent: agent.length > 0 ? agent : 'Subagent',
        description: description.length > 0 ? description : 'Delegated task',
        state: state.status,
        started: state.time.start,
        ended,
        duration: ended !== undefined ? Math.max(0, ended - state.time.start) : undefined,
        prompt: typeof prompt === 'string' ? clean(prompt, prompt.length) : undefined,
        background: metadata.background === true,
      };
      events.push({ kind: 'task', time: task.started, messageID: entry.info.id, partID: part.id, task });
    }
  }
  return events.sort(compareEvents);
}

export function initialPrompt(entries: readonly Entry[]): string | undefined {
  const first = ordered(entries).find((entry) => entry.info.role === 'user');
  const text = first?.parts
    .filter((part) => part.type === 'text' && part.synthetic !== true && part.ignored !== true)
    .map((part) => (part.type === 'text' ? clean(part.text, part.text.length) : ''))
    .join('\n');
  return text !== undefined && text.trim().length > 0 ? text : undefined;
}

export function phaseLabel(phase: WorkflowPhase): string {
  const labels: Record<WorkflowPhase['stage'], string> = {
    planning: 'Planning',
    implementation: 'Dev',
    review: 'Review',
    verification: 'Verification',
    blocked: 'Blocked',
    complete: 'Complete',
    unassigned: 'Unassigned',
  };
  return phase.stage === 'unassigned' ? labels.unassigned : `${labels[phase.stage]} ${phase.occurrence}`;
}

export function workflowTimeline(
  rootID: string,
  histories: ReadonlyMap<string, readonly Entry[]>,
  rows: readonly WorkflowRow[],
): WorkflowPhase[] {
  const phases: WorkflowPhase[] = [];
  const counts = new Map<Stage, number>();
  const unassigned: WorkflowPhase = {
    id: `${rootID}:unassigned`,
    stage: 'unassigned',
    occurrence: 0,
    summary: 'No recorded phase or delegation establishes the assignment.',
    assignments: [],
  };
  const rowBySession = new Map(rows.map((row) => [row.session.id, row]));
  const phaseByTask = new Map<string, WorkflowPhase>();
  const tasks: TaskEvent[] = [];
  let current: WorkflowPhase | undefined;
  for (const event of timelineEvents(rootID, histories.get(rootID) ?? [])) {
    if (event.kind === 'task') {
      tasks.push(event);
      phaseByTask.set(event.task.id, current ?? unassigned);
      continue;
    }
    if (current?.stage === event.stage) {
      current.summary = event.summary;
      continue;
    }
    if (current !== undefined) {
      current.ended = event.time;
    }
    const occurrence = (counts.get(event.stage) ?? 0) + 1;
    counts.set(event.stage, occurrence);
    current = {
      id: `${rootID}:${event.partID}`,
      stage: event.stage,
      occurrence,
      summary: event.summary,
      started: event.time,
      assignments: [],
    };
    phases.push(current);
  }

  for (const [sessionID, entries] of histories) {
    if (sessionID !== rootID) {
      tasks.push(...timelineEvents(sessionID, entries).filter((event): event is TaskEvent => event.kind === 'task'));
    }
  }
  tasks.sort(compareEvents);
  const tasksByChildSession = new Map<string, TaskEvent[]>();
  for (const event of tasks) {
    const launches = tasksByChildSession.get(event.task.sessionID) ?? [];
    launches.push(event);
    tasksByChildSession.set(event.task.sessionID, launches);
  }
  const nested = tasks.filter((event) => event.task.parentSessionID !== rootID);
  for (const event of nested) {
    const launches = tasksByChildSession.get(event.task.parentSessionID) ?? [];
    const overlapping = launches.filter(
      (candidate) =>
        compareEvents(candidate, event) <= 0 &&
        (candidate.task.background || candidate.task.ended === undefined || event.time < candidate.task.ended),
    );
    const candidates = launches.filter((candidate, index) => {
      const next = launches.at(index + 1);
      return (
        compareEvents(candidate, event) <= 0 &&
        (next === undefined || compareEvents(event, next) < 0) &&
        (candidate.task.ended === undefined || candidate.task.background || event.time <= candidate.task.ended)
      );
    });
    const parent = overlapping.length < 2 && candidates.length === 1 ? candidates.at(0) : undefined;
    phaseByTask.set(event.task.id, parent !== undefined ? (phaseByTask.get(parent.task.id) ?? unassigned) : unassigned);
  }

  const linked = new Set<string>();
  for (const event of tasks) {
    const task = event.task;
    linked.add(task.sessionID);
    const row = rowBySession.get(task.sessionID);
    const assignment: WorkflowAssignment = {
      id: task.id,
      sessionID: task.sessionID,
      depth: (rowBySession.get(task.parentSessionID)?.depth ?? 0) + 1,
      row: row !== undefined ? { ...row, agent: task.agent, task } : undefined,
      task,
      latest: tasksByChildSession.get(task.sessionID)?.at(-1)?.task.id === task.id,
    };
    (phaseByTask.get(task.id) ?? unassigned).assignments.push(assignment);
  }
  for (const row of rows) {
    if (row.depth > 0 && !linked.has(row.session.id)) {
      unassigned.assignments.push({
        id: `${rootID}:unlinked:${row.session.id}`,
        sessionID: row.session.id,
        depth: row.depth,
        row,
        latest: true,
      });
    }
  }
  return unassigned.assignments.length > 0 ? [unassigned, ...phases] : phases;
}
