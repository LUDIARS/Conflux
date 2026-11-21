import { createHash } from 'node:crypto';
import { queueSignal, type SignalQueueDeps } from '../../cc-management-feed/application/signal-use-cases.ts';
import { adoptionSignal } from '../../cc-management-feed/domain/outcome-signals.ts';
import { requireVariant } from '../../evolution-streams/application/flow-use-cases.ts';
import { targetCommitOf } from '../../evolution-streams/domain/flow-rules.ts';
import type { Revision } from '../../evolution-streams/domain/model.ts';
import type { Rating } from '../../play-feedback/domain/model.ts';
import type { PlaytestResult } from '../../playable-results/domain/playtest-result.ts';
import { variantResultStatus } from '../../playable-results/domain/result-status.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import { DEFAULT_AUTONOMOUS_ADOPTION } from '../../project-workspaces/domain/autonomous-adoption-policy.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { ok, type Result } from '../../shared/result.ts';
import { serialByKey } from '../../shared/serial-by-key.ts';
import { collectAdoptionEvidence } from '../domain/adoption-evidence.ts';
import { assessAdoption } from '../domain/auto-adoption-rules.ts';
import { planAutoDecision } from '../domain/auto-decision.ts';
import { effectiveDecisions } from '../domain/decision-history.ts';
import type { AdoptionDecision } from '../domain/model.ts';
import type { DecisionDeps } from './decision-use-cases.ts';

type AutoEvaluationDeps = DecisionDeps & SignalQueueDeps & {
  readonly revisions: RecordStore<Revision>;
  readonly ratings: RecordStore<Rating>;
  readonly playtestResults: RecordStore<PlaytestResult>;
};

type Evaluation =
  | { readonly kind: 'manual' | 'automatic'; readonly decision: AdoptionDecision }
  | { readonly kind: 'disabled' };

export async function evaluateVariant(deps: AutoEvaluationDeps, projectCode: string, variantId: string): Promise<Result<Evaluation>> {
  return serialByKey(deps.workspaces, projectCode, async () => {
    const workspace = await requireWorkspace(deps.workspaces, projectCode);
    if (!workspace.ok) return workspace;
    const variant = await requireVariant(deps.variants, projectCode, variantId);
    if (!variant.ok) return variant;
    const history = await deps.decisions.listByProject(projectCode);
    const effective = effectiveDecisions(history).get(variantId);
    if (effective && !effective.automation) return ok({ kind: 'manual', decision: effective });

    const policy = workspace.value.autonomousAdoption ?? DEFAULT_AUTONOMOUS_ADOPTION;
    // Repair a failed outbox write before returning or evaluating further evidence.
    if (effective) await queueSignal(deps, adoptionSignal(effective), deps.clock.now());
    if (!policy.enabled) return ok({ kind: 'disabled' });
    if (effective && effective.verdict !== 'held') return ok({ kind: 'automatic', decision: effective });

    const [revisions, builds, artifacts, playtests, ratings] = await Promise.all([
      deps.revisions.listByProject(projectCode),
      deps.builds.listByProject(projectCode),
      deps.artifacts.listByProject(projectCode),
      deps.playtestResults.listByProject(projectCode),
      deps.ratings.listByProject(projectCode),
    ]);
    const commit = targetCommitOf(revisions, variantId);
    const status = variantResultStatus({ variantId, ...(commit ? { targetCommit: commit } : {}), builds, artifacts });
    const evidence = collectAdoptionEvidence(status, playtests, ratings);
    const fingerprint = createHash('sha256').update(JSON.stringify([
      policy.minPlaytests, policy.minRatings, policy.minRatingScore, policy.maxCriticalBugs, policy.maxFailureRate,
      commit, status.targetBuild?.id, status.targetArtifacts.map((artifact) => artifact.id).sort(),
      evidence.metrics, evidence.playtestIds, evidence.ratingIds,
    ])).digest('hex');
    const replay = history.find((entry) => entry.variantId === variantId && entry.automation?.fingerprint === fingerprint);
    if (replay) {
      await queueSignal(deps, adoptionSignal(replay), deps.clock.now());
      return ok({ kind: 'automatic', decision: replay });
    }
    const planned = planAutoDecision(variant.value, evidence, assessAdoption(policy, evidence.metrics), fingerprint, {
      id: deps.ids.next('decision'),
      at: deps.clock.now(),
    });
    if (!planned.ok) return planned;
    await deps.decisions.put(planned.value);
    await queueSignal(deps, adoptionSignal(planned.value), deps.clock.now());
    return ok({ kind: 'automatic', decision: planned.value });
  });
}
