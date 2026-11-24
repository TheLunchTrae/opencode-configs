// semver publishes no type declarations. These cover the functions the plugin cache refresh uses.
declare module 'semver' {
  export function valid(version: string): string | null;
  export function validRange(range: string): string | null;
  export function satisfies(version: string, range: string): boolean;
  export function maxSatisfying(versions: readonly string[], range: string): string | null;
}
