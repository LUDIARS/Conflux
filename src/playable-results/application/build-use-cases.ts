import { requireTide, requireVariant } from '../../evolution-streams/application/flow-use-cases.ts';
import { mainlineBranchName } from '../../evolution-streams/domain/branch-naming.ts';
import type { Tide, Variant } from '../../evolution-streams/domain/model.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock, IdGenerator } from '../../shared/runtime.ts';
import { applyBuildEvent, type BuildEvent, type BuildEventEffect } from '../domain/build-events.ts';
import { applyBuildRequestOutcome, planFlowBuild, planRetry } from '../domain/build-requests.ts';
import type { Artifact, Build, BuildOrigin } from '../domain/model.ts';
import type { BuildTriggerGateway } from '../ports.ts';

export interface BuildDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly tides: RecordStore<Tide>;
  readonly variants: RecordStore<Variant>;
  readonly builds: RecordStore<Build>;
  readonly artifacts: RecordStore<Artifact>;
  readonly buildTrigger: BuildTriggerGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

async function sendBuild(deps: BuildDeps, ws: ProjectWorkspace, tide: Tide, variant: Variant, build: Build): Promise<Build> {
  // Persist before sending so a crash mid-request leaves a `requested` record to reconcile.
  await deps.builds.put(build);
  const outcome = await deps.buildTrigger.requestBuild({
    dedupeKey: build.dedupeKey,
    ccProjectCode: ws.ccProjectCode,
    tide: tide.slug,
    variant: variant.slug,
    commit: build.commit,
    ...(ws.branchNaming ? { branch: mainlineBranchName(ws.branchNaming, tide.slug, variant.slug) } : {}),
    platforms: ws.build.platforms,
  });
  const updated = applyBuildRequestOutcome(build, outcome, deps.clock.now());
  await deps.builds.put(updated);
  return updated;
}

/** A Cf Flow trigger (e.g. variant mainline updated) asks Cc to build the target commit once. */
export async function requestFlowBuild(
  deps: BuildDeps,
  input: { readonly projectCode: string; readonly variantId: string; readonly commit: string; readonly origin: BuildOrigin },
): Promise<Result<Build>> {
  const ws = await requireWorkspace(deps.workspaces, input.projectCode);
  if (!ws.ok) return ws;
  const variant = await requireVariant(deps.variants, input.projectCode, input.variantId);
  if (!variant.ok) return variant;
  const tide = await requireTide(deps.tides, input.projectCode, variant.value.tideId);
  if (!tide.ok) return tide;
  const existing = await deps.builds.listByProject(input.projectCode);
  const plan = planFlowBuild(
    existing,
    ws.value.build,
    { projectCode: input.projectCode, tideId: tide.value.id, variantId: variant.value.id, commit: input.commit },
    input.origin,
    { id: deps.ids.next('build'), at: deps.clock.now() },
  );
  if (!plan.ok) return plan;
  if (plan.value.action === 'existing') return ok(plan.value.build);
  return ok(await sendBuild(deps, ws.value, tide.value, variant.value, plan.value.build));
}

/** Explicit human rerun after reading the failure log. */
export async function retryBuild(deps: BuildDeps, input: { readonly projectCode: string; readonly buildId: string }): Promise<Result<Build>> {
  const ws = await requireWorkspace(deps.workspaces, input.projectCode);
  if (!ws.ok) return ws;
  const failed = await deps.builds.get(input.buildId);
  if (!failed || failed.projectCode !== input.projectCode) return fail('build_not_found', 'ビルドがこのプロジェクトにありません');
  const variant = await requireVariant(deps.variants, input.projectCode, failed.variantId);
  if (!variant.ok) return variant;
  const tide = await requireTide(deps.tides, input.projectCode, variant.value.tideId);
  if (!tide.ok) return tide;
  const retry = planRetry(await deps.builds.listByProject(input.projectCode), failed, {
    id: deps.ids.next('build'),
    at: deps.clock.now(),
  });
  if (!retry.ok) return retry;
  return ok(await sendBuild(deps, ws.value, tide.value, variant.value, retry.value));
}

/**
 * Applies a Cc build-hook event. Builds Cc started on its own (without a Cf request)
 * are recorded under the event's dedupe key the first time they are reported.
 */
export async function ingestBuildEvent(deps: BuildDeps, event: BuildEvent): Promise<Result<BuildEventEffect>> {
  const ws = await requireWorkspace(deps.workspaces, event.projectCode);
  if (!ws.ok) return ws;
  const variant = await requireVariant(deps.variants, event.projectCode, event.variantId);
  if (!variant.ok) return variant;
  const builds = await deps.builds.listByProject(event.projectCode);
  const now = deps.clock.now();
  const build: Build = builds.find((b) => b.dedupeKey === event.dedupeKey) ?? {
    id: deps.ids.next('build'),
    projectCode: event.projectCode,
    tideId: variant.value.tideId,
    variantId: variant.value.id,
    commit: event.commit,
    origin: 'hook-reported',
    dedupeKey: event.dedupeKey,
    state: 'requested',
    eventSeq: 0,
    requestedAt: now,
    updatedAt: now,
  };
  const effect = applyBuildEvent(build, event, () => deps.ids.next('artifact'), now);
  if (!effect.ok) return effect;
  if (effect.value.kind === 'applied') {
    await deps.builds.put(effect.value.build);
    for (const artifact of effect.value.artifacts) await deps.artifacts.put(artifact);
  }
  return effect;
}
