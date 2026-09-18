import { ingestDebugFeedback, postComment, rateVariant } from '../../../play-feedback/application/feedback-use-cases.ts';
import type { CommentAuthor } from '../../../play-feedback/domain/model.ts';
import type { AppDeps } from '../app-deps.ts';
import { BadRequestError, numberRecord, optStr, readJson, str, strList } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

function author(b: Record<string, unknown>): CommentAuthor {
  const kind = optStr(b, 'authorKind') ?? 'human';
  if (kind === 'human') return { kind: 'human', name: str(b, 'author') };
  if (kind === 'ai-summary') return { kind: 'ai-summary', agent: str(b, 'agent'), sourceCommentIds: strList(b, 'sourceCommentIds') };
  throw new BadRequestError('authorKind must be human or ai-summary');
}

export function registerFeedbackApi(router: Router, deps: AppDeps): void {
  router.add('POST', '/api/projects/:code/variants/:variantId/comments', async (req, p) => {
    const b = readJson(req);
    const a = author(b);
    const revisionId = optStr(b, 'revisionId');
    const parentId = optStr(b, 'parentId');
    const playedBuildId = optStr(b, 'playedBuildId');
    return resultResponse(
      await postComment(deps, {
        projectCode: p.code as string,
        variantId: p.variantId as string,
        author: a,
        body: str(b, 'body'),
        source: a.kind === 'ai-summary' ? 'ai' : 'cf-ui',
        ...(revisionId ? { revisionId } : {}),
        ...(parentId ? { parentId } : {}),
        ...(playedBuildId ? { playedBuildId } : {}),
      }),
      201,
    );
  });

  router.add('POST', '/api/projects/:code/variants/:variantId/ratings', async (req, p) => {
    const b = readJson(req);
    return resultResponse(
      await rateVariant(deps, {
        projectCode: p.code as string,
        variantId: p.variantId as string,
        playedBuildId: str(b, 'playedBuildId'),
        rater: str(b, 'rater'),
        scores: numberRecord(b, 'scores') ?? {},
      }),
      201,
    );
  });

  /**
   * Game debug-screen intake. The game reports the build it runs; Cf admits the post only
   * for Cf Flow projects and only for a build it recorded for that variant and commit.
   */
  router.add('POST', '/api/debug/feedback', async (req) => {
    const b = readJson(req);
    const body = optStr(b, 'body');
    const scores = numberRecord(b, 'scores');
    return resultResponse(
      await ingestDebugFeedback(deps, {
        claim: { projectCode: str(b, 'projectCode'), variantId: str(b, 'variantId'), buildId: str(b, 'buildId'), commit: str(b, 'commit') },
        player: str(b, 'player'),
        ...(body ? { body } : {}),
        ...(scores ? { scores } : {}),
      }),
      201,
    );
  });
}
