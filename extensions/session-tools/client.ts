import type { TuiDialogSelectOption, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Session } from "@opencode-ai/sdk/v2"
import { clean, historyLimit, PanelError, type Entry } from "./model.ts"

export type Action = TuiDialogSelectOption<string> & { run?: () => void | Promise<void> }
export type Snapshot = { session: Session; entries: Entry[]; limited: boolean }

export function currentSession(api: TuiPluginApi): string {
  const route = api.route.current
  const id = route.name === "session" ? route.params?.sessionID : undefined
  if (typeof id !== "string") throw new PanelError("Open a session before using this panel.")
  return id
}

export async function snapshot(api: TuiPluginApi, sessionID: string, signal = api.lifecycle.signal): Promise<Snapshot> {
  const client = api.client
  const options = { signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15_000)]) }
  const [session, messages] = await Promise.all([
    client.session.get({ sessionID }, options),
    client.session.messages({ sessionID, limit: historyLimit }, options),
  ])
  if (session.error || messages.error || !session.data || !messages.data) {
    throw new PanelError("Could not read this session. It may have been deleted or the server is unavailable.")
  }
  return { session: session.data, entries: messages.data, limited: messages.data.length >= historyLimit }
}

export function ui(api: TuiPluginApi) {
  const run = (action: () => void | Promise<void>) => {
    const client = api.client
    return Promise.resolve().then(() => {
      if (api.lifecycle.signal.aborted || client !== api.client) return
      return action()
    }).catch((error: unknown) => {
      if (api.lifecycle.signal.aborted || client !== api.client) return
      api.ui.toast({ title: "Session tools", variant: "error",
        message: error instanceof PanelError ? error.message
          : "Could not complete the action. Check the session and server connection, then retry.", duration: 6000 })
    })
  }
  const menu = (title: string, actions: readonly Action[] | (() => readonly Action[]), onClose?: () => void) => {
    if (api.lifecycle.signal.aborted) return
    const items = () => typeof actions === "function" ? actions() : actions
    api.ui.dialog.replace(() => api.ui.DialogSelect({ title, placeholder: "Search…",
      get options() { return [...items()] },
      onSelect: (option) => { void run(() => items().find((item) => item.value === option.value)?.run?.()) },
    }), onClose)
  }
  const alert = (title: string, message: string) => {
    if (api.lifecycle.signal.aborted) return
    api.ui.dialog.replace(() => api.ui.DialogAlert({ title, message: clean(message, 30_000) }))
  }
  const prompt = (title: string, value: string, save: (text: string) => void | Promise<void>) => {
    if (api.lifecycle.signal.aborted) return
    api.ui.dialog.replace(() => api.ui.DialogPrompt({ title, value,
      onConfirm: (text) => { void run(() => save(text)) }, onCancel: () => api.ui.dialog.clear() }))
  }
  const command = (name: string, title: string, slashName: string, category: string, action: () => void | Promise<void>) => {
    api.keymap.registerLayer({ commands: [{ name, title, category, namespace: "palette", slashName,
      run: () => run(action) }] })
  }
  return { run, menu, alert, prompt, command }
}

export function historyNote(value: Snapshot): string {
  return value.limited ? `Recent ${historyLimit} messages; older evidence is not loaded.` : "Loaded session history."
}
