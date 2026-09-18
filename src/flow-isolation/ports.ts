import type { ExternalOutcome } from '../shared/external-outcome.ts';
import type { FlowSelection } from './domain/selection.ts';

/** `POST /v1/harness/conflux/select` on Cc (PR #1893, not deployed yet). */
export interface CcHarnessGateway {
  select(sessionId: string, selection: FlowSelection): Promise<ExternalOutcome<{ readonly accepted: true }>>;
}
