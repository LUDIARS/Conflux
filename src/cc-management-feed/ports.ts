import type { ExternalOutcome } from '../shared/external-outcome.ts';
import type { ManagementSignal } from './domain/model.ts';

/** Cc `POST /v1/management/events` (Cc spec/feature/cdgd-management.md CC-MGMT-02). */
export interface CcManagementEventsGateway {
  send(signal: ManagementSignal): Promise<ExternalOutcome<{ readonly created: boolean }>>;
}
