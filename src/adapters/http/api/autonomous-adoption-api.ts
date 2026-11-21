import { evaluateVariant } from '../../../adoption-decisions/application/auto-evaluate.ts';
import { readAutonomousAdoptionStatus } from '../../../adoption-decisions/application/autonomous-adoption-status.ts';
import { receiveProposal } from '../../../evolution-streams/application/proposal-intake.ts';
import { configureAutonomousAdoption } from '../../../project-workspaces/application/autonomous-adoption-settings.ts';
import type { AppDeps } from '../app-deps.ts';
import { checkHookToken } from '../hook-auth.ts';
import { BadRequestError, optStr, readJson, str, strList } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

export function registerAutonomousAdoptionApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/hooks/proposals', async (req) => {
    const denied = checkHookToken(req, deps.hookToken);
    if (denied) return denied;
    const body = readJson(req);
    const origin = str(body, 'origin');
    if (origin !== 'human' && origin !== 'ai' && origin !== 'system') throw new BadRequestError('origin must be human|ai|system');
    const targetTide = optStr(body, 'targetTide');
    const result = await receiveProposal(deps, {
      proposalId: str(body, 'proposalId'),
      projectCode: str(body, 'projectCode'),
      title: str(body, 'title'),
      summary: str(body, 'summary'),
      origin,
      evidence: strList(body, 'evidence'),
      ...(targetTide ? { targetTide } : {}),
    });
    return resultResponse(result, result.ok && result.value.kind === 'created' ? 201 : 200);
  });

  router.add('PUT', '/api/projects/:code/autonomous-adoption/policy', async (req, params) => {
    const denied = checkHookToken(req, deps.hookToken);
    if (denied) return denied;
    return resultResponse(await configureAutonomousAdoption(deps, params.code as string, readJson(req)));
  });

  router.add('POST', '/api/projects/:code/variants/:id/auto-evaluate', async (req, params) => {
    const denied = checkHookToken(req, deps.hookToken);
    if (denied) return denied;
    return resultResponse(await evaluateVariant(deps, params.code as string, params.id as string));
  });

  router.add('GET', '/api/projects/:code/autonomous-adoption', async (req, params) => {
    const denied = checkHookToken(req, deps.hookToken);
    if (denied) return denied;
    return resultResponse(await readAutonomousAdoptionStatus(deps, params.code as string));
  });
}
