/** Minimal facts about follow-ups that cite a comment, owned by other domains. */
export interface FollowUpFacts {
  readonly requests: readonly { readonly id: string; readonly title: string; readonly state: string; readonly sourceCommentIds: readonly string[] }[];
  readonly decisions: readonly { readonly id: string; readonly verdict: string; readonly reason: string; readonly relatedCommentIds: readonly string[] }[];
  readonly summaries: readonly { readonly id: string; readonly sourceCommentIds: readonly string[] }[];
}

export interface CommentTrace {
  readonly commentId: string;
  readonly summarizedBy: readonly string[];
  readonly requests: readonly { readonly id: string; readonly title: string; readonly state: string }[];
  readonly decisions: readonly { readonly id: string; readonly verdict: string; readonly reason: string }[];
}

/**
 * From an original opinion to what it led to (CF-COMMENT-001, CF-UX-3): AI summaries citing it,
 * work requests started from it (directly or via a summary), and adoption decisions citing it.
 */
export function traceComment(commentId: string, facts: FollowUpFacts): CommentTrace {
  const summarizedBy = facts.summaries.filter((s) => s.sourceCommentIds.includes(commentId)).map((s) => s.id);
  const related = new Set([commentId, ...summarizedBy]);
  const cites = (ids: readonly string[]) => ids.some((id) => related.has(id));
  return {
    commentId,
    summarizedBy,
    requests: facts.requests.filter((r) => cites(r.sourceCommentIds)).map(({ id, title, state }) => ({ id, title, state })),
    decisions: facts.decisions.filter((d) => cites(d.relatedCommentIds)).map(({ id, verdict, reason }) => ({ id, verdict, reason })),
  };
}
