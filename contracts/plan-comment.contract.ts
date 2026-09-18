import type { planComment } from '../src/play-feedback/domain/comment-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-4: AI organisation stays distinguishable from human originals and cites sources. */
export default {
  post: (result, _ctx, draft) => {
    if (!result.ok) return true;
    const a = result.value.author;
    if (draft.author.kind === 'ai-summary') {
      return (a.kind === 'ai-summary' && result.value.source === 'ai' && a.sourceCommentIds.length > 0) || 'AI summary not marked';
    }
    return (a.kind === 'human' && result.value.source !== 'ai') || 'human comment marked as AI';
  },
} satisfies ContractOf<typeof planComment>;
