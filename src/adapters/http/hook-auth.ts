import { timingSafeEqual } from 'node:crypto';
import type { HttpRequest, HttpResponse } from './http-types.ts';
import { bearerToken } from './request-parsing.ts';
import { jsonResponse } from './responses.ts';

/** Trusted machine routes are closed until a shared token is configured. */
export function checkHookToken(req: HttpRequest, expected: string | undefined): HttpResponse | undefined {
  if (!expected) return jsonResponse(503, { error: 'hook_intake_not_configured', message: 'CONFLUX_HOOK_TOKEN が未設定のためフックを受け付けません' });
  const given = Buffer.from(bearerToken(req) ?? '');
  const secret = Buffer.from(expected);
  if (given.length !== secret.length || !timingSafeEqual(given, secret)) return jsonResponse(401, { error: 'unauthenticated' });
  return undefined;
}
