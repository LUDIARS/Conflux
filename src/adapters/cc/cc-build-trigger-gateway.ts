import type { BuildRequestPayload, BuildTriggerGateway } from '../../playable-results/ports.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import type { CcHttpClient } from './cc-http-client.ts';
import { commandOutcome } from './status-mapping.ts';

/** Asks the Cc hook layer to build. The Cc route is not defined yet (remaining work). */
export class HttpCcBuildTriggerGateway implements BuildTriggerGateway {
  private readonly client: CcHttpClient;
  private readonly buildPath: string | undefined;

  constructor(client: CcHttpClient, buildPath: string | undefined) {
    this.client = client;
    this.buildPath = buildPath;
  }

  async requestBuild(payload: BuildRequestPayload): Promise<ExternalOutcome<{ readonly accepted: true }>> {
    if (!this.buildPath) return { kind: 'not_connected', reason: 'Cc のビルド要求経路が未定義 (CONFLUX_CC_BUILD_PATH 未設定)' };
    const result = await this.client.request('POST', this.buildPath, {
      dedupe_key: payload.dedupeKey,
      project_code: payload.ccProjectCode,
      tide: payload.tide,
      variant: payload.variant,
      commit: payload.commit,
      ...(payload.branch ? { branch: payload.branch } : {}),
      platforms: payload.platforms,
    });
    return commandOutcome(result, () => ({ accepted: true as const }));
  }
}
