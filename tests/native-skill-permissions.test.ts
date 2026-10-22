import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderedSkillPermissions } from './native-skill-permissions.ts';

const paths = ['/fixture/skills/a/*', '/fixture/skills/b/*'];
const grants = paths.map((pattern) => ({ permission: 'external_directory', pattern, action: 'allow' }));
const before = { permission: 'external_directory', pattern: '*', action: 'ask' };
const after = { permission: 'external_directory', pattern: '/fixture/*', action: 'deny' };
const original = [before, ...grants, after];

test('only complete native skill-grant blocks may reorder at the same positions', () => {
  assert.deepEqual(orderedSkillPermissions([before, ...grants.toReversed(), after], paths, 1), original);
  const repeated = [...original, ...original];
  assert.deepEqual(orderedSkillPermissions([...original, before, ...grants.toReversed(), after], paths, 2), repeated);
});

test('native skill-grant comparison rejects changed action, path, and multiplicity', () => {
  for (const changed of [
    [before, { ...grants[0], action: 'deny' }, grants[1], after],
    [before, { ...grants[0], permission: 'read' }, grants[1], after],
    [before, { ...grants[0], pattern: '/fixture/skills/c/*' }, grants[1], after],
    [before, grants[0], grants[0], grants[1], after],
    [before, grants[0], after],
  ]) {
    assert.throws(() => orderedSkillPermissions(changed, paths, 1));
  }
});

test('authored boundaries and the position of every remaining rule stay significant', () => {
  assert.throws(() => orderedSkillPermissions([before, grants[0], after, grants[1]], paths, 1));
  assert.notDeepEqual(orderedSkillPermissions([before, after, ...grants], paths, 1), original);
  assert.notDeepEqual(orderedSkillPermissions([before, ...grants, { ...after, action: 'allow' }], paths, 1), original);
});
