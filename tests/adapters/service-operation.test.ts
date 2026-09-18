import assert from 'node:assert/strict';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import admitWebRequestContract from '../../contracts/admit-web-request.contract.ts';
import describeHealthContract from '../../contracts/describe-health.contract.ts';
import resolveCcBaseUrlContract from '../../contracts/resolve-cc-base-url.contract.ts';
import { resolveCcBaseUrl } from '../../src/adapters/config/cc-url.ts';
import { ConfigError, loadConfig } from '../../src/adapters/config/load-config.ts';
import { buildWebAccess, parseAllowedHosts } from '../../src/adapters/config/web-access.ts';
import { describeHealth, registerHealthRoute } from '../../src/adapters/http/health.ts';
import { admitWebRequest, matchesHost } from '../../src/adapters/http/host-origin-guard.ts';
import { createNodeServer } from '../../src/adapters/http/node-server.ts';
import { Router } from '../../src/adapters/http/router.ts';

const base = { CONFLUX_DATA_DIR: 'data', CONFLUX_HOST: '127.0.0.1', CONFLUX_PORT: '4350', CONFLUX_CC_TIMEOUT_MS: '5000' };
const CC = 'http://localhost:11111';

describe('Cc URL resolution (C-16)', () => {
  it('uses the Excubitor-injected CONCORDIA_URL when CONFLUX_CC_URL is absent', () => {
    const env = { ...base, CONCORDIA_URL: CC };
    const url = resolveCcBaseUrl(env);
    assert.equal(url, CC);
    assert.equal(resolveCcBaseUrlContract.post(url, env), true);
    assert.equal(loadConfig(env).ccBaseUrl, CC);
  });

  it('prefers an explicit CONFLUX_CC_URL over CONCORDIA_URL', () => {
    const env = { ...base, CONFLUX_CC_URL: 'http://127.0.0.1:12000/', CONCORDIA_URL: CC };
    const url = resolveCcBaseUrl(env);
    assert.equal(url, 'http://127.0.0.1:12000');
    assert.equal(resolveCcBaseUrlContract.post(url, env), true);
  });

  it('fails fast when neither is set or the value is not http(s)', () => {
    assert.throws(() => loadConfig(base), ConfigError);
    assert.throws(() => loadConfig({ ...base, CONCORDIA_URL: 'redis://127.0.0.1:6379' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, CONFLUX_CC_URL: '   ', CONCORDIA_URL: '' }), ConfigError);
  });
});

describe('loopback listening and web access config', () => {
  it('refuses a non-loopback listen host', () => {
    assert.throws(() => loadConfig({ ...base, CONCORDIA_URL: CC, CONFLUX_HOST: '0.0.0.0' }), ConfigError);
    assert.equal(loadConfig({ ...base, CONCORDIA_URL: CC, CONFLUX_HOST: 'localhost' }).host, 'localhost');
  });

  it('accepts the own loopback authorities and LUDIARS_ALLOWED_HOSTS', () => {
    const { access } = loadConfig({ ...base, CONCORDIA_URL: CC, LUDIARS_ALLOWED_HOSTS: ' .Example.test ,box.local ' });
    assert.ok(access.hosts.has('127.0.0.1:4350'));
    assert.ok(access.hosts.has('localhost:4350'));
    assert.ok(access.hosts.has('.example.test'));
    assert.ok(access.origins.has('http://127.0.0.1:4350'));
    assert.ok(!access.origins.has('https://example.test'), 'a Host domain allowance is not an Origin allowance');
  });

  it('rejects malformed allowed hosts and viewer origins instead of widening access', () => {
    for (const bad of ['*', 'http://x.test', 'user@x.test', 'x.test/path']) {
      assert.throws(() => parseAllowedHosts(bad));
      assert.throws(() => loadConfig({ ...base, CONCORDIA_URL: CC, LUDIARS_ALLOWED_HOSTS: bad }), ConfigError);
    }
    assert.throws(() => loadConfig({ ...base, CONCORDIA_URL: CC, CONFLUX_VIEWER_ORIGINS: 'http://127.0.0.1:17334/app' }), ConfigError);
    assert.ok(loadConfig({ ...base, CONCORDIA_URL: CC, CONFLUX_VIEWER_ORIGINS: 'http://127.0.0.1:17334' }).access.origins.has('http://127.0.0.1:17334'));
  });
});

describe('Host / Origin guard (C-17)', () => {
  const access = buildWebAccess(4350, '.example.test', undefined);

  it('matches the leading-dot domain and its subdomains only', () => {
    assert.ok(matchesHost('example.test', access.hosts));
    assert.ok(matchesHost('a.example.test:443', access.hosts));
    assert.ok(!matchesHost('badexample.test', access.hosts));
    assert.ok(!matchesHost('example.test.evil.test', access.hosts));
    assert.ok(!matchesHost('127.0.0.1:9999', access.hosts));
    assert.ok(!matchesHost(undefined, access.hosts));
  });

  const cases: ReadonlyArray<readonly [Record<string, string | undefined>, number | undefined]> = [
    [{ host: '127.0.0.1:4350' }, undefined],
    [{ host: 'localhost:4350', origin: 'http://localhost:4350' }, undefined],
    [{ host: 'evil.test' }, 403],
    [{ host: 'localhost:4350', origin: 'https://evil.test' }, 403],
    [{ host: 'localhost:4350', origin: 'https://a.example.test' }, 403],
    [{}, 403],
  ];
  for (const [headers, status] of cases) {
    it(`host=${headers['host'] ?? '-'} origin=${headers['origin'] ?? '-'} → ${status ?? 'admitted'}`, () => {
      const refusal = admitWebRequest(headers, access);
      assert.equal(refusal?.status, status);
      assert.equal(admitWebRequestContract.post(refusal, headers, access), true);
    });
  }
});

describe('health (C-18)', () => {
  it('reports liveness without claiming Cc is connected', () => {
    const config = loadConfig({ ...base, CONCORDIA_URL: CC });
    const report = describeHealth(config, '2026-09-18T00:00:00.000Z');
    assert.equal(report.status, 'alive');
    assert.equal(report.cc.reachability, 'not_checked');
    assert.deepEqual(report.capabilities, {
      spawn: 'not_connected', spawnLookup: 'not_connected', build: 'not_connected', identity: 'not_connected', hookIntake: 'not_connected', deploy: 'not_connected',
    });
    assert.equal(describeHealthContract.post(report, config), true);
  });

  it('marks only configured routes as configured and never echoes the hook token', () => {
    const token = 'x'.repeat(40);
    const config = loadConfig({ ...base, CONCORDIA_URL: CC, CONFLUX_CC_BUILD_PATH: '/v1/cf/builds', CONFLUX_HOOK_TOKEN: token });
    const report = describeHealth(config, '2026-09-18T00:00:00.000Z');
    assert.equal(report.capabilities.build, 'configured');
    assert.equal(report.capabilities.hookIntake, 'configured');
    assert.equal(report.capabilities.spawn, 'not_connected');
    assert.doesNotMatch(JSON.stringify(report), new RegExp(token));
    assert.equal(describeHealthContract.post(report, config), true);
  });
});

function get(port: number, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path: '/health', method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('node server admission', () => {
  it('serves /health to an allowed Host and refuses an unknown Host before routing', async () => {
    const config = loadConfig({ ...base, CONCORDIA_URL: CC, CONFLUX_PORT: '4350' });
    const router = registerHealthRoute(new Router(), describeHealth(config, '2026-09-18T00:00:00.000Z'));
    const server = createNodeServer(router, config.access, () => {});
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const ok = await get(port, { host: '127.0.0.1:4350' });
      assert.equal(ok.status, 200);
      assert.equal(JSON.parse(ok.body).status, 'alive');
      assert.equal((await get(port, { host: 'rebind.evil.test' })).status, 403);
      assert.equal((await get(port, { host: '127.0.0.1:4350', origin: 'https://evil.test' })).status, 403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
