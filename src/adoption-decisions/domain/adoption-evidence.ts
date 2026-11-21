import type { Rating } from '../../play-feedback/domain/model.ts';
import type { PlaytestResult } from '../../playable-results/domain/playtest-result.ts';
import type { VariantResultStatus } from '../../playable-results/domain/result-status.ts';
import type { TrialMetrics } from './auto-adoption-rules.ts';

export interface AdoptionEvidence {
  readonly status: VariantResultStatus;
  readonly metrics: TrialMetrics;
  readonly playtestIds: readonly string[];
  readonly ratingIds: readonly string[];
}

function normalizedScore(rating: Rating): number | undefined {
  const { min, max, items } = rating.scale;
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0 || items.length === 0) return undefined;
  let total = 0;
  for (const { key } of items) {
    const score = rating.scores[key];
    if (typeof score !== 'number' || !Number.isFinite(score) || score < min || score > max) return undefined;
    total += (score - min) / range;
  }
  return total / items.length;
}

export function collectAdoptionEvidence(
  status: VariantResultStatus,
  playtests: readonly PlaytestResult[],
  ratings: readonly Rating[],
): AdoptionEvidence {
  const build = status.targetBuild;
  const measured = build && status.target === 'playable'
    ? playtests.filter((trial) => trial.variantId === build.variantId && trial.buildId === build.id && trial.commit === build.commit
      && (trial.outcome === 'passed' || trial.outcome === 'failed') && typeof trial.criticalBug === 'boolean')
    : [];
  const scored: { id: string; score: number }[] = [];
  if (build && status.target === 'playable') {
    for (const rating of ratings) {
      if (rating.variantId !== build.variantId || rating.playedBuild.buildId !== build.id || rating.playedBuild.commit !== build.commit) continue;
      const score = normalizedScore(rating);
      if (score !== undefined) scored.push({ id: rating.id, score });
    }
  }
  // Stable summation and evidence ordering keep comparisons and replays deterministic.
  scored.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    status,
    metrics: {
      target: status.target,
      measuredTrials: measured.length,
      ratingCount: scored.length,
      ratingScore: scored.length ? scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length : undefined,
      criticalBugs: measured.filter((entry) => entry.criticalBug).length,
      failureRate: measured.length ? measured.filter((entry) => entry.outcome === 'failed').length / measured.length : 0,
    },
    playtestIds: measured.map((entry) => entry.id).sort(),
    ratingIds: scored.map((entry) => entry.id),
  };
}
