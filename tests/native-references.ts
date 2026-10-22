import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

interface NativeReference {
  name: string;
  path: string;
}

interface NativeReferenceAgent {
  name: string;
  permission: { permission: string; pattern: string; action: string }[];
}

export async function establishNativeReferenceBaseline<T extends NativeReferenceAgent>(
  snapshot: (signal: AbortSignal) => Promise<T[]>,
  dispose: (signal: AbortSignal) => Promise<unknown>,
  directory: string,
  { timeout = 30_000, interval = 50 } = {},
): Promise<T[]> {
  const pattern = join(directory, '*');
  const signal = AbortSignal.timeout(timeout);
  try {
    for (;;) {
      signal.throwIfAborted();
      const agents = await snapshot(signal);
      signal.throwIfAborted();
      if (
        agents.length > 0 &&
        agents.every((agent) =>
          agent.permission.some(
            (rule) => rule.permission === 'external_directory' && rule.pattern === pattern && rule.action === 'allow',
          ),
        )
      ) {
        return agents;
      }
      // V1 Agent caches defaults, so another read alone cannot add a missing grant.
      await dispose(signal);
      await setTimeout(interval, undefined, { signal });
    }
  } catch (error) {
    if (signal.aborted) {
      throw new Error(`Native agent reference permissions did not become ready: ${pattern}`, { cause: error });
    }
    throw error;
  }
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
