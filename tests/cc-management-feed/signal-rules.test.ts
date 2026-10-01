import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { afterAttempt, commentSignal, isDue, newEntry, ratingSignal, SUMMARY_LIMIT } from '../../src/cc-management-feed/domain/signal-rules.ts';
import type { Comment, Rating } from '../../src/play-feedback/domain/model.ts';

const base: Comment = {
  id: 'comment_1', projectCode: 'KD', tideId: 't1', variantId: 'v1',
  author: { kind: 'human', name: 'tester' }, body: '操作が重い', source: 'cf-ui', createdAt: '2026-10-01T00:00:00.000Z',
};

describe('management signal rules', () => {
  it('reports a human comment as origin=human on its variant', () => {
    const s = commentSignal(base);
    assert.equal(s.eventKey, 'cf:comment:comment_1');
    assert.equal(s.kind, 'comment');
    assert.equal(s.origin, 'human');
    assert.equal(s.targetKey, 'variant/v1');
    assert.equal(s.summary, 'tester: 操作が重い');
  });

  it('reports AI summaries as origin=ai so Cc never takes them as human requests', () => {
    const s = commentSignal({ ...base, author: { kind: 'ai-summary', agent: 'dots', sourceCommentIds: ['comment_0'] }, source: 'ai' });
    assert.equal(s.origin, 'ai');
    assert.equal(s.kind, 'ai-summary');
  });

  it('marks replies and clips long bodies to the Cc summary limit', () => {
    const s = commentSignal({ ...base, parentId: 'comment_0', body: 'あ'.repeat(5000) });
    assert.equal(s.kind, 'reply');
    assert.equal(s.summary.length, SUMMARY_LIMIT);
  });

  it('summarises a rating with its played build', () => {
    const rating: Rating = {
      id: 'rating_1', projectCode: 'KD', tideId: 't1', variantId: 'v1',
      playedBuild: { buildId: 'b1', commit: 'abcdef0123456789' }, rater: 'tester', scores: { fun: 4 },
      scale: { axes: [] } as unknown as Rating['scale'], source: 'debug-screen', createdAt: '2026-10-01T00:00:00.000Z',
    };
    const s = ratingSignal(rating);
    assert.equal(s.eventKey, 'cf:rating:rating_1');
    assert.equal(s.origin, 'human');
    assert.match(s.summary, /abcdef012345.*fun=4/);
  });

  it('retries not_connected and unknown with backoff, stops on delivery or refusal', () => {
    const now = '2026-10-01T00:00:00.000Z';
    const entry = newEntry(commentSignal(base), now);
    assert.equal(isDue(entry, now), true);
    const retry = afterAttempt(entry, { kind: 'unknown', reason: 'timeout' }, now);
    assert.equal(retry.status, 'pending');
    assert.equal(retry.attempts, 1);
    assert.equal(isDue(retry, now), false);
    assert.ok(retry.nextAttemptAt > now);
    assert.equal(afterAttempt(retry, { kind: 'accepted', value: { created: false } }, now).status, 'delivered');
    assert.equal(afterAttempt(retry, { kind: 'rejected', status: 409, detail: 'conflict' }, now).status, 'refused');
  });
});
