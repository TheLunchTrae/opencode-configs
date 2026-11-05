import type { PluginInput } from '@opencode-ai/plugin';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { CommentGuardPlugin } from '../plugins/comment-guard.ts';

const createHook = async (directory = '/project') => {
  const hooks = await CommentGuardPlugin({ directory } as unknown as PluginInput);
  const hook = hooks['tool.execute.before'];
  assert.ok(hook !== undefined);
  return hook;
};

const run = async (tool: string, args: Record<string, unknown>, directory?: string) => {
  const hook = await createHook(directory);
  await hook({ tool, sessionID: 'test-session', callID: 'test-call' }, { args });
};

const assertBlocked = async (tool: string, args: Record<string, unknown>, expected: string) => {
  await assert.rejects(run(tool, args), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /blocked by comment-guard plugin/);
    assert.ok(error.message.includes(expected), error.message);
    return true;
  });
};

const edit = (newString: string, filePath = '/project/src/app.ts', oldString = '') => ({
  filePath,
  oldString,
  newString,
});

afterEach(() => {
  delete process.env.OPENCODE_COMMENT_GUARD;
});

describe('comment-guard plugin', () => {
  it('blocks added comments that reference the conversation or earlier iterations', async () => {
    for (const comment of [
      '// As requested, retry twice before failing.',
      '// Per our discussion, cache the token.',
      '/* You asked for a shorter timeout. */',
      ' * Previously this was a class; now a function.',
      '// Changed from forEach to a for loop.',
      '// Now uses Map instead of a plain object.',
      '// Kept the guard from our previous iteration.',
      '{/* As the user requested, hide the banner. */}',
      'const limit = 3; // per the user request',
    ]) {
      await assertBlocked('edit', edit(comment), 'src/app.ts');
    }
    await assertBlocked('edit', edit('# As we discussed, skip vendored files.', '/project/tool.py'), 'tool.py');
    await assertBlocked('edit', edit('-- Per the prompt, keep both indexes.', '/project/schema.sql'), 'schema.sql');
  });

  it('allows neutral comments, code, strings, and prose files', async () => {
    for (const line of [
      '// Retry twice because the upstream API drops the first request after a deploy.',
      '// Fires when the state changed from idle to busy.',
      '// The user requested a password reset; send the email once.',
      '// Track the previous iteration so the loop can compare totals.',
      "const message = 'as requested'; // shown in the toast",
      "const url = 'https://example.com/as-requested'; // see docs",
      "const text = 'x(); // as requested';",
      'const asRequested = changedFrom(previous);',
    ]) {
      await run('edit', edit(line));
    }
    await run('write', { filePath: '/project/NOTES.md', content: '# As requested\n\nPer our discussion, ship it.' });
    await run('edit', edit('#header { color: red; } /* brand color */', '/project/site.css'));
    await run('bash', { command: 'echo "// as requested" > file.ts' });
  });

  it('ignores comment lines that the edit only keeps or moves', async () => {
    const existing = '// As requested, retry twice.';
    await run('edit', edit(`${existing}\nretry();`, '/project/src/app.ts', `${existing}\nattempt();`));
  });

  it('checks only lines added by write compared with the existing file', async (context) => {
    const directory = await mkdtemp(join(tmpdir(), 'comment-guard-'));
    context.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(join(directory, 'app.ts'), '// As requested, retry twice.\nretry();\n');

    await run('write', { filePath: 'app.ts', content: '// As requested, retry twice.\nretry(3);\n' }, directory);
    await assert.rejects(
      run('write', { filePath: 'app.ts', content: '// You asked for three retries.\nretry(3);\n' }, directory),
      /You asked for three retries/,
    );
  });

  it('reads added lines from apply_patch and multiedit inputs', async () => {
    const patchText = [
      '*** Begin Patch',
      '*** Add File: src/new.ts',
      '+// Per our conversation, export a default.',
      '+export default 1;',
      '*** Update File: README.md',
      '+As requested, more docs.',
      '*** End Patch',
    ].join('\n');
    await assertBlocked('apply_patch', { patchText }, 'src/new.ts: "Per our conversation, export a default."');

    await assertBlocked(
      'multiedit',
      { filePath: '/project/src/app.ts', edits: [{ oldString: 'a', newString: '// you said to inline this\nb' }] },
      'you said to inline this',
    );
  });

  it('blocks every new comment except directives in all mode, and nothing in off mode', async () => {
    process.env.OPENCODE_COMMENT_GUARD = 'all';
    await assertBlocked('edit', edit('// Retry twice.'), 'Retry twice.');
    await run('edit', edit('// eslint-disable-next-line no-console -- CLI output'));
    await run('edit', edit('# type: ignore', '/project/tool.py'));
    await run('edit', edit('#include <stdio.h>', '/project/main.c'));

    process.env.OPENCODE_COMMENT_GUARD = 'off';
    await run('edit', edit('// As requested, retry twice.'));
  });
});
