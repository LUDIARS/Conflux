import { resolveSelection, selectFlowForSession, type SelectionDeps } from '../../flow-isolation/application/selection-use-cases.ts';
import { requireVariant } from '../../evolution-streams/application/flow-use-cases.ts';
import type { Comment } from '../../play-feedback/domain/model.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import { findDestination } from '../../project-workspaces/domain/workspace-rules.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { ImplementationRequest } from '../domain/model.ts';
import {
  applyReconciliation,
  applySpawnOutcome,
  markRequested,
  nextSpawnAction,
  planRequest,
  type RequestDraft,
} from '../domain/request-rules.ts';
import type { CcSpawnGateway } from '../ports.ts';

export interface RequestDeps extends SelectionDeps {
  readonly comments: RecordStore<Comment>;
  readonly requests: RecordStore<ImplementationRequest>;
  readonly spawner: CcSpawnGateway;
}

function authorName(c: Comment): string {
  return c.author.kind === 'human' ? c.author.name : `AI整理 (${c.author.agent})`;
}

async function send(deps: RequestDeps, request: ImplementationRequest): Promise<ImplementationRequest> {
  const ws = await deps.workspaces.get(request.projectCode);
  const destination = ws ? findDestination(ws, request.destinationId) : undefined;
  if (!ws || !destination) {
    // Settings changed after the request was stored; nothing is sent.
    const at = deps.clock.now();
    const blocked: ImplementationRequest = {
      ...request,
      state: 'not_sent',
      attempts: [...request.attempts, { at, result: 'not_connected', detail: 'spawn 先の設定が見つかりません' }],
      updatedAt: at,
    };
    await deps.requests.put(blocked);
    return blocked;
  }
  const inFlight = markRequested(request, deps.clock.now());
  await deps.requests.put(inFlight);
  const comments = await Promise.all(request.sourceCommentIds.map((id) => deps.comments.get(id)));
  const outcome = await deps.spawner.spawn({
    idempotencyKey: request.idempotencyKey,
    ccProjectCode: ws.ccProjectCode,
    destination: { kind: destination.kind, address: destination.address },
    selection: request.selection,
    title: request.title,
    brief: request.brief,
    requestedBy: request.requestedBy,
    sourceComments: comments.filter((c): c is Comment => c !== undefined).map((c) => ({ id: c.id, author: authorName(c), body: c.body })),
  });
  let updated = applySpawnOutcome(inFlight, outcome, deps.clock.now());
  if (updated.state === 'spawned' && updated.ccSessionId) {
    const selected = await selectFlowForSession(deps, {
      projectCode: request.projectCode,
      variantId: request.variantId,
      task: request.task,
      sessionId: updated.ccSessionId,
    });
    if (selected.ok) updated = { ...updated, harnessSelection: selected.value.state };
  }
  await deps.requests.put(updated);
  return updated;
}

/**
 * Turns a chosen improvement into a Cc session at a preconfigured destination, carrying
 * the flow selection and source comments, then registers the flow on the Cc harness.
 */
export async function requestImplementation(deps: RequestDeps, draft: RequestDraft): Promise<Result<ImplementationRequest>> {
  const ws = await requireWorkspace(deps.workspaces, draft.projectCode);
  if (!ws.ok) return ws;
  const variant = await requireVariant(deps.variants, draft.projectCode, draft.variantId);
  if (!variant.ok) return variant;
  const selection = await resolveSelection(deps, { projectCode: draft.projectCode, variantId: draft.variantId, task: draft.task });
  if (!selection.ok) return selection;
  const comments = await deps.comments.listByProject(draft.projectCode);
  const commentProjects = new Map<string, string>(comments.map((c) => [c.id, c.projectCode]));
  for (const id of draft.sourceCommentIds) {
    if (!commentProjects.has(id)) {
      const other = await deps.comments.get(id);
      if (other) commentProjects.set(id, other.projectCode);
    }
  }
  const plan = planRequest(
    {
      destinations: ws.value.spawnDestinations,
      variant: variant.value,
      commentProjects,
      existing: await deps.requests.listByProject(draft.projectCode),
      selection: selection.value,
    },
    draft,
    { id: deps.ids.next('request'), at: deps.clock.now() },
  );
  if (!plan.ok) return plan;
  const request = plan.value.request;
  if (plan.value.action === 'create') await deps.requests.put(request);
  // An existing request is only resent when it is known not to have reached Cc.
  if (nextSpawnAction(request) !== 'send') return ok(request);
  return ok(await send(deps, request));
}

/** Resolves a request whose spawn result is uncertain; resends only after Cc confirms absence. */
export async function reconcileRequest(
  deps: RequestDeps,
  input: { readonly projectCode: string; readonly requestId: string; readonly resendIfAbsent: boolean },
): Promise<Result<ImplementationRequest>> {
  const request = await deps.requests.get(input.requestId);
  if (!request || request.projectCode !== input.projectCode) return fail('request_not_found', '依頼がこのプロジェクトにありません');
  const action = nextSpawnAction(request);
  if (action === 'none') return ok(request);
  if (action === 'send') return input.resendIfAbsent ? ok(await send(deps, request)) : ok(request);
  const lookup = await deps.spawner.lookup(request.idempotencyKey);
  const reconciled = applyReconciliation(request, lookup, deps.clock.now());
  await deps.requests.put(reconciled);
  if (reconciled.state === 'not_sent' && input.resendIfAbsent) return ok(await send(deps, reconciled));
  return ok(reconciled);
}
