import type { RatingScale } from '../../project-workspaces/domain/model.ts';

/** The exact build a person played; a rating/comment stays tied to it even after newer builds. */
export interface PlayedBuildRef {
  readonly buildId: string;
  readonly commit: string;
}

/**
 * Human originals and AI organisation are different authors, so an AI summary can never
 * be mistaken for what a player actually wrote (CF-COMMENT-001).
 */
export type CommentAuthor =
  | { readonly kind: 'human'; readonly name: string }
  | { readonly kind: 'ai-summary'; readonly agent: string; readonly sourceCommentIds: readonly string[] };

export type CommentSource = 'cf-ui' | 'debug-screen' | 'ai';

export interface Comment {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly revisionId?: string;
  readonly parentId?: string;
  readonly author: CommentAuthor;
  readonly body: string;
  readonly source: CommentSource;
  readonly playedBuild?: PlayedBuildRef;
  readonly createdAt: string;
}

export interface Rating {
  readonly id: string;
  readonly projectCode: string;
  readonly tideId: string;
  readonly variantId: string;
  readonly playedBuild: PlayedBuildRef;
  readonly rater: string;
  readonly scores: Readonly<Record<string, number>>;
  /** Scale as it was when rated; the project scale may change later. */
  readonly scale: RatingScale;
  readonly source: Exclude<CommentSource, 'ai'>;
  readonly createdAt: string;
}
