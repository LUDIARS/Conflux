import type { ManagementSignal } from '../../cc-management-feed/domain/model.ts';
import type { CcManagementEventsGateway } from '../../cc-management-feed/ports.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import type { CcHttpClient } from './cc-http-client.ts';
import { commandOutcome } from './status-mapping.ts';

/** Posts one Cf change to the Cc CDGD management feed (Cc PR #2218, deployed). */
export class HttpCcManagementEventsGateway implements CcManagementEventsGateway {
  private readonly client: CcHttpClient;
  private readonly path: string | undefined;

  constructor(client: CcHttpClient, path: string | undefined) {
    this.client = client;
    this.path = path;
  }

  async send(signal: ManagementSignal): Promise<ExternalOutcome<{ readonly created: boolean }>> {
    if (!this.path) return { kind: 'not_connected', reason: 'Cc の変更受付経路が無効 (CONFLUX_CC_MANAGEMENT_EVENTS_PATH=off)' };
    const result = await this.client.request('POST', this.path, {
      event_key: signal.eventKey,
      source: 'cf',
      kind: signal.kind,
      project_code: signal.projectCode,
      target_key: signal.targetKey,
      origin: signal.origin,
      summary: signal.summary,
      observed_at: Date.parse(signal.observedAt),
    });
    return commandOutcome(result, (body) => {
      const created = (body as { created?: unknown } | undefined)?.created;
      return typeof created === 'boolean' ? { created } : undefined;
    });
  }
}
