import { requireTide, requireVariant } from '../../evolution-streams/application/flow-use-cases.ts';
import type { Tide, Variant } from '../../evolution-streams/domain/model.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import { requireBranchNaming } from '../../project-workspaces/domain/workspace-rules.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock, IdGenerator } from '../../shared/runtime.ts';
import { buildFlowSelection, type FlowSelection } from '../domain/selection.ts';
import { selectionStateOf, type SelectionRecord } from '../domain/selection-record.ts';
import type { CcHarnessGateway } from '../ports.ts';

export interface SelectionDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly tides: RecordStore<Tide>;
  readonly variants: RecordStore<Variant>;
  readonly selections: RecordStore<SelectionRecord>;
  readonly harness: CcHarnessGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export interface SelectionTarget {
  readonly projectCode: string;
  readonly variantId: string;
  readonly task: string;
}

/** Resolves the base/work branch pair for a variant using the project's explicit naming policy. */
export async function resolveSelection(
  deps: Pick<SelectionDeps, 'workspaces' | 'tides' | 'variants'>,
  target: SelectionTarget,
): Promise<Result<FlowSelection>> {
  const ws = await requireWorkspace(deps.workspaces, target.projectCode);
  if (!ws.ok) return ws;
  const naming = requireBranchNaming(ws.value);
  if (!naming.ok) return naming;
  const variant = await requireVariant(deps.variants, target.projectCode, target.variantId);
  if (!variant.ok) return variant;
  const tide = await requireTide(deps.tides, target.projectCode, variant.value.tideId);
  if (!tide.ok) return tide;
  return buildFlowSelection(naming.value, {
    projectCode: ws.value.ccProjectCode,
    tide: tide.value.slug,
    variant: variant.value.slug,
    task: target.task,
  });
}

/**
 * Registers the selection for one Cc session. The outcome is recorded as reported:
 * an undeployed endpoint stays `not_connected`, never `selected`.
 */
export async function selectFlowForSession(
  deps: SelectionDeps,
  input: SelectionTarget & { readonly sessionId: string },
): Promise<Result<SelectionRecord>> {
  if (input.sessionId.trim().length === 0) return fail('missing_session', 'Cc セッション id が必要です');
  const selection = await resolveSelection(deps, input);
  if (!selection.ok) return selection;
  const outcome = await deps.harness.select(input.sessionId, selection.value);
  const state = selectionStateOf(outcome);
  const record: SelectionRecord = {
    id: deps.ids.next('selection'),
    projectCode: input.projectCode,
    sessionId: input.sessionId,
    variantId: input.variantId,
    selection: selection.value,
    state: state.state,
    ...(state.detail ? { detail: state.detail } : {}),
    requestedAt: deps.clock.now(),
  };
  await deps.selections.put(record);
  return ok(record);
}
