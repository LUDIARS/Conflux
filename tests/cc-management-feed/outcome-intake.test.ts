import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CcHttpClient } from '../../src/adapters/cc/cc-http-client.ts';
import { HttpCcManagementEventsGateway } from '../../src/adapters/cc/cc-management-events-gateway.ts';
import { createApp } from '../../src/adapters/http/create-app.ts';
import type { HttpRequest } from '../../src/adapters/http/http-types.ts';
import { deliverDueSignals } from '../../src/cc-management-feed/application/signal-use-cases.ts';
import { COMMIT_A, COMMIT_B, HOOK_TOKEN, testDeps } from '../support/fixtures.ts';
import { seedProject } from '../support/seed.ts';

function post(path: string, data: object | URLSearchParams, token?: string): HttpRequest {
  return {
    method: 'POST', path, query: new URLSearchParams(),
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: data instanceof URLSearchParams ? data.toString() : JSON.stringify(data),
  };
}

const observedAt = '2026-11-21T05:34:03.000Z';

describe('management feed outcome intake', () => {
  it('delivers saved decisions, terminal builds and playtest outcomes through the Cc event contract', async () => {
    const { deps } = testDeps();
    const { variant } = await seedProject(deps, { settings: { ccProjectCode: 'ENGINE' } });
    const target = { projectCode: 'KD', variantId: variant.id, commit: COMMIT_A };
    const app = createApp(deps);
    const hook = { ...target, dedupeKey: 'game-build' };
    const publishBuild = (event: object) => app.handle(post('/api/hooks/build-events', { ...hook, ...event }, HOOK_TOKEN));

    assert.equal((await publishBuild({ seq: 1, state: 'running' })).status, 200);
    assert.equal((await deps.signals.listAll()).length, 0);
    const done = { seq: 2, state: 'succeeded', artifacts: [{ platform: 'web', delivery: 'download', uri: 'https://example.test/game' }] };
    const [built, replay] = await Promise.all([publishBuild(done), publishBuild(done)]);
    assert.equal(built.status, 200);
    assert.equal(replay.status, 200);
    assert.equal((await deps.artifacts.listAll()).length, 1);
    const buildId = JSON.parse(built.body).build.id as string;

    const decision = { variantId: variant.id, verdict: 'adopted', reason: `改善\n${'あ'.repeat(2100)}`, decidedBy: 'director', commit: COMMIT_A };
    assert.equal((await app.handle(post('/api/projects/KD/decisions', decision))).status, 201);
    const decline = new URLSearchParams({ variantId: variant.id, verdict: 'declined', reason: '見送り', decidedBy: 'director' });
    assert.equal((await app.handle(post('/projects/KD/decisions', decline))).status, 303);

    const report = { ...target, id: 'session-41', buildId, origin: 'ai', summary: '後半で難度が上がった', observedAt };
    const playtestPath = '/api/hooks/playtest-results';
    assert.equal((await app.handle(post(playtestPath, report))).status, 401);
    assert.equal((await app.handle(post(playtestPath, { ...report, commit: COMMIT_B }, HOOK_TOKEN))).status, 422);
    assert.equal((await app.handle(post(playtestPath, { ...report, observedAt: 'tomorrow' }, HOOK_TOKEN))).status, 422);
    const submit = (data: object) => app.handle(post(playtestPath, data, HOOK_TOKEN));
    const duplicate = await Promise.all([submit(report), submit(report)]);
    assert.deepEqual(duplicate.map((res) => res.status), [200, 200]);
    assert.equal((await submit({ ...report, summary: 'changed' })).status, 409);
    assert.equal((await deps.playtestResults.listAll()).length, 1);

    const sent: Record<string, unknown>[] = [];
    const gateway = new HttpCcManagementEventsGateway(new CcHttpClient({
      baseUrl: 'http://cc.example.test', timeoutMs: 1000,
      fetchImpl: async (url, init) => {
        assert.equal(String(url), 'http://cc.example.test/v1/management/events');
        assert.equal(init?.method, 'POST');
        sent.push(JSON.parse(String(init?.body)));
        return Response.json({ created: true });
      },
    }), '/v1/management/events');
    assert.equal(await deliverDueSignals({ ...deps, managementEvents: gateway }), 4);
    assert.deepEqual(sent.map((e) => [e.kind, e.origin]), [
      ['build', 'system'], ['adoption', 'human'], ['adoption', 'human'], ['playtest', 'ai'],
    ]);
    for (const event of sent) {
      assert.equal(event.source, 'cf');
      assert.equal(event.project_code, 'KD');
      assert.equal(event.target_key, `variant/${variant.id}`);
    }
    assert.equal(sent[0]?.event_key, `cf:build:${buildId}`);
    assert.match(String(sent[0]?.summary), /^succeeded /);
    assert.equal(String(sent[1]?.summary).length, 2000);
    assert.match(String(sent[1]?.summary), /^adopted 改善 あ/);
    assert.equal(sent[3]?.event_key, `cf:playtest:${report.id}`);
    assert.equal(sent[3]?.observed_at, Date.parse(observedAt));
    assert.match(String(sent[3]?.summary), /後半で難度が上がった$/);
    assert.equal(await deliverDueSignals({ ...deps, managementEvents: gateway }), 0);
    assert.equal((await publishBuild(done)).status, 200);
    assert.equal((await submit(report)).status, 200);
    assert.equal(await deliverDueSignals({ ...deps, managementEvents: gateway }), 0);
  });

  it('preserves successful saves when enqueue fails and queues nothing when the source save fails', async () => {
    const { deps } = testDeps();
    const { variant } = await seedProject(deps);
    const target = { projectCode: 'KD', variantId: variant.id, commit: COMMIT_A };
    const event = { ...target, dedupeKey: 'failed-build', seq: 1, state: 'failed', failureSummary: 'コンパイル失敗' };
    const decision = { variantId: variant.id, verdict: 'declined', reason: '冗長', decidedBy: 'director' };
    const failPut = async () => { throw new Error('write failed'); };
    const brokenSave = createApp({ ...deps, builds: Object.assign(Object.create(deps.builds), { put: failPut }) });
    await assert.rejects(brokenSave.handle(post('/api/hooks/build-events', event, HOOK_TOKEN)), /write failed/);
    assert.equal((await deps.signals.listAll()).length, 0);

    const brokenOutbox = createApp({ ...deps, signals: Object.assign(Object.create(deps.signals), { put: failPut }) });
    assert.equal((await brokenOutbox.handle(post('/api/projects/KD/decisions', decision))).status, 201);
    assert.equal((await brokenOutbox.handle(post('/api/hooks/build-events', event, HOOK_TOKEN))).status, 200);
    assert.equal((await deps.decisions.listAll()).length, 1);
    assert.equal((await deps.builds.listAll())[0]?.state, 'failed');

    const app = createApp(deps);
    const playable = await app.handle(post('/api/hooks/build-events', { ...event, dedupeKey: 'playable', state: 'succeeded' }, HOOK_TOKEN));
    const report = { ...target, id: 'human-17', buildId: JSON.parse(playable.body).build.id, origin: 'human', summary: '試遊完了', observedAt };
    const brokenResultSave = createApp({ ...deps, playtestResults: Object.assign(Object.create(deps.playtestResults), { put: failPut }) });
    await assert.rejects(brokenResultSave.handle(post('/api/hooks/playtest-results', report, HOOK_TOKEN)), /write failed/);
    assert.equal(await deps.signals.get(`cf:playtest:${report.id}`), undefined);
    assert.equal((await brokenOutbox.handle(post('/api/hooks/playtest-results', report, HOOK_TOKEN))).status, 200);
    assert.equal((await deps.playtestResults.listAll()).length, 1);
    assert.equal(await deps.signals.get(`cf:playtest:${report.id}`), undefined);
    assert.equal((await app.handle(post('/api/hooks/playtest-results', report, HOOK_TOKEN))).status, 200);
    assert.equal((await deps.signals.get(`cf:playtest:${report.id}`))?.signal.origin, 'human');
  });
});
