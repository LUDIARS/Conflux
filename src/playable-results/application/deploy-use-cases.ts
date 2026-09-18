import { requireWorkspace } from '../../project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../project-workspaces/domain/model.ts';
import type { RecordStore } from '../../shared/record-store.ts';
import { ok, type Result } from '../../shared/result.ts';
import type { Clock, IdGenerator } from '../../shared/runtime.ts';
import { applyDeployOutcome, authorizeDeploy, newDeployment, type DeployCommand } from '../domain/deploy-authorization.ts';
import type { Artifact, Build, Deployment } from '../domain/model.ts';
import type { CcIdentityGateway, DeployGateway } from '../ports.ts';

export interface DeployDeps {
  readonly workspaces: RecordStore<ProjectWorkspace>;
  readonly builds: RecordStore<Build>;
  readonly artifacts: RecordStore<Artifact>;
  readonly deployments: RecordStore<Deployment>;
  readonly identity: CcIdentityGateway;
  readonly deployTarget: DeployGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Verifies the caller with Cc on every call, then records and executes the deploy. */
export async function deployArtifact(
  deps: DeployDeps,
  command: DeployCommand,
  actorToken: string | undefined,
): Promise<Result<Deployment>> {
  const ws = await requireWorkspace(deps.workspaces, command.projectCode);
  if (!ws.ok) return ws;
  const identity = await deps.identity.verify(actorToken);
  const artifact = await deps.artifacts.get(command.artifactId);
  const build = artifact ? await deps.builds.get(artifact.buildId) : undefined;
  const auth = authorizeDeploy({
    settings: ws.value.deploy,
    identity,
    command,
    ...(artifact ? { artifact } : {}),
    ...(build ? { build } : {}),
  });
  if (!auth.ok) return auth;

  const deployment = newDeployment(auth.value, { id: deps.ids.next('deploy'), at: deps.clock.now() });
  await deps.deployments.put(deployment);
  const outcome = await deps.deployTarget.deploy({
    deploymentId: deployment.id,
    environment: deployment.environment,
    artifactUri: auth.value.artifact.uri,
    ...(auth.value.artifact.sha256 ? { artifactSha256: auth.value.artifact.sha256 } : {}),
  });
  const updated = applyDeployOutcome(deployment, outcome, deps.clock.now());
  await deps.deployments.put(updated);
  return ok(updated);
}
