import type { PluginInput } from '@opencode-ai/plugin';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { ScrubSecretsPlugin } from '../plugins/scrub-secrets.ts';

// Synthetic values only. They match credential formats but are not real credentials.
const fake = {
  github: `ghp_${'a'.repeat(36)}`,
  aws: 'AKIAABCDEFGHIJKLMNOP',
  openai: `sk-proj-${'b'.repeat(40)}`,
  jwt: `eyJ${'c'.repeat(12)}.eyJ${'d'.repeat(12)}.${'e'.repeat(12)}`,
  key: '-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAsynthetic\n-----END OPENSSH PRIVATE KEY-----',
  env: 'synthetic-env-value-123',
};

const variables = {
  SCRUB_TEST_API_TOKEN: fake.env,
  SCRUB_TEST_DATABASE_URL: 'postgres://app:synthetic-password@db.example.invalid/app',
  SCRUB_TEST_TOKENIZERS_PARALLELISM: 'false',
  SCRUB_TEST_ALLOWED_TOKEN: 'kept-for-tools',
  PASSWORD_STORE_DIR: '/home/test/.password-store',
  SCRUB_TEST_IDENTITY_TOKEN_FILE: '/var/run/secrets/token',
  SCRUB_TEST_APPLICATION_CREDENTIALS: '/home/test/key.json',
  SCRUB_TEST_SHORT_PASSWORD: 'postgres',
};
const saved = new Map<string, string | undefined>();

const create = async () => {
  const showToast = mock.fn(async () => ({ data: undefined }));
  const hooks = await ScrubSecretsPlugin({ client: { tui: { showToast } } } as unknown as PluginInput);
  const env = hooks['shell.env'];
  const after = hooks['tool.execute.after'];
  assert.ok(env !== undefined && after !== undefined);
  return { env, after, showToast };
};

describe('scrub-secrets plugin', () => {
  beforeEach(() => {
    for (const [name, value] of Object.entries({
      ...variables,
      OPENCODE_SCRUB_ENV_ALLOW: 'SCRUB_TEST_ALLOWED_TOKEN',
    })) {
      saved.set(name, process.env[name]);
      process.env[name] = value;
    }
  });
  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = value;
      }
    }
    saved.clear();
  });

  it('blanks credential variables for agent shell calls', async () => {
    const { env } = await create();
    const output = { env: {} as Record<string, string> };
    await env({ cwd: '/project', sessionID: 'session', callID: 'call' }, output);
    assert.equal(output.env.SCRUB_TEST_API_TOKEN, '');
    assert.equal(output.env.SCRUB_TEST_DATABASE_URL, '');
    assert.equal('SCRUB_TEST_TOKENIZERS_PARALLELISM' in output.env, false);
    assert.equal('SCRUB_TEST_ALLOWED_TOKEN' in output.env, false);
    assert.equal('PASSWORD_STORE_DIR' in output.env, false);
    assert.equal('SCRUB_TEST_IDENTITY_TOKEN_FILE' in output.env, false);
    assert.equal('SCRUB_TEST_APPLICATION_CREDENTIALS' in output.env, false);
    assert.equal(output.env.SCRUB_TEST_SHORT_PASSWORD, '');
  });

  it('leaves terminal panels without a session unchanged', async () => {
    const { env } = await create();
    const output = { env: {} as Record<string, string> };
    await env({ cwd: '/project' }, output);
    assert.deepEqual(output.env, {});
  });

  it('redacts credential formats, environment values, and URL passwords from output', async () => {
    const { after, showToast } = await create();
    const text = [
      `token=${fake.github}`,
      `aws=${fake.aws}`,
      `openai=${fake.openai}`,
      `Authorization: Bearer ${fake.jwt}`,
      fake.key,
      `leaked ${fake.env}`,
      'url=postgres://app:synthetic-password@db.example.invalid/app',
      'other=mysql://root:other-synthetic-password@localhost/app',
    ].join('\n');
    const output = { title: '', output: text, metadata: { output: text } };
    await after({ tool: 'bash', sessionID: 'session', callID: 'call', args: {} }, output);
    for (const value of [
      fake.github,
      fake.aws,
      fake.openai,
      fake.jwt,
      'AAAAsynthetic',
      fake.env,
      'synthetic-password',
    ]) {
      assert.equal(output.output.includes(value), false, value);
      assert.equal(output.metadata.output.includes(value), false, value);
    }
    assert.match(output.output, /\[REDACTED:github-token\]/);
    assert.match(output.output, /\[REDACTED:env:SCRUB_TEST_API_TOKEN\]/);
    assert.match(output.output, /\[REDACTED:env:SCRUB_TEST_DATABASE_URL\]/);
    assert.match(output.output, /mysql:\/\/root:\[REDACTED:url-password\]@localhost/);
    assert.equal(showToast.mock.callCount(), 1);
  });

  it('leaves ordinary output and the toast untouched', async () => {
    const { after, showToast } = await create();
    const text = 'sk-short\nTOKENIZERS_PARALLELISM=false\nhttps://example.invalid/path\nkept-for-tools';
    const output = { title: '', output: text, metadata: {} };
    await after({ tool: 'read', sessionID: 'session', callID: 'call', args: {} }, output);
    assert.equal(output.output, text);
    assert.equal(showToast.mock.callCount(), 0);
  });

  it('redacts MCP content and tolerates missing results', async () => {
    const { after } = await create();
    const output = {
      content: [
        { type: 'text', text: `token ${fake.github}` },
        { type: 'resource', resource: { uri: 'file:///x', text: fake.jwt } },
      ],
      structuredContent: { nested: { key: fake.aws } },
    };
    await after({ tool: 'github_get_file', sessionID: 's', callID: 'c', args: {} }, output as never);
    const text = JSON.stringify(output);
    for (const value of [fake.github, fake.jwt, fake.aws]) {
      assert.equal(text.includes(value), false, value);
    }
    await after({ tool: 'task', sessionID: 's', callID: 'c', args: {} }, undefined as never);
  });

  it('redacts partial private keys and PGP key blocks', async () => {
    const { after } = await create();
    for (const text of [
      '-----BEGIN RSA PRIVATE KEY-----\nAAAAtruncated',
      'AAAAoffset-body\nmore\n-----END EC PRIVATE KEY-----\nafter',
      '-----BEGIN PGP PRIVATE KEY BLOCK-----\nAAAApgp\n-----END PGP PRIVATE KEY BLOCK-----',
    ]) {
      const output = { title: '', output: text, metadata: {} };
      await after({ tool: 'read', sessionID: 's', callID: 'c', args: {} }, output);
      assert.doesNotMatch(output.output, /AAAA/, text);
    }
  });

  it('keeps short environment values in ordinary text and redacts empty-user URL passwords', async () => {
    const { after } = await create();
    const output = { title: '', output: 'database: postgres\nhttps://:synthetic-url-token@host.invalid', metadata: {} };
    await after({ tool: 'read', sessionID: 's', callID: 'c', args: {} }, output);
    assert.match(output.output, /database: postgres/);
    assert.doesNotMatch(output.output, /synthetic-url-token/);
  });

  it('still redacts when the toast fails', async () => {
    const showToast = mock.fn(async () => Promise.reject(new Error('no tui')));
    const hooks = await ScrubSecretsPlugin({ client: { tui: { showToast } } } as unknown as PluginInput);
    const output = { title: '', output: fake.github, metadata: {} };
    await hooks['tool.execute.after']?.({ tool: 'grep', sessionID: 's', callID: 'c', args: {} }, output);
    assert.equal(output.output, '[REDACTED:github-token]');
  });
});
