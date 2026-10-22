import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { establishNativeReferenceBaseline, waitForNativeReferences } from './native-references.ts';

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

const referenceDirectory = join('/fixture', 'references', 'agent');
const referenceGrant = {
  permission: 'external_directory',
  pattern: join(referenceDirectory, '*'),
  action: 'allow',
};
const readyAgents = [
  {
    name: 'workflow-lead',
    permission: [{ permission: 'external_directory', pattern: '*', action: 'ask' }, referenceGrant],
    prompt: 'Lead prompt',
  },
  { name: 'explore', permission: [referenceGrant], prompt: 'Explore prompt' },
];

test('initial agent baseline awaits disposal and rebuilds missing native reference grants', async () => {
  const events: string[] = [];
  let disposed = false;
  const baseline = await establishNativeReferenceBaseline(
    async (signal) => {
      assert.equal(signal.aborted, false);
      events.push('snapshot');
      return disposed ? readyAgents : [readyAgents[0], { name: 'explore', permission: [], prompt: 'Explore prompt' }];
    },
    async (signal) => {
      assert.equal(signal.aborted, false);
      events.push('dispose');
      await setTimeout(10);
      disposed = true;
    },
    referenceDirectory,
    { timeout: 1000, interval: 0 },
  );
  assert.equal(baseline, readyAgents);
  assert.deepEqual(events, ['snapshot', 'dispose', 'snapshot']);
});

test('ready initial agent baseline preserves actual grants and skips disposal', async () => {
  let disposals = 0;
  const before = structuredClone(readyAgents);
  const baseline = await establishNativeReferenceBaseline(
    async () => readyAgents,
    async () => {
      disposals++;
    },
    referenceDirectory,
  );
  assert.equal(baseline, readyAgents);
  assert.deepEqual(baseline, before);
  assert.equal(disposals, 0);
});

test('initial agent baseline fails at its deadline when native reference grants remain absent', async () => {
  let disposals = 0;
  await assert.rejects(
    establishNativeReferenceBaseline(
      async () => [{ name: 'workflow-lead', permission: [{ ...referenceGrant, action: 'deny' }] }],
      async () => {
        disposals++;
      },
      referenceDirectory,
      { timeout: 20, interval: 0 },
    ),
    /Native agent reference permissions did not become ready/,
  );
  assert.ok(disposals > 0);
});

test('initial agent baseline passes its deadline signal to pending native reads', async () => {
  let readAborted = false;
  await assert.rejects(
    establishNativeReferenceBaseline(
      async (signal) => {
        try {
          await setTimeout(1000, undefined, { signal });
        } catch (error) {
          readAborted = true;
          throw error;
        }
        return readyAgents;
      },
      async () => {},
      referenceDirectory,
      { timeout: 20, interval: 0 },
    ),
    /Native agent reference permissions did not become ready/,
  );
  assert.equal(readAborted, true);
});

for (const stage of ['snapshot', 'dispose'] as const) {
  test(`initial agent baseline propagates ${stage} API errors`, async () => {
    const error = new Error(`${stage} API failed`);
    await assert.rejects(
      establishNativeReferenceBaseline(
        async () => {
          if (stage === 'snapshot') {
            throw error;
          }
          return [];
        },
        async () => {
          throw error;
        },
        referenceDirectory,
      ),
      (caught: unknown) => caught === error,
    );
  });
}
