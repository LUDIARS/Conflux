import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import { detailOf, type HttpOutcome } from './cc-http-client.ts';

/**
 * Shared mapping of an HTTP result to an external outcome for Cc command routes.
 * 404/405 mean the route is not deployed on this Cc: nothing was applied (`not_connected`).
 */
export function commandOutcome<T>(result: HttpOutcome, accept: (body: unknown) => T | undefined): ExternalOutcome<T> {
  if (result.kind !== 'response') return result;
  const { status, body } = result;
  if (status === 404 || status === 405) return { kind: 'not_connected', reason: `Cc に経路がありません (${status})` };
  if (status >= 500) return { kind: 'unknown', reason: `Cc エラー ${status}` };
  if (status >= 400) return { kind: 'rejected', status, detail: detailOf(body) };
  if (status >= 200 && status < 300) {
    const value = accept(body);
    return value === undefined ? { kind: 'unknown', reason: 'Cc の応答に必要な項目がありません' } : { kind: 'accepted', value };
  }
  return { kind: 'unknown', reason: `想定外のステータス ${status}` };
}
