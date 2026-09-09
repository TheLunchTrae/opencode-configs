# Plugins

## `block-secrets.ts`

The plugin rejects matching path arguments before a tool runs. It shows an error toast when the toast surface is
available.

The plugin checks `filePath`, `file_path`, and `path` arguments. It checks `pattern` only for glob. It normalizes
backslashes and compares paths without case sensitivity, including on POSIX systems.

The plugin blocks `.env` files, private-key files, SSH key paths, `credentials.json`, `.netrc`,
`secrets.{json,yaml,yml}`, `.aws/credentials`, `.ssh/` content, `.p12`, and `.pfx` files. A complete literal
`secrets` path segment takes precedence over allowed `.env` template basenames.

The Bash check splits a command into tokens and checks each token. This check is a heuristic, not a sandbox.

## Limits

- Shell expansion can hide a path from the token check.
- Symlinks and aliases can change the accessed path.
- A search that starts in a parent directory can read matching content without a blocked path argument.
- Shell approval defaults to `ask`. Existing deny rules remain in effect.
- The `--auto` option, session `Always` approval, project configuration, and agent overrides can reduce approval
  prompts.
- Approved commands, scripts, and hooks can access secrets.

Do not treat this plugin as complete secret protection.

## Check the plugin

Run these commands only when local Node.js, TypeScript, and `@opencode-ai/plugin` dependencies are available. The
ignored `package.json` provides local plugin tooling.

```sh
node --experimental-strip-types --test tests/block-secrets.test.ts
npm exec --no -- tsc --noEmit
```

`tests/block-secrets.test.ts` uses a mocked hook and does not access real secrets.

Restart OpenCode after plugin changes. Then run a harmless command that requires approval to check the approval
prompt.
