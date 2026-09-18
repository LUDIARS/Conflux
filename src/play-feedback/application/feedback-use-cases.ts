import { requireVariant } from '../../evolution-streams/application/flow-use-cases.ts';
import type { Variant } from '../../evolution-streams/domain/model.ts';
import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import { canIngestDebugFeedback } from '../../project-workspaces/domain/workspace-rules.ts';
import type { Build } from '../../playable-results/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock, IdGenerator } from '../../shared/runtime.ts';
import { bindPlayedBuild, planComment, type BuildFacts, type CommentDraft } from '../domain/comment-rules.ts';
import { admitDebugPost, type DebugBuildClaim } from '../domain/debug-intake.ts';
import type { Comment, Rating } from '../domain/model.ts';
import { planRating } from '../domain/rating-rules.ts';

export interface FeedbackDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly variants: RecordStore<Variant>;
  readonly builds: RecordStore<Build>;
  readonly comments: RecordStore<Comment>;
  readonly ratings: RecordStore<Rating>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

async function buildFacts(builds: RecordStore<Build>, buildId: string | undefined): Promise<BuildFacts | undefined> {
  if (!buildId) return undefined;
  const b = await builds.get(buildId);
  return b ? { id: b.id, projectCode: b.projectCode, variantId: b.variantId, commit: b.commit } : undefined;
}

/** Posts a comment, reply or AI summary from the Cf UI/API. */
export async function postComment(deps: FeedbackDeps, draft: CommentDraft): Promise<Result<Comment>> {
  const ws = await requireWorkspace(deps.workspaces, draft.projectCode);
  if (!ws.ok) return ws;
  const variant = await requireVariant(deps.variants, draft.projectCode, draft.variantId);
  if (!variant.ok) return variant;
  const parent = draft.parentId ? await deps.comments.get(draft.parentId) : undefined;
  const build = await buildFacts(deps.builds, draft.playedBuildId);
  const sources = draft.author.kind === 'ai-summary' ? await deps.comments.listByProject(draft.projectCode) : undefined;
  const planned = planComment(
    {
      variant: variant.value,
      ...(parent ? { parent } : {}),
      ...(build ? { build } : {}),
      ...(sources ? { sources } : {}),
    },
    draft,
    { id: deps.ids.next('comment'), at: deps.clock.now() },
  );
  if (!planned.ok) return planned;
  await deps.comments.put(planned.value);
  return planned;
}

export interface RateInput {
  readonly projectCode: string;
  readonly variantId: string;
  readonly playedBuildId: string;
  readonly rater: string;
  readonly scores: Readonly<Record<string, number>>;
}

/** Rates a variant against the build that was actually played. */
export async function rateVariant(deps: FeedbackDeps, input: RateInput, source: Rating['source'] = 'cf-ui'): Promise<Result<Rating>> {
  const ws = await requireWorkspace(deps.workspaces, input.projectCode);
  if (!ws.ok) return ws;
  const variant = await requireVariant(deps.variants, input.projectCode, input.variantId);
  if (!variant.ok) return variant;
  const played = bindPlayedBuild(variant.value, await buildFacts(deps.builds, input.playedBuildId));
  if (!played.ok) return played;
  const planned = planRating(
    ws.value.ratingScale,
    {
      projectCode: input.projectCode,
      tideId: variant.value.tideId,
      variantId: variant.value.id,
      playedBuild: played.value,
      rater: input.rater,
      scores: input.scores,
      source,
    },
    { id: deps.ids.next('rating'), at: deps.clock.now() },
  );
  if (!planned.ok) return planned;
  await deps.ratings.put(planned.value);
  return planned;
}

export interface DebugPostInput {
  readonly claim: DebugBuildClaim;
  readonly player: string;
  readonly body?: string;
  readonly scores?: Readonly<Record<string, number>>;
}

/**
 * Debug-screen intake: the same comment/rating model as the Cf UI, admitted only for
 * Cf Flow projects and bound to the build the game reports. Validates everything before
 * storing anything so a half-accepted post does not happen.
 */
export async function ingestDebugFeedback(
  deps: FeedbackDeps,
  input: DebugPostInput,
): Promise<Result<{ readonly comment?: Comment; readonly rating?: Rating }>> {
  const ws = await requireWorkspace(deps.workspaces, input.claim.projectCode);
  if (!ws.ok) return ws;
  const variant = await deps.variants.get(input.claim.variantId);
  const build = await buildFacts(deps.builds, input.claim.buildId);
  const admitted = admitDebugPost({
    intakeOpen: canIngestDebugFeedback(ws.value),
    ...(variant ? { variant } : {}),
    ...(build ? { build } : {}),
    claim: input.claim,
  });
  if (!admitted.ok) return admitted;

  const now = deps.clock.now();
  const comment = input.body?.trim()
    ? planComment(
        { variant: admitted.value.variant, ...(build ? { build } : {}) },
        {
          projectCode: input.claim.projectCode,
          variantId: input.claim.variantId,
          author: { kind: 'human', name: input.player },
          body: input.body,
          source: 'debug-screen',
          playedBuildId: input.claim.buildId,
        },
        { id: deps.ids.next('comment'), at: now },
      )
    : undefined;
  if (comment && !comment.ok) return comment;
  const rating = input.scores
    ? planRating(
        ws.value.ratingScale,
        {
          projectCode: input.claim.projectCode,
          tideId: admitted.value.variant.tideId,
          variantId: admitted.value.variant.id,
          playedBuild: admitted.value.playedBuild,
          rater: input.player,
          scores: input.scores,
          source: 'debug-screen',
        },
        { id: deps.ids.next('rating'), at: now },
      )
    : undefined;
  if (rating && !rating.ok) return rating;
  if (!comment && !rating) return fail('empty_post', 'コメントか評価のどちらかが必要です');

  if (comment?.ok) await deps.comments.put(comment.value);
  if (rating?.ok) await deps.ratings.put(rating.value);
  return ok({
    ...(comment?.ok ? { comment: comment.value } : {}),
    ...(rating?.ok ? { rating: rating.value } : {}),
  });
}
