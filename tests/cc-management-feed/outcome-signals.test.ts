import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSignal, playtestSignal } from '../../src/cc-management-feed/domain/outcome-signals.ts';
import { clip } from '../../src/cc-management-feed/domain/signal-rules.ts';
import type { Build } from '../../src/playable-results/domain/model.ts';

const at = '2026-11-22T00:00:00.000Z';

describe('outcome signal mapping', () => {
  it('preserves the saved failure facts and skips an in-progress build', () => {
    const build: Build = {
      id: 'build-1', projectCode: 'KD', variantId: 'variant-1', tideId: 'tide-1',
      commit: 'abc123', state: 'failed', eventSeq: 2, origin: 'hook-reported', dedupeKey: 'job-1',
      requestedAt: '2026-11-21T23:00:00.000Z', updatedAt: at, failureSummary: 'コンパイル\n失敗',
    };
    assert.deepEqual(buildSignal(build), {
      eventKey: 'cf:build:build-1', kind: 'build', projectCode: 'KD', targetKey: 'variant/variant-1',
      origin: 'system', summary: 'failed build-1 (abc123): コンパイル 失敗', observedAt: at,
    });
    assert.equal(buildSignal({ ...build, state: 'running' }), undefined);
  });

  it('keeps each reported origin and clips without splitting a supplementary character', () => {
    for (const origin of ['human', 'ai', 'system'] as const) {
      const signal = playtestSignal({
        id: 'run-1', projectCode: 'KD', variantId: 'variant-1', buildId: 'build-1', commit: 'abc123',
        origin, summary: '試遊済み', observedAt: at,
      });
      assert.equal(signal.origin, origin);
      assert.equal(signal.summary, 'build-1 (abc123): 試遊済み');
    }
    assert.equal(clip(`${'a'.repeat(1998)}🎮x`), `${'a'.repeat(1998)}…`);
    assert.equal(clip(`${'a'.repeat(1998)}🎮`), `${'a'.repeat(1998)}🎮`);
  });
});
