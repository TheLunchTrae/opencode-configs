import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const config = JSON.parse(read("opencode.jsonc"))
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

test("workflow entry points route to the owning agent procedures", () => {
  assert.ok(read("skills/development-workflow/SKILL.md").includes("../../agents/lead.md"))
  assert.ok(read("skills/plan/SKILL.md").includes("../../agents/planner.md"))
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
  assert.ok(read("agents/lead.md").includes("../skills/development-workflow/LICENSE-pstack.txt"))
})

test("shared prompts use one hidden directory reference", () => {
  assert.deepEqual(Object.keys(config.references), ["agent-prompts"])
  const reference = config.references["agent-prompts"]
  assert.equal(reference.path, "./references/agent-prompts")
  assert.equal(reference.hidden, true)
  assert.ok(reference.description?.trim(), "missing directory description")
  assert.ok(statSync(new URL(reference.path, root)).isDirectory(), "references must point to directories")
})

test("moved shared prompts remain available without stale root copies", () => {
  for (const name of ["asd-ste100", "global-coding-style", "reviewer-standards", "review-template"]) {
    assert.ok(statSync(new URL(`references/agent-prompts/${name}.md`, root)).isFile())
    assert.equal(existsSync(new URL(`references/${name}.md`, root)), false)
  }
})

test("prompt references resolve to files under the configured directory", () => {
  const markdown = (directory) => readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}${entry.name}`
    if (entry.isDirectory()) return markdown(`${path}/`)
    return /\.(md|markdown)$/.test(entry.name) ? [path] : []
  })
  const paths = ["AGENTS.md", "README.md", ".opencode/AGENTS.md"]
  for (const directory of ["agents/", "commands/", "skills/", "references/agent-prompts/"]) {
    paths.push(...markdown(directory))
  }
  const promptFiles = readdirSync(new URL("references/agent-prompts/", root)).filter((file) => file.endsWith(".md"))
  const formerAliases = new Set(promptFiles.map((file) => file.slice(0, -3)))
  const referenced = new Set()
  for (const path of paths) {
    const text = read(path)
    for (const [, alias] of text.matchAll(/`@([a-z][a-z0-9-]*)`/g)) {
      assert.ok(!formerAliases.has(alias), `${path}: obsolete file alias @${alias}`)
    }
    for (const [, alias, file] of text.matchAll(/`@([a-z][a-z0-9-]*)\/([^`\s]+)`/g)) {
      const reference = config.references[alias]
      // Scoped package names are not references. Still reject unknown aliases used with Markdown paths.
      if (!reference && !file.endsWith(".md")) continue
      assert.ok(reference, `${path}: unknown directory alias @${alias}`)
      const directory = new URL(`${reference.path.replace(/\/$/, "")}/`, root)
      const target = new URL(file, directory)
      assert.ok(target.href.startsWith(directory.href), `${path}: reference escapes its directory`)
      assert.ok(statSync(target).isFile(), `${path}: missing prompt ${file}`)
      if (alias === "agent-prompts") referenced.add(file)
    }
  }
  for (const file of promptFiles) {
    assert.ok(referenced.has(file), `${file}: no consumer uses this shared prompt`)
  }
})

test("language and framework roles explicitly load their shared language guidance", () => {
  const roles = {
    typescript: ["typescript-developer", "typescript-reviewer", "react-developer"],
    go: ["go-developer", "go-reviewer"],
    csharp: ["csharp-developer", "csharp-reviewer", "efcore-developer"],
    php: ["php-developer", "php-reviewer", "laminas-developer", "doctrine-developer"],
  }
  for (const [language, agents] of Object.entries(roles)) {
    for (const agent of agents) {
      assert.ok(read(`agents/${agent}.md`).includes(`@agent-prompts/${language}-guidance.md`), agent)
    }
  }
})

test("specialist commands route to the proper skill without shell interpolation", () => {
  const routes = {
    "phased-plan": ["planner", "phased-plan"],
    "code-review": ["code-reviewer", "review"],
    "go-review": ["go-reviewer", "review"],
    "security-review": ["security-reviewer", "security-review"],
  }
  for (const [command, [agent, skill]] of Object.entries(routes)) {
    const path = `commands/${command}.md`
    const fields = metadata(path)
    assert.equal(fields.agent, agent)
    assert.equal(fields.subtask, "true")
    assert.ok(read(path).includes(`${skill} skill`))
    assert.equal(read(path).split("$ARGUMENTS").length, 2)
    assert.ok(!read(path).includes("!`"))
  }
})

test("disabled MCP defaults do not require credentials or package execution", () => {
  assert.deepEqual(config.mcp, { github: { enabled: false }, playwright: { enabled: false } })
  assert.ok(!read("opencode.jsonc").includes("{file:"))
})

test("permission defaults preserve specific approval gates and destructive-command denials", () => {
  assert.equal(config.permission.bash["*"], "ask")
  for (const pattern of ["git checkout*", "git commit*", "git push*", "sudo*", "python*"]) {
    assert.equal(config.permission.bash[pattern], "ask", pattern)
  }
  for (const pattern of [
    "git branch -D*", "git clean -f*", "git push --force*", "git push -f*", "git reset --hard*", "rm -rf*",
  ]) assert.equal(config.permission.bash[pattern], "deny", pattern)
  assert.equal(config.permission.task["*"], "deny")
  assert.equal(config.permission.edit["*"], "ask")
  assert.equal(config.permission.external_directory["*"], "ask")
  assert.equal(config.permission.read["~/.config/opencode/secrets/**"], "deny")
  assert.equal(config.subagent_depth, 2)
})

test("verification distinguishes unavailable checks from observed passes", () => {
  const text = read("skills/verify/SKILL.md")
  for (const status of ["PASS", "FAIL", "BLOCKED", "SKIP"]) assert.ok(text.includes(`| ${status} |`))
  assert.ok(text.includes("do not invent an 80 percent gate"))
})
