import type { Stamp } from '../../evolution-streams/domain/flow-rules.ts';
import type { Variant } from '../../evolution-streams/domain/model.ts';
import { ok, type Result } from '../../shared/result.ts';
import type { AdoptionEvidence } from './adoption-evidence.ts';
import type { Assessment } from './auto-adoption-rules.ts';
import { planDecision } from './decision-rules.ts';
import type { AdoptionDecision } from './model.ts';
import { contract } from '#augur-contract-runtime'; /* augur-inject:import:2c8a6145 */
import augurContract_642106e6 from '../../../contracts/plan-auto-decision.contract.ts'; /* augur-inject:contract-predicate:d0d5bb1c */

const AUTOMATIC_ACTOR = 'Conflux autonomous adoption';

export function planAutoDecision(
  variant: Variant,
  evidence: AdoptionEvidence,
  assessment: Assessment,
  fingerprint: string,
  stamp: Stamp,
): Result<AdoptionDecision> {
  const { status } = evidence;
  const build = status.targetBuild;
  const commit = status.targetCommit;
  const playable = build && status.target === 'playable'
    ? { commit: build.commit, buildId: build.id, artifactIds: status.targetArtifacts.map((artifact) => artifact.id).sort() }
    : undefined;
  const verdict = { adopt: 'adopted', hold: 'held', reject: 'declined' } as const;
  const planned = planDecision({ variant, ...(playable ? { evidence: playable } : {}) }, {
    projectCode: variant.projectCode,
    variantId: variant.id,
    verdict: verdict[assessment.verdict],
    ...(commit ? { commit } : {}),
    reason: assessment.rationale,
    decidedBy: AUTOMATIC_ACTOR,
    relatedCommentIds: [],
  }, stamp);
  if (!planned.ok) return planned;
  return ok({
    ...planned.value,
    origin: 'system',
    automation: { verdict: assessment.verdict, fingerprint, playtestIds: evidence.playtestIds, ratingIds: evidence.ratingIds },
  });
}
// @ts-expect-error augur-inject
planAutoDecision = contract(planAutoDecision, { ...augurContract_642106e6, contractId: 'C-24', mode: 'observe', sample: 1, where: 'src/adoption-decisions/domain/auto-decision.ts:11', rule: 'contract-wrap', id: '642106e6' }); /* augur-inject:contract-wrap:642106e6 */
