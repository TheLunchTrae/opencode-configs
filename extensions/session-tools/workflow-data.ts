import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Session, SessionStatus } from "@opencode-ai/sdk/v2"
import { snapshot, type Snapshot } from "./client.ts"
import { delegations, lastAssistant, clean, type Delegation } from "./model.ts"

export type WorkflowRow = {
  session: Session; agent: string; model: string; variant: string; depth: number;
  task?: Delegation; unavailable?: boolean;
}
export type WorkflowData = { root: Snapshot; rows: WorkflowRow[]; statuses: Record<string, SessionStatus>; partial: boolean }

export async function loadWorkflow(api: TuiPluginApi, sessionID: string, signal: AbortSignal): Promise<WorkflowData> {
  const client = api.client
  const root = await snapshot(api, sessionID, signal)
  const options = { signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15_000)]) }
  const status = await client.session.status({}, options)
  const rows: WorkflowRow[] = []
  let partial = !!status.error || !status.data
  const seen = new Set<string>()
  const queue: { session: Session; depth: number; task?: Delegation }[] = [{ session: root.session, depth: 0 }]
  while (queue.length && rows.length < 24 && !signal.aborted) {
    const item = queue.shift()!
    if (seen.has(item.session.id)) continue
    seen.add(item.session.id)
    const messages = item.depth === 0 ? { data: root.entries, error: undefined }
      : await client.session.messages({ sessionID: item.session.id, limit: 20 }, options)
    const last = lastAssistant(messages.data ?? [])
    rows.push({ ...item, agent: clean(last?.agent ?? item.session.agent ?? item.task?.agent) || "Agent unavailable",
      model: last ? clean(`${last.providerID}/${last.modelID}`) : "No recorded model in recent history",
      variant: clean(last?.variant) || "Not recorded", unavailable: !!messages.error })
    partial ||= !!messages.error
    if (item.depth >= 2) continue
    const children = await client.session.children({ sessionID: item.session.id }, options)
    if (children.error) { partial = true; continue }
    const tasks = delegations(messages.data ?? [])
    for (const session of children.data ?? []) {
      if (queue.length + rows.length >= 24) { partial = true; break }
      if (!seen.has(session.id)) queue.push({ session, depth: item.depth + 1,
        task: tasks.find((task) => task.sessionID === session.id) })
    }
  }
  const statuses = { ...status.data }
  // V1 removes idle sessions from the status map. Missing entries in a successful response mean idle.
  if (!status.error && status.data) for (const row of rows) statuses[row.session.id] ??= { type: "idle" }
  return { root, rows, statuses, partial: partial || queue.length > 0 }
}
