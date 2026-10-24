import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectivePatterns } from './permission-equivalence.ts';

test('permission equivalence keeps distinct overlapping patterns in their original order', () => {
  const rules = [
    { pattern: 'git *', action: 'allow' },
    { pattern: '* --output*', action: 'deny' },
    { pattern: 'git log*', action: 'ask' },
  ];
  assert.deepEqual(effectivePatterns(rules), rules);
});

test('permission equivalence removes only rules shadowed by a later catch-all or exact duplicate', () => {
  const rules = [
    { pattern: 'old', action: 'allow' },
    { pattern: '*', action: 'deny' },
    { pattern: 'alpha*', action: 'allow' },
    { pattern: '*beta', action: 'ask' },
    { pattern: 'alpha*', action: 'deny' },
  ];
  assert.deepEqual(effectivePatterns(rules), [rules[1], rules[3], rules[4]]);
  assert.equal(rules.length, 5);
});
