import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import type { TuiPluginStatus } from '@opencode-ai/plugin/tui';
import { nativeBinary } from './native-host.ts';

test(
  'native TUI requires explicit registration and initializes each shipped panel once',
  { timeout: 90_000 },
  async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'opencode-tui-discovery-'));
    const children: ReturnType<typeof spawn>[] = [];
    t.after(async () => {
      for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
          await once(child, 'exit').catch(() => undefined);
        }
      }
      await rm(root, { recursive: true, force: true });
    });
    const config = join(root, 'config', 'opencode');
    const project = join(root, 'project');
    await mkdir(config, { recursive: true });
    await mkdir(project);
    for (const path of ['extensions', 'themes', 'node_modules', 'package.json', 'package-lock.json']) {
      await cp(new URL(`../${path}`, import.meta.url), join(config, path), { recursive: true });
    }
    const events = join(root, 'events.txt');
    const statuses = join(root, 'statuses.json');
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_DATA_HOME: join(root, 'data'),
      XDG_STATE_HOME: join(root, 'state'),
      XDG_CACHE_HOME: join(root, 'cache'),
      OPENCODE_TEST_HOME: root,
      OPENCODE_CONFIG: '',
      OPENCODE_CONFIG_DIR: '',
      OPENCODE_CONFIG_CONTENT: '',
      OPENCODE_DISABLE_PROJECT_CONFIG: '1',
      OPENCODE_DISABLE_AUTOUPDATE: '1',
      OPENCODE_DISABLE_MODELS_FETCH: '1',
      OPENCODE_DISABLE_DEFAULT_PLUGINS: 'true',
      OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: 'true',
      OPENCODE_SERVER_PASSWORD: '',
      OPENCODE_DB: join(root, 'db.sqlite'),
    };
    const launch = (args: string[]) => {
      const child = spawn(nativeBinary(), args, { cwd: project, env, stdio: 'pipe' });
      children.push(child);
      let output = '';
      child.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });
      const exited = once(child, 'exit').catch(() => undefined);
      const stop = async () => {
        child.kill();
        const kill = globalThis.setTimeout(() => child.kill('SIGKILL'), 3000);
        kill.unref();
        await exited;
        globalThis.clearTimeout(kill);
      };
      return { child, output: () => output, stop };
    };
    const server = launch(['serve', '--hostname', '127.0.0.1', '--port', '0']);
    let url: string | undefined;
    for (let attempt = 0; attempt < 150; attempt++) {
      url = /http:\/\/127\.0\.0\.1:\d+/.exec(server.output())?.[0];
      if (url !== undefined) {
        break;
      }
      assert.equal(server.child.exitCode, null, server.output());
      await setTimeout(100);
    }
    assert.ok(url !== undefined, server.output());
    // Initialize the attached server before introducing TUI-only discovery probes.
    assert.ok((await fetch(`${url}/config`, { headers: { 'x-opencode-directory': project } })).ok);
    const record = `import { appendFileSync } from 'node:fs';\nconst record = (value) => appendFileSync(${JSON.stringify(events)}, value + '\\n');\n`;
    const clientPath = join(config, 'extensions', 'session-tools', 'client.ts');
    const client = await readFile(clientPath, 'utf8');
    assert.ok(client.includes('api.keymap.registerLayer({'));
    await writeFile(
      clientPath,
      record + client.replace('api.keymap.registerLayer({', 'record(name);\napi.keymap.registerLayer({'),
    );
    const workflowPath = join(config, 'extensions', 'session-tools', 'workflow.tsx');
    const workflow = await readFile(workflowPath, 'utf8');
    assert.ok(workflow.includes('api.slots.register({'));
    await writeFile(
      workflowPath,
      record + workflow.replace('api.slots.register({', "record('sidebar');\napi.slots.register({"),
    );
    await mkdir(join(config, 'plugins'));
    const probe = './plugins/tui-probe.ts';
    await writeFile(
      join(config, probe),
      record + "export default { id: 'tui-probe', tui: async () => record('probe') };\n",
    );
    await writeFile(
      join(config, 'extensions', 'ready.js'),
      record +
        `import { writeFileSync } from 'node:fs';
export default { id: 'ready', tui: async (api) => {
  writeFileSync(${JSON.stringify(statuses)}, JSON.stringify(api.plugins.list()));
  record('ready');
} };\n`,
    );
    const shipped = JSON.parse(await readFile(new URL('../tui.jsonc', import.meta.url), 'utf8')) as {
      plugin: string[];
    };
    const panels = shipped.plugin.filter((spec) => spec.startsWith('./'));
    const expected = [
      'context-inspector.open',
      'effective-config.open',
      'session-bookmarks.add',
      'session-bookmarks.handoff',
      'session-bookmarks.open',
      'sidebar',
      'workflow-panel.open',
    ];
    for (const explicit of [false, true]) {
      await writeFile(events, '');
      await writeFile(
        join(config, 'tui.jsonc'),
        JSON.stringify({ plugin: [...panels, ...(explicit ? [probe, probe] : []), './extensions/ready.js'] }),
      );
      const tui = launch(['attach', url, '--dir', project]);
      let records: string[] = [];
      for (let attempt = 0; attempt < 200; attempt++) {
        records = (await readFile(events, 'utf8')).trim().split('\n');
        if (records.includes('ready')) {
          break;
        }
        assert.equal(tui.child.exitCode, null, tui.output().slice(-5000));
        await setTimeout(100);
      }
      assert.ok(records.includes('ready'), tui.output().slice(-5000));
      assert.deepEqual(records.sort(), [...expected, 'ready', ...(explicit ? ['probe'] : [])].sort());
      const active = JSON.parse(await readFile(statuses, 'utf8')) as TuiPluginStatus[];
      assert.deepEqual(
        active
          .filter((plugin) => plugin.source === 'file' && plugin.id !== 'ready')
          .map(({ id, active, enabled }) => ({ id, active, enabled })),
        [
          'workflow-panel',
          'effective-config',
          'context-inspector',
          'session-bookmarks',
          ...(explicit ? ['tui-probe'] : []),
        ].map((id) => ({ id, active: true, enabled: true })),
      );
      await tui.stop();
    }
    await server.stop();
  },
);
