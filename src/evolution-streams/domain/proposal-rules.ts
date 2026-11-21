import { fail, ok, type Result } from '../../shared/result.ts';
import { planTide, planVariant, type Stamp } from './flow-rules.ts';
import type { ProposalOrigin, Tide, Variant } from './model.ts';
import { validateSlug } from './slug.ts';
import { contract } from '#augur-contract-runtime'; /* augur-inject:import:eeb5e123 */
import augurContract_d00cddf2 from '../../../contracts/plan-proposal.contract.ts'; /* augur-inject:contract-predicate:988005d2 */

export interface ProposalDraft {
  readonly proposalId: string;
  readonly projectCode: string;
  readonly title: string;
  readonly summary: string;
  readonly targetTide?: string;
  readonly origin: ProposalOrigin;
  readonly evidence: readonly string[];
}

export type ProposalPlan =
  | { readonly kind: 'existing'; readonly tide: Tide; readonly variant: Variant }
  | { readonly kind: 'created'; readonly tide: Tide; readonly variant: Variant; readonly createTide: boolean };

export function planProposal(input: {
  readonly draft: ProposalDraft;
  readonly tides: readonly Tide[];
  readonly variants: readonly Variant[];
  readonly activeCount: number;
  readonly limit: number;
  readonly variantSlug: string;
  readonly tideStamp: Stamp;
  readonly variantStamp: Stamp;
}): Result<ProposalPlan> {
  const { draft, tides, variants } = input;
  const existing = variants.find((variant) => variant.proposal?.id === draft.proposalId);
  if (existing) {
    const tide = tides.find((entry) => entry.id === existing.tideId);
    return tide ? ok({ kind: 'existing', tide, variant: existing }) : fail('tide_not_found', '提案の潮流が見つかりません');
  }
  if (input.activeCount >= input.limit) {
    return fail('variant_capacity_reached', `アクティブな亜流が上限（${input.limit} 件）に達しました`);
  }
  if (!draft.proposalId.trim() || draft.proposalId.length > 256 || draft.title.length > 256 || draft.summary.length > 4000
    || draft.evidence.length > 32 || draft.evidence.some((ref) => !ref.trim() || ref.length > 512)) {
    return fail('invalid_proposal', '提案 ID、タイトル、要約、根拠の長さを確認してください');
  }
  const slug = validateSlug('対象潮流', draft.targetTide ?? 'proposals');
  if (!slug.ok) return slug;
  const previousTide = tides.find((tide) => tide.slug === slug.value);
  const tide = previousTide ? ok(previousTide) : planTide(tides, {
    projectCode: draft.projectCode,
    slug: slug.value,
    title: draft.targetTide ?? '改善提案',
    concept: '改善提案から作成した亜流を管理する潮流',
  }, input.tideStamp);
  if (!tide.ok) return tide;
  const variant = planVariant([tide.value], variants, {
    projectCode: draft.projectCode,
    tideId: tide.value.id,
    slug: input.variantSlug,
    title: draft.title,
    concept: draft.summary,
    rules: [],
  }, input.variantStamp);
  if (!variant.ok) return variant;
  return ok({
    kind: 'created',
    tide: tide.value,
    createTide: previousTide === undefined,
    variant: { ...variant.value, proposal: { id: draft.proposalId, origin: draft.origin, evidence: draft.evidence } },
  });
}
// @ts-expect-error augur-inject
planProposal = contract(planProposal, { ...augurContract_d00cddf2, contractId: 'C-22', mode: 'observe', sample: 1, where: 'src/evolution-streams/domain/proposal-rules.ts:20', rule: 'contract-wrap', id: 'd00cddf2' }); /* augur-inject:contract-wrap:d00cddf2 */
