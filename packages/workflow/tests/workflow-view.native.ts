import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  TuiDialogAlertProps,
  TuiDialogSelectProps,
  TuiPluginApi,
  TuiPluginModule,
  TuiSlotPlugin,
} from '@opencode-ai/plugin/tui';
import type { Session } from '@opencode-ai/sdk/v2';
import type { JSX } from '@opentui/solid';
import type { Entry } from '../src/session-tools/model.ts';

test(
  'workflow sidebar toggles and updates; prompt reader renders, scrolls, resizes, and disposes pending reads',
  {
    skip: process.versions.bun === undefined ? 'Run with Bun and @opentui/solid/preload to render TSX.' : false,
    timeout: 15_000,
  },
  async (t) => {
    const { RGBA } = await import('@opentui/core');
    const { testRender } = await import('@opentui/solid');
    const { jsxs, jsx } = await import('@opentui/solid/jsx-runtime');
    const { createSignal } = await import('solid-js');
    const { PromptReader, workflowUi } = await import('../src/session-tools/workflow-view.tsx');
    const [frame, setFrame] = createSignal<(() => JSX.Element) | undefined>();
    let selected: TuiDialogSelectProps<string> | undefined;
    const commands = new Map<string, () => unknown>();
    const listeners = new Set<() => void>();
    let sidebar: TuiSlotPlugin | undefined;
    let closed: (() => void) | undefined;
    const controller = new AbortController();
    const native = (props: TuiDialogAlertProps) =>
      jsxs('box', {
        paddingLeft: 4,
        paddingRight: 4,
        gap: 1,
        children: [
          jsxs('box', {
            flexDirection: 'row',
            justifyContent: 'space-between',
            children: [jsx('text', { children: props.title }), jsx('text', { children: 'esc' })],
          }),
          jsx('text', { children: props.message }),
        ],
      });
    const api = {
      lifecycle: { signal: controller.signal, onDispose: () => () => {} },
      client: {},
      event: {
        on: (_type: string, handler: () => void) => {
          listeners.add(handler);
          return () => listeners.delete(handler);
        },
      },
      slots: {
        register: (plugin: TuiSlotPlugin) => {
          sidebar = plugin;
          return '';
        },
      },
      state: { session: { question: () => [], permission: () => [] } },
      route: { current: { name: 'session', params: { sessionID: 'root' } } },
      theme: {
        current: {
          primary: RGBA.fromHex('#F78AEE'),
          text: RGBA.fromHex('#ffffff'),
          textMuted: RGBA.fromHex('#aaaaaa'),
          warning: RGBA.fromHex('#ffcc00'),
          backgroundPanel: RGBA.fromHex('#222222'),
        },
      },
      keymap: {
        registerLayer: ({ commands: layer }: { commands: { name: string; run: () => unknown }[] }) => {
          layer.forEach((command) => commands.set(command.name, command.run));
          return () => layer.forEach((command) => commands.delete(command.name));
        },
      },
      ui: {
        DialogAlert: native,
        DialogSelect: (props: TuiDialogSelectProps<string>) => {
          selected = props;
          return jsxs('box', {
            paddingLeft: 4,
            paddingRight: 4,
            gap: 1,
            get children() {
              return [
                jsxs('box', {
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  children: [jsx('text', { children: props.title }), jsx('text', { children: 'esc' })],
                }),
                jsx('text', {
                  get children() {
                    return props.options
                      .map((option) => `${option.title} ${typeof option.footer === 'string' ? option.footer : ''}`)
                      .join('\n');
                  },
                }),
              ];
            },
          });
        },
        dialog: {
          get open() {
            return frame() !== undefined;
          },
          replace: (render: () => JSX.Element, onClose?: () => void) => {
            closed?.();
            closed = onClose;
            setFrame(() => render);
          },
          clear: () => {
            closed?.();
            closed = undefined;
            setFrame(undefined);
          },
          setSize: () => {},
        },
      },
    } as unknown as TuiPluginApi;
    const renderer = await testRender(
      () =>
        jsx('box', {
          width: '100%',
          backgroundColor: api.theme.current.backgroundPanel,
          get children() {
            return frame()?.();
          },
        }),
      { width: 88, height: 40 },
    );
    t.after(() => {
      controller.abort();
      renderer.renderer.destroy();
    });
    const view = workflowUi(api);
    view.alert('Workflow root', 'Root contents');
    view.alert('Assignment', 'Child contents');
    await renderer.flush();
    let captured = renderer.captureCharFrame();
    assert.match(captured, /Assignment/);
    assert.ok(!captured.includes('esc'));
    assert.match(captured, /×/);
    const clickClose = async () => {
      const rows = renderer.captureCharFrame().split('\n');
      const y = rows.findIndex((row) => row.includes('×'));
      assert.ok(y >= 0);
      await renderer.mockMouse.click(rows[y].indexOf('×'), y);
      await renderer.flush();
    };
    await clickClose();
    await Promise.resolve();
    assert.equal(frame(), undefined);
    assert.equal(view.navigation.canGoBack, false);

    view.alert('Workflow root', 'Root contents');
    const prompt = `First line\n${'Long assignment prompt\n'.repeat(1800)}LAST LINE`;
    view.navigation.show(() => PromptReader({ api, view, title: 'Assignment prompt', load: async () => prompt }));
    await renderer.flush();
    captured = renderer.captureCharFrame();
    assert.match(captured, /Assignment prompt/);
    assert.match(captured, /First line/);
    assert.ok(!captured.includes('LAST LINE'));
    commands.get('workflow-panel.prompt.end')!();
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /LAST LINE/);
    renderer.resize(44, 20);
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /×/);
    api.ui.dialog.clear();
    await Promise.resolve();
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /Workflow root/);
    assert.equal(commands.size, 0);

    let resolve: (value: string) => void = () => assert.fail('Pending reader was not created');
    let signal: AbortSignal | undefined;
    view.navigation.show(() =>
      PromptReader({
        api,
        view,
        title: 'Pending prompt',
        load: (abort) => {
          signal = abort;
          return new Promise<string>((done) => {
            resolve = done;
          });
        },
      }),
    );
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /Loading prompt/);
    await clickClose();
    assert.equal(signal?.aborted, true);
    resolve('STALE PROMPT');
    await Promise.resolve();
    await renderer.flush();
    assert.equal(frame(), undefined);
    assert.ok(!renderer.captureCharFrame().includes('STALE PROMPT'));

    renderer.resize(88, 40);
    const session = (id: string, parentID?: string): Session => ({
      id,
      parentID,
      slug: id,
      projectID: 'project',
      directory: '/project',
      title: id,
      version: '1.18.34',
      time: { created: 1, updated: 2 },
    });
    const entry = (id: string, parts: unknown[]): Entry =>
      ({
        info: {
          id,
          sessionID: 'root',
          role: 'assistant',
          agent: 'lead',
          time: { created: 1 },
          providerID: 'fixture',
          modelID: 'model',
        },
        parts,
      }) as Entry;
    const stage = (id: string, name: string, time: number) => ({
      id,
      type: 'tool',
      tool: 'workflow_status',
      state: {
        status: 'completed',
        input: {},
        time: { start: time, end: time },
        metadata: { workflowPanel: { version: 1, stage: name, summary: `${name} details`, agent: 'lead' } },
      },
    });
    const task = (id: string, agent: string, child: string, time: number, background = false) => ({
      id,
      type: 'tool',
      tool: 'task',
      state: {
        status: 'completed',
        input: { subagent_type: agent, description: id, prompt: `PROMPT ${id}` },
        time: { start: time, end: time + 1 },
        metadata: { sessionId: child, background },
      },
    });
    const history = [
      entry('workflow', [
        stage('planning', 'planning', 1),
        task('plan-task', 'planner', 'planner', 2),
        stage('dev', 'implementation', 4),
        task('dev-task', 'developer', 'developer', 5, true),
        stage('review', 'review', 7),
        task('review-task', 'reviewer', 'developer', 8, true),
      ]),
    ];
    Object.assign(api.client, {
      session: {
        get: async () => ({ data: session('root') }),
        messages: async ({ sessionID }: { sessionID: string }) => ({ data: sessionID === 'root' ? history : [] }),
        children: async ({ sessionID }: { sessionID: string }) => ({
          data: sessionID === 'root' ? [session('planner', 'root'), session('developer', 'root')] : [],
        }),
        status: async () => ({ data: { developer: { type: 'busy' } } }),
      },
    });
    // The renderer and artifacts must share host runtime instances, as they do in OpenCode.
    const { ensureRuntimePluginSupport } = await import('@opentui/solid/runtime-plugin-support/configure');
    ensureRuntimePluginSupport();
    const artifactRoot = await mkdtemp(join(tmpdir(), 'workflow ui artifact '));
    t.after(() => rm(artifactRoot, { recursive: true, force: true }));
    await cp(new URL('../../../extensions/workflow/', import.meta.url), artifactRoot, { recursive: true });
    const load = async (name: string) => {
      const spec = pathToFileURL(join(artifactRoot, `${name}.js`)).href;
      const plugin = ((await import(spec)) as { default: TuiPluginModule }).default;
      await plugin.tui(api, undefined, {
        id: plugin.id ?? name,
        source: 'file',
        spec,
        target: spec,
        first_time: 1,
        last_time: 1,
        time_changed: 1,
        load_count: 1,
        fingerprint: 'fixture',
        state: 'first',
      });
      return plugin;
    };
    for (const name of ['config', 'context', 'bookmarks']) {
      await load(name);
    }
    for (const command of [
      'effective-config.open',
      'context-inspector.open',
      'session-bookmarks.open',
      'session-bookmarks.add',
      'session-bookmarks.handoff',
    ]) {
      assert.ok(commands.has(command), `${command}: artifact did not register its command`);
    }
    await load('workflow');
    const [sidebarSession, setSidebarSession] = createSignal('root');
    setFrame(() => () => {
      assert.ok(sidebar?.slots.sidebar_content !== undefined);
      return sidebar.slots.sidebar_content(
        { theme: api.theme },
        {
          get session_id() {
            return sidebarSession();
          },
        },
      );
    });
    await renderer.waitForFrame((value) => value.includes('review'));
    const clickText = async (label: string) => {
      const rows = renderer.captureCharFrame().split('\n');
      const y = rows.findIndex((row) => row.includes(label));
      assert.ok(y >= 0, `Missing text: ${label}`);
      await renderer.mockMouse.click(rows[y].indexOf(label), y);
      await renderer.flush();
    };
    assert.match(renderer.captureCharFrame(), /▸ Workflow/);
    assert.ok(!renderer.captureCharFrame().includes('lead:'));
    assert.ok(!renderer.captureCharFrame().includes('review details'));
    await clickText('Workflow');
    assert.match(renderer.captureCharFrame(), /▾ Workflow/);
    assert.match(renderer.captureCharFrame(), /lead:/);
    assert.match(renderer.captureCharFrame(), /review details/);
    await clickText('Workflow');
    assert.match(renderer.captureCharFrame(), /▸ Workflow/);
    assert.ok(!renderer.captureCharFrame().includes('lead:'));
    assert.ok(!renderer.captureCharFrame().includes('review details'));

    const update = entry('live-update', [stage('verify', 'verification', 10)]);
    update.info.time.created = 10;
    history.push(update);
    listeners.forEach((listener) => listener());
    await delay(550);
    await renderer.waitForFrame((value) => value.includes('verification'));
    assert.match(renderer.captureCharFrame(), /▸ Workflow/);
    assert.ok(!renderer.captureCharFrame().includes('review'));
    assert.ok(!renderer.captureCharFrame().includes('lead:'));
    assert.ok(!renderer.captureCharFrame().includes('verification details'));
    const savedHistory = history.splice(0);
    listeners.forEach((listener) => listener());
    await delay(550);
    await renderer.waitForFrame((value) => value.includes('Stage not reported'));
    assert.match(renderer.captureCharFrame(), /▸ Workflow/);
    await clickText('Workflow');
    assert.match(renderer.captureCharFrame(), /▾ Workflow/);
    setSidebarSession('other');
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /▸ Workflow/);
    history.push(...savedHistory.slice(0, -1));
    setSidebarSession('root');
    await renderer.waitForFrame((value) => value.includes('review'));
    await clickText('review');
    await renderer.waitForFrame((value) => value.includes('Review 1'));
    await clickClose();
    await commands.get('workflow-panel.open')!();
    await renderer.waitForFrame((value) => value.includes('Review 1'));
    const select = (value: string) => {
      const option = selected?.options.find((item) => item.value === value);
      assert.ok(option !== undefined, `Missing menu option: ${value}`);
      selected?.onSelect?.(option);
    };
    assert.match(renderer.captureCharFrame(), /reviewer Running/);
    select('phase:root:planning');
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /planner Delegation completed/);
    select('assignment:root:plan-task');
    await renderer.waitForFrame((value) => value.includes('View assignment prompt'));
    select('prompt');
    await renderer.waitForFrame((value) => value.includes('PROMPT plan-task'));
    api.ui.dialog.clear();
    await Promise.resolve();
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /View assignment prompt/);
    api.ui.dialog.clear();
    await Promise.resolve();
    await renderer.waitForFrame((value) => value.includes('Planning 1'));
    assert.match(renderer.captureCharFrame(), /planner Delegation completed/);
    assert.equal(selected?.current, 'assignment:root:plan-task');
    select('phase:root:dev');
    await renderer.flush();
    assert.match(renderer.captureCharFrame(), /developer Background dispatch completed/);
    assert.match(renderer.captureCharFrame(), /reviewer Running/);
    await clickClose();
    assert.equal(frame(), undefined);
  },
);
