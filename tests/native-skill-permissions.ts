import assert from 'node:assert/strict';

export interface PermissionRule {
  permission: string;
  pattern: string;
  action: string;
}

// Native Agent inserts Skill.dirs() as a contiguous allow block, repeated for Explore's readonly defaults.
// Reorder only independently discovered complete blocks, preserving their positions and every other rule.
export function orderedSkillPermissions(rules: PermissionRule[], paths: string[], blocks: number): PermissionRule[] {
  assert.ok(paths.length > 0);
  assert.equal(new Set(paths).size, paths.length, 'expected skill directories must be unique');
  const positions = rules.flatMap((rule, index) => (paths.includes(rule.pattern) ? [index] : []));
  assert.equal(positions.length, paths.length * blocks, 'native skill grant multiplicity changed');
  const normalized = [...rules];
  for (let offset = 0; offset < positions.length; offset += paths.length) {
    const block = positions.slice(offset, offset + paths.length);
    assert.equal(block.at(-1)! - block[0], paths.length - 1, 'native skill grants crossed a policy boundary');
    const grants = block.map((index) => rules[index]);
    for (const pattern of paths) {
      assert.deepEqual(
        grants.filter((rule) => rule.pattern === pattern),
        [{ permission: 'external_directory', pattern, action: 'allow' }],
      );
    }
    const sorted = grants.toSorted((left, right) => left.pattern.localeCompare(right.pattern));
    for (const [index, position] of block.entries()) {
      normalized[position] = sorted[index];
    }
  }
  return normalized;
}
