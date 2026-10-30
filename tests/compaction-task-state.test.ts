import type { PluginInput } from '@opencode-ai/plugin';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CompactionTaskStatePlugin } from '../plugins/compaction-task-state.ts';

describe('compaction-task-state plugin', () => {
  it('appends task-state guidance without replacing the native prompt', async () => {
    const hooks = await CompactionTaskStatePlugin({} as PluginInput);
    const hook = hooks['experimental.session.compacting'];
    assert.ok(hook !== undefined);
    const output: { context: string[]; prompt?: string } = { context: ['earlier plugin context'] };
    await hook({ sessionID: 'session' }, output);
    assert.equal(output.prompt, undefined);
    assert.equal(output.context.length, 2);
    assert.equal(output.context[0], 'earlier plugin context');
    for (const field of ['Approved scope', 'Checks actually run', 'Review findings', 'remaining budget', 'unknown']) {
      assert.ok(output.context[1]?.includes(field), field);
    }
  });
});
