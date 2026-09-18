import type { FlowSelection } from '../flow-isolation/domain/selection.ts';
import type { SpawnDestination } from '../project-workspaces/domain/model.ts';
import type { ExternalOutcome } from '../shared/external-outcome.ts';
import type { SpawnAccepted, SpawnLookup } from './domain/model.ts';

export interface SpawnPayload {
  readonly idempotencyKey: string;
  readonly ccProjectCode: string;
  readonly destination: Pick<SpawnDestination, 'kind' | 'address'>;
  readonly selection: FlowSelection;
  readonly title: string;
  readonly brief: string;
  readonly requestedBy: string;
  readonly sourceComments: readonly { readonly id: string; readonly author: string; readonly body: string }[];
}

/** Cc spawn route. Its Cc-side API is not defined yet (see spec/architecture/cc-integration.md). */
export interface CcSpawnGateway {
  spawn(payload: SpawnPayload): Promise<ExternalOutcome<SpawnAccepted>>;
  lookup(idempotencyKey: string): Promise<SpawnLookup>;
}
