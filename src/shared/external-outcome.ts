/**
 * Outcome of a call to an external system (Cc, build hook, deploy target).
 *
 * - `not_connected`: nothing was delivered (endpoint absent / not configured / refused).
 *   Safe to send again later; never shown as success.
 * - `unknown`: the request may or may not have been applied (timeout, 5xx).
 *   Must be reconciled before any resend.
 */
export type ExternalOutcome<T> =
  | { readonly kind: 'accepted'; readonly value: T }
  | { readonly kind: 'rejected'; readonly status: number; readonly detail: string }
  | { readonly kind: 'not_connected'; readonly reason: string }
  | { readonly kind: 'unknown'; readonly reason: string };

export function describeExternalOutcome(outcome: ExternalOutcome<unknown>): string {
  switch (outcome.kind) {
    case 'accepted':
      return '受理';
    case 'rejected':
      return `拒否 (${outcome.status}): ${outcome.detail}`;
    case 'not_connected':
      return `未接続: ${outcome.reason}`;
    case 'unknown':
      return `結果不明: ${outcome.reason}`;
  }
}
