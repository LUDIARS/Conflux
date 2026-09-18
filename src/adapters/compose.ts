import type { AdoptionDecision } from '../adoption-decisions/domain/model.ts';
import type { Revision, Tide, Variant } from '../evolution-streams/domain/model.ts';
import type { SelectionRecord } from '../flow-isolation/domain/selection-record.ts';
import type { ImplementationRequest } from '../implementation-requests/domain/model.ts';
import type { Comment, Rating } from '../play-feedback/domain/model.ts';
import type { Artifact, Build, Deployment } from '../playable-results/domain/model.ts';
import type { ProjectWorkspace } from '../project-workspaces/domain/model.ts';
import type { CcProjectRegistry } from '../project-workspaces/ports.ts';
import type { CcHarnessGateway } from '../flow-isolation/ports.ts';
import type { CcSpawnGateway } from '../implementation-requests/ports.ts';
import type { BuildTriggerGateway, CcIdentityGateway, DeployGateway } from '../playable-results/ports.ts';
import type { Database } from '../shared/record-store.ts';
import type { Clock, IdGenerator } from '../shared/runtime.ts';
import type { AppDeps } from './http/app-deps.ts';

export interface Gateways {
  readonly registry: CcProjectRegistry;
  readonly harness: CcHarnessGateway;
  readonly spawner: CcSpawnGateway;
  readonly buildTrigger: BuildTriggerGateway;
  readonly identity: CcIdentityGateway;
  readonly deployTarget: DeployGateway;
}

/** Wires stores and gateways into the dependency set every use case receives. */
export function composeDeps(db: Database, gateways: Gateways, runtime: { readonly clock: Clock; readonly ids: IdGenerator; readonly hookToken: string | undefined }): AppDeps {
  return {
    workspaces: db.collection<ProjectWorkspace>('workspaces'),
    tides: db.collection<Tide>('tides'),
    variants: db.collection<Variant>('variants'),
    revisions: db.collection<Revision>('revisions'),
    comments: db.collection<Comment>('comments'),
    ratings: db.collection<Rating>('ratings'),
    decisions: db.collection<AdoptionDecision>('decisions'),
    requests: db.collection<ImplementationRequest>('requests'),
    selections: db.collection<SelectionRecord>('selections'),
    builds: db.collection<Build>('builds'),
    artifacts: db.collection<Artifact>('artifacts'),
    deployments: db.collection<Deployment>('deployments'),
    ...gateways,
    clock: runtime.clock,
    ids: runtime.ids,
    hookToken: runtime.hookToken,
  };
}
