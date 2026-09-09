import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { posix } from "node:path"

type Client = PluginInput["client"]

const BLOCKED_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[^/]+$/,
  /\.pem$/,
  /(^|\/)id_rsa($|\.)/,
  /(^|\/)id_ed25519($|\.)/,
  /(^|\/)id_ecdsa($|\.)/,
  /(^|\/)id_dsa($|\.)/,
  /\.key$/,
  /(^|\/)credentials\.json$/,
  /(^|\/)\.netrc$/,
  /(^|\/)secrets\.(json|yaml|yml)$/,
  /\.p12$/,
  /\.pfx$/,
  /(^|\/)\.aws\/credentials$/,
  /(^|\/)\.ssh\/.*$/,
]

const ALLOWED_BASENAMES: ReadonlySet<string> = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.defaults",
  ".env.dist",
])

const PATH_TOOL_ARG_KEYS = ["filePath", "file_path", "path"] as const

const SECRETS_DIRECTORY_PATTERN = /(^|\/)secrets(\/|$)/

const isBlockedPath = (raw: string): string | undefined => {
  if (!raw) return undefined
  const normalized = raw.replaceAll("\\", "/").toLowerCase()
  if (SECRETS_DIRECTORY_PATTERN.test(normalized)) return SECRETS_DIRECTORY_PATTERN.source
  if (ALLOWED_BASENAMES.has(posix.basename(normalized))) return undefined
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) return pattern.source
  }
  return undefined
}

const firstBlockedPathInCommand = (command: string): { path: string; pattern: string } | undefined => {
  const tokens = command.split(/\s+/).filter(Boolean)
  for (const raw of tokens) {
    const cleaned = raw.replace(/^["']|["']$/g, "")
    const hit = isBlockedPath(cleaned)
    if (hit) return { path: cleaned, pattern: hit }
  }
  return undefined
}

// Toast is best-effort additive UX — the thrown error is what actually stops
// the tool call. A toast failure must not mask the underlying block reason.
const notifyBlocked = (client: Client, path: string, pattern: string): void => {
  void client.tui
    .showToast({
      body: {
        title: "block-secrets",
        message: `Blocked ${path} (pattern ${pattern})`,
        variant: "error",
      },
    })
    .catch(() => {
      // toast surface unavailable (headless run, server down) — swallow
    })
}

const reject = (client: Client, path: string, pattern: string, reason: string): never => {
  notifyBlocked(client, path, pattern)
  throw new Error(
    `blocked by block-secrets plugin: ${reason}. Sensitive-file access is denied by policy (see plugins/README.md).`,
  )
}

export const BlockSecretsPlugin: Plugin = async ({ client }) => ({
  "tool.execute.before": async (input, output) => {
    const toolName = input.tool.toLowerCase()
    const args = (output.args ?? {}) as Record<string, unknown>

    if (toolName === "bash") {
      const command = typeof args.command === "string" ? args.command : ""
      const hit = firstBlockedPathInCommand(command)
      if (hit) reject(client, hit.path, hit.pattern, `bash command references ${hit.path} (pattern ${hit.pattern})`)
      return
    }

    if (toolName === "glob" && typeof args.pattern === "string") {
      const hit = isBlockedPath(args.pattern)
      if (hit) reject(client, args.pattern, hit, `glob attempted to access ${args.pattern} (pattern ${hit})`)
    }

    for (const key of PATH_TOOL_ARG_KEYS) {
      const value = args[key]
      if (typeof value !== "string") continue
      const hit = isBlockedPath(value)
      if (hit) reject(client, value, hit, `${toolName || "tool"} attempted to access ${value} (pattern ${hit})`)
    }
  },
})
