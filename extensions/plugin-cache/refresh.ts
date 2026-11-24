import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

// OpenCode V1 installs each npm plugin spec once into `<cache>/packages/<spec>` and reuses that directory while
// `node_modules/<name>` exists. A bare spec is installed as `<name>@latest`. Nothing expires these directories, so a
// dist-tag such as `@latest` keeps resolving to the version that was current at the first install.
const PACKAGE_NAME = /^(?:@[a-z0-9~-][\w.~-]*\/)?[a-z0-9~-][\w.~-]*$/i;
// A dist-tag must not parse as a semver version or range. Ranges start with a digit, `v` and a digit, an operator,
// or an `x` wildcard; tags are otherwise limited to the characters a cache directory name can hold.
const DIST_TAG = /^[a-z][\w.-]*$/i;
const RANGE_LIKE_TAG = /^(?:v\d|[x*](?:\.|$))/i;
const STALE_DIRECTORY = '.stale';
const REQUEST_TIMEOUT_MS = 10_000;

export interface CachedPackage {
  readonly name: string;
  readonly tag: string;
  readonly directory: string;
  readonly installedVersion: string;
}

export interface RefreshedPackage extends CachedPackage {
  readonly availableVersion: string;
}

export interface RefreshOptions {
  readonly packagesDirectory: string;
  readonly fetchDistTags: (name: string) => Promise<Readonly<Record<string, string>> | undefined>;
  readonly warn: (message: string, extra: Record<string, unknown>) => Promise<void> | void;
}

export function defaultPackagesDirectory(env: NodeJS.ProcessEnv = process.env): string {
  const cacheHome = env.XDG_CACHE_HOME ?? join(homedir(), '.cache');
  return join(cacheHome, 'opencode', 'packages');
}

export function defaultRegistry(env: NodeJS.ProcessEnv = process.env): string {
  return (env.npm_config_registry ?? env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org').replace(/\/+$/, '');
}

export function parseCacheEntry(entry: string): { name: string; tag: string } | undefined {
  const separator = entry.indexOf('@', entry.startsWith('@') ? entry.indexOf('/') + 1 : 0);
  if (separator <= 0) {
    return undefined;
  }
  const name = entry.slice(0, separator);
  const tag = entry.slice(separator + 1);
  if (!PACKAGE_NAME.test(name) || !DIST_TAG.test(tag) || RANGE_LIKE_TAG.test(tag)) {
    return undefined;
  }
  return { name, tag };
}

const directoryNames = async (directory: string): Promise<string[]> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
};

const installedVersion = async (directory: string, name: string): Promise<string | undefined> => {
  try {
    const manifest: unknown = JSON.parse(await readFile(join(directory, 'node_modules', name, 'package.json'), 'utf8'));
    if (typeof manifest !== 'object' || manifest === null || !('version' in manifest)) {
      return undefined;
    }
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
};

export async function listTaggedPackages(packagesDirectory: string): Promise<CachedPackage[]> {
  const entries: string[] = [];
  for (const name of await directoryNames(packagesDirectory)) {
    if (name.startsWith('.')) {
      continue;
    }
    if (!name.startsWith('@')) {
      entries.push(name);
      continue;
    }
    for (const scoped of await directoryNames(join(packagesDirectory, name))) {
      entries.push(`${name}/${scoped}`);
    }
  }
  const packages = await Promise.all(
    entries.map(async (entry) => {
      const parsed = parseCacheEntry(entry);
      if (parsed === undefined) {
        return undefined;
      }
      const directory = join(packagesDirectory, ...entry.split('/'));
      const version = await installedVersion(directory, parsed.name);
      return version === undefined ? undefined : { ...parsed, directory, installedVersion: version };
    }),
  );
  return packages.filter((cached) => cached !== undefined);
}

// The directory is renamed before it is deleted. OpenCode treats any existing `node_modules/<name>` as a complete
// install, so a recursive delete that stops partway would leave a broken package that is never reinstalled.
const discard = async (packagesDirectory: string, directory: string) => {
  const staleRoot = join(packagesDirectory, STALE_DIRECTORY);
  await mkdir(staleRoot, { recursive: true });
  const staleDirectory = join(staleRoot, randomUUID());
  await rename(directory, staleDirectory);
  await rm(staleDirectory, { recursive: true, force: true });
};

export async function refreshTaggedPackages(options: RefreshOptions): Promise<RefreshedPackage[]> {
  await rm(join(options.packagesDirectory, STALE_DIRECTORY), { recursive: true, force: true });
  const cached = await listTaggedPackages(options.packagesDirectory);
  const distTags = new Map<string, Promise<Readonly<Record<string, string>> | undefined>>();
  const results = await Promise.all(
    cached.map(async (entry): Promise<RefreshedPackage | undefined> => {
      let tags = distTags.get(entry.name);
      if (tags === undefined) {
        tags = options.fetchDistTags(entry.name);
        distTags.set(entry.name, tags);
      }
      try {
        const availableVersion = (await tags)?.[entry.tag];
        if (availableVersion === undefined || availableVersion === entry.installedVersion) {
          return undefined;
        }
        await discard(options.packagesDirectory, entry.directory);
        return { ...entry, availableVersion };
      } catch (error) {
        await options.warn('Could not refresh cached plugin package', {
          package: `${entry.name}@${entry.tag}`,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    }),
  );
  return results.filter((result) => result !== undefined);
}

export function registryDistTags(registry: string) {
  return async (name: string): Promise<Readonly<Record<string, string>> | undefined> => {
    const response = await fetch(`${registry}/${name.replace('/', '%2f')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return undefined;
    }
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('dist-tags' in body)) {
      return undefined;
    }
    const tags = body['dist-tags'];
    if (typeof tags !== 'object' || tags === null) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(tags).filter((tag): tag is [string, string] => typeof tag[1] === 'string'),
    );
  };
}
