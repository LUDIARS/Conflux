import type { FlowSelection } from '../../flow-isolation/domain/selection.ts';
import type { CcHarnessGateway } from '../../flow-isolation/ports.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import type { CcHttpClient } from './cc-http-client.ts';
import { commandOutcome } from './status-mapping.ts';

export const HARNESS_SELECT_PATH = '/v1/harness/conflux/select';

/** Contract from Cc PR #1893: `{ session_id, selection: { projectCode, tide, variant, baseBranch, workBranch } }`. */
export class HttpCcHarnessGateway implements CcHarnessGateway {
  private readonly client: CcHttpClient;

  constructor(client: CcHttpClient) {
    this.client = client;
  }

  async select(sessionId: string, selection: FlowSelection): Promise<ExternalOutcome<{ readonly accepted: true }>> {
    const result = await this.client.request('POST', HARNESS_SELECT_PATH, {
      session_id: sessionId,
      selection: {
        projectCode: selection.projectCode,
        tide: selection.tide,
        variant: selection.variant,
        baseBranch: selection.baseBranch,
        workBranch: selection.workBranch,
      },
    });
    return commandOutcome(result, () => ({ accepted: true as const }));
  }
}
