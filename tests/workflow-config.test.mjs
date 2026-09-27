import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const skills = [
  "development-workflow", "spec-interview", "test-first", "measured-performance",
  "checkpoint", "finish", "code-learning", "plan", "verify",
]
const commands = {
  workflow: "development-workflow",
  spec: "spec-interview",
  checkpoint: "checkpoint",
  "resume-work": "checkpoint",
  finish: "finish",
  explain: "code-learning",
  quiz: "code-learning",
  verify: "verify",
}

// This checks our flat command/skill metadata, not arbitrary YAML or runtime loading.
const metadata = (path) => {
  const text = read(path)
  const match = text.match(/^---\n([\s\S]*?)\n---\n/)
  assert.ok(match, `${path}: missing frontmatter`)
  const entries = match[1].split("\n").map((line) => {
    const field = line.match(/^([a-z][a-z_-]*): (.+)$/)
    assert.ok(field, `${path}: unsupported metadata line: ${line}`)
    return [field[1], field[2]]
  })
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length, `${path}: duplicate key`)
  return Object.fromEntries(entries)
}

for (const skill of skills) {
  test(`${skill} has valid discoverable skill metadata`, () => {
    const fields = metadata(`skills/${skill}/SKILL.md`)
    assert.deepEqual(Object.keys(fields).sort(), ["description", "name"])
    assert.equal(fields.name, skill)
    assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.ok(fields.name.length <= 64)
    assert.ok(fields.description.length >= 1 && fields.description.length <= 1024)
  })
}

for (const [command, skill] of Object.entries(commands)) {
  test(`/${command} uses ${skill} without a nested lead`, () => {
    const path = `commands/${command}.md`
    const fields = metadata(path)
    assert.deepEqual(Object.keys(fields).sort(), ["agent", "description", "subtask"])
    assert.equal(fields.agent, "lead")
    assert.equal(fields.subtask, "false")
    assert.ok(read(path).includes(`${skill} skill`))
    assert.equal(read(path).split("$ARGUMENTS").length, 2)
    assert.ok(!read(path).includes("!`"), "No automatic shell interpolation")
  })
}

test("/plan stays isolated in the read-only planner and loads the plan skill", () => {
  const fields = metadata("commands/plan.md")
  assert.equal(fields.agent, "planner")
  assert.equal(fields.subtask, "true")
  assert.ok(read("commands/plan.md").includes("plan skill"))
})

test("existing agent bodies load their workflow procedures", () => {
  assert.ok(read("agents/lead.md").includes("development-workflow skill"))
  assert.ok(read("agents/planner.md").includes("plan skill"))
  assert.ok(read("agents/performance-optimizer.md").includes("measured-performance skill"))
})

test("commands do not shadow documented built-in commands or aliases", () => {
  const reserved = new Set([
    "connect", "compact", "summarize", "details", "editor", "exit", "quit", "q",
    "export", "help", "init", "models", "new", "clear", "redo", "sessions", "resume",
    "continue", "share", "themes", "thinking", "undo", "unshare",
  ])
  for (const command of Object.keys(commands)) assert.ok(!reserved.has(command))
})

test("adapted pstack skills retain the same complete notice", () => {
  const notice = read("skills/development-workflow/LICENSE-pstack.txt")
  assert.equal(notice, read("skills/measured-performance/LICENSE-pstack.txt"))
  assert.match(notice, /Copyright \(c\) 2026 Lauren Tan/)
  assert.match(notice, /THE SOFTWARE IS PROVIDED "AS IS"/)
})

test("verification distinguishes unavailable checks from observed passes", () => {
  const text = read("skills/verify/SKILL.md")
  for (const status of ["PASS", "FAIL", "BLOCKED", "SKIP"]) assert.ok(text.includes(`| ${status} |`))
  assert.ok(text.includes("do not invent an 80 percent gate"))
})
