import type { DeployGateway, DeployPayload } from '../../playable-results/ports.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';

/**
 * Deploy targets and the execution mechanism are undecided (CF-DEPLOY-001). This gateway
 * is the only implementation until they are: it reports `not_connected` for every call,
 * so an authorised deploy is recorded honestly as "not executed".
 */
export class UnconfiguredDeployGateway implements DeployGateway {
  async deploy(payload: DeployPayload): Promise<ExternalOutcome<{ readonly accepted: true }>> {
    return { kind: 'not_connected', reason: `デプロイ先 ${payload.environment} の実行手段が未確定のため未実行` };
  }
}
