import type { Plugin, PluginInput } from '@opencode-ai/plugin';

type Client = PluginInput['client'];

// Variable names whose values are treated as credentials. Delimited words avoid names such as TOKENIZERS_PARALLELISM.
const SECRET_NAME =
  /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?)(?:_|$)/i;
// Names that locate a credential or store rather than holding one, such as AWS_WEB_IDENTITY_TOKEN_FILE.
const LOCATION_NAME = /(?:_FILE|_PATH|_DIR|_HOME)$|^PASSWORD_STORE_/i;
// Values that are filesystem paths, such as GOOGLE_APPLICATION_CREDENTIALS=/home/me/key.json.
const PATH_VALUE = /^(?:[/~]|[a-z]:[\\/]|\.{1,2}[\\/])\S*$/i;
// A URL with an embedded password, such as postgres://user:password@host/db or https://:token@host.
const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]*:)[^\s/@]+@/gi;
// Short values such as `postgres` would rewrite ordinary text, so only longer literal values are redacted.
const MIN_LITERAL_LENGTH = 12;
const MAX_DEPTH = 8;

const KEY_BEGIN = '-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----';
const KEY_END = '-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----';
const REDACTIONS: readonly (readonly [string, RegExp])[] = [
  // A key block ends at its END line or, when output was cut, at the end of the text.
  ['private-key', new RegExp(`${KEY_BEGIN}[\\s\\S]*?(?:${KEY_END}|$)`, 'g')],
  // An END line without its BEGIN means the text starts inside a key, as with an offset read.
  ['private-key', new RegExp(`^[\\s\\S]*?${KEY_END}`)],
  ['aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ['github-token', /\bgh[opsur]_[A-Za-z0-9]{36,255}\b/g],
  ['github-token', /\bgithub_pat_\w{22,255}\b/g],
  ['gitlab-token', /\bglpat-[\w-]{20,}\b/g],
  ['slack-token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g],
  ['api-key', /\bsk-[\w-]{20,}\b/g],
  ['stripe-key', /\b[rs]k_live_[A-Za-z0-9]{20,}\b/g],
  ['npm-token', /\bnpm_[A-Za-z0-9]{36}\b/g],
  ['google-api-key', /\bAIza[\w-]{35}\b/g],
  ['jwt', /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g],
];
const BEARER = /(authorization:\s*bearer\s+)[\w.~+/-]+=*/gi;

const hasUrlPassword = (value: string): boolean => {
  URL_PASSWORD.lastIndex = 0;
  return URL_PASSWORD.test(value);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const notify = (client: Client, kinds: ReadonlySet<string>, tool: string): void => {
  void client.tui
    .showToast({
      body: {
        title: 'scrub-secrets',
        message: `Redacted ${[...kinds].join(', ')} from ${tool} output`,
        variant: 'warning',
      },
    })
    .catch(() => {
      // toast surface unavailable (headless run, server down) — redaction already applied
    });
};

// eslint-disable-next-line @typescript-eslint/require-await -- OpenCode's plugin factory requires a Promise result.
export const ScrubSecretsPlugin: Plugin = async ({ client }) => {
  // OPENCODE_SCRUB_ENV_ALLOW names variables that shell commands still need, separated by commas.
  const allowed = new Set(
    (process.env.OPENCODE_SCRUB_ENV_ALLOW ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  );
  const secrets = Object.entries(process.env).flatMap(([name, value]) => {
    if (value === undefined || value === '' || allowed.has(name)) {
      return [];
    }
    const named = SECRET_NAME.test(name) && !LOCATION_NAME.test(name) && !PATH_VALUE.test(value);
    return named || hasUrlPassword(value) ? [[name, value] as const] : [];
  });
  const secretNames = secrets.map(([name]) => name);
  // Literal values of scrubbed variables are also redacted if a tool prints them from another source.
  const literals = secrets
    .filter(([, value]) => value.length >= MIN_LITERAL_LENGTH)
    .map(([name, value]) => [name, new RegExp(escapeRegExp(value), 'g')] as const);

  const redact = (text: string, kinds: Set<string>): string => {
    let result = text;
    const apply = (kind: string, pattern: RegExp, replacement: string) => {
      const next = result.replace(pattern, replacement);
      if (next !== result) {
        kinds.add(kind);
        result = next;
      }
    };
    for (const [name, pattern] of literals) {
      apply('environment value', pattern, `[REDACTED:env:${name}]`);
    }
    for (const [kind, pattern] of REDACTIONS) {
      apply(kind, pattern, `[REDACTED:${kind}]`);
    }
    apply('bearer', BEARER, '$1[REDACTED:bearer]');
    apply('url-password', URL_PASSWORD, '$1[REDACTED:url-password]@');
    return result;
  };

  // Built-in tools return { output, metadata }; MCP tools return { content: [...] }; failed subtasks return nothing.
  // Every string in the result is redacted in place, except attachments, which carry encoded file data.
  const walk = (value: unknown, kinds: Set<string>, depth: number): unknown => {
    if (typeof value === 'string') {
      return redact(value, kinds);
    }
    if (depth >= MAX_DEPTH || typeof value !== 'object' || value === null) {
      return value;
    }
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        value[index] = walk(value[index], kinds, depth + 1);
      }
      return value;
    }
    for (const [key, item] of Object.entries(value)) {
      if (key !== 'attachments') {
        Reflect.set(value, key, walk(item, kinds, depth + 1));
      }
    }
    return value;
  };

  return {
    // The host merges this result over its own environment, so a blank value is the only available removal.
    // Terminal panels call the hook without a session or tool call; their output is not sent to the model.
    // eslint-disable-next-line @typescript-eslint/require-await -- The hook contract returns a Promise.
    'shell.env': async (input, output) => {
      if (input.sessionID === undefined && input.callID === undefined) {
        return;
      }
      for (const name of secretNames) {
        output.env[name] = '';
      }
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- The hook contract returns a Promise.
    'tool.execute.after': async (input, output: unknown) => {
      const kinds = new Set<string>();
      walk(output, kinds, 0);
      if (kinds.size > 0) {
        notify(client, kinds, input.tool);
      }
    },
  };
};
