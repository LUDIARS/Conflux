import { fail, ok, type Result } from '../../shared/result.ts';
import type { Comment, CommentAuthor, CommentSource, PlayedBuildRef } from './model.ts';

/** The facts about the target variant/build this domain needs, without owning those records. */
export interface VariantFacts {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
}

export interface BuildFacts {
  readonly id: string;
  readonly projectCode: string;
  readonly variantId: string;
  readonly commit: string;
}

export interface CommentDraft {
  readonly projectCode: string;
  readonly variantId: string;
  readonly revisionId?: string;
  readonly parentId?: string;
  readonly author: CommentAuthor;
  readonly body: string;
  readonly source: CommentSource;
  readonly playedBuildId?: string;
}

export const MAX_COMMENT_LENGTH = 4000;

/** Binds a played build to a variant; a build of another variant or project is refused. */
export function bindPlayedBuild(variant: VariantFacts, build: BuildFacts | undefined): Result<PlayedBuildRef> {
  if (!build || build.projectCode !== variant.projectCode) return fail('build_not_found', 'プレイしたビルドがこのプロジェクトにありません');
  if (build.variantId !== variant.id) return fail('build_mismatch', 'プレイしたビルドは別の亜流のものです');
  return ok({ buildId: build.id, commit: build.commit });
}

/**
 * Validates a comment. Very short feedback ("楽しい") is accepted on purpose (CF-UX-1).
 * Replies stay on the parent's variant; AI summaries must cite human comments of the same project.
 */
export function planComment(
  ctx: {
    readonly variant: VariantFacts;
    readonly parent?: Comment;
    readonly build?: BuildFacts;
    readonly sources?: readonly Comment[];
  },
  draft: CommentDraft,
  stamp: { readonly id: string; readonly at: string },
): Result<Comment> {
  if (ctx.variant.projectCode !== draft.projectCode || ctx.variant.id !== draft.variantId) {
    return fail('variant_not_found', '投稿先の亜流がこのプロジェクトにありません');
  }
  const body = draft.body.trim();
  if (body.length === 0) return fail('empty_comment', 'コメントが空です');
  if (body.length > MAX_COMMENT_LENGTH) return fail('comment_too_long', `コメントは ${MAX_COMMENT_LENGTH} 文字以内です`);

  if (draft.author.kind === 'human' && draft.author.name.trim().length === 0) {
    return fail('missing_author', '投稿者名を入力してください');
  }
  if (draft.author.kind === 'ai-summary') {
    if (draft.source !== 'ai') return fail('invalid_source', 'AI による整理は source=ai で投稿してください');
    const sources = ctx.sources ?? [];
    const cited = draft.author.sourceCommentIds;
    if (cited.length === 0) return fail('missing_sources', 'AI による整理は元のコメントを 1 件以上参照してください');
    const valid = cited.every((id) =>
      sources.some((c) => c.id === id && c.projectCode === draft.projectCode && c.author.kind === 'human'),
    );
    if (!valid) return fail('invalid_sources', 'AI による整理の参照先は同じプロジェクトの人間のコメントに限ります');
  } else if (draft.source === 'ai') {
    return fail('invalid_source', '人間の投稿に source=ai は使えません');
  }

  if (draft.parentId) {
    const parent = ctx.parent;
    if (!parent || parent.id !== draft.parentId || parent.variantId !== draft.variantId) {
      return fail('parent_mismatch', '返信先のコメントが同じ亜流にありません');
    }
  }

  let playedBuild: PlayedBuildRef | undefined;
  if (draft.playedBuildId) {
    const bound = bindPlayedBuild(ctx.variant, ctx.build && ctx.build.id === draft.playedBuildId ? ctx.build : undefined);
    if (!bound.ok) return bound;
    playedBuild = bound.value;
  }

  return ok({
    id: stamp.id,
    projectCode: draft.projectCode,
    tideId: ctx.variant.tideId,
    variantId: ctx.variant.id,
    ...(draft.revisionId ? { revisionId: draft.revisionId } : {}),
    ...(draft.parentId ? { parentId: draft.parentId } : {}),
    author: draft.author,
    body,
    source: draft.source,
    ...(playedBuild ? { playedBuild } : {}),
    createdAt: stamp.at,
  });
}

export interface CommentThread {
  readonly comment: Comment;
  readonly replies: readonly CommentThread[];
}

/** Groups comments into reply threads in chronological order. */
export function buildThreads(comments: readonly Comment[]): readonly CommentThread[] {
  const sorted = [...comments].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  const ids = new Set(sorted.map((c) => c.id));
  const childrenOf = (parentId: string | undefined): CommentThread[] =>
    sorted
      .filter((c) => (parentId === undefined ? !c.parentId || !ids.has(c.parentId) : c.parentId === parentId))
      .map((c) => ({ comment: c, replies: childrenOf(c.id) }));
  return childrenOf(undefined);
}
