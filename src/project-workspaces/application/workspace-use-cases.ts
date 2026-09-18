import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock } from '../../shared/runtime.ts';
import { observeFlowFlag } from '../domain/flow-observation.ts';
import type { ProjectWorkspace } from '../domain/model.ts';
import { planWorkspace, type WorkspaceSettingsInput } from '../domain/workspace-rules.ts';
import type { CcProjectRegistry } from '../ports.ts';

export interface WorkspaceDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly clock: Clock;
}

export async function configureWorkspace(deps: WorkspaceDeps, input: WorkspaceSettingsInput): Promise<Result<ProjectWorkspace>> {
  const existing = await deps.workspaces.get(input.projectCode);
  const planned = planWorkspace(existing, input, deps.clock.now());
  if (!planned.ok) return planned;
  await deps.workspaces.put(planned.value);
  return planned;
}

export async function requireWorkspace(
  workspaces: RecordStore<ProjectWorkspace>,
  projectCode: string,
): Promise<Result<ProjectWorkspace>> {
  const ws = await workspaces.get(projectCode);
  return ws ? ok(ws) : fail('project_not_found', `プロジェクト ${projectCode} は Cf に登録されていません`);
}

/** Re-reads `conflux_flow` from Cc and stores the observation (never assumes enabled). */
export async function refreshFlowObservation(
  deps: WorkspaceDeps & { readonly registry: CcProjectRegistry },
  projectCode: string,
): Promise<Result<ProjectWorkspace>> {
  const ws = await requireWorkspace(deps.workspaces, projectCode);
  if (!ws.ok) return ws;
  const lookup = await deps.registry.lookup(ws.value.ccProjectCode);
  const now = deps.clock.now();
  const updated: ProjectWorkspace = { ...ws.value, flowObservation: observeFlowFlag(lookup, now), updatedAt: now };
  await deps.workspaces.put(updated);
  return ok(updated);
}
