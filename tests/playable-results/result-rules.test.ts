import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyBuildEvent } from '../../src/playable-results/domain/build-events.ts';
import { applyBuildRequestOutcome, planFlowBuild, planRetry } from '../../src/playable-results/domain/build-requests.ts';
import type { Artifact, Build } from '../../src/playable-results/domain/model.ts';
import { isResultComplete, variantResultStatus } from '../../src/playable-results/domain/result-status.ts';

const at = '2026-09-18T00:00:00.000Z';
const settings = { triggers: ['variant-mainline-updated' as const], platforms: ['windows'] };
const target = { projectCode: 'KD', tideId: 't1', variantId: 'v1', commit: 'aaa1111' };

function build(overrides: Partial<Build> = {}): Build {
  return { id: 'b1', ...target, origin: 'variant-mainline-updated', dedupeKey: 'k', state: 'requested', eventSeq: 0, requestedAt: at, updatedAt: at, ...overrides };
}

describe('build requests', () => {
  it('a repeated flow hook returns the same build instead of restarting', () => {
    const first = planFlowBuild([], settings, target, 'variant-mainline-updated', { id: 'b1', at });
    assert.ok(first.ok && first.value.action === 'send');
    const again = planFlowBuild([first.value.build], settings, target, 'variant-mainline-updated', { id: 'b2', at });
    assert.ok(again.ok && again.value.action === 'existing' && again.value.build.id === 'b1');
  });

  it('refuses triggers the project did not configure', () => {
    const r = planFlowBuild([], settings, target, 'work-branch-submitted', { id: 'b1', at });
    assert.equal(r.ok ? null : r.error.code, 'trigger_not_configured');
  });

  it('retries only the latest failed attempt; unknown needs reconciliation first', () => {
    const failed = build({ state: 'failed' });
    const retry = planRetry([failed], failed, { id: 'b2', at: '2026-09-18T00:00:01.000Z' });
    assert.ok(retry.ok && retry.value.retryOf === 'b1' && retry.value.dedupeKey.endsWith('retry-1'));
    assert.equal(planRetry([build({ state: 'unknown' })], build({ state: 'unknown' }), { id: 'b2', at }).ok, false);
  });

  it('records an undeployed Cc build route as not_connected, not requested', () => {
    assert.equal(applyBuildRequestOutcome(build(), { kind: 'not_connected', reason: 'x' }, at).state, 'not_connected');
    assert.equal(applyBuildRequestOutcome(build(), { kind: 'unknown', reason: 'x' }, at).state, 'unknown');
  });
});

describe('build events', () => {
  const ev = { dedupeKey: 'k', projectCode: 'KD', variantId: 'v1', commit: 'aaa1111' };
  let n = 0;
  const newId = () => `a${++n}`;

  it('ignores duplicate/stale events and never regresses a terminal state', () => {
    const done = applyBuildEvent(build(), { ...ev, seq: 2, state: 'succeeded', artifacts: [{ platform: 'w', delivery: 'download', uri: 'https://x/y' }] }, newId, at);
    assert.ok(done.ok && done.value.kind === 'applied');
    const stale = applyBuildEvent(done.value.build, { ...ev, seq: 1, state: 'running' }, newId, at);
    assert.ok(stale.ok && stale.value.kind === 'ignored');
    const late = applyBuildEvent(done.value.build, { ...ev, seq: 3, state: 'failed' }, newId, at);
    assert.ok(late.ok && late.value.kind === 'ignored' && late.value.reason === 'already_terminal');
  });

  it('rejects events describing another commit', () => {
    assert.equal(applyBuildEvent(build(), { ...ev, commit: 'bbb2222', seq: 1, state: 'running' }, newId, at).ok, false);
  });
});

describe('result status', () => {
  const art = (buildId: string): Artifact => ({ id: `art-${buildId}`, projectCode: 'KD', buildId, tideId: 't1', variantId: 'v1', commit: 'x', platform: 'w', delivery: 'download', uri: 'https://x', createdAt: at });
  const old = build({ id: 'old', commit: 'aaa1111', state: 'succeeded', requestedAt: '2026-01-01' });
  const failedNew = build({ id: 'new', commit: 'bbb2222', state: 'failed', requestedAt: '2026-01-02' });

  it('a failed target never borrows an older success', () => {
    const s = variantResultStatus({ variantId: 'v1', targetCommit: 'bbb2222', builds: [old, failedNew], artifacts: [art('old')] });
    assert.equal(s.target, 'failed');
    assert.equal(s.lastPlayable?.isTarget, false);
    assert.equal(isResultComplete(s), false);
  });

  it('success without artifacts is not complete', () => {
    const s = variantResultStatus({ variantId: 'v1', targetCommit: 'aaa1111', builds: [old], artifacts: [] });
    assert.equal(s.target, 'succeeded_without_artifact');
    assert.equal(isResultComplete(s), false);
  });

  it('the target commit with artifacts is playable', () => {
    const s = variantResultStatus({ variantId: 'v1', targetCommit: 'aaa1111', builds: [old], artifacts: [art('old')] });
    assert.equal(s.target, 'playable');
    assert.equal(s.lastPlayable?.isTarget, true);
  });
});
