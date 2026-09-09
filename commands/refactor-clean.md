---
description: Identify and safely remove unused code, dead dependencies, and duplicated logic. Categorises findings by risk (SAFE / CAREFUL / RISKY), removes only SAFE items, and verifies with tests between batches.
agent: refactor-cleaner
subtask: true
---

Identify and safely remove unused code, dead dependencies, and duplicated logic.

Detect unused exports, imports, and files using tools appropriate to the project's ecosystem.
Categorize findings by risk (SAFE / CAREFUL / RISKY). Remove only SAFE items, one category at
a time, running tests between batches. Never remove code without full verification.

$ARGUMENTS
