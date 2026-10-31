import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PluginInput } from '@opencode-ai/plugin';
import tokenEconomizer from '../plugins/tokeneconomizer.ts';

test('disabled and side-call sessions register no upstream hooks or exit listeners', async () => {
  const before = process.listenerCount('exit');
  const originalDisable = process.env.TE_DISABLE;
  const originalSidecall = process.env.TE_SIDECALL;
  try {
    for (const key of ['TE_DISABLE', 'TE_SIDECALL']) {
      delete process.env.TE_DISABLE;
      delete process.env.TE_SIDECALL;
      process.env[key] = ' YES ';
      assert.deepEqual(await tokenEconomizer({} as PluginInput), {});
      assert.equal(process.listenerCount('exit'), before);
    }
  } finally {
    if (originalDisable === undefined) {
      delete process.env.TE_DISABLE;
    } else {
      process.env.TE_DISABLE = originalDisable;
    }
    if (originalSidecall === undefined) {
      delete process.env.TE_SIDECALL;
    } else {
      process.env.TE_SIDECALL = originalSidecall;
    }
  }
});

test('enabled initialization returns upstream hooks without invoking a session', async () => {
  const listeners = new Set(process.listeners('exit'));
  const originalDisable = process.env.TE_DISABLE;
  const originalSidecall = process.env.TE_SIDECALL;
  delete process.env.TE_DISABLE;
  delete process.env.TE_SIDECALL;
  try {
    const hooks = await tokenEconomizer({ client: {}, directory: '/synthetic-project' } as PluginInput);
    for (const name of ['event', 'chat.message', 'experimental.chat.system.transform', 'tool.execute.after']) {
      assert.equal(typeof Reflect.get(hooks, name), 'function', `${name} must be available`);
    }
    assert.equal(process.listenerCount('exit'), listeners.size + 1);
  } finally {
    for (const listener of process.listeners('exit')) {
      if (!listeners.has(listener)) {
        process.removeListener('exit', listener);
      }
    }
    if (originalDisable === undefined) {
      delete process.env.TE_DISABLE;
    } else {
      process.env.TE_DISABLE = originalDisable;
    }
    if (originalSidecall === undefined) {
      delete process.env.TE_SIDECALL;
    } else {
      process.env.TE_SIDECALL = originalSidecall;
    }
  }
});
