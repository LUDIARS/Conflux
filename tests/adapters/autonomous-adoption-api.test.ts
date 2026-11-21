import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createApp } from '../../src/adapters/http/create-app.ts';
import type { HttpRequest } from '../../src/adapters/http/http-types.ts';
import { deliverDueSignals } from '../../src/cc-management-feed/application/signal-use-cases.ts';
import { recordRevision } from '../../src/evolution-streams/application/flow-use-cases.ts';
import { loadProjectOverview } from '../../src/evolution-streams/application/project-overview.ts';
import { rateVariant } from '../../src/play-feedback/application/feedback-use-cases.ts';
import { COMMIT_A, COMMIT_B, HOOK_TOKEN, testDeps } from '../support/fixtures.ts';
import { seedPlayableBuild, seedProject, unwrap } from '../support/seed.ts';

const policyPath = '/api/projects/KD/autonomous-adoption/policy';
const statusPath = '/api/projects/KD/autonomous-adoption';
const proposalPath = '/api/hooks/proposals';
const playtestPath = '/api/hooks/playtest-results';
const evaluatePath = (id: string) => `/api/projects/KD/variants/${id}/auto-evaluate`;
const proposal = {
  projectCode: 'KD', proposalId: 'discutere-1', title: 'Improve controls', summary: 'Add a buffer',
  origin: 'ai', evidence: ['discussion-42'],
};

function request(method: string, path: string, body?: object, token = HOOK_TOKEN): HttpRequest {
  return {
    method, path, query: new URLSearchParams(),
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

it('protects proposal, policy, evaluation and status routes with the existing hook token', async () => {
  const { deps } = testDeps();
  const app = createApp(deps);
  const closed = createApp({ ...deps, hookToken: undefined });
  for (const [method, path] of [
    ['POST', proposalPath], ['PUT', policyPath], ['POST', evaluatePath('variant')], ['GET', statusPath],
  ] as const) {
    assert.equal((await app.handle(request(method, path, undefined, ''))).status, 401);
    assert.equal((await app.handle(request(method, path, undefined, 'wrong'))).status, 401);
    assert.equal((await closed.handle(request(method, path))).status, 503);
  }
});

it('creates a tide and a variant once and serializes concurrent proposals competing for capacity', async () => {
  const { deps } = testDeps();
  const seeded = await seedProject(deps);
  const app = createApp(deps);
  const handle = (method: string, path: string, body?: object) => app.handle(request(method, path, body));
  assert.equal((await handle('PUT', policyPath, { maxActiveVariants: 2 })).status, 200);
  const [first, overLimit, replay] = await Promise.all([
    handle('POST', proposalPath, proposal),
    handle('POST', proposalPath, { ...proposal, proposalId: 'discutere-2', targetTide: 'other' }),
    handle('POST', proposalPath, proposal),
  ]);
  assert.deepEqual([first.status, overLimit.status, replay.status], [201, 409, 200]);
  assert.equal(JSON.parse(overLimit.body).error, 'variant_capacity_reached');
  const created = JSON.parse(first.body);
  assert.equal(created.tide.slug, 'proposals');
  assert.deepEqual(created.variant.proposal, { id: proposal.proposalId, origin: 'ai', evidence: proposal.evidence });
  assert.equal(JSON.parse(replay.body).variant.id, created.variant.id);
  assert.deepEqual((await deps.tides.listByProject('KD')).map((tide) => tide.slug), ['rush', 'proposals']);

  assert.equal((await handle('POST', '/api/projects/KD/decisions', {
    variantId: seeded.variant.id, verdict: 'declined', reason: 'Review complete', decidedBy: 'director',
  })).status, 201);
  const retried = await handle('POST', proposalPath, { ...proposal, proposalId: 'discutere-2', targetTide: 'rush' });
  assert.equal(retried.status, 201);
  assert.equal(JSON.parse(retried.body).tide.id, seeded.tide.id);
  const status = JSON.parse((await handle('GET', statusPath)).body);
  assert.equal(status.activeCount, 2);
  assert.deepEqual(status.proposals.map((entry: { proposalId: string }) => entry.proposalId), ['discutere-1', 'discutere-2']);
});

it('records auditable, idempotent automatic decisions and lets a human override them', async () => {
  const { deps, gateways } = testDeps();
  const seeded = await seedProject(deps, { settings: { ccProjectCode: 'ENGINE' } });
  const variantId = seeded.variant.id;
  const app = createApp(deps);
  const handle = (method: string, path: string, body?: object) => app.handle(request(method, path, body));
  const evaluate = async () => {
    const response = await handle('POST', evaluatePath(variantId));
    assert.equal(response.status, 200);
    return JSON.parse(response.body);
  };
  assert.deepEqual(await evaluate(), { kind: 'disabled' });
  assert.equal((await handle('PUT', policyPath, { enabled: true, minPlaytests: 1, minRatings: 1 })).status, 200);
  const oldBuild = await seedPlayableBuild(deps, seeded, COMMIT_B);
  unwrap(await recordRevision(deps, {
    projectCode: 'KD', variantId, intent: 'Test the change', summary: '', ruleChanges: [],
    gitRef: { branch: 'evolution/rush/combo/main', commit: COMMIT_A },
  }));
  const failed = await handle('POST', '/api/hooks/build-events', {
    projectCode: 'KD', variantId, commit: COMMIT_A, dedupeKey: 'failed-target', seq: 1, state: 'failed',
  });
  assert.equal(failed.status, 200);
  const firstHold = (await evaluate()).decision;
  assert.equal(firstHold.verdict, 'held');
  assert.match(firstHold.reason, /failed/);

  const build = await seedPlayableBuild(deps, seeded, COMMIT_A);
  const recordTrial = (id: string, buildId: string, commit: string, measurement: object) => handle('POST', playtestPath, {
    id, projectCode: 'KD', variantId, buildId, commit, origin: 'human', summary: 'Played',
    observedAt: '2026-11-21T05:34:03.000Z', ...measurement,
  });
  const rate = (buildId: string) => rateVariant(deps, {
    projectCode: 'KD', variantId, playedBuildId: buildId, rater: 'tester', scores: { fun: 4, fit: 4 },
  });
  assert.equal((await recordTrial('past', oldBuild.id, COMMIT_B, { outcome: 'passed', criticalBug: false })).status, 200);
  unwrap(await rate(oldBuild.id));
  assert.equal((await recordTrial('legacy', build.id, COMMIT_A, {})).status, 200);
  assert.equal((await recordTrial('incomplete', build.id, COMMIT_A, { outcome: 'passed' })).status, 400);
  const evidenceHold = (await evaluate()).decision;
  assert.equal(evidenceHold.verdict, 'held');
  assert.notEqual(evidenceHold.id, firstHold.id);
  assert.equal((await evaluate()).decision.id, evidenceHold.id);

  assert.equal((await recordTrial('current', build.id, COMMIT_A, { outcome: 'passed', criticalBug: false })).status, 200);
  const rating = unwrap(await rate(build.id));
  const [adopted, repeated] = await Promise.all([evaluate(), evaluate()]);
  assert.equal(adopted.kind, 'automatic');
  assert.equal(adopted.decision.id, repeated.decision.id);
  assert.equal(adopted.decision.verdict, 'adopted');
  assert.equal(adopted.decision.origin, 'system');
  assert.equal(adopted.decision.target.buildId, build.id);
  assert.equal(adopted.decision.target.commit, COMMIT_A);
  assert.equal(adopted.decision.integration.state, 'awaiting');
  assert.deepEqual(adopted.decision.automation.playtestIds, ['current']);
  assert.deepEqual(adopted.decision.automation.ratingIds, [rating.id]);
  assert.match(adopted.decision.reason, /採用基準/);

  const manual = await handle('POST', '/api/projects/KD/decisions', {
    variantId, verdict: 'declined', reason: 'Director override', decidedBy: 'director',
  });
  assert.equal(manual.status, 201);
  assert.deepEqual(await evaluate(), { kind: 'manual', decision: JSON.parse(manual.body) });
  assert.equal((await deps.decisions.listByProject('KD')).length, 4);
  assert.deepEqual(unwrap(await loadProjectOverview(deps, 'KD', variantId)).official, []);
  await deliverDueSignals(deps);
  const delivered = gateways.calls.management.filter((signal) => signal.kind === 'adoption');
  assert.deepEqual(delivered.map((signal) => [signal.origin, signal.projectCode]), [
    ['system', 'KD'], ['system', 'KD'], ['system', 'KD'], ['human', 'KD'],
  ]);
});

it('repairs a missing adoption outbox entry on retry without recording a second decision', async () => {
  const { deps } = testDeps();
  const { variant } = await seedProject(deps);
  const app = createApp(deps);
  assert.equal((await app.handle(request('PUT', policyPath, { enabled: true }))).status, 200);
  const brokenOutbox = createApp({ ...deps, signals: Object.assign(Object.create(deps.signals), {
    put: async () => { throw new Error('outbox unavailable'); },
  }) });
  const evaluation = request('POST', evaluatePath(variant.id));
  await assert.rejects(brokenOutbox.handle(evaluation), /outbox unavailable/);
  const [saved] = await deps.decisions.listByProject('KD');
  assert.ok(saved);
  assert.equal((await deps.signals.listAll()).length, 0);
  const retried = await app.handle(evaluation);
  assert.equal(retried.status, 200);
  assert.equal(JSON.parse(retried.body).decision.id, saved.id);
  assert.equal((await deps.decisions.listByProject('KD')).length, 1);
  assert.equal((await deps.signals.get(`cf:adoption:${saved.id}`))?.signal.origin, 'system');
});
