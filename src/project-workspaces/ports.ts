import type { RegistryLookup } from './domain/flow-observation.ts';

/** Read-only view of Cc's project registry (`GET /v1/project-codes`). */
export interface CcProjectRegistry {
  lookup(ccProjectCode: string): Promise<RegistryLookup>;
}
