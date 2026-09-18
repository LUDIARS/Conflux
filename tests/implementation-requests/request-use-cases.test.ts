import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reconcileRequest, requestImplementation } from '../../src/implementation-requests/application/request-use-cases.ts';
import { applySpawnOutcome, nextSpawnAction } from '../../src/implementation-requests/domain/request-rules.ts';
import { postComment } from '../../src/play-feedback/application/feedback-use-cases.ts';
import { testDeps } from '../support/fixtures.ts';
import { seedProject, unwrap } from '../support/seed.ts';

async function setup() {
  const t = testDeps();
  const s = await seedProject(t.deps);
  const comment = unwrap(await postComment(t.deps, { projectCode: 'KD', variantId: s.variant.id, author: { kind: 'human', name: 'p' }, body: 'ターンが長い', source: 'cf-ui' }));
  const draft = {
    projectCode: 'KD',
    variantId: s.variant.id,
    destinationId: 'discord-kd',
    title: 'ターン短縮',
    brief: '10→8',
    task: 'shorter-turns',
    sourceCommentIds: [comment.id],
    requestedBy: 'dir',
  };
  return { ...t, s, comment, draft };
}

describe('implementation requests', () => {
  it('spawns at the preconfigured destination with the flow and source comments, then selects the flow', async () => {
    const { deps, gateways, draft, comment } = await setup();
    gateways.spawnOutcome = { kind: 'accepted', value: { sessionId: 'sess-9', runId: 'run-1' } };
    const r = unwrap(await requestImplementation(deps, draft));
    assert.equal(r.state, 'spawned');
    assert.equal(r.ccSessionId, 'sess-9');
    assert.deepEqual(gateways.calls.spawn[0]?.destination, { kind: 'discord', address: { guildId: 'g1', channelId: 'c1' } });
    assert.equal(gateways.calls.spawn[0]?.sourceComments[0]?.id, comment.id);
    assert.equal(gateways.calls.select[0]?.sessionId, 'sess-9');
    assert.equal(r.harnessSelection, 'not_connected');
  });

  it('refuses destinations that were not preconfigured', async () => {
    const { deps, draft } = await setup();
    const r = await requestImplementation(deps, { ...draft, destinationId: 'slack-x' });
    assert.equal(r.ok ? null : r.error.code, 'destination_not_configured');
  });

  it('an unknown spawn result is reconciled, not resent', async () => {
    const { deps, gateways, draft } = await setup();
    gateways.spawnOutcome = { kind: 'unknown', reason: 'timeout' };
    const first = unwrap(await requestImplementation(deps, draft));
    assert.equal(first.state, 'unknown');
    const again = unwrap(await requestImplementation(deps, draft));
    assert.equal(again.id, first.id);
    assert.equal(gateways.calls.spawn.length, 1);

    gateways.spawnLookup = { kind: 'found', sessionId: 'sess-late' };
    const reconciled = unwrap(await reconcileRequest(deps, { projectCode: 'KD', requestId: first.id, resendIfAbsent: true }));
    assert.equal(reconciled.state, 'spawned');
    assert.equal(gateways.calls.spawn.length, 1);
  });

  it('resends only after Cc confirms absence', async () => {
    const { deps, gateways, draft } = await setup();
    gateways.spawnOutcome = { kind: 'unknown', reason: 'timeout' };
    const first = unwrap(await requestImplementation(deps, draft));
    gateways.spawnLookup = { kind: 'unavailable', reason: 'no route' };
    assert.equal(unwrap(await reconcileRequest(deps, { projectCode: 'KD', requestId: first.id, resendIfAbsent: true })).state, 'unknown');
    gateways.spawnLookup = { kind: 'absent' };
    gateways.spawnOutcome = { kind: 'accepted', value: { sessionId: 's2' } };
    assert.equal(unwrap(await reconcileRequest(deps, { projectCode: 'KD', requestId: first.id, resendIfAbsent: true })).state, 'spawned');
    assert.equal(gateways.calls.spawn.length, 2);
  });

  it('an undeployed spawn route leaves the request not_sent', async () => {
    const { deps, draft } = await setup();
    const r = unwrap(await requestImplementation(deps, draft));
    assert.equal(r.state, 'not_sent');
    assert.equal(nextSpawnAction(r), 'send');
  });

  it('state machine: rejected needs a new request', () => {
    const base = { state: 'requested' } as Parameters<typeof applySpawnOutcome>[0];
    const rejected = applySpawnOutcome({ ...base, attempts: [] }, { kind: 'rejected', status: 400, detail: 'bad' }, 'now');
    assert.equal(nextSpawnAction(rejected), 'none');
  });
});
