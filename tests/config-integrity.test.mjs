import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const config = JSON.parse(read("opencode.jsonc"))
const skills = readdirSync(new URL("skills/", root)).filter((name) =>
  existsSync(new URL(`skills/${name}/SKILL.md`, root)))
const utilityCommands = ["checkpoint", "resume-work", "explain", "quiz", "init-docs", "commit", "push", "summarize-branch"]
const leads = ["workflow-lead", "planning-lead", "implementation-lead", "review-lead"]
const retiredCommands = [
  "workflow", "spec", "design", "plan", "phased-plan", "verification-tests", "verify", "finish",
  "review", "code-review", "security-review", "go-review", "refactor-clean", "update-docs",
]
const retiredSkills = [
  "development-workflow", "spec-interview", "plan", "phased-plan", "review", "security-review", "finish",
]

const markdown = (directory) => readdirSync(new URL(directory, root), { withFileTypes: true }).flatMap((entry) => {
  const path = `${directory}${entry.name}`
  if (entry.isDirectory()) return markdown(`${path}/`)
  return /\.(md|markdown)$/.test(entry.name) ? [path] : []
})
const promptPaths = ["AGENTS.md", ...["agents/", "commands/", "skills/", "references/agent-prompts/"].flatMap(markdown)]
const documentPaths = [...promptPaths, "README.md", "USAGE.md", ".opencode/AGENTS.md"]

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

for (const command of utilityCommands) {
  test(`/${command} retains the active agent and forwards arguments`, () => {
    const path = `commands/${command}.md`
    const fields = metadata(path)
    assert.ok(fields.description?.trim(), `${path}: missing description`)
    assert.equal(fields.agent, undefined, "Utilities must not switch the selected lead")
    assert.equal(fields.subtask, "false")
    assert.ok(read(path).includes("$ARGUMENTS"), `${path}: missing argument forwarding`)
    assert.ok(!read(path).includes("!`"), "No automatic shell interpolation")
  })
}

test("retired workflow entrypoints are absent and documented for upgrades", () => {
  assert.ok(!existsSync(new URL("agents/lead.md", root)))
  const upgrade = read("README.md").split("## Upgrade an existing installation")[1]
  assert.ok(upgrade?.includes("agents/lead.md"))
  for (const name of retiredCommands) {
    assert.ok(!existsSync(new URL(`commands/${name}.md`, root)), `${name}: retired command remains`)
    assert.ok(upgrade.includes(`\`${name}.md\``), `${name}: missing command removal instruction`)
  }
  for (const name of retiredSkills) {
    assert.ok(!existsSync(new URL(`skills/${name}/`, root)), `${name}: retired skill remains`)
    assert.ok(upgrade.includes(`\`${name}/\``), `${name}: missing skill removal instruction`)
  }
  const commands = readdirSync(new URL("commands/", root)).filter((name) => name.endsWith(".md"))
  assert.deepEqual(commands.sort(), utilityCommands.map((name) => `${name}.md`).sort())
})

// Read only the scalar permission fields and exact Task maps used by these agent files.
// Native OpenCode loading remains a separate check; this is not a general YAML parser.
const agents = Object.fromEntries(readdirSync(new URL("agents/", root)).filter((name) => name.endsWith(".md"))
  .map((file) => {
    const name = file.slice(0, -3)
    const header = read(`agents/${file}`).match(/^---\n([\s\S]*?)\n---\n/)?.[1]
    assert.ok(header, `${name}: missing agent frontmatter`)
    const task = header.match(/^  task: (allow|ask|deny)$/m)?.[1]
    const taskMap = header.match(/^  task:\n((?:    [^\n]+(?:\n|$))*)/m)?.[1]
    const rules = task ? { "*": task } : { ...config.permission.task }
    if (taskMap) {
      for (const line of taskMap.trimEnd().split("\n")) {
        const match = line.match(/^    ['"]?([a-z0-9*-]+)['"]?: (allow|ask|deny)$/)
        assert.ok(match, `${name}: unsupported Task rule: ${line}`)
        rules[match[1]] = match[2]
      }
    }
    return [name, {
      mode: header.match(/^mode: (.+)$/m)?.[1],
      edit: header.match(/^  edit: (.+)$/m)?.[1] ?? config.permission.edit["*"],
      bash: header.match(/^  bash: (.+)$/m)?.[1],
      rules,
    }]
  }))
const builtinAgents = Object.fromEntries(["general", "explore"].map((name) => {
  const permission = config.agent[name].permission ?? {}
  const task = permission.task
  return [name, {
    mode: config.agent[name].mode ?? "subagent",
    edit: permission.edit ?? (name === "explore" ? "deny" : config.permission.edit["*"]),
    rules: typeof task === "string" ? { "*": task } : { ...config.permission.task, ...task },
  }]
}))
const allAgents = { ...builtinAgents, ...agents }
const targets = (name) => Object.entries(allAgents[name].rules)
  .filter(([, action]) => action !== "deny").map(([target]) => target)

test("the default and focused leads are selectable primary agents", () => {
  assert.equal(config.default_agent, "workflow-lead")
  assert.deepEqual(Object.keys(agents).filter((name) => agents[name].mode === "primary").sort(), [...leads].sort())
  assert.equal(config.agent.build.disable, true)
  assert.equal(config.agent.plan.disable, true)
  assert.equal(agents[config.default_agent].edit, "allow")
  assert.equal(agents["implementation-lead"].edit, "allow")
  assert.equal(agents["planning-lead"].bash, "deny")
})

test("delegation uses exact targets, excludes lead children, and fits the depth limit", () => {
  assert.deepEqual(config.permission.task, { "*": "deny" })
  assert.equal(config.subagent_depth, 2)
  for (const [name, agent] of Object.entries(allAgents)) {
    assert.equal(agent.rules["*"], "deny", `${name}: Task must default to deny`)
    for (const target of targets(name)) {
      assert.match(target, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${name}: target must be exact`)
      assert.ok(allAgents[target], `${name}: unknown target ${target}`)
      assert.equal(allAgents[target].mode, "subagent", `${name}: cannot delegate to primary ${target}`)
    }
  }
  const walk = (name, path = []) => {
    assert.ok(!path.includes(name), `${name}: delegation cycle`)
    assert.ok(path.length <= config.subagent_depth, `${[...path, name].join(" -> ")}: exceeds depth limit`)
    for (const target of targets(name)) walk(target, [...path, name])
  }
  for (const lead of leads) walk(lead)
})

test("planning and review cannot reach writing agents, including through another reviewer", () => {
  const inspect = (name, path = []) => {
    assert.ok(!path.includes(name), `${name}: delegation cycle`)
    assert.equal(allAgents[name].edit, "deny", `${[...path, name].join(" -> ")}: can edit files`)
    for (const target of targets(name)) inspect(target, [...path, name])
  }
  inspect("planning-lead")
  inspect("review-lead")
})

test("leaf agents retain denied delegation", () => {
  const coordinators = new Set([...leads, "code-reviewer", "security-reviewer", "doc-updater", "refactor-cleaner"])
  for (const name of Object.keys(allAgents)) {
    if (!coordinators.has(name)) assert.deepEqual(targets(name), [], `${name}: leaf can delegate`)
  }
})

test("stage leads can reach required reviewers while implementation cannot start a new planning assignment", () => {
  for (const lead of leads) {
    for (const reviewer of ["code-reviewer", "architecture-reviewer", "security-reviewer"]) {
      assert.ok(targets(lead).includes(reviewer), `${lead}: missing ${reviewer}`)
    }
  }
  for (const lead of ["workflow-lead", "planning-lead"]) {
    assert.ok(targets(lead).includes("planner"))
    assert.ok(targets(lead).includes("architect"))
  }
  assert.ok(!targets("implementation-lead").includes("planner"))
  assert.ok(!targets("implementation-lead").includes("architect"))
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

test("adapted workflow references and performance skill retain the complete notice", () => {
  const notice = read("references/agent-prompts/LICENSE-pstack.txt")
  assert.equal(notice, read("skills/measured-performance/LICENSE-pstack.txt"))
  assert.match(notice, /Copyright \(c\) 2026 Lauren Tan/)
  assert.match(notice, /THE SOFTWARE IS PROVIDED "AS IS"/)
  assert.ok(read("agents/workflow-lead.md").includes("../references/agent-prompts/LICENSE-pstack.txt"))
  assert.ok(read("references/agent-prompts/lead-contract.md").includes("(LICENSE-pstack.txt)"))
})

test("shared prompts use a hidden directory reference", () => {
  const reference = config.references["agent-prompts"]
  assert.equal(reference.hidden, true)
  assert.ok(reference.description?.trim(), "missing directory description")
  assert.ok(statSync(new URL(reference.path, root)).isDirectory(), "references must point to directories")
})

test("prompt references resolve to files under the configured directory", () => {
  const promptFiles = markdown("references/agent-prompts/")
    .map((path) => path.slice("references/agent-prompts/".length))
  const referenced = new Set()
  for (const path of documentPaths) {
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

const responseDirectory = "references/agent-prompts/response-formats/"
const responseProfiles = markdown(responseDirectory).filter((path) => !/\/(common|catalog)\.md$/.test(path))
const sharedReferences = (path, visited = new Set()) => {
  if (visited.has(path)) return visited
  visited.add(path)
  for (const [, file] of read(path).matchAll(/`@agent-prompts\/([^`\s]+)`/g)) {
    sharedReferences(`references/agent-prompts/${file}`, visited)
  }
  return visited
}

test("canonical response profiles share the envelope and are discoverable from the catalog", () => {
  const catalog = read(`${responseDirectory}catalog.md`)
  const listed = [...catalog.matchAll(/`@agent-prompts\/response-formats\/([^`]+)`/g)]
    .map(([, file]) => `${responseDirectory}${file}`).filter((path) => !path.endsWith("/common.md"))
  assert.deepEqual(listed.sort(), [...responseProfiles].sort())
  for (const path of responseProfiles) {
    assert.ok(read(path).includes("`@agent-prompts/response-formats/common.md`"), `${path}: missing shared envelope`)
  }
  assert.ok(!existsSync(new URL("references/agent-prompts/review-template.md", root)))
  assert.ok(read("README.md").includes("`references/agent-prompts/review-template.md`"), "missing upgrade removal")
})

test("every specialist selects one canonical task response profile", () => {
  for (const [name, agent] of Object.entries(agents)) {
    if (agent.mode !== "subagent") continue
    const profiles = [...read(`agents/${name}.md`).matchAll(/`@agent-prompts\/response-formats\/([^`]+)`/g)]
      .map(([, file]) => `${responseDirectory}${file}`)
    assert.equal(profiles.length, 1, `${name}: declare exactly one default response profile`)
    assert.ok(responseProfiles.includes(profiles[0]), `${name}: unknown task response profile`)
  }
})

test("every delegating agent can read the canonical response catalog", () => {
  for (const name of Object.keys(agents)) {
    if (targets(name).length === 0) continue
    assert.ok(sharedReferences(`agents/${name}.md`).has(`${responseDirectory}catalog.md`),
      `${name}: no response catalog in its explicit reference chain`)
  }
})

test("specialist references and reusable task skills do not import primary workflow procedures", () => {
  const primaryProcedures = new Set([
    "lead-contract", "planning-stage", "implementation-stage", "review-stage", "completion", "spec-interview",
  ].map((name) => `references/agent-prompts/${name}.md`))
  const paths = Object.keys(agents).filter((name) => agents[name].mode === "subagent")
    .map((name) => `agents/${name}.md`)
  paths.push(...skills.filter((name) => name !== "checkpoint").map((name) => `skills/${name}/SKILL.md`))
  for (const path of paths) {
    for (const dependency of sharedReferences(path)) {
      assert.ok(!primaryProcedures.has(dependency), `${path}: imports primary workflow ${dependency}`)
    }
  }
})

test("runtime prompts do not invoke retired entrypoints", () => {
  for (const path of promptPaths) {
    const text = read(path)
    assert.ok(!text.includes("`lead`"), `${path}: obsolete lead name`)
    assert.ok(!text.includes("agents/lead.md"), `${path}: obsolete lead path`)
    assert.ok(!text.includes("@agent-prompts/review-template.md"), `${path}: obsolete review response template`)
    for (const name of retiredCommands) {
      assert.ok(!text.includes(`\`/${name}\``), `${path}: obsolete command /${name}`)
    }
    for (const name of retiredSkills) {
      assert.ok(!text.includes(`skills/${name}/`), `${path}: obsolete skill path ${name}`)
    }
  }
})

test("relative documentation links resolve after moving procedures", () => {
  for (const path of documentPaths) {
    for (const [, href] of read(path).matchAll(/\]\(([^\s)]+)\)/g)) {
      if (/^(?:[a-z]+:|#|\/)/i.test(href)) continue
      const target = new URL(href, new URL(path, root))
      target.hash = ""
      assert.ok(target.href.startsWith(root.href), `${path}: link leaves the repository: ${href}`)
      assert.ok(existsSync(target), `${path}: broken link ${href}`)
    }
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
