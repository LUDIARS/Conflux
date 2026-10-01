import type { Comment, Rating } from '../../play-feedback/domain/model.ts';
import { describeExternalOutcome, type ExternalOutcome } from '../../shared/external-outcome.ts';
import type { ManagementSignal, OutboxEntry } from './model.ts';

/** Cc keeps summaries to 2000 characters. */
export const SUMMARY_LIMIT = 2000;
/** Retry delays grow to this ceiling so a long Cc outage does not spin. */
const MAX_BACKOFF_MS = 30 * 60 * 1000;
const BASE_BACKOFF_MS = 15 * 1000;

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= SUMMARY_LIMIT ? flat : `${flat.slice(0, SUMMARY_LIMIT - 1)}…`;
}

export function variantTarget(variantId: string): string {
  return `variant/${variantId}`;
}

/**
 * AI summaries are reported as origin=ai so Cc never treats an AI's own output as a
 * new human request (CC-MGMT-INV-06).
 */
export function commentSignal(comment: Comment): ManagementSignal {
  const ai = comment.author.kind === 'ai-summary';
  const who = comment.author.kind === 'human' ? comment.author.name : comment.author.agent;
  return {
    eventKey: `cf:comment:${comment.id}`,
    kind: ai ? 'ai-summary' : comment.parentId ? 'reply' : 'comment',
    projectCode: comment.projectCode,
    targetKey: variantTarget(comment.variantId),
    origin: ai ? 'ai' : 'human',
    summary: clip(`${who}: ${comment.body}`),
    observedAt: comment.createdAt,
  };
}

export function ratingSignal(rating: Rating): ManagementSignal {
  const scores = Object.entries(rating.scores).map(([axis, score]) => `${axis}=${score}`).join(', ');
  return {
    eventKey: `cf:rating:${rating.id}`,
    kind: 'rating',
    projectCode: rating.projectCode,
    targetKey: variantTarget(rating.variantId),
    origin: 'human',
    summary: clip(`${rating.rater} の評価 (${rating.playedBuild.commit.slice(0, 12)}): ${scores}`),
    observedAt: rating.createdAt,
  };
}

export function newEntry(signal: ManagementSignal, now: string): OutboxEntry {
  return {
    id: signal.eventKey,
    projectCode: signal.projectCode,
    signal,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function isDue(entry: OutboxEntry, now: string): boolean {
  return entry.status === 'pending' && entry.nextAttemptAt <= now;
}

/**
 * Next outbox state after one send. Cc is idempotent per event key, so both
 * `not_connected` and `unknown` are retried with the same key; only an explicit
 * 4xx refusal stops retrying.
 */
export function afterAttempt(entry: OutboxEntry, outcome: ExternalOutcome<unknown>, now: string): OutboxEntry {
  const attempts = entry.attempts + 1;
  const lastResult = describeExternalOutcome(outcome);
  if (outcome.kind === 'accepted') return { ...entry, status: 'delivered', attempts, lastResult, updatedAt: now };
  if (outcome.kind === 'rejected') return { ...entry, status: 'refused', attempts, lastResult, updatedAt: now };
  const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(attempts - 1, 10));
  const nextAttemptAt = new Date(Date.parse(now) + delay).toISOString();
  return { ...entry, attempts, lastResult, nextAttemptAt, updatedAt: now };
}
