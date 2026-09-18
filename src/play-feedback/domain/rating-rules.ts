import type { RatingScale } from '../../project-workspaces/domain/model.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { PlayedBuildRef, Rating } from './model.ts';

export interface RatingDraft {
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly playedBuild: PlayedBuildRef;
  readonly rater: string;
  readonly scores: Readonly<Record<string, number>>;
  readonly source: Rating['source'];
}

/**
 * A rating needs a declared scale (the scale itself is still undecided, so there is no
 * default) and must score every item within range. It is always tied to the played build.
 */
export function planRating(
  scale: RatingScale | undefined,
  draft: RatingDraft,
  stamp: { readonly id: string; readonly at: string },
): Result<Rating> {
  if (!scale) return fail('rating_scale_undecided', '評価尺度がプロジェクト設定で未定義のため評価は受け付けられません');
  if (draft.rater.trim().length === 0) return fail('missing_author', '評価者名を入力してください');
  const keys = Object.keys(draft.scores);
  const expected = scale.items.map((i) => i.key);
  if (keys.length !== expected.length || expected.some((k) => !keys.includes(k))) {
    return fail('invalid_scores', '評価項目がプロジェクトの評価尺度と一致しません');
  }
  for (const key of expected) {
    const v = draft.scores[key];
    if (v === undefined || !Number.isInteger(v) || v < scale.min || v > scale.max) {
      return fail('invalid_scores', `評価 ${key} は ${scale.min}〜${scale.max} の整数で指定してください`);
    }
  }
  return ok({ id: stamp.id, ...draft, rater: draft.rater.trim(), scale, createdAt: stamp.at });
}

export interface BuildRatingSummary {
  readonly buildId: string;
  readonly commit: string;
  readonly count: number;
  readonly averages: Readonly<Record<string, number>>;
  readonly isCurrent: boolean;
}

/**
 * Summaries are grouped per played build. Only the build equal to `currentBuildId` is
 * marked current, so ratings of an older build are never presented as the latest build's.
 */
export function summarizeRatings(ratings: readonly Rating[], currentBuildId: string | undefined): readonly BuildRatingSummary[] {
  const groups = new Map<string, Rating[]>();
  for (const r of ratings) {
    const list = groups.get(r.playedBuild.buildId) ?? [];
    list.push(r);
    groups.set(r.playedBuild.buildId, list);
  }
  const summaries: BuildRatingSummary[] = [];
  for (const [buildId, list] of groups) {
    const totals = new Map<string, { sum: number; n: number }>();
    for (const r of list) {
      for (const [key, value] of Object.entries(r.scores)) {
        const t = totals.get(key) ?? { sum: 0, n: 0 };
        totals.set(key, { sum: t.sum + value, n: t.n + 1 });
      }
    }
    const averages: Record<string, number> = {};
    for (const [key, t] of totals) averages[key] = Math.round((t.sum / t.n) * 100) / 100;
    const first = list[0] as Rating;
    summaries.push({ buildId, commit: first.playedBuild.commit, count: list.length, averages, isCurrent: buildId === currentBuildId });
  }
  const latestOf = (s: BuildRatingSummary) =>
    ratings.filter((r) => r.playedBuild.buildId === s.buildId).reduce((m, r) => (r.createdAt > m ? r.createdAt : m), '');
  return summaries.sort((a, b) => (a.isCurrent !== b.isCurrent ? (a.isCurrent ? -1 : 1) : latestOf(a) < latestOf(b) ? 1 : -1));
}
