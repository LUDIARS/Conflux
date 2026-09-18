import type { FlowSelection } from '../../flow-isolation/domain/selection.ts';
import type { SelectionState } from '../../flow-isolation/domain/selection-record.ts';

/**
 * - pending:   stored, not yet handed to Cc.
 * - requested: handed to Cc, response not recorded yet (a crash here must be reconciled).
 * - spawned:   Cc accepted and returned a session.
 * - rejected:  Cc refused; a new request is needed after fixing the cause.
 * - unknown:   delivery may have happened; reconcile by idempotency key, never resend blindly.
 * - not_sent:  Cc spawn route not connected; nothing was delivered, safe to send later.
 */
export type RequestState = 'pending' | 'requested' | 'spawned' | 'rejected' | 'unknown' | 'not_sent';

export interface RequestAttempt {
  readonly at: string;
  readonly result: 'accepted' | 'rejected' | 'not_connected' | 'unknown' | 'reconciled_found' | 'reconciled_absent' | 'reconcile_failed';
  readonly detail?: string;
}

export interface ImplementationRequest {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly destinationId: string;
  readonly title: string;
  readonly brief: string;
  readonly task: string;
  readonly sourceCommentIds: readonly string[];
  readonly selection: FlowSelection;
  readonly idempotencyKey: string;
  readonly requestedBy: string;
  readonly state: RequestState;
  readonly ccSessionId?: string;
  readonly ccRunId?: string;
  /** Outcome of registering the flow selection for the spawned session on the Cc harness. */
  readonly harnessSelection?: SelectionState;
  readonly attempts: readonly RequestAttempt[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SpawnAccepted {
  readonly sessionId: string;
  readonly runId?: string;
}

export type SpawnLookup =
  | { readonly kind: 'found'; readonly sessionId: string; readonly runId?: string }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unavailable'; readonly reason: string };
