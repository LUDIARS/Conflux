import type { FlowSelection } from '../../flow-isolation/domain/selection.ts';
import type { SpawnDestination } from '../../project-workspaces/domain/model.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { ImplementationRequest, SpawnAccepted, SpawnLookup } from './model.ts';

export interface RequestDraft {
  readonly projectCode: string;
  readonly variantId: string;
  readonly destinationId: string;
  readonly title: string;
  readonly brief: string;
  readonly task: string;
  readonly sourceCommentIds: readonly string[];
  readonly requestedBy: string;
}

/** Identity of a work request: the same project/variant/task is the same request. */
export function requestIdempotencyKey(projectCode: string, variantId: string, task: string): string {
  return `cf-spawn:${projectCode}:${variantId}:${task}`;
}

export type RequestPlan =
  | { readonly action: 'create'; readonly request: ImplementationRequest }
  | { readonly action: 'existing'; readonly request: ImplementationRequest };

/**
 * Plans a new work request (CF-SPAWN-001). The destination must be one preconfigured for
 * this project; source comments must belong to this project. A request with the same
 * identity is returned as-is instead of creating a duplicate.
 */
export function planRequest(
  ctx: {
    readonly destinations: readonly SpawnDestination[];
    readonly variant: { readonly id: string; readonly projectCode: string; readonly tideId: string };
    readonly commentProjects: ReadonlyMap<string, string>;
    readonly existing: readonly ImplementationRequest[];
    readonly selection: FlowSelection;
  },
  draft: RequestDraft,
  stamp: { readonly id: string; readonly at: string },
): Result<RequestPlan> {
  if (ctx.variant.projectCode !== draft.projectCode || ctx.variant.id !== draft.variantId) {
    return fail('variant_not_found', '依頼対象の亜流がこのプロジェクトにありません');
  }
  if (!ctx.destinations.some((d) => d.id === draft.destinationId)) {
    return fail('destination_not_configured', 'spawn 先がこのプロジェクトで事前設定されていません');
  }
  if (draft.title.trim().length === 0 || draft.brief.trim().length === 0) {
    return fail('missing_field', '依頼の題名と改善内容を入力してください');
  }
  if (draft.requestedBy.trim().length === 0) return fail('missing_author', '依頼者名を入力してください');
  for (const id of draft.sourceCommentIds) {
    if (ctx.commentProjects.get(id) !== draft.projectCode) {
      return fail('invalid_sources', '元コメントは同じプロジェクトのものに限ります');
    }
  }
  const key = requestIdempotencyKey(draft.projectCode, draft.variantId, draft.task);
  const same = ctx.existing.find((r) => r.idempotencyKey === key);
  if (same) return ok({ action: 'existing', request: same });
  return ok({
    action: 'create',
    request: {
      id: stamp.id,
      projectCode: draft.projectCode,
      tideId: ctx.variant.tideId,
      variantId: draft.variantId,
      destinationId: draft.destinationId,
      title: draft.title.trim(),
      brief: draft.brief.trim(),
      task: draft.task,
      sourceCommentIds: draft.sourceCommentIds,
      selection: ctx.selection,
      idempotencyKey: key,
      requestedBy: draft.requestedBy.trim(),
      state: 'pending',
      attempts: [],
      createdAt: stamp.at,
      updatedAt: stamp.at,
    },
  });
}

export type SpawnAction = 'send' | 'reconcile' | 'none';

/**
 * Only requests that are known not to have reached Cc may be sent. Anything that may have
 * been delivered (`requested`, `unknown`) must be reconciled first.
 */
export function nextSpawnAction(request: ImplementationRequest): SpawnAction {
  switch (request.state) {
    case 'pending':
    case 'not_sent':
      return 'send';
    case 'requested':
    case 'unknown':
      return 'reconcile';
    case 'spawned':
    case 'rejected':
      return 'none';
  }
}

export function markRequested(request: ImplementationRequest, at: string): ImplementationRequest {
  return { ...request, state: 'requested', updatedAt: at };
}

export function applySpawnOutcome(request: ImplementationRequest, outcome: ExternalOutcome<SpawnAccepted>, at: string): ImplementationRequest {
  switch (outcome.kind) {
    case 'accepted':
      return {
        ...request,
        state: 'spawned',
        ccSessionId: outcome.value.sessionId,
        ...(outcome.value.runId ? { ccRunId: outcome.value.runId } : {}),
        attempts: [...request.attempts, { at, result: 'accepted' }],
        updatedAt: at,
      };
    case 'rejected':
      return { ...request, state: 'rejected', attempts: [...request.attempts, { at, result: 'rejected', detail: outcome.detail }], updatedAt: at };
    case 'not_connected':
      return { ...request, state: 'not_sent', attempts: [...request.attempts, { at, result: 'not_connected', detail: outcome.reason }], updatedAt: at };
    case 'unknown':
      return { ...request, state: 'unknown', attempts: [...request.attempts, { at, result: 'unknown', detail: outcome.reason }], updatedAt: at };
  }
}

/** Resolves an uncertain request from Cc's own record of the idempotency key. */
export function applyReconciliation(request: ImplementationRequest, lookup: SpawnLookup, at: string): ImplementationRequest {
  switch (lookup.kind) {
    case 'found':
      return {
        ...request,
        state: 'spawned',
        ccSessionId: lookup.sessionId,
        ...(lookup.runId ? { ccRunId: lookup.runId } : {}),
        attempts: [...request.attempts, { at, result: 'reconciled_found' }],
        updatedAt: at,
      };
    case 'absent':
      // Cc confirms it never started a session for this key, so a later send is safe.
      return { ...request, state: 'not_sent', attempts: [...request.attempts, { at, result: 'reconciled_absent' }], updatedAt: at };
    case 'unavailable':
      return { ...request, attempts: [...request.attempts, { at, result: 'reconcile_failed', detail: lookup.reason }], updatedAt: at };
  }
}

export function describeRequestState(state: ImplementationRequest['state']): string {
  const labels: Record<ImplementationRequest['state'], string> = {
    pending: '未送信',
    requested: 'Cc へ送信中 (応答未記録・照合が必要)',
    spawned: 'Cc セッション起動済み',
    rejected: 'Cc が拒否',
    unknown: '起動結果不明 (照合が必要)',
    not_sent: 'Cc spawn 経路未接続 (未送信)',
  };
  return labels[state];
}
