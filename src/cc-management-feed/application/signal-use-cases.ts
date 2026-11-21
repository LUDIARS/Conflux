import type { Comment, Rating } from '../../play-feedback/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import type { Clock } from '../../shared/runtime.ts';
import { serialByKey } from '../../shared/serial-by-key.ts';
import type { ManagementSignal, OutboxEntry } from '../domain/model.ts';
import { afterAttempt, commentSignal, isDue, newEntry, ratingSignal } from '../domain/signal-rules.ts';
import type { CcManagementEventsGateway } from '../ports.ts';

export interface SignalDeps {
  readonly signals: RecordStore<OutboxEntry>;
  readonly managementEvents: CcManagementEventsGateway;
  readonly clock: Clock;
}

export type SignalQueueDeps = Pick<SignalDeps, 'signals' | 'clock'>;

async function queueSignal(deps: SignalQueueDeps, signal: ManagementSignal, now: string): Promise<void> {
  await serialByKey(deps.signals, signal.eventKey, async () => {
    if (await deps.signals.get(signal.eventKey)) return;
    await deps.signals.put(newEntry(signal, now));
  });
}

/** Call only after the source save has succeeded. An outbox failure leaves that save intact. */
export async function queueStoredSignal(deps: SignalQueueDeps, signal: ManagementSignal): Promise<void> {
  try {
    await queueSignal(deps, signal, deps.clock.now());
  } catch (error) {
    process.stderr.write(`[conflux] management signal queue failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

/**
 * Queues stored feedback for the Cc management feed. Called after the comment/rating is
 * stored; a record already queued is left as is, so replays never duplicate it.
 */
export async function queueFeedbackSignals(
  deps: SignalQueueDeps,
  stored: { readonly comment?: Comment; readonly rating?: Rating },
): Promise<void> {
  const now = deps.clock.now();
  const signals = [
    ...(stored.comment ? [commentSignal(stored.comment)] : []),
    ...(stored.rating ? [ratingSignal(stored.rating)] : []),
  ];
  for (const signal of signals) {
    await queueSignal(deps, signal, now);
  }
}

/**
 * Sends due entries one at a time. Returns how many were attempted. Each result is
 * stored before the next send, so a crash re-sends at most one entry (Cc dedupes it).
 */
export async function deliverDueSignals(deps: SignalDeps, limit = 20): Promise<number> {
  const now = deps.clock.now();
  const due = (await deps.signals.listAll())
    .filter((entry) => isDue(entry, now))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
  for (const entry of due) {
    const outcome = await deps.managementEvents.send(entry.signal);
    await deps.signals.put(afterAttempt(entry, outcome, deps.clock.now()));
  }
  return due.length;
}
