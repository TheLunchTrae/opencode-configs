/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal, onCleanup, For, Show } from "solid-js"
import { activity, clean, stageReport } from "./model.ts"
import { currentSession, historyNote, ui, type Action } from "./client.ts"
import { loadWorkflow, type WorkflowData, type WorkflowRow } from "./workflow-data.ts"

function feed(api: TuiPluginApi, sessionID: string) {
  const [data, setData] = createSignal<WorkflowData>()
  const [failed, setFailed] = createSignal(false)
  const controller = new AbortController()
  let busy = false
  let pending = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const refresh = async () => {
    if (controller.signal.aborted || api.lifecycle.signal.aborted) return
    if (busy) { pending = true; return }
    busy = true
    const client = api.client
    try {
      const result = await loadWorkflow(api, sessionID, controller.signal)
      if (!controller.signal.aborted && client === api.client) { setData(result); setFailed(false) }
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      busy = false
      if (pending) { pending = false; schedule() }
    }
  }
  const schedule = () => {
    if (timer || controller.signal.aborted) return
    timer = setTimeout(() => { timer = undefined; void refresh() }, 500)
  }
  const unsubscribers = [
    api.event.on("session.status", schedule), api.event.on("session.created", schedule),
    api.event.on("session.updated", schedule), api.event.on("session.deleted", schedule),
  ]
  const interval = setInterval(() => void refresh(), 10_000)
  const dispose = () => {
    controller.abort(); clearInterval(interval); clearTimeout(timer)
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
  const removeDispose = api.lifecycle.onDispose(dispose)
  onCleanup(() => { dispose(); removeDispose() })
  void refresh()
  return { data, failed, refresh }
}

function rowStatus(api: TuiPluginApi, data: WorkflowData, row: WorkflowRow): string {
  const questions = api.state.session.question(row.session.id).length
  const permissions = api.state.session.permission(row.session.id).length
  const status = data.statuses[row.session.id]
  if (questions || permissions || status?.type === "busy" || status?.type === "retry") {
    return activity(status, questions, permissions)
  }
  if (row.task?.state === "completed") return "Delegation completed"
  if (row.task?.state === "error") return "Delegation failed"
  return row.unavailable ? "History unavailable" : activity(status, 0, 0)
}

function details(api: TuiPluginApi, view: ReturnType<typeof ui>, row: WorkflowRow) {
  view.menu(clean(row.agent), [
    { title: "Open conversation", value: "open", description: clean(row.session.title), run: () => {
      view.navigation.close(); api.route.navigate("session", { sessionID: row.session.id })
    } },
    { title: "Last recorded model", value: "model", description: `${row.model} · ${row.variant}`,
      run: () => view.alert("Recorded model", `${row.model}\nVariant: ${row.variant}\nThis describes a recorded turn.`) },
    { title: "Delegated task", value: "task", description: row.task?.description ?? "Primary session",
      run: () => view.alert("Delegated task", row.task?.description ?? clean(row.session.title)) },
    { title: "Timing", value: "time", description: row.task?.duration !== undefined
      ? `${Math.round(row.task.duration / 1000)} seconds for the recorded delegation`
      : `Session created ${new Date(row.session.time.created).toLocaleString()}` },
  ])
}

function Dialog(props: { api: TuiPluginApi; sessionID: string; view: ReturnType<typeof ui> }) {
  const source = feed(props.api, props.sessionID)
  const actions = (): Action[] => {
    const data = source.data()
    if (!data) return [{ title: source.failed() ? "Could not load workflow. Select to retry." : "Loading workflow…",
      value: "retry", run: source.refresh }]
    const report = stageReport(data.root.entries)
    return [
      { title: report ? `Reported stage: ${report.stage}` : "No stage report in loaded history", value: "stage",
        description: report?.summary ?? "The lead reports stages through workflow_status.",
        run: () => props.view.alert("Workflow stage", report
          ? `${report.agent}: ${report.stage}\n${report.summary}\n${new Date(report.time).toLocaleString()}`
          : "No stage report is available. Idle status does not mean the workflow is complete.") },
      ...data.rows.map((row) => ({ title: `${"  ".repeat(row.depth)}${row.agent}`, value: row.session.id,
        description: row.task?.description ?? clean(row.session.title), footer: rowStatus(props.api, data, row),
        category: "Sessions", run: () => details(props.api, props.view, row) })),
      { title: "Refresh", value: "refresh", description: source.failed() ? "Refresh failed; displayed data may be stale."
        : `${historyNote(data.root)}${data.partial ? " Some child sessions or statuses are unavailable." : ""}`,
        run: source.refresh },
    ]
  }
  return props.view.navigation.select({ title: "Live workflow", placeholder: "Find an agent or task…",
    get options() { return actions() }, onSelect: (option) => {
      void props.view.run(() => actions().find((item) => item.value === option.value)?.run?.())
    } })()
}

function Sidebar(props: { api: TuiPluginApi; sessionID: string; open: (row?: WorkflowRow) => void }) {
  const source = feed(props.api, props.sessionID)
  const report = () => source.data() ? stageReport(source.data()!.root.entries) : undefined
  const theme = () => props.api.theme.current
  return <box gap={1}>
    <text fg={theme().primary} onMouseUp={() => props.open()}>Workflow</text>
    <text fg={theme().text}>{report()?.stage ?? "Stage not reported"}</text>
    <Show when={source.failed()}><text fg={theme().warning}>Refresh failed; data may be stale.</text></Show>
    <For each={source.data()?.rows.slice(0, 5)}>{(row) =>
      <text fg={theme().textMuted} onMouseUp={() => props.open(row)}>
        {row.agent}: {source.data() ? rowStatus(props.api, source.data()!, row) : "Loading"}
      </text>
    }</For>
    <text fg={theme().textMuted} onMouseUp={() => props.open()}>/workflow-panel · expand</text>
  </box>
}

export default {
  id: "workflow-panel",
  tui: async (api) => {
    const view = ui(api)
    const open = (sessionID = currentSession(api), row?: WorkflowRow) => {
      view.navigation.show(() => <Dialog api={api} view={view} sessionID={sessionID} />, true)
      if (row) details(api, view, row)
    }
    view.command("workflow-panel.open", "Live workflow", "workflow-panel", "Session", () => open())
    api.slots.register({ order: 350, slots: {
      sidebar_content: (_context, props) => <Show when={props.session_id} keyed>{(sessionID: string) =>
        <Sidebar api={api} sessionID={sessionID} open={(row) => open(sessionID, row)} />
      }</Show>,
    } })
  },
} satisfies TuiPluginModule
