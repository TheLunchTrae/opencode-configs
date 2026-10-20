import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

interface NativeReference {
  name: string;
  path: string;
}

export async function waitForNativeReferences(
  read: () => Promise<{ data: NativeReference[] }>,
  expected: NativeReference[],
  { attempts = 100, interval = 50 } = {},
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { data } = await read();
    if (
      expected.every((reference) => data.some((item) => item.name === reference.name && item.path === reference.path))
    ) {
      return;
    }
    if (attempt + 1 < attempts) {
      await setTimeout(interval);
    }
  }
  assert.fail(`Native reference discovery did not complete: ${JSON.stringify(expected)}`);
}
