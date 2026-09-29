# Verification scope

Use this reference before planning, generating, executing, or assessing verification.
Primary agents and specialists apply it within their assigned scope and permissions.
Explicit verification limits take precedence over this workflow's default verification procedures.
They do not expand edit, delegation, or shipping authority.

## Establish the boundary

Read the user's instructions, applicable project instructions, and current approved decisions.
Honor explicit limits for the task or project. A user can exclude all agent verification or only selected work.
Distinguish capability discovery, test generation, check execution, and infrastructure changes.
Skipping execution alone does not exclude requested test generation. Excluding infrastructure work does not exclude
existing checks. Do not broaden a narrow exclusion.

Keep the boundary and its source with the task constraints. Include permitted checks, excluded work, and any
conditions for continuing when checks are impractical or unavailable. Include a reason when one was supplied.
Carry these decisions into assignments, reviews, and authorized handoffs. Reuse them after an agent switch or resume.
Do not require another confirmation for an applicable explicit instruction or approval.
Revisit only affected decisions when requirements change or a material ambiguity prevents applying the boundary.

Without an explicit limit, use proportionate verification under the existing procedures.
Repository size, complexity, missing access, and anticipated cost do not create an automatic exclusion.
For a consequential gap, propose a bounded correction or an explicit accepted limitation for the user's decision.
Do not ask every task to choose a verification policy.

## Apply the boundary

- Assess capabilities only within the agreed discovery scope. Do not investigate excluded environments or coverage.
- Generate tests and run checks only within their respective scope. Do not install tools, create a harness, or
  repair infrastructure solely to satisfy excluded verification.
- When the user already permits continuation if a check is impractical or unavailable, apply that condition without
  another approval request. State the known limitation and continue the remaining assigned work.
  Do not repeatedly retry or investigate an excluded prerequisite.
- Treat an accepted verification limitation as non-blocking for the requested implementation and its handoff.
  Do not reopen it as a planning prerequisite, repair attempt, or project-learning recommendation solely because
  verification remains absent. Continue required work outside the exclusion.
- Preserve required code and security reviews, known defects, consequential product questions, and permission limits.
  An exclusion does not resolve those issues. Do not weaken assertions or change acceptance criteria to hide a failure.
- Assess merge readiness separately. Agent verification exclusions do not satisfy or disable required CI,
  branch protections, or other external merge requirements.

## Report evidence and limits

Use `SKIP` for unrun checks excluded by the user or applicable project instructions. Identify the excluded scope,
the decision source, and what remains unverified. Do not invent commands, test counts, or exhaustive inventories
for excluded discovery. A concise scope-level entry is sufficient.
Use `BLOCKED` when a check remains required and cannot run. A later exclusion can remove its task prerequisite,
but preserve any earlier attempt and result. A check that ran and found a failure remains `FAIL`.

Keep accepted limitations visible without presenting them as unresolved approval requests or mandatory follow-up.
Report completion against the assigned scope separately from check results and merge readiness.
Never count an exclusion as `PASS`, claim full verification, or claim an unmeasured performance improvement.
