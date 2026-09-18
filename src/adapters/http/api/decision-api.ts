import { decideAdoption } from '../../../adoption-decisions/application/decision-use-cases.ts';
import type { AppDeps } from '../app-deps.ts';
import { BadRequestError, optStr, readJson, str, strList } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

export function registerDecisionApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/projects/:code/decisions', async (req, p) => {
    const b = readJson(req);
    const verdict = str(b, 'verdict');
    if (verdict !== 'adopted' && verdict !== 'declined') throw new BadRequestError('verdict must be adopted or declined');
    const commit = optStr(b, 'commit');
    const ratingDigest = optStr(b, 'ratingDigest');
    return resultResponse(
      await decideAdoption(deps, {
        projectCode: p.code as string,
        variantId: str(b, 'variantId'),
        verdict,
        reason: str(b, 'reason'),
        decidedBy: str(b, 'decidedBy'),
        relatedCommentIds: strList(b, 'relatedCommentIds'),
        ...(commit ? { commit } : {}),
        ...(ratingDigest ? { ratingDigest } : {}),
      }),
      201,
    );
  });
}
