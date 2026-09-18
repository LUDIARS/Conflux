import type { ExternalOutcome } from '../shared/external-outcome.ts';
import type { IdentityVerification } from './domain/deploy-authorization.ts';

export interface BuildRequestPayload {
  readonly dedupeKey: string;
  readonly ccProjectCode: string;
  readonly tide: string;
  readonly variant: string;
  readonly commit: string;
  readonly branch?: string;
  readonly platforms: readonly string[];
}

/** Asks the Cc hook layer to run a build. Cc owns the build execution. */
export interface BuildTriggerGateway {
  requestBuild(payload: BuildRequestPayload): Promise<ExternalOutcome<{ readonly accepted: true }>>;
}

/** Resolves who is calling and which roles Cc grants them. */
export interface CcIdentityGateway {
  verify(actorToken: string | undefined): Promise<IdentityVerification>;
}

export interface DeployPayload {
  readonly deploymentId: string;
  readonly environment: string;
  readonly artifactUri: string;
  readonly artifactSha256?: string;
}

export interface DeployGateway {
  deploy(payload: DeployPayload): Promise<ExternalOutcome<{ readonly accepted: true }>>;
}
