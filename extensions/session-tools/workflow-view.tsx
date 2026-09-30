/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from '@opencode-ai/plugin/tui';
import type { MouseEvent, ScrollBoxRenderable } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/solid';
import { Show, createSignal, onCleanup } from 'solid-js';
import { ui } from './client.ts';
import { PanelError } from './model.ts';
import { initialPrompt } from './workflow-timeline.ts';

function CloseControl(props: { api: TuiPluginApi; close: () => void }) {
  return (
    <box
      position="absolute"
      top={0}
      right={4}
      width={3}
      height={1}
      zIndex={1}
      backgroundColor={props.api.theme.current.backgroundPanel}
      onMouseUp={(event: MouseEvent) => {
        event.stopPropagation();
        props.close();
      }}
    >
      <text fg={props.api.theme.current.textMuted}> × </text>
    </box>
  );
}

export function workflowUi(api: TuiPluginApi) {
  return ui(api, (element, close) => (
    <box>
      {element}
      <CloseControl api={api} close={close} />
    </box>
  ));
}

export function PromptReader(props: {
  api: TuiPluginApi;
  view: ReturnType<typeof ui>;
  title: string;
  load: (signal: AbortSignal) => Promise<string | undefined>;
}) {
  const dimensions = useTerminalDimensions();
  const [text, setText] = createSignal<string>();
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const controller = new AbortController();
  const client = props.api.client;
  const route = props.api.route.current;
  const sessionID = route.name === 'session' ? route.params?.sessionID : undefined;
  let scroll: ScrollBoxRenderable | undefined;
  const current = () => {
    const active = props.api.route.current;
    return (
      !controller.signal.aborted &&
      !props.api.lifecycle.signal.aborted &&
      client === props.api.client &&
      active.name === route.name &&
      (active.name !== 'session' || active.params?.sessionID === sessionID)
    );
  };
  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await props.load(controller.signal);
      if (current()) {
        setText(result);
      }
    } catch {
      if (current()) {
        setFailed(true);
      }
    } finally {
      if (current()) {
        setLoading(false);
      }
    }
  };
  const height = () => Math.max(3, Math.floor(dimensions().height * 0.6) - 6);
  const dispose = props.api.keymap.registerLayer({
    mode: 'modal',
    commands: [
      { name: 'workflow-panel.prompt.up', title: 'Scroll prompt up', run: () => scroll?.scrollBy(-1) },
      { name: 'workflow-panel.prompt.down', title: 'Scroll prompt down', run: () => scroll?.scrollBy(1) },
      { name: 'workflow-panel.prompt.page-up', title: 'Previous prompt page', run: () => scroll?.scrollBy(-height()) },
      { name: 'workflow-panel.prompt.page-down', title: 'Next prompt page', run: () => scroll?.scrollBy(height()) },
      { name: 'workflow-panel.prompt.home', title: 'Prompt start', run: () => scroll?.scrollTo(0) },
      { name: 'workflow-panel.prompt.end', title: 'Prompt end', run: () => scroll?.scrollTo(scroll.scrollHeight) },
    ],
    bindings: [
      { key: 'up', cmd: 'workflow-panel.prompt.up' },
      { key: 'down', cmd: 'workflow-panel.prompt.down' },
      { key: 'pageup', cmd: 'workflow-panel.prompt.page-up' },
      { key: 'pagedown', cmd: 'workflow-panel.prompt.page-down' },
      { key: 'home', cmd: 'workflow-panel.prompt.home' },
      { key: 'end', cmd: 'workflow-panel.prompt.end' },
    ],
  });
  onCleanup(() => {
    controller.abort();
    dispose();
  });
  props.api.ui.dialog.setSize('large');
  // eslint-disable-next-line @typescript-eslint/no-floating-promises -- The loader handles failures and checks disposal before updating the view.
  void load();
  return (
    <box paddingLeft={4} paddingRight={4} paddingBottom={1} gap={1}>
      <text fg={props.api.theme.current.primary} paddingRight={3}>
        {props.title}
      </text>
      <CloseControl api={props.api} close={props.view.navigation.close} />
      <Show when={!loading()} fallback={<text fg={props.api.theme.current.textMuted}>Loading prompt…</text>}>
        <Show
          when={!failed()}
          fallback={
            <text
              fg={props.api.theme.current.warning}
              onMouseUp={() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises -- The loader reports failures in the reader.
                void load();
              }}
            >
              Could not load prompt. Select to retry.
            </text>
          }
        >
          <Show
            when={text()}
            fallback={
              <text fg={props.api.theme.current.textMuted}>
                The original prompt is unavailable in recorded history.
              </text>
            }
          >
            {(value) => (
              <scrollbox
                height={height()}
                ref={(element: ScrollBoxRenderable) => {
                  scroll = element;
                }}
              >
                <text fg={props.api.theme.current.text} wrapMode="word">
                  {value()}
                </text>
              </scrollbox>
            )}
          </Show>
        </Show>
      </Show>
      <text fg={props.api.theme.current.textMuted} onMouseUp={props.view.navigation.back}>
        esc · back
      </text>
    </box>
  );
}

export async function readInitialPrompt(
  api: TuiPluginApi,
  sessionID: string,
  signal: AbortSignal,
): Promise<string | undefined> {
  const result = await api.client.session.messages(
    { sessionID },
    { signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15_000)]) },
  );
  if (Boolean(result.error) || result.data === undefined) {
    throw new PanelError('Could not read the original prompt.');
  }
  return initialPrompt(result.data);
}
