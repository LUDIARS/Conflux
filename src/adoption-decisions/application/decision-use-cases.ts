import { requireVariant } from '../../evolution-streams/application/flow-use-cases.ts';
import type { Variant } from '../../evolution-streams/domain/model.ts';
import type { Artifact, Build } from '../../playable-results/domain/model.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, type Result } from '../../shared/result.ts';
import type { Clock, IdGenerator } from '../../shared/runtime.ts';
import { applyIntegrationReport, planDecision, type DecisionDraft, type IntegrationReport, type PlayableEvidence } from '../domain/decision-rules.ts';
import type { AdoptionDecision } from '../domain/model.ts';

export interface DecisionDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly variants: RecordStore<Variant>;
  readonly builds: RecordStore<Build>;
  readonly artifacts: RecordStore<Artifact>;
  readonly decisions: RecordStore<AdoptionDecision>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Latest succeeded build of the commit that produced artifacts. */
async function evidenceFor(deps: DecisionDeps, projectCode: string, variantId: string, commit: string | undefined): Promise<PlayableEvidence | undefined> {
  if (!commit) return undefined;
  const [builds, artifacts] = await Promise.all([deps.builds.listByProject(projectCode), deps.artifacts.listByProject(projectCode)]);
  const candidates = builds
    .filter((b) => b.variantId === variantId && b.commit === commit && b.state === 'succeeded')
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  for (const build of candidates) {
    const ids = artifacts.filter((a) => a.buildId === build.id).map((a) => a.id);
    if (ids.length > 0) return { commit, buildId: build.id, artifactIds: ids };
  }
  return undefined;
}

export async function decideAdoption(deps: DecisionDeps, draft: DecisionDraft): Promise<Result<AdoptionDecision>> {
  const ws = await requireWorkspace(deps.workspaces, draft.projectCode);
  if (!ws.ok) return ws;
  const variant = await requireVariant(deps.variants, draft.projectCode, draft.variantId);
  if (!variant.ok) return variant;
  const evidence = await evidenceFor(deps, draft.projectCode, draft.variantId, draft.commit);
  const planned = planDecision(
    { variant: variant.value, ...(evidence ? { evidence } : {}) },
    draft,
    { id: deps.ids.next('decision'), at: deps.clock.now() },
  );
  if (!planned.ok) return planned;
  await deps.decisions.put(planned.value);
  return planned;
}

/** Receives the integration fact from Cc/Rv/GitHub (via the Cc hook route). */
export async function recordIntegration(
  deps: DecisionDeps,
  input: IntegrationReport & { readonly projectCode: string },
): Promise<Result<AdoptionDecision>> {
  const decision = await deps.decisions.get(input.decisionId);
  if (!decision || decision.projectCode !== input.projectCode) return fail('decision_not_found', '合流判断がこのプロジェクトにありません');
  const updated = applyIntegrationReport(decision, input, deps.clock.now());
  if (!updated.ok) return updated;
  await deps.decisions.put(updated.value);
  return updated;
}
