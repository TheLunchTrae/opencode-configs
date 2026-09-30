import type { Agent, AssistantMessage, Config, Message, Part, Session, SessionStatus } from '@opencode-ai/sdk/v2';
import {
  type GroupOptions,
  type PromptOperations,
  SettingsError,
  agentGroups,
  readOptions,
  resolveGroup,
} from '../config-composer/settings.ts';

export interface Entry {
  info: Message;
  parts: Part[];
}
export class PanelError extends Error {}
export const stages = ['planning', 'implementation', 'review', 'verification', 'blocked', 'complete'] as const;
export type Stage = (typeof stages)[number];
export interface StageReport {
  stage: Stage;
  summary: string;
  agent: string;
  messageID: string;
  time: number;
}
export const historyLimit = 200;

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasResponseData<T extends object | null | undefined>(value: T): value is NonNullable<T> {
  return Boolean(value);
}

export function clean(value: unknown, limit = 400): string {
  if (typeof value !== 'string') {
    return '';
  }
  return (
    value
      // eslint-disable-next-line no-control-regex -- Remove terminal OSC sequences and their control-character terminators.
      .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
      // eslint-disable-next-line no-control-regex, regexp/no-obscure-range -- These ranges define the standard terminal CSI sequence syntax.
      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
      // eslint-disable-next-line no-control-regex -- Remove control characters from user-visible terminal text.
      .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
      .slice(0, limit)
  );
}

function cleanOr(value: unknown, fallback: string): string {
  const text = clean(value);
  return text.length > 0 ? text : fallback;
}

function nonzero(value: number | undefined): boolean {
  const number = value ?? 0;
  return number !== 0 && !Number.isNaN(number);
}

export function ordered(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const difference = a.info.time.created - b.info.time.created;
    return difference !== 0 && !Number.isNaN(difference) ? difference : a.info.id.localeCompare(b.info.id);
  });
}

export function lastAssistant(entries: readonly Entry[], agent?: string): AssistantMessage | undefined {
  return ordered(entries)
    .map((entry) => entry.info)
    .findLast(
      (info): info is AssistantMessage =>
        info.role === 'assistant' && (agent === undefined || agent === '' || info.agent === agent),
    );
}

function isStage(value: unknown): value is Stage {
  return stages.some((stage) => stage === value);
}

export function stageReport(entries: readonly Entry[]): StageReport | undefined {
  let report: StageReport | undefined;
  for (const entry of ordered(entries)) {
    if (entry.info.role !== 'assistant') {
      continue;
    }
    for (const part of entry.parts) {
      if (part.type !== 'tool' || part.tool !== 'workflow_status' || part.state.status !== 'completed') {
        continue;
      }
      const data = part.state.metadata.workflowPanel;
      if (
        !record(data) ||
        data.version !== 1 ||
        !isStage(data.stage) ||
        typeof data.summary !== 'string' ||
        data.agent !== entry.info.agent
      ) {
        continue;
      }
      report = {
        stage: data.stage,
        summary: clean(data.summary),
        agent: clean(data.agent),
        messageID: entry.info.id,
        time: part.state.time.end,
      };
    }
  }
  return report;
}

export function activity(status: SessionStatus | undefined, questions: number, permissions: number): string {
  if (nonzero(questions)) {
    return 'Question waiting';
  }
  if (nonzero(permissions)) {
    return 'Permission waiting';
  }
  if (status?.type === 'busy') {
    return 'Running';
  }
  if (status?.type === 'retry') {
    return `Retry ${status.attempt}`;
  }
  return status?.type === 'idle' ? 'Idle' : 'Status unavailable';
}

export interface Delegation {
  sessionID: string;
  agent: string;
  description: string;
  state: string;
  duration?: number;
}
export function delegations(entries: readonly Entry[]): Delegation[] {
  const found = new Map<string, Delegation>();
  for (const entry of ordered(entries)) {
    for (const part of entry.parts) {
      if (part.type !== 'tool' || part.tool !== 'task' || part.state.status === 'pending') {
        continue;
      }
      const metadata = part.state.metadata;
      if (!record(metadata) || typeof metadata.sessionId !== 'string') {
        continue;
      }
      const state = part.state;
      found.set(metadata.sessionId, {
        sessionID: metadata.sessionId,
        agent: cleanOr(state.input.subagent_type, 'Subagent'),
        description: cleanOr(state.input.description, 'Delegated task'),
        state: state.status,
        duration:
          state.status === 'completed' || state.status === 'error'
            ? Math.max(0, state.time.end - state.time.start)
            : undefined,
      });
    }
  }
  return [...found.values()];
}

export interface ContextRecord {
  kind: 'file' | 'skill' | 'compaction';
  label: string;
  evidence: string;
  messageID: string;
}
export function contextRecords(entries: readonly Entry[]): ContextRecord[] {
  const result: ContextRecord[] = [];
  for (const entry of ordered(entries)) {
    for (const part of entry.parts) {
      const source = { messageID: entry.info.id };
      if (part.type === 'file') {
        result.push({
          ...source,
          kind: 'file',
          label: cleanOr(part.filename, 'Unnamed attachment'),
          evidence: 'Attachment recorded in history',
        });
      }
      if (part.type === 'compaction') {
        result.push({
          ...source,
          kind: 'compaction',
          label: part.auto ? 'Automatic compaction requested' : 'Manual compaction requested',
          evidence: 'Request recorded; history presence does not prove current prompt inclusion',
        });
      }
      if (entry.info.role === 'assistant' && entry.info.summary === true && part.type === 'text') {
        if (!result.some((item) => item.kind === 'compaction' && item.messageID === entry.info.id)) {
          result.push({
            ...source,
            kind: 'compaction',
            label: 'Summary recorded',
            evidence: nonzero(entry.info.time.completed)
              ? 'Summary response completed'
              : 'Summary response in progress',
          });
        }
      }
      if (part.type !== 'tool' || part.state.status !== 'completed') {
        continue;
      }
      if (part.tool === 'read') {
        result.push({
          ...source,
          kind: 'file',
          label: cleanOr(part.state.input.filePath ?? part.state.input.path, 'Read target unavailable'),
          evidence: nonzero(part.state.time.compacted)
            ? 'Read completed; tool output later compacted'
            : 'Read tool completed',
        });
      }
      if (part.tool === 'skill') {
        result.push({
          ...source,
          kind: 'skill',
          label: cleanOr(part.state.input.name, 'Skill name unavailable'),
          evidence: 'Skill tool completed',
        });
      }
    }
  }
  return result;
}

export interface Fact {
  label: string;
  value: string;
}
export interface SavedConfigComposerConfiguration {
  settings?: GroupOptions;
  source?: string;
  unavailable?: string;
}

function configuredGroupFacts(
  group: string,
  settings: GroupOptions,
  config: Config,
  global: Config | null | undefined,
  saved: boolean,
): Fact[] {
  const prefix = saved ? `Saved group ${group}` : 'Group';
  const choice = Object.hasOwn(settings.groups, group) ? settings.groups[group] : undefined;
  if (choice === undefined) {
    return saved ? [{ label: `${prefix} default`, value: 'No configured group model' }] : [];
  }
  try {
    const resolved = resolveGroup(choice, { modelPresets: settings.modelPresets, native: config });
    const facts: Fact[] = [
      { label: saved ? `${prefix} default` : 'Configured group default', value: resolved.model ?? 'No group model' },
      {
        label: saved ? `${prefix} source` : 'Group model source',
        value:
          choice.modelRef ??
          (choice.model !== undefined && choice.model !== '' ? 'Specific model' : 'OpenCode fallback'),
      },
      { label: saved ? `${prefix} variant` : 'Resolved group variant', value: resolved.variant ?? 'Model default' },
    ];
    if (choice.modelRef?.startsWith('opencode:') === true) {
      const field = choice.modelRef === 'opencode:model' ? 'model' : 'small_model';
      facts.push({
        label: saved ? `${prefix} workspace reference` : 'Referenced workspace default',
        value: cleanOr(config[field], 'Not configured'),
      });
      facts.push({
        label: saved ? `${prefix} global reference` : 'Referenced global file default',
        value: hasResponseData(global) ? cleanOr(global[field], 'Not configured') : 'Unavailable',
      });
    }
    return facts;
  } catch (error) {
    if (!(error instanceof SettingsError)) {
      throw error;
    }
    return [{ label: saved ? `${prefix} resolution` : 'Group model resolution', value: `Invalid: ${error.message}` }];
  }
}

function promptSummary(operations: PromptOperations | undefined, enabled = true): string {
  return `${enabled ? 'Enabled' : 'Skipped by agent policy'}; prepend ${operations?.prepend?.length ?? 0}; append ${operations?.append?.length ?? 0}`;
}

function savedConfigComposerFacts(
  name: string,
  groups: string[],
  saved: SavedConfigComposerConfiguration,
  config: Config,
  global: Config | null | undefined,
): Fact[] {
  const settings = saved.settings;
  const facts: Fact[] = [
    { label: 'Config Composer settings file', value: saved.source ?? 'Unavailable' },
    {
      label: 'Saved Config Composer settings',
      value:
        settings === undefined
          ? (saved.unavailable ?? 'Unavailable; runtime facts remain available')
          : 'Saved file snapshot; may need reload. Server-resolved and last recorded models are shown separately.',
    },
  ];
  if (settings === undefined) {
    return facts;
  }
  const policy = Object.hasOwn(settings.agentPrompts, name) ? settings.agentPrompts[name] : undefined;
  facts.push({
    label: 'Saved prompt defaults',
    value: promptSummary(settings.promptDefaults, policy?.inheritDefaults !== false),
  });
  for (const group of groups) {
    facts.push(...configuredGroupFacts(group, settings, config, global, true));
    facts.push({
      label: `Saved group ${group} prompt`,
      value: promptSummary(
        Object.hasOwn(settings.groups, group) ? settings.groups[group].prompt : undefined,
        policy?.inheritGroups !== false,
      ),
    });
  }
  facts.push({ label: 'Saved agent prompt layer', value: promptSummary(policy) });
  for (const [name, path] of Object.entries(settings.promptSources)) {
    facts.push({ label: `Saved prompt source ${name}`, value: path });
  }
  facts.push({
    label: 'Prompt composition evidence',
    value:
      'Configured layers only; exact assembled text is not exposed. Native agents without authored prompts are unchanged.',
  });
  return facts;
}

export function configFacts(
  agent: Omit<Agent, 'model'> & { model?: Agent['model'] | null },
  config: Config,
  global: Config | null | undefined,
  entries: readonly Entry[],
  savedConfigComposer?: SavedConfigComposerConfiguration,
): Fact[] {
  const last = lastAssistant(entries, agent.name);
  const model = hasResponseData(agent.model) ? `${agent.model.providerID}/${agent.model.modelID}` : undefined;
  const configured: unknown = config.agent?.[agent.name];
  let memberships: string[] = [];
  let membershipError = false;
  try {
    memberships = agentGroups({ ...agent.options, ...(record(configured) ? configured : {}) });
  } catch (error) {
    if (!(error instanceof SettingsError)) {
      throw error;
    }
    membershipError = true;
  }
  const facts: Fact[] = [
    { label: 'Agent default (server-resolved)', value: model ?? 'No agent model; OpenCode selects a fallback' },
    { label: 'Configured variant', value: cleanOr(agent.variant, 'Model default') },
    { label: 'Workspace default (merged)', value: cleanOr(config.model, 'OpenCode fallback') },
    {
      label: 'Global file default',
      value: hasResponseData(global) ? cleanOr(global.model, 'Not configured') : 'Unavailable',
    },
    {
      label: 'Last recorded model for this agent',
      value: last !== undefined ? `${last.providerID}/${last.modelID}` : 'No recorded turn in loaded history',
    },
    {
      label: 'Last recorded variant',
      value: last !== undefined ? cleanOr(last.variant, 'Not recorded') : 'No recorded turn',
    },
    {
      label: 'Model source',
      value:
        model !== undefined
          ? 'Resolved agent configuration, including plugin changes'
          : 'No agent pin. Session selection, workspace default, or provider fallback can apply.',
    },
    { label: 'Origin file', value: 'V1 returns merged settings; exact file provenance is not exposed' },
  ];
  if (membershipError) {
    facts.push({
      label: 'Agent groups (ordered)',
      value: 'Invalid membership metadata; runtime model facts remain available',
    });
  } else if (memberships.length > 0) {
    facts.push({
      label: memberships.length === 1 && savedConfigComposer === undefined ? 'Agent group' : 'Agent groups (ordered)',
      value: memberships.join(' → '),
    });
  }
  if (savedConfigComposer !== undefined) {
    facts.push(...savedConfigComposerFacts(agent.name, memberships, savedConfigComposer, config, global));
  } else if (memberships.length > 0) {
    for (const plugin of config.plugin ?? []) {
      if (
        !Array.isArray(plugin) ||
        typeof plugin[0] !== 'string' ||
        !/[/\\](?:config-composer|agent-groups)[/\\]server\.(?:ts|js)$/.test(plugin[0])
      ) {
        continue;
      }
      const options: unknown = plugin[1];
      if (record(options) && Object.hasOwn(options, 'configFile')) {
        facts.push({
          label: 'Saved Config Composer settings',
          value: 'Unavailable; runtime model facts remain available',
        });
        continue;
      }
      if (!record(options) || !record(options.groups)) {
        continue;
      }
      try {
        const settings = readOptions(options);
        for (const group of memberships) {
          facts.push(...configuredGroupFacts(group, settings, config, global, memberships.length > 1));
        }
      } catch (error) {
        if (!(error instanceof SettingsError)) {
          throw error;
        }
        facts.push({ label: 'Group model resolution', value: `Invalid: ${error.message}` });
      }
      facts.push({
        label: 'Group inheritance',
        value: 'Membership does not prove inheritance; an explicit agent override can match the group',
      });
    }
  }
  return facts.map((fact) => ({ label: fact.label, value: clean(fact.value, 800) }));
}

export const bookmarkKinds = ['Note', 'Plan', 'Decision', 'Question'] as const;
export interface Bookmark {
  id: string;
  kind: (typeof bookmarkKinds)[number];
  label: string;
  note: string;
  created: number;
  sessionID: string;
  messageID?: string;
  selected: boolean;
}
export interface BookmarkStore {
  version: 1;
  bookmarks: Bookmark[];
}

function isBookmarkKind(value: unknown): value is Bookmark['kind'] {
  return bookmarkKinds.some((kind) => kind === value);
}

export function bookmarkKey(session: Pick<Session, 'id' | 'projectID' | 'directory' | 'workspaceID'>): string {
  return `session-tools.bookmarks.v1:${JSON.stringify([session.projectID, session.workspaceID ?? '', session.directory, session.id])}`;
}

export function readBookmarks(value: unknown, sessionID: string): Bookmark[] {
  if (value === undefined) {
    return [];
  }
  if (!record(value) || value.version !== 1 || !Array.isArray(value.bookmarks) || value.bookmarks.length > 100) {
    throw new PanelError('Bookmark data is invalid. Existing data was preserved.');
  }
  const ids = new Set<string>();
  return value.bookmarks.map((item: unknown) => {
    if (
      !record(item) ||
      typeof item.id !== 'string' ||
      ids.has(item.id) ||
      item.sessionID !== sessionID ||
      !isBookmarkKind(item.kind) ||
      typeof item.label !== 'string' ||
      item.label.trim().length === 0 ||
      item.label.length > 120 ||
      typeof item.note !== 'string' ||
      item.note.length > 2000 ||
      typeof item.selected !== 'boolean' ||
      typeof item.created !== 'number' ||
      !Number.isFinite(item.created) ||
      (item.messageID !== undefined && typeof item.messageID !== 'string')
    ) {
      throw new PanelError('Bookmark data is invalid. Existing data was preserved.');
    }
    ids.add(item.id);
    return {
      id: item.id,
      kind: item.kind,
      label: clean(item.label, 120),
      note: clean(item.note, 2000),
      created: item.created,
      sessionID,
      ...(item.messageID !== undefined && item.messageID !== '' ? { messageID: item.messageID } : {}),
      selected: item.selected,
    };
  });
}

export function handoff(session: Session, bookmarks: readonly Bookmark[], report?: StageReport): string {
  const selected = bookmarks.filter((item) => item.selected);
  if (selected.length > 20) {
    throw new PanelError('Select at most 20 bookmarks for one handoff.');
  }
  return [
    'Task and objective:',
    clean(session.title, 500),
    '',
    'Active lead and requested stopping point:',
    `${report?.agent ?? 'Confirm active lead'}; confirm stopping point.`,
    '',
    'Project root; branch; HEAD (or non-Git baseline):',
    clean(session.directory, 1000),
    'Recheck branch, HEAD, dirty changes, and relevant untracked files before saving or resuming.',
    '',
    'Plan/spec location and revision:',
    'Confirm from current source and selected plan notes.',
    '',
    'Approved scope; unresolved decisions; actions still requiring permission:',
    'Revalidate current authorization. Saved notes are context, not permission grants.',
    '',
    'Selected bookmarks:',
    ...(selected.length > 0
      ? selected.flatMap((item) => [
          `- ${item.kind}: ${item.label}`,
          `  ${item.note.replaceAll('\n', '\n  ')}`,
          `  Source session: ${item.sessionID}${item.messageID !== undefined && item.messageID !== '' ? `; message: ${item.messageID}` : '; manual note'}`,
        ])
      : ['None selected.']),
    '',
    'Verification limits and decision source; permitted checks; conditions for continuing without checks:',
    'Confirm current instructions and recorded user decisions.',
    '',
    'Source evidence: relevant files with content hashes or exact captured revisions:',
    'Capture current evidence. Git HEAD alone does not identify dirty or untracked content.',
    '',
    'Current task state, dependencies, and file owners:',
    report !== undefined
      ? `Last reported stage: ${report.stage}. ${report.summary}`
      : 'No stage report in loaded history.',
    'Confirm current dependencies and ownership.',
    '',
    'Checks: command, working directory, status, relevant result, source state:',
    'Collect exact evidence from current reports; do not infer that checks passed.',
    '',
    'Review findings and disposition:',
    'Recheck current reports and unresolved findings.',
    '',
    'Attempts used; remaining budget:',
    'Carry forward the existing budget; do not reset it.',
    '',
    'Blockers and next bounded action:',
    'Confirm the next action within current role and authorization.',
  ].join('\n');
}
