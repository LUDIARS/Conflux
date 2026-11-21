import { ok, type Result } from '../../shared/result.ts';
import { serialByKey } from '../../shared/serial-by-key.ts';
import { parseAutonomousAdoptionPolicy, type AutonomousAdoptionPolicy } from '../domain/autonomous-adoption-policy.ts';
import { requireWorkspace, type WorkspaceDeps } from './workspace-use-cases.ts';

export async function configureAutonomousAdoption(
  deps: WorkspaceDeps,
  projectCode: string,
  input: Record<string, unknown>,
): Promise<Result<AutonomousAdoptionPolicy>> {
  const policy = parseAutonomousAdoptionPolicy(input);
  if (!policy.ok) return policy;
  return serialByKey(deps.workspaces, projectCode, async () => {
    const workspace = await requireWorkspace(deps.workspaces, projectCode);
    if (!workspace.ok) return workspace;
    await deps.workspaces.put({ ...workspace.value, autonomousAdoption: policy.value, updatedAt: deps.clock.now() });
    return ok(policy.value);
  });
}
