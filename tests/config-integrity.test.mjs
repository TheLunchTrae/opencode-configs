import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const config = JSON.parse(read("opencode.jsonc"))
const skills = [
  "development-workflow", "spec-interview", "test-first", "measured-performance",
  "checkpoint", "finish", "code-learning", "plan", "verify", "verification-tests",
]
const leadCommands = [
  "workflow", "spec", "checkpoint", "resume-work", "finish", "explain", "quiz", "verify", "verification-tests",
]

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
    assert.equal(fields.name, skill)
    assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.ok(fields.name.length <= 64)
    assert.ok(fields.description.length >= 1 && fields.description.length <= 1024)
  })
}

for (const command of leadCommands) {
  test(`/${command} runs in the active lead session`, () => {
    const path = `commands/${command}.md`
    const fields = metadata(path)
    assert.ok(fields.description?.trim(), `${path}: missing description`)
    assert.equal(fields.agent, "lead")
    assert.equal(fields.subtask, "false")
    assert.ok(read(path).includes("$ARGUMENTS"), `${path}: missing argument forwarding`)
    assert.ok(!read(path).includes("!`"), "No automatic shell interpolation")
  })
}

test("/plan runs as a planner subtask", () => {
  const fields = metadata("commands/plan.md")
  assert.equal(fields.agent, "planner")
  assert.equal(fields.subtask, "true")
})

test("commands do not shadow documented built-in commands or aliases", () => {
  const reserved = new Set([
    "connect", "compact", "summarize", "details", "editor", "exit", "quit", "q",
    "export", "help", "init", "models", "new", "clear", "redo", "sessions", "resume",
    "continue", "share", "themes", "thinking", "undo", "unshare",
  ])
  for (const file of readdirSync(new URL("commands/", root)).filter((file) => file.endsWith(".md"))) {
    assert.ok(!reserved.has(file.slice(0, -3)), `${file}: shadows a built-in command`)
  }
})

test("adapted pstack skills retain the same complete notice", () => {
  const notice = read("skills/development-workflow/LICENSE-pstack.txt")
  assert.equal(notice, read("skills/measured-performance/LICENSE-pstack.txt"))
  assert.match(notice, /Copyright \(c\) 2026 Lauren Tan/)
  assert.match(notice, /THE SOFTWARE IS PROVIDED "AS IS"/)
  assert.ok(read("agents/lead.md").includes("../skills/development-workflow/LICENSE-pstack.txt"))
})

test("shared prompts use a hidden directory reference", () => {
  const reference = config.references["agent-prompts"]
  assert.equal(reference.hidden, true)
  assert.ok(reference.description?.trim(), "missing directory description")
  assert.ok(statSync(new URL(reference.path, root)).isDirectory(), "references must point to directories")
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
  const referenced = new Set()
  for (const path of paths) {
    const text = read(path)
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

test("specialist commands route to their agents without shell interpolation", () => {
  const routes = {
    "phased-plan": "planner",
    "code-review": "code-reviewer",
    "go-review": "go-reviewer",
    "security-review": "security-reviewer",
  }
  for (const [command, agent] of Object.entries(routes)) {
    const path = `commands/${command}.md`
    const fields = metadata(path)
    assert.equal(fields.agent, agent)
    assert.equal(fields.subtask, "true")
    assert.ok(read(path).includes("$ARGUMENTS"), `${path}: missing argument forwarding`)
    assert.ok(!read(path).includes("!`"))
  }
})

test("MCP entries have typed connection definitions", () => {
  for (const server of Object.values(config.mcp)) {
    assert.ok(["local", "remote"].includes(server.type), "enabled-only MCP entries are ignored by V2")
    if (server.type === "remote") assert.doesNotThrow(() => new URL(server.url))
    else assert.ok(Array.isArray(server.command) && server.command.length > 0)
  }
})

test("repository maintenance instructions stay out of the global configuration", () => {
  const localConfig = JSON.parse(read(".opencode/opencode.jsonc"))
  const instructions = ".opencode/AGENTS.md"
  assert.ok(!config.instructions?.includes(instructions))
  assert.ok(localConfig.instructions.includes(instructions))
  assert.ok(statSync(new URL(instructions, root)).isFile())
})
