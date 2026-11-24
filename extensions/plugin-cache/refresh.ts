import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
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
const STATE_FILE = '.plugin-cache-refresh.json';
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const REQUEST_TIMEOUT_MS = 10_000;

export interface CachedPackage {
  readonly name: string;
  readonly tag: string;
  readonly entry: string;
  readonly directory: string;
  readonly installedVersion: string;
}

export interface OutdatedPackage extends CachedPackage {
  readonly availableVersion: string;
}

export type DistTagLookup = (name: string) => Promise<Readonly<Record<string, string>> | undefined>;

export interface FindOptions {
  readonly packagesDirectory: string;
  readonly fetchDistTags: DistTagLookup;
  readonly warn: (message: string, extra: Record<string, unknown>) => Promise<void> | void;
}

export interface NpmSettings {
  readonly registry: string;
  readonly scopes: Readonly<Record<string, string>>;
  // Authorization header values by registry "nerf dart", the `//host/path/` form npmrc credential keys use.
  readonly credentials: Readonly<Partial<Record<string, string>>>;
  readonly pinnedDate: boolean;
}

export type NpmrcValues = Partial<Pick<NpmSettings, 'registry'>> & Omit<NpmSettings, 'registry'>;

export function defaultPackagesDirectory(env: NodeJS.ProcessEnv = process.env): string {
  // xdg-basedir, which OpenCode uses, treats an empty XDG_CACHE_HOME as unset.
  const cacheHome =
    env.XDG_CACHE_HOME === undefined || env.XDG_CACHE_HOME === '' ? join(homedir(), '.cache') : env.XDG_CACHE_HOME;
  return join(cacheHome, 'opencode', 'packages');
}

const trimRegistry = (registry: string) => registry.replace(/\/+$/, '');

const expandEnvironment = (value: string, env: NodeJS.ProcessEnv) =>
  value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => env[name] ?? '');

export function nerfDart(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
    return `//${parsed.host}${path}`;
  } catch {
    return undefined;
  }
}

const CREDENTIAL_KEY = /^(\/\/.+\/):(_authToken|_auth|username|_password)$/;

// Reads the settings that decide where a plugin install comes from and how it authenticates: `registry`,
// `@scope:registry`, `before`, and per-registry `_authToken`, `_auth`, or `username` with `_password`.
// Other keys are ignored. Credential values are kept only to send to the registry they are configured for.
export function parseNpmrc(text: string, env: NodeJS.ProcessEnv = process.env): NpmrcValues {
  let registry: string | undefined;
  const scopes: Record<string, string> = {};
  const credentialParts: Record<string, Partial<Record<string, string>>> = {};
  let pinnedDate = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = expandEnvironment(
      line
        .slice(separator + 1)
        .trim()
        .replace(/^(["'])(.*)\1$/, '$2'),
      env,
    );
    if (value === '') {
      continue;
    }
    const credential = CREDENTIAL_KEY.exec(key);
    if (key === 'registry') {
      registry = trimRegistry(value);
    } else if (/^@[^:]+:registry$/.test(key)) {
      scopes[key.slice(0, key.indexOf(':'))] = trimRegistry(value);
    } else if (key === 'before') {
      pinnedDate = true;
    } else if (credential !== null) {
      const [, dart, field] = credential;
      credentialParts[dart] = { ...credentialParts[dart], [field]: value };
    }
  }
  const credentials: Record<string, string> = {};
  for (const [dart, parts] of Object.entries(credentialParts)) {
    if (parts._authToken !== undefined) {
      credentials[dart] = `Bearer ${parts._authToken}`;
    } else if (parts._auth !== undefined) {
      credentials[dart] = `Basic ${parts._auth}`;
    } else if (parts.username !== undefined && parts._password !== undefined) {
      const password = Buffer.from(parts._password, 'base64').toString('utf8');
      credentials[dart] = `Basic ${Buffer.from(`${parts.username}:${password}`).toString('base64')}`;
    }
  }
  return { ...(registry === undefined ? {} : { registry }), scopes, credentials, pinnedDate };
}

const nonEmpty = (...values: (string | undefined)[]) => values.find((value) => value !== undefined && value !== '');

const readNpmrc = (file: string | undefined, env: NodeJS.ProcessEnv): NpmrcValues | undefined => {
  if (file === undefined) {
    return undefined;
  }
  try {
    return parseNpmrc(readFileSync(file, 'utf8'), env);
  } catch {
    // A missing or unreadable npmrc leaves the other sources in place.
    return undefined;
  }
};

// Follows npm's precedence: environment variables, then the user npmrc, then the global npmrc. The global npmrc
// is read only when `npm_config_globalconfig` names it, because its default location depends on the npm prefix.
// OpenCode installs from its cache directory, so a project npmrc does not apply to plugin installs.
export function npmSettings(env: NodeJS.ProcessEnv = process.env): NpmSettings {
  const files = [
    readNpmrc(nonEmpty(env.npm_config_globalconfig, env.NPM_CONFIG_GLOBALCONFIG), env),
    readNpmrc(nonEmpty(env.npm_config_userconfig, env.NPM_CONFIG_USERCONFIG) ?? join(homedir(), '.npmrc'), env),
  ].filter((values) => values !== undefined);
  const scopes: Record<string, string> = {};
  const credentials: Record<string, string> = {};
  for (const values of files) {
    Object.assign(scopes, values.scopes);
    Object.assign(credentials, values.credentials);
  }
  for (const [key, value] of Object.entries(env)) {
    const scope = /^npm_config_(@[^:]+):registry$/i.exec(key)?.[1];
    const registry = nonEmpty(value);
    if (scope !== undefined && registry !== undefined) {
      scopes[scope] = trimRegistry(registry);
    }
  }
  const registry =
    nonEmpty(env.npm_config_registry, env.NPM_CONFIG_REGISTRY) ??
    files.findLast((values) => values.registry !== undefined)?.registry ??
    DEFAULT_REGISTRY;
  return {
    registry: trimRegistry(registry),
    scopes,
    credentials,
    pinnedDate:
      nonEmpty(env.npm_config_before, env.NPM_CONFIG_BEFORE) !== undefined || files.some((values) => values.pinnedDate),
  };
}

// npm matches credentials to the registry URL and then to each parent path on the same host.
export function registryAuthorization(settings: NpmSettings, registry: string): string | undefined {
  let dart = nerfDart(registry);
  while (dart !== undefined) {
    const authorization = settings.credentials[dart];
    if (authorization !== undefined) {
      return authorization;
    }
    const parent = dart.replace(/[^/]+\/$/, '');
    dart = parent === dart || parent === '//' ? undefined : parent;
  }
  return undefined;
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
      return version === undefined ? undefined : { ...parsed, entry, directory, installedVersion: version };
    }),
  );
  return packages.filter((cached) => cached !== undefined);
}

// The state file records, per cache entry, the version it was removed for. If the reinstall still does not
// produce that version, the registry OpenCode installs from differs from the one checked here, and removing the
// entry again would only reinstall the same version at every start.
const readState = (packagesDirectory: string): Record<string, string> => {
  try {
    const state: unknown = JSON.parse(readFileSync(join(packagesDirectory, STATE_FILE), 'utf8'));
    if (typeof state !== 'object' || state === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(state).filter((item): item is [string, string] => typeof item[1] === 'string'),
    );
  } catch {
    return {};
  }
};

export async function findOutdatedPackages(options: FindOptions): Promise<OutdatedPackage[]> {
  await rm(join(options.packagesDirectory, STALE_DIRECTORY), { recursive: true, force: true });
  const removedFor = readState(options.packagesDirectory);
  const cached = await listTaggedPackages(options.packagesDirectory);
  const distTags = new Map<string, ReturnType<DistTagLookup>>();
  const results = await Promise.all(
    cached.map(async (entry): Promise<OutdatedPackage | undefined> => {
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
        if (removedFor[entry.entry] === availableVersion) {
          await options.warn('Reinstalling the cached plugin package did not produce the registry version', {
            package: `${entry.name}@${entry.tag}`,
            installed: entry.installedVersion,
            registry: availableVersion,
          });
          return undefined;
        }
        return { ...entry, availableVersion };
      } catch (error) {
        await options.warn('Could not check cached plugin package', {
          package: `${entry.name}@${entry.tag}`,
          error: error instanceof Error ? error.message : String(error),
        });
        return undefined;
      }
    }),
  );
  return results.filter((result) => result !== undefined);
}

// Runs from a process `exit` handler, so it must be synchronous. The directory is renamed before it is deleted:
// OpenCode treats any existing `node_modules/<name>` as a complete install, so a recursive delete that stopped partway
// would leave a broken package that is never reinstalled. Errors are not reported because the process is ending;
// an entry that stays in place is checked again at the next start.
export function discardPackagesSync(packagesDirectory: string, packages: readonly OutdatedPackage[]): string[] {
  const discarded: string[] = [];
  const state = readState(packagesDirectory);
  for (const entry of packages) {
    try {
      const staleRoot = join(packagesDirectory, STALE_DIRECTORY);
      mkdirSync(staleRoot, { recursive: true });
      const staleDirectory = join(staleRoot, randomUUID());
      renameSync(entry.directory, staleDirectory);
      discarded.push(entry.entry);
      state[entry.entry] = entry.availableVersion;
      rmSync(staleDirectory, { recursive: true, force: true });
    } catch {
      // See the function comment.
    }
  }
  if (discarded.length > 0) {
    try {
      writeFileSync(join(packagesDirectory, STATE_FILE), JSON.stringify(state));
    } catch {
      // See the function comment.
    }
  }
  return discarded;
}

export function registryDistTags(settings: NpmSettings): DistTagLookup {
  return async (name) => {
    const scope = name.startsWith('@') ? name.slice(0, name.indexOf('/')) : undefined;
    const registry = (scope === undefined ? undefined : settings.scopes[scope]) ?? settings.registry;
    const authorization = registryAuthorization(settings, registry);
    const response = await fetch(`${registry}/${name.replaceAll('/', '%2f')}`, {
      headers: {
        accept: 'application/vnd.npm.install-v1+json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      // A redirect would need its own credential check, so it is treated like any other unusable response.
      redirect: 'manual',
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
