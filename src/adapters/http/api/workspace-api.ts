import { loadProjectOverview } from '../../../evolution-streams/application/project-overview.ts';
import { configureWorkspace, refreshFlowObservation } from '../../../project-workspaces/application/workspace-use-cases.ts';
import type { WorkspaceSettingsInput } from '../../../project-workspaces/domain/workspace-rules.ts';
import type { AppDeps } from '../app-deps.ts';
import { BadRequestError, readJson } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

function settingsFrom(code: string, body: Record<string, unknown>): WorkspaceSettingsInput {
  // Structural checks happen in planWorkspace; here we only reject non-object shapes.
  const obj = (key: string) => {
    const v = body[key];
    if (v !== undefined && (typeof v !== 'object' || v === null)) throw new BadRequestError(`${key} must be an object`);
    return v as never;
  };
  if (typeof body.name !== 'string' || typeof body.ccProjectCode !== 'string') throw new BadRequestError('name and ccProjectCode are required');
  return {
    projectCode: code,
    name: body.name,
    ccProjectCode: body.ccProjectCode,
    ...(body.branchNaming !== undefined ? { branchNaming: obj('branchNaming') } : {}),
    spawnDestinations: Array.isArray(body.spawnDestinations) ? (body.spawnDestinations as never) : [],
    ...(body.ratingScale !== undefined ? { ratingScale: obj('ratingScale') } : {}),
    build: obj('build') ?? { triggers: [], platforms: [] },
    deploy: obj('deploy') ?? { environments: [], managerRoles: [] },
    debugIntake: body.debugIntake === true,
  };
}

export function registerWorkspaceApi(router: Router, deps: AppDeps): void {
  router.add('PUT', '/api/projects/:code', async (req, p) => resultResponse(await configureWorkspace(deps, settingsFrom(p.code as string, readJson(req)))));
  router.add('POST', '/api/projects/:code/flow-status/refresh', async (_req, p) => resultResponse(await refreshFlowObservation(deps, p.code as string)));
  router.add('GET', '/api/projects/:code/overview', async (req, p) =>
    resultResponse(await loadProjectOverview(deps, p.code as string, req.query.get('variant') ?? undefined)),
  );
}
