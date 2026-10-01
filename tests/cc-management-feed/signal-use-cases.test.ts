import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deliverDueSignals, queueFeedbackSignals } from '../../src/cc-management-feed/application/signal-use-cases.ts';
import { postComment } from '../../src/play-feedback/application/feedback-use-cases.ts';
import { testDeps } from '../support/fixtures.ts';
import { seedProject, unwrap } from '../support/seed.ts';

describe('management signal use cases', () => {
  it('queues a stored comment once and delivers it to Cc', async () => {
    const { deps, gateways } = testDeps();
    const s = await seedProject(deps);
    const comment = unwrap(await postComment(deps, { projectCode: 'KD', variantId: s.variant.id, author: { kind: 'human', name: 'p' }, body: '重い', source: 'cf-ui' }));
    await queueFeedbackSignals(deps, { comment });
    await queueFeedbackSignals(deps, { comment });
    assert.equal((await deps.signals.listAll()).length, 1);
    assert.equal(await deliverDueSignals(deps), 1);
    assert.equal(gateways.calls.management.length, 1);
    assert.equal(gateways.calls.management[0]?.origin, 'human');
    assert.equal((await deps.signals.listAll())[0]?.status, 'delivered');
    assert.equal(await deliverDueSignals(deps), 0);
  });

  it('keeps entries pending while Cc is unreachable', async () => {
    const { deps, gateways } = testDeps();
    gateways.managementOutcome = { kind: 'not_connected', reason: 'down' };
    const s = await seedProject(deps);
    const comment = unwrap(await postComment(deps, { projectCode: 'KD', variantId: s.variant.id, author: { kind: 'human', name: 'p' }, body: 'x', source: 'cf-ui' }));
    await queueFeedbackSignals(deps, { comment });
    await deliverDueSignals(deps);
    const [entry] = await deps.signals.listAll();
    assert.equal(entry?.status, 'pending');
    assert.equal(entry?.attempts, 1);
    assert.match(entry?.lastResult ?? '', /未接続/);
  });
});
