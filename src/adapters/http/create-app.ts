import { registerDecisionApi } from './api/decision-api.ts';
import { registerFeedbackApi } from './api/feedback-api.ts';
import { registerFlowApi } from './api/flow-api.ts';
import { registerHookApi } from './api/hook-api.ts';
import { registerResultsApi } from './api/results-api.ts';
import { registerWorkApi } from './api/work-api.ts';
import { registerWorkspaceApi } from './api/workspace-api.ts';
import type { AppDeps } from './app-deps.ts';
import { registerPageRoutes } from './page-routes.ts';
import { Router } from './router.ts';

/** Builds the full route table. No socket is opened here. */
export function createApp(deps: AppDeps): Router {
  const router = new Router();
  registerPageRoutes(router, deps);
  registerWorkspaceApi(router, deps);
  registerFlowApi(router, deps);
  registerFeedbackApi(router, deps);
  registerWorkApi(router, deps);
  registerResultsApi(router, deps);
  registerDecisionApi(router, deps);
  registerHookApi(router, deps);
  return router;
}
