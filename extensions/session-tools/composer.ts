import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from 'opencode-config-composer-name-tbd/package.json' with { type: 'json' };

const installedDirectory = dirname(
  fileURLToPath(import.meta.resolve('opencode-config-composer-name-tbd/package.json')),
);

export function isConfigComposer(spec: unknown): boolean {
  if (typeof spec !== 'string') {
    return false;
  }
  if (spec === manifest.name) {
    return true;
  }
  if (spec.startsWith(`${manifest.name}@`)) {
    const version = spec.slice(manifest.name.length + 1);
    return version !== '' && /^[a-z0-9.*+~^<>=| -]+$/i.test(version);
  }
  if (/[/\\](?:config-composer|agent-groups)[/\\]server\.(?:ts|js)$/.test(spec)) {
    return true;
  }
  try {
    return resolve(spec.startsWith('file:') ? fileURLToPath(spec) : spec) === installedDirectory;
  } catch {
    return false;
  }
}
