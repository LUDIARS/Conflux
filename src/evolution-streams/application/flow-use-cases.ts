import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock, IdGenerator } from '../../shared/runtime.ts';
import {
  planRevision,
  planTide,
  planVariant,
  type RevisionDraft,
  type TideDraft,
  type VariantDraft,
} from '../domain/flow-rules.ts';
import type { Revision, Tide, Variant } from '../domain/model.ts';

export interface FlowDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly tides: RecordStore<Tide>;
  readonly variants: RecordStore<Variant>;
  readonly revisions: RecordStore<Revision>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export async function createTide(deps: FlowDeps, draft: TideDraft): Promise<Result<Tide>> {
  const ws = await requireWorkspace(deps.workspaces, draft.projectCode);
  if (!ws.ok) return ws;
  const existing = await deps.tides.listByProject(draft.projectCode);
  const planned = planTide(existing, draft, { id: deps.ids.next('tide'), at: deps.clock.now() });
  if (!planned.ok) return planned;
  await deps.tides.put(planned.value);
  return planned;
}

export async function createVariant(deps: FlowDeps, draft: VariantDraft): Promise<Result<Variant>> {
  const ws = await requireWorkspace(deps.workspaces, draft.projectCode);
  if (!ws.ok) return ws;
  const [tides, variants] = await Promise.all([
    deps.tides.listByProject(draft.projectCode),
    deps.variants.listByProject(draft.projectCode),
  ]);
  const planned = planVariant(tides, variants, draft, { id: deps.ids.next('variant'), at: deps.clock.now() });
  if (!planned.ok) return planned;
  await deps.variants.put(planned.value);
  return planned;
}

export async function requireVariant(
  variants: RecordStore<Variant>,
  projectCode: string,
  variantId: string,
): Promise<Result<Variant>> {
  const variant = await variants.get(variantId);
  return variant && variant.projectCode === projectCode
    ? ok(variant)
    : fail('variant_not_found', '指定した亜流がこのプロジェクトにありません');
}

export async function requireTide(tides: RecordStore<Tide>, projectCode: string, tideId: string): Promise<Result<Tide>> {
  const tide = await tides.get(tideId);
  return tide && tide.projectCode === projectCode
    ? ok(tide)
    : fail('tide_not_found', '指定した潮流がこのプロジェクトにありません');
}

/** Appends a revision to one variant and applies its rule changes to that variant only. */
export async function recordRevision(deps: FlowDeps, draft: RevisionDraft): Promise<Result<Revision>> {
  const variant = await requireVariant(deps.variants, draft.projectCode, draft.variantId);
  if (!variant.ok) return variant;
  const planned = planRevision(variant.value, draft, { id: deps.ids.next('rev'), at: deps.clock.now() });
  if (!planned.ok) return planned;
  await deps.revisions.put(planned.value.revision);
  await deps.variants.put(planned.value.variant);
  return ok(planned.value.revision);
}
