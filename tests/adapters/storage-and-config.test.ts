import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig } from '../../src/adapters/config/load-config.ts';
import { JsonFileDatabase, STATE_FILE } from '../../src/adapters/storage/json-file-database.ts';
import type { Tide } from '../../src/evolution-streams/domain/model.ts';

const tide: Tide = { id: 't1', projectCode: 'KD', slug: 'rush', title: '速攻', concept: 'c', createdAt: '2026-09-18T00:00:00.000Z' };

describe('json file database', () => {
  it('persists records and reloads them per project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'conflux-'));
    try {
      const db = await JsonFileDatabase.open(dir);
      await db.collection<Tide>('tides').put(tide);
      const reopened = await JsonFileDatabase.open(dir);
      assert.deepEqual(await reopened.collection<Tide>('tides').listByProject('KD'), [tide]);
      assert.deepEqual(await reopened.collection<Tide>('tides').listByProject('Mp'), []);
      assert.match(await readFile(join(dir, STATE_FILE), 'utf8'), /"version": 1/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('refuses a state file of an unknown format instead of starting empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'conflux-'));
    try {
      await writeFile(join(dir, STATE_FILE), JSON.stringify({ version: 99, collections: {} }), 'utf8');
      await assert.rejects(JsonFileDatabase.open(dir), /unsupported format/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('config', () => {
  const base = { CONFLUX_DATA_DIR: 'data', CONFLUX_HOST: '127.0.0.1', CONFLUX_PORT: '4300', CONFLUX_CC_URL: 'http://127.0.0.1:11111', CONFLUX_CC_TIMEOUT_MS: '5000' };

  it('fails fast on missing required values', () => {
    assert.throws(() => loadConfig({ ...base, CONFLUX_DATA_DIR: '' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, CONFLUX_PORT: 'x' }), ConfigError);
  });

  it('keeps undefined Cc routes undefined rather than guessing', () => {
    const c = loadConfig(base);
    assert.equal(c.ccSpawnPath, undefined);
    assert.equal(c.ccBuildPath, undefined);
    assert.equal(c.hookToken, undefined);
    assert.throws(() => loadConfig({ ...base, CONFLUX_CC_BUILD_PATH: 'no-slash' }), ConfigError);
    assert.throws(() => loadConfig({ ...base, CONFLUX_HOOK_TOKEN: 'short' }), ConfigError);
  });
});
