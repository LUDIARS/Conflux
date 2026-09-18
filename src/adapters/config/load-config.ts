import { CcUrlError, resolveCcBaseUrl } from './cc-url.ts';
import { buildWebAccess, type WebAccess, WebAccessError } from './web-access.ts';

/**
 * Runtime configuration from environment variables. Required values fail fast; optional
 * Cc routes that Cc has not defined yet stay undefined and their adapters report
 * "not connected" instead of guessing a path.
 */
export interface ConfluxConfig {
  readonly dataDir: string;
  readonly host: string;
  readonly port: number;
  readonly ccBaseUrl: string;
  readonly ccTimeoutMs: number;
  readonly ccSpawnPath?: string;
  readonly ccSpawnLookupPath?: string;
  readonly ccBuildPath?: string;
  readonly ccIdentityPath?: string;
  readonly hookToken?: string;
  /** Host / Origin values the Web entrance accepts. */
  readonly access: WebAccess;
}

export class ConfigError extends Error {}

function required(env: Readonly<Record<string, string | undefined>>, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new ConfigError(`${key} is required`);
  return v;
}

function optional(env: Readonly<Record<string, string | undefined>>, key: string): string | undefined {
  const v = env[key]?.trim();
  return v ? v : undefined;
}

function routePath(env: Readonly<Record<string, string | undefined>>, key: string): string | undefined {
  const v = optional(env, key);
  if (v !== undefined && !v.startsWith('/')) throw new ConfigError(`${key} must start with '/'`);
  return v;
}

function integer(env: Readonly<Record<string, string | undefined>>, key: string, min: number, max: number): number {
  const raw = required(env, key);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${key} must be an integer in ${min}..${max}`);
  return n;
}

/** Conflux has no public entrance; it listens on loopback only. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);

function loopbackHost(env: Readonly<Record<string, string | undefined>>): string {
  const host = required(env, 'CONFLUX_HOST');
  if (!LOOPBACK_HOSTS.has(host)) throw new ConfigError('CONFLUX_HOST must be a loopback address (127.0.0.1, ::1 or localhost)');
  return host;
}

/** Re-raises the helpers' validation errors as ConfigError so startup reports one kind. */
function asConfigError<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (error instanceof CcUrlError || error instanceof WebAccessError) throw new ConfigError(error.message);
    throw error;
  }
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): ConfluxConfig {
  const ccBaseUrl = asConfigError(() => resolveCcBaseUrl(env));
  const port = integer(env, 'CONFLUX_PORT', 1, 65535);
  const spawn = routePath(env, 'CONFLUX_CC_SPAWN_PATH');
  const lookup = routePath(env, 'CONFLUX_CC_SPAWN_LOOKUP_PATH');
  const build = routePath(env, 'CONFLUX_CC_BUILD_PATH');
  const identity = routePath(env, 'CONFLUX_CC_IDENTITY_PATH');
  const hookToken = optional(env, 'CONFLUX_HOOK_TOKEN');
  if (hookToken !== undefined && hookToken.length < 32) throw new ConfigError('CONFLUX_HOOK_TOKEN must be at least 32 characters');
  return {
    dataDir: required(env, 'CONFLUX_DATA_DIR'),
    host: loopbackHost(env),
    port,
    ccBaseUrl,
    ccTimeoutMs: integer(env, 'CONFLUX_CC_TIMEOUT_MS', 100, 120_000),
    ...(spawn ? { ccSpawnPath: spawn } : {}),
    ...(lookup ? { ccSpawnLookupPath: lookup } : {}),
    ...(build ? { ccBuildPath: build } : {}),
    ...(identity ? { ccIdentityPath: identity } : {}),
    ...(hookToken ? { hookToken } : {}),
    access: asConfigError(() => buildWebAccess(port, env['LUDIARS_ALLOWED_HOSTS'], env['CONFLUX_VIEWER_ORIGINS'])),
  };
}
