import type { Plugin, PluginInput } from '@opencode-ai/plugin';

type Client = PluginInput['client'];

// Variable names whose values are treated as credentials. Delimited words avoid names such as TOKENIZERS_PARALLELISM.
const SECRET_NAME =
  /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIALS?)(?:_|$)/i;
// Names that match SECRET_NAME but locate an agent or store rather than holding a credential value.
const ALLOWED_NAMES: ReadonlySet<string> = new Set(['PASSWORD_STORE_DIR']);
// A URL with an embedded password, such as postgres://user:password@host/db.
const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s/@]+@/gi;
const MIN_LITERAL_LENGTH = 8;

const REDACTIONS: readonly (readonly [string, RegExp])[] = [
  ['private-key', /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g],
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

const isSecretName = (name: string, allowed: ReadonlySet<string>): boolean =>
  !ALLOWED_NAMES.has(name) && !allowed.has(name) && SECRET_NAME.test(name);

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
  const secretNames = Object.entries(process.env)
    .filter(([name, value]) => value !== undefined && (isSecretName(name, allowed) || hasUrlPassword(value)))
    .filter(([name]) => !allowed.has(name))
    .map(([name]) => name);
  // Literal values of scrubbed variables are also redacted if a tool prints them from another source.
  const literals = Object.entries(process.env)
    .filter(([name, value]) => secretNames.includes(name) && value !== undefined && value.length >= MIN_LITERAL_LENGTH)
    .map(([name, value]) => [name, new RegExp(escapeRegExp(value ?? ''), 'g')] as const);

  const redact = (text: string): { text: string; kinds: Set<string> } => {
    const kinds = new Set<string>();
    let result = text;
    for (const [name, pattern] of literals) {
      const next = result.replace(pattern, `[REDACTED:env:${name}]`);
      if (next !== result) {
        kinds.add('environment value');
        result = next;
      }
    }
    for (const [kind, pattern] of REDACTIONS) {
      const next = result.replace(pattern, `[REDACTED:${kind}]`);
      if (next !== result) {
        kinds.add(kind);
        result = next;
      }
    }
    const withoutBearer = result.replace(BEARER, '$1[REDACTED:bearer]');
    if (withoutBearer !== result) {
      kinds.add('bearer');
      result = withoutBearer;
    }
    const withoutUrlPassword = result.replace(URL_PASSWORD, '$1[REDACTED:url-password]@');
    if (withoutUrlPassword !== result) {
      kinds.add('url-password');
      result = withoutUrlPassword;
    }
    return { text: result, kinds };
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
    'tool.execute.after': async (input, output) => {
      const { text, kinds } = redact(output.output);
      const metadata: unknown = output.metadata;
      if (typeof metadata === 'object' && metadata !== null && 'output' in metadata) {
        const record = metadata as Record<string, unknown>;
        if (typeof record.output === 'string') {
          const redacted = redact(record.output);
          record.output = redacted.text;
          for (const kind of redacted.kinds) {
            kinds.add(kind);
          }
        }
      }
      if (kinds.size > 0) {
        output.output = text;
        notify(client, kinds, input.tool);
      }
    },
  };
};
