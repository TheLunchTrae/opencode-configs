interface PatternRule {
  pattern: string;
  action: string;
}

// For one tool, a later '*' shadows every earlier pattern. An exact duplicate
// shadows its earlier occurrence. Distinct overlapping patterns keep their order.
export function effectivePatterns(rules: PatternRule[]): PatternRule[] {
  const start = Math.max(
    0,
    rules.findLastIndex((rule) => rule.pattern === '*'),
  );
  const seen = new Set<string>();
  const result: PatternRule[] = [];
  for (let index = rules.length - 1; index >= start; index--) {
    const { pattern, action } = rules[index];
    if (!seen.has(pattern)) {
      result.push({ pattern, action });
      seen.add(pattern);
    }
  }
  return result.reverse();
}
