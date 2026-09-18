import type { DomainError, Result } from '../../shared/result.ts';
import type { HttpResponse } from './http-types.ts';

export function jsonResponse(status: number, data: unknown): HttpResponse {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(data) };
}

export function htmlResponse(status: number, html: string): HttpResponse {
  return { status, headers: { 'content-type': 'text/html; charset=utf-8' }, body: html };
}

export function redirect(location: string): HttpResponse {
  return { status: 303, headers: { location }, body: '' };
}

const FORBIDDEN = new Set(['forbidden', 'role_mapping_undecided', 'conflux_flow_not_enabled']);
const CONFLICT = new Set(['duplicate_tide', 'duplicate_variant', 'rule_conflict']);

/** Maps a domain error code to an HTTP status. */
export function statusOf(error: DomainError): number {
  if (error.code === 'unauthenticated') return 401;
  if (FORBIDDEN.has(error.code)) return 403;
  if (error.code.endsWith('_not_found')) return 404;
  if (CONFLICT.has(error.code)) return 409;
  if (error.code === 'identity_unavailable') return 503;
  return 422;
}

export function resultResponse<T>(result: Result<T>, successStatus = 200): HttpResponse {
  return result.ok ? jsonResponse(successStatus, result.value) : jsonResponse(statusOf(result.error), { error: result.error.code, message: result.error.message });
}
