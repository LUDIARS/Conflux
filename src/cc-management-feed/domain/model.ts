/**
 * A change Cf reports to the Cc CDGD management feed (Cc spec/feature/cdgd-management.md
 * CC-MGMT-02). The outbox keeps it until Cc has accepted or definitively refused it.
 */
export type SignalOrigin = 'human' | 'ai';

export interface ManagementSignal {
  /** Idempotency key on the Cc side; one per stored comment or rating. */
  readonly eventKey: string;
  readonly kind: 'comment' | 'reply' | 'ai-summary' | 'rating';
  readonly projectCode: string;
  readonly targetKey: string;
  readonly origin: SignalOrigin;
  readonly summary: string;
  readonly observedAt: string;
}

export type OutboxStatus = 'pending' | 'delivered' | 'refused';

export interface OutboxEntry {
  /** Same value as signal.eventKey so a record is enqueued at most once. */
  readonly id: string;
  readonly projectCode: string;
  readonly signal: ManagementSignal;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly nextAttemptAt: string;
  readonly lastResult?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
