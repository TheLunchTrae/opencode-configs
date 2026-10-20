import assert from 'node:assert/strict';
import { test } from 'node:test';
import { waitForNativeReferences } from './native-references.ts';

const expected = [{ name: 'agent-references', path: '/fixture/references/agent' }];

test('native snapshots wait for the exact configured references, not just a nonempty catalog', async () => {
  const states = [[], [{ name: 'agent-references', path: '/another-project/references/agent' }], expected];
  let calls = 0;
  await waitForNativeReferences(async () => ({ data: states[calls++] }), expected, { attempts: 3, interval: 0 });
  assert.equal(calls, 3);
});

test('native snapshots fail when reference discovery never completes', async () => {
  await assert.rejects(
    waitForNativeReferences(async () => ({ data: [] }), expected, { attempts: 2, interval: 0 }),
    /Native reference discovery did not complete/,
  );
});

test('native reference discovery propagates API failures instead of accepting a partial baseline', async () => {
  await assert.rejects(
    waitForNativeReferences(
      async () => {
        throw new Error('reference API failed');
      },
      expected,
      { attempts: 2, interval: 0 },
    ),
    /reference API failed/,
  );
});
