import { retryBuild } from '../../../playable-results/application/build-use-cases.ts';
import { deployArtifact } from '../../../playable-results/application/deploy-use-cases.ts';
import type { AppDeps } from '../app-deps.ts';
import { bearerToken, readJson, str } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

export function registerResultsApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/projects/:code/builds/:buildId/retry', async (_req, p) =>
    resultResponse(await retryBuild(deps, { projectCode: p.code as string, buildId: p.buildId as string }), 201),
  );

  /** Manager-or-above check runs here on every call; the UI check is not trusted alone. */
  router.add('POST', '/api/projects/:code/deployments', async (req, p) => {
    const b = readJson(req);
    return resultResponse(
      await deployArtifact(
        deps,
        {
          projectCode: p.code as string,
          artifactId: str(b, 'artifactId'),
          environment: str(b, 'environment'),
          confirmArtifactId: str(b, 'confirmArtifactId'),
          confirmEnvironment: str(b, 'confirmEnvironment'),
        },
        bearerToken(req),
      ),
      201,
    );
  });
}
