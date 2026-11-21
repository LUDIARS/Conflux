import { isDeepStrictEqual } from 'node:util';
import { queueStoredSignal, type SignalQueueDeps } from '../../cc-management-feed/application/signal-use-cases.ts';
import { playtestSignal } from '../../cc-management-feed/domain/outcome-signals.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import { serialByKey } from '../../shared/serial-by-key.ts';
import type { Build } from '../domain/model.ts';
import type { PlaytestResult } from '../domain/playtest-result.ts';

export interface PlaytestDeps {
  readonly builds: RecordStore<Build>;
  readonly playtestResults: RecordStore<PlaytestResult>;
}

// CC-MGMT-02 allows 200 characters for the complete `cf:playtest:` event key.
const RESULT_ID = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,187}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export async function recordPlaytestResult(deps: PlaytestDeps & SignalQueueDeps, input: PlaytestResult): Promise<Result<PlaytestResult>> {
  const summary = input.summary.trim();
  const at = Date.parse(input.observedAt);
  if (!RESULT_ID.test(input.id) || !summary || !UTC_TIMESTAMP.test(input.observedAt) || !Number.isFinite(at) || at < 0) {
    return fail('invalid_playtest_result', '試遊結果の ID・要約・観測時刻を確認してください');
  }
  const observedAt = new Date(at).toISOString();
  if (observedAt !== input.observedAt.replace(/(\d{2}:\d{2}:\d{2})Z$/, '$1.000Z')) {
    return fail('invalid_playtest_result', '試遊結果の観測時刻を確認してください');
  }
  const result = { ...input, summary, observedAt };
  return serialByKey(deps.playtestResults, result.id, async () => {
    const existing = await deps.playtestResults.get(result.id);
    if (existing && !isDeepStrictEqual(existing, result)) {
      return fail('playtest_result_conflict', 'この試遊結果 ID は別の記録に使用されています');
    }
    if (!existing) {
      const build = await deps.builds.get(result.buildId);
      if (!build || build.projectCode !== result.projectCode || build.variantId !== result.variantId
        || build.commit !== result.commit || build.state !== 'succeeded') {
        return fail('playtest_build_mismatch', '試遊結果の対象が成功したビルドの記録と一致しません');
      }
      await deps.playtestResults.put(result);
    }
    const saved = existing ?? result;
    await queueStoredSignal(deps, playtestSignal(saved));
    return ok(saved);
  });
}
