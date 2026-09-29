import type { Agent, AssistantMessage, Config, Message, Part, Session, SessionStatus } from "@opencode-ai/sdk/v2"

export type Entry = { info: Message; parts: Part[] }
export class PanelError extends Error {}
export const stages = ["planning", "implementation", "review", "verification", "blocked", "complete"] as const
export type Stage = typeof stages[number]
export type StageReport = { stage: Stage; summary: string; agent: string; messageID: string; time: number }
export const historyLimit = 200

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function clean(value: unknown, limit = 400): string {
  if (typeof value !== "string") return ""
  return value.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "").slice(0, limit)
}

export function ordered(entries: readonly Entry[]): Entry[] {
  return [...entries].sort((a, b) => a.info.time.created - b.info.time.created || a.info.id.localeCompare(b.info.id))
}

export function lastAssistant(entries: readonly Entry[], agent?: string): AssistantMessage | undefined {
  return ordered(entries).map((entry) => entry.info).findLast((info): info is AssistantMessage =>
    info.role === "assistant" && (!agent || info.agent === agent))
}

export function stageReport(entries: readonly Entry[]): StageReport | undefined {
  let report: StageReport | undefined
  for (const entry of ordered(entries)) {
    if (entry.info.role !== "assistant") continue
    for (const part of entry.parts) {
      if (part.type !== "tool" || part.tool !== "workflow_status" || part.state.status !== "completed") continue
      const data = part.state.metadata.workflowPanel
      if (!record(data) || data.version !== 1 || !stages.includes(data.stage as Stage)
        || typeof data.summary !== "string" || data.agent !== entry.info.agent) continue
      report = { stage: data.stage as Stage, summary: clean(data.summary), agent: clean(data.agent),
        messageID: entry.info.id, time: part.state.time.end }
    }
  }
  return report
}

export function activity(status: SessionStatus | undefined, questions: number, permissions: number): string {
  if (questions) return "Question waiting"
  if (permissions) return "Permission waiting"
  if (status?.type === "busy") return "Running"
  if (status?.type === "retry") return `Retry ${status.attempt}`
  return status?.type === "idle" ? "Idle" : "Status unavailable"
}

export type Delegation = { sessionID: string; agent: string; description: string; state: string; duration?: number }
export function delegations(entries: readonly Entry[]): Delegation[] {
  const found = new Map<string, Delegation>()
  for (const entry of ordered(entries)) for (const part of entry.parts) {
    if (part.type !== "tool" || part.tool !== "task" || part.state.status === "pending") continue
    const metadata = part.state.metadata
    if (!record(metadata) || typeof metadata.sessionId !== "string") continue
    const state = part.state
    found.set(metadata.sessionId, {
      sessionID: metadata.sessionId, agent: clean(state.input.subagent_type) || "Subagent",
      description: clean(state.input.description) || "Delegated task", state: state.status,
      duration: state.status === "completed" || state.status === "error"
        ? Math.max(0, state.time.end - state.time.start) : undefined,
    })
  }
  return [...found.values()]
}

export type ContextRecord = { kind: "file" | "skill" | "compaction"; label: string; evidence: string; messageID: string }
export function contextRecords(entries: readonly Entry[]): ContextRecord[] {
  const result: ContextRecord[] = []
  for (const entry of ordered(entries)) for (const part of entry.parts) {
    const source = { messageID: entry.info.id }
    if (part.type === "file") result.push({ ...source, kind: "file",
      label: clean(part.filename) || "Unnamed attachment", evidence: "Attachment recorded in history" })
    if (part.type === "compaction") result.push({ ...source, kind: "compaction",
      label: part.auto ? "Automatic compaction requested" : "Manual compaction requested",
      evidence: "Request recorded; history presence does not prove current prompt inclusion" })
    if (entry.info.role === "assistant" && entry.info.summary && part.type === "text") {
      if (!result.some((item) => item.kind === "compaction" && item.messageID === entry.info.id)) {
        result.push({ ...source, kind: "compaction", label: "Summary recorded",
          evidence: entry.info.time.completed ? "Summary response completed" : "Summary response in progress" })
      }
    }
    if (part.type !== "tool" || part.state.status !== "completed") continue
    if (part.tool === "read") result.push({ ...source, kind: "file",
      label: clean(part.state.input.filePath ?? part.state.input.path) || "Read target unavailable",
      evidence: part.state.time.compacted ? "Read completed; tool output later compacted" : "Read tool completed" })
    if (part.tool === "skill") result.push({ ...source, kind: "skill",
      label: clean(part.state.input.name) || "Skill name unavailable", evidence: "Skill tool completed" })
  }
  return result
}

export type Fact = { label: string; value: string }
export function configFacts(agent: Agent, config: Config, global: Config | undefined,
  entries: readonly Entry[]): Fact[] {
  const last = lastAssistant(entries, agent.name)
  const model = agent.model ? `${agent.model.providerID}/${agent.model.modelID}` : undefined
  const group = clean(agent.options.agent_group)
  const facts: Fact[] = [
    { label: "Agent default (server-resolved)", value: model ?? "No agent model; OpenCode selects a fallback" },
    { label: "Configured variant", value: clean(agent.variant) || "Model default" },
    { label: "Workspace default (merged)", value: clean(config.model) || "OpenCode fallback" },
    { label: "Global file default", value: global ? clean(global.model) || "Not configured" : "Unavailable" },
    { label: "Last recorded model for this agent", value: last ? `${last.providerID}/${last.modelID}` : "No recorded turn in loaded history" },
    { label: "Last recorded variant", value: last ? clean(last.variant) || "Not recorded" : "No recorded turn" },
    { label: "Model source", value: model ? "Resolved agent configuration, including plugin changes"
      : "No agent pin. Session selection, workspace default, or provider fallback can apply." },
    { label: "Origin file", value: "V1 returns merged settings; exact file provenance is not exposed" },
  ]
  if (group) {
    facts.push({ label: "Agent group", value: group })
    for (const plugin of config.plugin ?? []) {
      if (!Array.isArray(plugin) || typeof plugin[0] !== "string"
        || !/[/\\]agent-groups[/\\]server\.(?:ts|js)$/.test(plugin[0])) continue
      const options: unknown = plugin[1]
      if (!record(options) || !record(options.groups) || !record(options.groups[group])) continue
      const choice = options.groups[group]
      facts.push({ label: "Configured group default", value: clean(choice.model) || "No group model" })
      facts.push({ label: "Group inheritance", value: "Membership does not prove inheritance; an explicit agent override can match the group" })
    }
  }
  return facts.map((fact) => ({ label: fact.label, value: clean(fact.value, 800) }))
}

export const bookmarkKinds = ["Note", "Plan", "Decision", "Question"] as const
export type Bookmark = {
  id: string; kind: typeof bookmarkKinds[number]; label: string; note: string; created: number;
  sessionID: string; messageID?: string; selected: boolean;
}
export type BookmarkStore = { version: 1; bookmarks: Bookmark[] }

export function bookmarkKey(session: Pick<Session, "id" | "projectID" | "directory" | "workspaceID">): string {
  return `session-tools.bookmarks.v1:${JSON.stringify([session.projectID, session.workspaceID ?? "", session.directory, session.id])}`
}

export function readBookmarks(value: unknown, sessionID: string): Bookmark[] {
  if (value === undefined) return []
  if (!record(value) || value.version !== 1 || !Array.isArray(value.bookmarks) || value.bookmarks.length > 100) {
    throw new PanelError("Bookmark data is invalid. Existing data was preserved.")
  }
  const ids = new Set<string>()
  return value.bookmarks.map((item: unknown) => {
    if (!record(item) || typeof item.id !== "string" || ids.has(item.id) || item.sessionID !== sessionID
      || !bookmarkKinds.includes(item.kind as Bookmark["kind"]) || typeof item.label !== "string"
      || !item.label.trim() || item.label.length > 120 || typeof item.note !== "string" || item.note.length > 2000
      || typeof item.selected !== "boolean" || typeof item.created !== "number" || !Number.isFinite(item.created)
      || (item.messageID !== undefined && typeof item.messageID !== "string")) {
      throw new PanelError("Bookmark data is invalid. Existing data was preserved.")
    }
    ids.add(item.id)
    return { id: item.id, kind: item.kind as Bookmark["kind"], label: clean(item.label, 120),
      note: clean(item.note, 2000), created: item.created, sessionID,
      ...(item.messageID ? { messageID: item.messageID as string } : {}), selected: item.selected }
  })
}

export function handoff(session: Session, bookmarks: readonly Bookmark[], report?: StageReport): string {
  const selected = bookmarks.filter((item) => item.selected)
  if (selected.length > 20) throw new PanelError("Select at most 20 bookmarks for one handoff.")
  return [
    "Task and objective:", clean(session.title, 500), "",
    "Active lead and requested stopping point:", `${report?.agent ?? "Confirm active lead"}; confirm stopping point.`, "",
    "Project root; branch; HEAD (or non-Git baseline):", clean(session.directory, 1000),
    "Recheck branch, HEAD, dirty changes, and relevant untracked files before saving or resuming.", "",
    "Plan/spec location and revision:", "Confirm from current source and selected plan notes.", "",
    "Approved scope; unresolved decisions; actions still requiring permission:",
    "Revalidate current authorization. Saved notes are context, not permission grants.", "",
    "Selected bookmarks:", ...(selected.length ? selected.flatMap((item) => [
      `- ${item.kind}: ${item.label}`, `  ${item.note.replaceAll("\n", "\n  ")}`,
      `  Source session: ${item.sessionID}${item.messageID ? `; message: ${item.messageID}` : "; manual note"}`,
    ]) : ["None selected."]), "",
    "Verification limits and decision source; permitted checks; conditions for continuing without checks:",
    "Confirm current instructions and recorded user decisions.", "",
    "Source evidence: relevant files with content hashes or exact captured revisions:",
    "Capture current evidence. Git HEAD alone does not identify dirty or untracked content.", "",
    "Current task state, dependencies, and file owners:",
    report ? `Last reported stage: ${report.stage}. ${report.summary}` : "No stage report in loaded history.",
    "Confirm current dependencies and ownership.", "",
    "Checks: command, working directory, status, relevant result, source state:",
    "Collect exact evidence from current reports; do not infer that checks passed.", "",
    "Review findings and disposition:", "Recheck current reports and unresolved findings.", "",
    "Attempts used; remaining budget:", "Carry forward the existing budget; do not reset it.", "",
    "Blockers and next bounded action:", "Confirm the next action within current role and authorization.",
  ].join("\n")
}
