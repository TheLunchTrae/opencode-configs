import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TuiDialogAlertProps, TuiDialogSelectProps, TuiPluginApi } from '@opencode-ai/plugin/tui';
import type { Session } from '@opencode-ai/sdk/v2';
import type { JSX } from '@opentui/solid';
import type { Entry } from '../extensions/session-tools/model.ts';

test(
  'workflow close header and prompt reader render, scroll, resize, and dispose pending reads',
  {
    skip: process.versions.bun === undefined ? 'Run with Bun and @opentui/solid/preload to render TSX.' : false,
  },
  async (t) => {
    const { RGBA } = await import('@opentui/core');
    const { testRender } = await import('@opentui/solid');
    const { jsxs, jsx } = await import('@opentui/solid/jsx-runtime');
    const { createSignal } = await import('solid-js');
    const { PromptReader, workflowUi } = await import('../extensions/session-tools/workflow-view.tsx');
    const [frame, setFrame] = createSignal<(() => JSX.Element) | undefined>();
    let selected: TuiDialogSelectProps<string> | undefined;
    const commands = new Map<string, () => unknown>();
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
      event: { on: () => () => {} },
      slots: { register: () => '' },
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
      version: '1.18.29',
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
        metadata: { workflowPanel: { version: 1, stage: name, summary: name, agent: 'lead' } },
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
    const workflow = (await import('../extensions/session-tools/workflow.tsx')).default;
    await workflow.tui(api);
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
