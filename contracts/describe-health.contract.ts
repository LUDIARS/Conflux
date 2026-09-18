import type { describeHealth } from '../src/adapters/http/health.ts';
import type { ContractOf } from './contract-types.ts';

/** C-18: health reports liveness only; unconfigured Cc routes stay not_connected and Cc is not claimed reachable. */
export default {
  post: (report, config) => {
    if (report.status !== 'alive' || report.cc.reachability !== 'not_checked') return 'health claims more than liveness';
    const routes: ReadonlyArray<readonly [string | undefined, string]> = [
      [config.ccSpawnPath, report.capabilities.spawn],
      [config.ccSpawnLookupPath, report.capabilities.spawnLookup],
      [config.ccBuildPath, report.capabilities.build],
      [config.ccIdentityPath, report.capabilities.identity],
      [config.hookToken, report.capabilities.hookIntake],
    ];
    for (const [value, state] of routes) {
      if (state !== (value ? 'configured' : 'not_connected')) return 'capability state does not follow its configuration';
    }
    if (report.capabilities.deploy !== 'not_connected') return 'deploy reported as connected';
    if (JSON.stringify(report).includes(config.ccBaseUrl) || (config.hookToken && JSON.stringify(report).includes(config.hookToken))) {
      return 'health exposes Cc URL or hook token';
    }
    return true;
  },
} satisfies ContractOf<typeof describeHealth>;
