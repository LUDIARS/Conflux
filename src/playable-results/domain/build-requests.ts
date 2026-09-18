import type { BuildSettings } from '../../project-workspaces/domain/model.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import type { Build, BuildOrigin } from './model.ts';

export interface BuildTarget {
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly commit: string;
}

export function buildDedupeKey(target: BuildTarget, origin: BuildOrigin, attempt = 0): string {
  const base = `cf-build:${target.projectCode}:${target.variantId}:${target.commit}`;
  // Flow triggers for the same commit collapse to one request; only explicit retries add an attempt suffix.
  return origin === 'manual-retry' ? `${base}:retry-${attempt}` : base;
}

export type BuildRequestPlan =
  | { readonly action: 'send'; readonly build: Build }
  | { readonly action: 'existing'; readonly build: Build };

const COMMIT = /^[0-9a-f]{7,40}$/;

/**
 * Decides whether a flow trigger should start a build. Repeated hooks for the same
 * commit return the existing record, so a build is never restarted without bound.
 */
export function planFlowBuild(
  existing: readonly Build[],
  settings: BuildSettings,
  target: BuildTarget,
  origin: BuildOrigin,
  stamp: { readonly id: string; readonly at: string },
): Result<BuildRequestPlan> {
  if (!COMMIT.test(target.commit)) return fail('invalid_commit', 'コミットは 7〜40 桁の 16 進で指定してください');
  if (origin !== 'hook-reported' && origin !== 'manual-retry' && !settings.triggers.includes(origin)) {
    return fail('trigger_not_configured', `ビルド契機 ${origin} はこのプロジェクトで設定されていません`);
  }
  const key = buildDedupeKey(target, origin);
  const same = existing.find((b) => b.dedupeKey === key);
  if (same) return ok({ action: 'existing', build: same });
  return ok({
    action: 'send',
    build: {
      id: stamp.id,
      ...target,
      origin,
      dedupeKey: key,
      state: 'requested',
      eventSeq: 0,
      requestedAt: stamp.at,
      updatedAt: stamp.at,
    },
  });
}

/**
 * A rerun is an explicit human decision made after reading the failure; it is allowed only
 * when the latest attempt for that commit is known to have failed or was never delivered.
 */
export function planRetry(
  builds: readonly Build[],
  failed: Build,
  stamp: { readonly id: string; readonly at: string },
): Result<Build> {
  const sameCommit = builds
    .filter((b) => b.variantId === failed.variantId && b.commit === failed.commit)
    .sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0));
  const latest = sameCommit.at(-1);
  if (!latest || latest.id !== failed.id) return fail('not_latest_attempt', '最新の試行ではないビルドは再実行できません');
  if (failed.state !== 'failed' && failed.state !== 'not_connected') {
    return fail('retry_not_allowed', '失敗または未接続のビルドだけ再実行できます (結果不明は先に照合してください)');
  }
  const attempt = sameCommit.filter((b) => b.origin === 'manual-retry').length + 1;
  const target = { projectCode: failed.projectCode, tideId: failed.tideId, variantId: failed.variantId, commit: failed.commit };
  return ok({
    id: stamp.id,
    ...target,
    origin: 'manual-retry',
    dedupeKey: buildDedupeKey(target, 'manual-retry', attempt),
    retryOf: failed.id,
    state: 'requested',
    eventSeq: 0,
    requestedAt: stamp.at,
    updatedAt: stamp.at,
  });
}

/** Records what happened when Cf handed the request to the Cc build hook. */
export function applyBuildRequestOutcome(build: Build, outcome: ExternalOutcome<unknown>, at: string): Build {
  switch (outcome.kind) {
    case 'accepted':
      return { ...build, updatedAt: at };
    case 'rejected':
      return { ...build, state: 'failed', failureSummary: `Cc がビルド要求を拒否: ${outcome.detail}`, updatedAt: at };
    case 'not_connected':
      return { ...build, state: 'not_connected', failureSummary: outcome.reason, updatedAt: at };
    case 'unknown':
      return { ...build, state: 'unknown', failureSummary: outcome.reason, updatedAt: at };
  }
}
