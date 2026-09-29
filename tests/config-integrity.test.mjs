import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { test } from "node:test"
import { parseDocument } from "yaml"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const config = JSON.parse(read("opencode.jsonc"))

// Check this configuration's literal and * patterns, with V1 slash normalization and last-match order.
// These policy examples do not launch OpenCode or model its full permission system.
const matchesPolicyPattern = (pattern, input) => {
  const normalized = pattern.replaceAll("\\", "/")
  const optionalArguments = normalized.endsWith(" *")
  const body = optionalArguments ? normalized.slice(0, -2) : normalized
  const parts = body.split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const suffix = optionalArguments ? "(?: .*)?" : ""
  return new RegExp(`^${parts.join(".*")}${suffix}$`, "s").test(input.replaceAll("\\", "/"))
}
const configuredAction = (permission, input, policy = config.permission) => {
  let action
  for (const [name, rules] of Object.entries(policy)) {
    if (!matchesPolicyPattern(name, permission)) continue
    if (typeof rules === "string") {
      action = rules
      continue
    }
    for (const [pattern, value] of Object.entries(rules)) {
      if (matchesPolicyPattern(pattern, input)) action = value
    }
  }
  return action
}

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
})

const permissionActions = new Set(["allow", "ask", "deny"])
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const agentSettings = (text, name) => {
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
  assert.ok(header, `${name}: missing agent frontmatter`)
  const document = parseDocument(header, { uniqueKeys: true })
  assert.equal(document.errors.length, 0, `${name}: ${document.errors.map((error) => error.message).join("; ")}`)
  const fields = document.toJS()
  assert.ok(isRecord(fields), `${name}: agent frontmatter must be a mapping`)
  assert.ok(["primary", "subagent", "all"].includes(fields.mode), `${name}: invalid agent mode`)
  const permission = fields.permission === undefined ? {} : fields.permission
  assert.ok(isRecord(permission), `${name}: agent permissions must be a mapping`)
  for (const key of ["edit", "bash", "question"]) {
    assert.ok(permission[key] === undefined || permissionActions.has(permission[key]),
      `${name}: ${key} must be a scalar permission action`)
  }
  const task = permission.task
  assert.ok(task === undefined || permissionActions.has(task) || isRecord(task), `${name}: invalid Task permissions`)
  if (isRecord(task)) {
    for (const [target, action] of Object.entries(task)) {
      assert.ok(target.length > 0 && permissionActions.has(action), `${name}: invalid Task rule for ${target}`)
    }
  }
  return {
    mode: fields.mode,
    edit: permission.edit ?? config.permission.edit["*"],
    bash: permission.bash,
    question: permission.question,
    external_directory: permission.external_directory,
    rules: typeof task === "string" ? { "*": task } : { ...config.permission.task, ...task },
  }
}

test("agent permission inspection preserves YAML Task grants and rejects invalid policies", () => {
  const inspect = (permission) => agentSettings(`---\nmode: subagent\npermission: ${permission}\n---\n`, "fixture")
  assert.deepEqual(inspect("{ task: { '*': allow, writer: ask } }").rules, { "*": "allow", writer: "ask" })
  assert.deepEqual(inspect("\n  task:\n    writer: allow").rules, { "*": "deny", writer: "allow" })
  assert.deepEqual(inspect("{ task: allow }").rules, { "*": "allow" })
  assert.deepEqual(inspect("{}").rules, { "*": "deny" })
  assert.throws(() => inspect("{ task: { writer: invalid } }"), /invalid Task rule/)
  assert.throws(() => inspect("[allow]"), /permissions must be a mapping/)
  assert.throws(() => inspect("{ task: allow, task: deny }"), /Map keys must be unique/)
})

// These checks inspect configured policies. Native OpenCode loading remains a separate check.
const agents = Object.fromEntries(readdirSync(new URL("agents/", root)).filter((name) => name.endsWith(".md"))
  .map((file) => {
    const name = file.slice(0, -3)
    return [name, agentSettings(read(`agents/${file}`), name)]
  }))
const builtinAgents = Object.fromEntries(["general", "explore"].map((name) => {
  const permission = config.agent[name].permission ?? {}
  const task = permission.task
  return [name, {
    mode: config.agent[name].mode ?? "subagent",
    edit: permission.edit ?? config.permission.edit["*"],
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

test("Explore explicitly denies edits after global permissions are applied", () => {
  assert.equal(config.agent.explore.permission?.edit, "deny")
})

test("only primary leads receive an explicit Question tool grant", () => {
  assert.equal(config.permission.question, undefined, "do not enable questions for every subagent")
  for (const [name, agent] of Object.entries(agents)) {
    if (leads.includes(name)) assert.equal(agent.question, "allow", name)
    else assert.notEqual(agent.question, "allow", name)
  }
  for (const [name, agent] of Object.entries(config.agent)) {
    assert.notEqual(agent.permission?.question, "allow", name)
  }
})

test("native Read rules cover complete secrets segments with either path separator", () => {
  const blocked = [
    "secrets", "secrets/fixture.txt", "app/secrets", "app/secrets/nested/fixture.txt",
    "../../.config/opencode/secrets", "../../.config/opencode/secrets/fixture.txt",
    "../secrets/.env.example", "C:/Users/fixture/.config/opencode/secrets/fixture.txt",
  ]
  for (const path of blocked) {
    for (const input of [path, path.replaceAll("/", "\\")]) {
      assert.equal(configuredAction("read", input), "deny", input)
    }
  }
  for (const path of ["src/index.ts", "app/not-secrets/fixture.txt", "secrets-notes.md", "docs/secrets.md"]) {
    assert.equal(configuredAction("read", path), undefined, path)
  }
})

test("external-directory rules retain the native trusted-directory exceptions", () => {
  assert.equal(config.permission.external_directory, undefined)
  for (const [name, agent] of Object.entries(config.agent)) {
    assert.equal(agent.permission?.external_directory, undefined, name)
  }
  for (const [name, agent] of Object.entries(agents)) {
    assert.equal(agent.external_directory, undefined, name)
  }
})

test("configured MCP tools require approval while their connections stay disabled", () => {
  for (const name of [
    "github_get_me", "github_create_pull_request", "github_future_tool",
    "playwright_browser_navigate", "playwright_browser_click", "playwright_future_tool",
  ]) {
    assert.equal(configuredAction(name, "*"), "ask", name)
  }
  for (const server of Object.values(config.mcp)) assert.equal(server.enabled, false)
})

test("Git inspection accepts flexible arguments while output-writing forms require approval", () => {
  for (const command of [
    "git status", "git diff", "git log", "git status --short", "git status --porcelain=v2 --branch",
    "git status --ignored -- src", "git diff --stat", "git diff --cached --name-only",
    "git diff HEAD~2..HEAD -- src/index.ts", "git diff --no-ext-diff --no-textconv",
    "git diff --cached --no-ext-diff --no-textconv", "git diff --ext-diff", "git diff --textconv",
    "git log --oneline -n 10", "git log --graph --decorate --all -n 50", "git log -p -- src/index.ts",
  ]) {
    assert.equal(configuredAction("bash", command), "allow", command)
  }
  for (const command of [
    "git status > tracked-file.txt", "git status --short>tracked-file.txt", "git diff HEAD >> tracked-file.txt",
    "git diff --stat --output=tracked-file.txt", "git diff --output tracked-file.txt HEAD",
    "git log --oneline -n 10 --output=tracked-file.txt", "git log --output tracked-file.txt",
    "git log -n 5 2>tracked-file.txt", ">tracked-file.txt git status", "git -c alias.inspect=status inspect",
    "git difftool --extcmd=command", "git diff-tree HEAD", "git status-extra", "git log-extra",
    "git commit -m example", "git push origin main", "npm test", "python script.py",
  ]) {
    assert.equal(configuredAction("bash", command), "ask", command)
  }
  for (const command of [
    "git branch -D example", "git clean -fd", "git push --force origin main",
    "git push -f origin main", "git reset --hard HEAD", "rm -rf fixture",
  ]) {
    assert.equal(configuredAction("bash", command), "deny", command)
  }
  assert.equal(configuredAction("edit", "src/index.ts"), "ask")
  for (const name of ["planning-lead", "planner", "architect", "architecture-reviewer"]) {
    assert.equal(agents[name].bash, "deny", name)
  }
})

test("specific Bash approvals survive a broader project wildcard", () => {
  const projectPolicy = { ...config.permission, bash: { ...config.permission.bash, "*": "allow" } }
  for (const command of [
    "git checkout feature", "git commit -m example", "git push origin main", "sudo command", "python script.py",
  ]) {
    assert.equal(configuredAction("bash", command, projectPolicy), "ask", command)
  }
  assert.equal(configuredAction("bash", "git push --force origin main", projectPolicy), "deny")
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

test("/test-audit runs as the read-only primary review lead and forwards context", () => {
  const path = "commands/test-audit.md"
  const fields = metadata(path)
  assert.ok(fields.description?.trim(), `${path}: missing description`)
  assert.equal(fields.agent, "review-lead")
  assert.equal(agents[fields.agent].mode, "primary")
  assert.equal(agents[fields.agent].edit, "deny")
  assert.equal(fields.subtask, "false", "Do not invoke a primary lead as a child")
  assert.equal(fields.model, undefined, "Use the review lead's configured model")
  assert.equal(read(path).split("$ARGUMENTS").length - 1, 1, "Forward audit context once")
  assert.ok(!read(path).includes("!`"), "No automatic shell interpolation")
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

test("every specialist references one canonical task response profile", () => {
  for (const [name, agent] of Object.entries(agents)) {
    if (agent.mode !== "subagent") continue
    const profiles = [...new Set([...read(`agents/${name}.md`).matchAll(/`@agent-prompts\/response-formats\/([^`]+)`/g)]
      .map(([, file]) => `${responseDirectory}${file}`))]
    assert.equal(profiles.length, 1, `${name}: reference exactly one distinct task response profile`)
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
