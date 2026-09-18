import { fail, ok, type Result } from '../../shared/result.ts';
import type { AdoptionDecision, IntegrationSource, IntegrationStatus, Verdict } from './model.ts';

export interface DecisionDraft {
  readonly projectCode: string;
  readonly variantId: string;
  readonly verdict: Verdict;
  readonly commit?: string;
  readonly reason: string;
  readonly decidedBy: string;
  readonly relatedCommentIds: readonly string[];
  readonly ratingDigest?: string;
}

/** Playable evidence for the version being decided on, supplied by playable-results. */
export interface PlayableEvidence {
  readonly commit: string;
  readonly buildId: string;
  readonly artifactIds: readonly string[];
}

/**
 * Records a human merge (合流) decision. Adoption requires a playable artifact of exactly
 * the chosen commit, so an unplayed version cannot become official rules. Declines keep
 * their reason too. Who may decide is still undecided; only the decider's name is required
 * (the manager-or-above deploy rule is deliberately not reused).
 */
export function planDecision(
  ctx: {
    readonly variant: { readonly id: string; readonly projectCode: string; readonly tideId: string };
    readonly evidence?: PlayableEvidence;
  },
  draft: DecisionDraft,
  stamp: { readonly id: string; readonly at: string },
): Result<AdoptionDecision> {
  if (ctx.variant.projectCode !== draft.projectCode || ctx.variant.id !== draft.variantId) {
    return fail('variant_not_found', '判断対象の亜流がこのプロジェクトにありません');
  }
  const reason = draft.reason.trim();
  if (reason.length === 0) return fail('missing_reason', '採用/見送りの理由を入力してください');
  const decidedBy = draft.decidedBy.trim();
  if (decidedBy.length === 0) return fail('missing_author', '判断者名を入力してください');

  if (draft.verdict === 'adopted') {
    if (!draft.commit) return fail('missing_commit', '採用する版 (コミット) を指定してください');
    const evidence = ctx.evidence;
    if (!evidence || evidence.commit !== draft.commit || evidence.artifactIds.length === 0) {
      return fail('no_playable_artifact', '採用する版に試遊可能な成果物がありません。成果物のない結果は合流できません');
    }
  }
  const matchingEvidence = ctx.evidence && ctx.evidence.commit === draft.commit ? ctx.evidence : undefined;
  return ok({
    id: stamp.id,
    projectCode: draft.projectCode,
    tideId: ctx.variant.tideId,
    variantId: ctx.variant.id,
    verdict: draft.verdict,
    target: {
      ...(draft.commit ? { commit: draft.commit } : {}),
      ...(matchingEvidence ? { buildId: matchingEvidence.buildId } : {}),
      artifactIds: matchingEvidence?.artifactIds ?? [],
    },
    reason,
    decidedBy,
    relatedCommentIds: draft.relatedCommentIds,
    ...(draft.ratingDigest ? { ratingDigest: draft.ratingDigest } : {}),
    integration: draft.verdict === 'adopted' ? { state: 'awaiting' } : { state: 'not_applicable' },
    decidedAt: stamp.at,
  });
}

export interface IntegrationReport {
  readonly decisionId: string;
  readonly source: IntegrationSource;
  readonly commit: string;
  readonly outcome: 'integrated' | 'failed';
  readonly ref: string;
  readonly detail?: string;
}

/** Applies an integration fact from Cc/Rv/GitHub. Only adopted decisions for the same commit move. */
export function applyIntegrationReport(decision: AdoptionDecision, report: IntegrationReport, at: string): Result<AdoptionDecision> {
  if (decision.verdict !== 'adopted') return fail('not_adopted', '見送った判断に統合結果は記録できません');
  if (decision.target.commit !== report.commit) return fail('commit_mismatch', '統合報告のコミットが採用した版と一致しません');
  if (decision.integration.state === 'integrated') return ok(decision);
  const integration: IntegrationStatus =
    report.outcome === 'integrated'
      ? { state: 'integrated', source: report.source, ref: report.ref, reportedAt: at }
      : { state: 'integration_failed', source: report.source, detail: report.detail ?? report.ref, reportedAt: at };
  return ok({ ...decision, integration });
}

export function describeIntegration(status: IntegrationStatus): string {
  switch (status.state) {
    case 'not_applicable':
      return '—';
    case 'awaiting':
      return '採用済み・コード未統合 (Rv/GitHub の統合報告待ち)';
    case 'integrated':
      return `統合済み (${status.source}: ${status.ref})`;
    case 'integration_failed':
      return `統合失敗 (${status.source}: ${status.detail})`;
  }
}

/** Official-rules lineage: adopted decisions, newest first. Declines are kept but not official. */
export function officialLineage(decisions: readonly AdoptionDecision[]): readonly AdoptionDecision[] {
  return decisions
    .filter((d) => d.verdict === 'adopted')
    .sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : a.decidedAt > b.decidedAt ? -1 : 0));
}
