import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../../src/adapters/http/create-app.ts';
import type { HttpRequest } from '../../src/adapters/http/http-types.ts';
import { COMMIT_A, HOOK_TOKEN, testDeps } from '../support/fixtures.ts';
import { seedProject } from '../support/seed.ts';

function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): HttpRequest {
  const url = new URL(path, 'http://localhost');
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
  };
}

describe('http app', () => {
  it('renders the project graph page with the Cf Flow state as reported, not enabled', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const app = createApp(deps);
    const res = await app.handle(req('GET', `/projects/KD?variant=${s.variant.id}`));
    assert.equal(res.status, 200);
    assert.match(res.body, /<svg/);
    assert.match(res.body, /Cf Flow 状態不明/);
    assert.doesNotMatch(res.body, /Cf Flow 有効/);
    assert.match(res.body, /evolution\/rush\/combo\/main/);
  });

  it('escapes user text in the page', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const app = createApp(deps);
    await app.handle(req('POST', `/api/projects/KD/variants/${s.variant.id}/comments`, { author: 'p', body: '<script>x</script>' }));
    const res = await app.handle(req('GET', `/projects/KD?variant=${s.variant.id}`));
    assert.doesNotMatch(res.body, /<script>x/);
  });

  it('hook intake needs the shared token', async () => {
    const { deps } = testDeps();
    const s = await seedProject(deps);
    const app = createApp(deps);
    const event = { dedupeKey: 'k', projectCode: 'KD', variantId: s.variant.id, commit: COMMIT_A, seq: 1, state: 'running' };
    assert.equal((await app.handle(req('POST', '/api/hooks/build-events', event))).status, 401);
    assert.equal((await app.handle(req('POST', '/api/hooks/build-events', event, { authorization: `Bearer ${HOOK_TOKEN}` }))).status, 200);
  });

  it('deploy API denies callers Cc cannot verify', async () => {
    const { deps } = testDeps();
    await seedProject(deps);
    const app = createApp(deps);
    const res = await app.handle(req('POST', '/api/projects/KD/deployments', { artifactId: 'a', environment: 'staging', confirmArtifactId: 'a', confirmEnvironment: 'staging' }));
    assert.equal(res.status, 503);
  });

  it('bad JSON is a 400, unknown routes a 404', async () => {
    const { deps } = testDeps();
    await seedProject(deps);
    const app = createApp(deps);
    assert.equal((await app.handle(req('POST', '/api/projects/KD/tides', '{'))).status, 400);
    assert.equal((await app.handle(req('GET', '/nope'))).status, 404);
  });
});
