import type { DeploySettings } from '../../project-workspaces/domain/model.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Artifact, Build, Deployment } from './model.ts';

/** Identity as verified by Cc at request time. Cc is the source of truth for roles. */
export type IdentityVerification =
  | { readonly status: 'verified'; readonly actorId: string; readonly roles: readonly string[] }
  | { readonly status: 'unauthenticated'; readonly reason: string }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface DeployCommand {
  readonly projectCode: string;
  readonly artifactId: string;
  readonly environment: string;
  /** The caller must echo the artifact and environment it reviewed (UI confirmation, enforced in the API too). */
  readonly confirmArtifactId: string;
  readonly confirmEnvironment: string;
}

export interface AuthorizedDeploy {
  readonly actorId: string;
  readonly actorRoles: readonly string[];
  readonly artifact: Artifact;
  readonly build: Build;
  readonly environment: string;
}

/**
 * Manager-or-above deploy check (CF-DEPLOY-001). Runs on every API call, not only in the UI.
 * An unreachable Cc, an undecided role mapping or an undeclared environment all deny.
 * A successful build alone never deploys: a human command is always required.
 */
export function authorizeDeploy(input: {
  readonly settings: DeploySettings;
  readonly identity: IdentityVerification;
  readonly command: DeployCommand;
  readonly artifact?: Artifact;
  readonly build?: Build;
}): Result<AuthorizedDeploy> {
  const { identity, settings, command, artifact, build } = input;
  if (identity.status === 'unavailable') return fail('identity_unavailable', `Cc で本人/役職を確認できません: ${identity.reason}`);
  if (identity.status === 'unauthenticated') return fail('unauthenticated', `本人確認に失敗しました: ${identity.reason}`);
  if (settings.managerRoles.length === 0) {
    return fail('role_mapping_undecided', '管理職以上に該当する Cc 役職がプロジェクト設定で未定義です');
  }
  if (!identity.roles.some((r) => settings.managerRoles.includes(r))) {
    return fail('forbidden', 'デプロイは管理職以上のみ実行できます');
  }
  if (!settings.environments.includes(command.environment)) {
    return fail('environment_not_configured', `デプロイ環境 ${command.environment} はこのプロジェクトで設定されていません`);
  }
  if (command.confirmArtifactId !== command.artifactId || command.confirmEnvironment !== command.environment) {
    return fail('confirmation_mismatch', '確認した成果物/環境と実行対象が一致しません');
  }
  if (!artifact || artifact.projectCode !== command.projectCode) return fail('artifact_not_found', '成果物がこのプロジェクトにありません');
  if (artifact.delivery !== 'deployable') return fail('artifact_not_deployable', 'この成果物はデプロイ対象ではありません (DL 専用)');
  if (!build || build.id !== artifact.buildId || build.state !== 'succeeded') {
    return fail('build_not_succeeded', '成功したビルドの成果物だけデプロイできます');
  }
  return ok({ actorId: identity.actorId, actorRoles: identity.roles, artifact, build, environment: command.environment });
}

export function newDeployment(auth: AuthorizedDeploy, stamp: { readonly id: string; readonly at: string }): Deployment {
  return {
    id: stamp.id,
    projectCode: auth.artifact.projectCode,
    artifactId: auth.artifact.id,
    buildId: auth.build.id,
    variantId: auth.artifact.variantId,
    environment: auth.environment,
    actorId: auth.actorId,
    actorRoles: auth.actorRoles,
    state: 'requested',
    requestedAt: stamp.at,
    updatedAt: stamp.at,
  };
}

/** Unknown stays unknown; only an explicit acceptance from the deploy target is success. */
export function applyDeployOutcome(deployment: Deployment, outcome: ExternalOutcome<unknown>, at: string): Deployment {
  switch (outcome.kind) {
    case 'accepted':
      return { ...deployment, state: 'succeeded', updatedAt: at };
    case 'rejected':
      return { ...deployment, state: 'failed', detail: outcome.detail, updatedAt: at };
    case 'not_connected':
      return { ...deployment, state: 'not_connected', detail: outcome.reason, updatedAt: at };
    case 'unknown':
      return { ...deployment, state: 'unknown', detail: outcome.reason, updatedAt: at };
  }
}
