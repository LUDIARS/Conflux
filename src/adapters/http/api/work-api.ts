import { selectFlowForSession } from '../../../flow-isolation/application/selection-use-cases.ts';
import { reconcileRequest, requestImplementation } from '../../../implementation-requests/application/request-use-cases.ts';
import type { AppDeps } from '../app-deps.ts';
import { readJson, str, strList } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

export function registerWorkApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/projects/:code/requests', async (req, p) => {
    const b = readJson(req);
    return resultResponse(
      await requestImplementation(deps, {
        projectCode: p.code as string,
        variantId: str(b, 'variantId'),
        destinationId: str(b, 'destinationId'),
        title: str(b, 'title'),
        brief: str(b, 'brief'),
        task: str(b, 'task'),
        sourceCommentIds: strList(b, 'sourceCommentIds'),
        requestedBy: str(b, 'requestedBy'),
      }),
      201,
    );
  });

  router.add('POST', '/api/projects/:code/requests/:requestId/reconcile', async (req, p) => {
    const b = readJson(req);
    return resultResponse(
      await reconcileRequest(deps, { projectCode: p.code as string, requestId: p.requestId as string, resendIfAbsent: b.resendIfAbsent === true }),
    );
  });

  /** Registers a flow selection for an existing Cc session (e.g. one a human started in Cc). */
  router.add('POST', '/api/projects/:code/selections', async (req, p) => {
    const b = readJson(req);
    return resultResponse(
      await selectFlowForSession(deps, { projectCode: p.code as string, variantId: str(b, 'variantId'), task: str(b, 'task'), sessionId: str(b, 'sessionId') }),
      201,
    );
  });
}
