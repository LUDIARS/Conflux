import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpCcBuildTriggerGateway } from '../../src/adapters/cc/cc-build-trigger-gateway.ts';
import { HARNESS_SELECT_PATH, HttpCcHarnessGateway } from '../../src/adapters/cc/cc-harness-gateway.ts';
import { CcHttpClient, type FetchLike } from '../../src/adapters/cc/cc-http-client.ts';
import { HttpCcIdentityGateway } from '../../src/adapters/cc/cc-identity-gateway.ts';
import { HttpCcProjectRegistry } from '../../src/adapters/cc/cc-project-registry.ts';
import { HttpCcSpawnGateway } from '../../src/adapters/cc/cc-spawn-gateway.ts';

interface Sent {
  url: string;
  method: string;
  body?: string;
}

function client(respond: (sent: Sent) => { status: number; body?: unknown } | Error): { client: CcHttpClient; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const s: Sent = { url, method: init.method, ...(init.body !== undefined ? { body: init.body } : {}) };
    sent.push(s);
    const r = respond(s);
    if (r instanceof Error) throw r;
    return { status: r.status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
  };
  return { client: new CcHttpClient({ baseUrl: 'http://cc.test/', fetchImpl, timeoutMs: 1000 }), sent };
}

function refused(): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
}

const selection = { projectCode: 'KD', tide: 'rush', variant: 'combo', baseBranch: 'evolution/rush/combo/main', workBranch: 'feature/rush/combo/x' };

describe('harness gateway', () => {
  it('posts the PR #1893 contract body', async () => {
    const c = client(() => ({ status: 200, body: { ok: true } }));
    const r = await new HttpCcHarnessGateway(c.client).select('sess-1', selection);
    assert.equal(r.kind, 'accepted');
    assert.equal(c.sent[0]?.url, `http://cc.test${HARNESS_SELECT_PATH}`);
    assert.deepEqual(JSON.parse(c.sent[0]?.body ?? '{}'), { session_id: 'sess-1', selection });
  });

  it('404 and connection refusal are not_connected; 5xx is unknown; 4xx rejected', async () => {
    assert.equal((await new HttpCcHarnessGateway(client(() => ({ status: 404 })).client).select('s', selection)).kind, 'not_connected');
    assert.equal((await new HttpCcHarnessGateway(client(() => refused()).client).select('s', selection)).kind, 'not_connected');
    assert.equal((await new HttpCcHarnessGateway(client(() => ({ status: 503 })).client).select('s', selection)).kind, 'unknown');
    assert.equal((await new HttpCcHarnessGateway(client(() => ({ status: 409, body: { error: 'mismatch' } })).client).select('s', selection)).kind, 'rejected');
  });
});

describe('project registry', () => {
  it('distinguishes an absent conflux_flow field from false', async () => {
    const without = await new HttpCcProjectRegistry(client(() => ({ status: 200, body: [{ code: 'KD', workflow: 'revisor' }] })).client).lookup('KD');
    assert.deepEqual(without, { kind: 'found', hasConfluxFlowField: false, confluxFlow: undefined });
    const withFalse = await new HttpCcProjectRegistry(client(() => ({ status: 200, body: { project_codes: [{ code: 'KD', conflux_flow: false }] } })).client).lookup('KD');
    assert.deepEqual(withFalse, { kind: 'found', hasConfluxFlowField: true, confluxFlow: false });
    const shape = await new HttpCcProjectRegistry(client(() => ({ status: 200, body: { weird: 1 } })).client).lookup('KD');
    assert.equal(shape.kind, 'unknown');
  });
});

describe('routes Cc has not defined yet', () => {
  it('report not_connected / unavailable without sending anything', async () => {
    const c = client(() => ({ status: 200, body: {} }));
    assert.equal((await new HttpCcSpawnGateway(c.client, {}).lookup('k')).kind, 'unavailable');
    const spawn = await new HttpCcSpawnGateway(c.client, {}).spawn({
      idempotencyKey: 'k',
      ccProjectCode: 'KD',
      destination: { kind: 'discord', address: {} },
      selection,
      title: 't',
      brief: 'b',
      requestedBy: 'r',
      sourceComments: [],
    });
    assert.equal(spawn.kind, 'not_connected');
    assert.equal((await new HttpCcBuildTriggerGateway(c.client, undefined).requestBuild({ dedupeKey: 'k', ccProjectCode: 'KD', tide: 'a', variant: 'b', commit: 'c', platforms: [] })).kind, 'not_connected');
    assert.equal((await new HttpCcIdentityGateway(c.client, undefined).verify('t')).status, 'unavailable');
    assert.equal(c.sent.length, 0);
  });

  it('a spawn 2xx without session_id is unknown, not success', async () => {
    const c = client(() => ({ status: 200, body: {} }));
    const r = await new HttpCcSpawnGateway(c.client, { spawnPath: '/v1/x' }).spawn({
      idempotencyKey: 'k',
      ccProjectCode: 'KD',
      destination: { kind: 'discord', address: {} },
      selection,
      title: 't',
      brief: 'b',
      requestedBy: 'r',
      sourceComments: [],
    });
    assert.equal(r.kind, 'unknown');
  });
});
