import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

export function nativeBinary(): string {
  const binary = process.env.OPENCODE_BIN;
  const version = process.env.OPENCODE_NATIVE_VERSION;
  assert.ok(binary !== undefined && version !== undefined, 'Run native tests through npm run test:native');
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 30_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), version, 'Native executable changed after selection');
  return binary;
}
