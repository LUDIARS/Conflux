import { validateBranchNamingPolicy, type BranchNamingPolicy } from '../../evolution-streams/domain/branch-naming.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type {
  BuildSettings,
  BuildTrigger,
  DeploySettings,
  FlowObservation,
  ProjectWorkspace,
  RatingScale,
  SpawnDestination,
  SpawnDestinationKind,
} from './model.ts';

export interface WorkspaceSettingsInput {
  readonly projectCode: string;
  readonly name: string;
  readonly ccProjectCode: string;
  readonly branchNaming?: BranchNamingPolicy;
  readonly spawnDestinations: readonly SpawnDestination[];
  readonly ratingScale?: RatingScale;
  readonly build: BuildSettings;
  readonly deploy: DeploySettings;
  readonly debugIntake: boolean;
}

const PROJECT_CODE = /^[A-Za-z][A-Za-z0-9]{0,15}$/;
const BUILD_TRIGGERS: readonly BuildTrigger[] = ['variant-mainline-updated', 'work-branch-submitted'];

/** Address keys each destination kind must carry so Cc can resolve it. */
const REQUIRED_ADDRESS_KEYS: Readonly<Record<SpawnDestinationKind, readonly string[]>> = {
  subsidiary: ['subsidiaryId'],
  discord: ['guildId', 'channelId'],
  slack: ['workspaceId', 'channelId'],
};

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function validateDestinations(destinations: readonly SpawnDestination[]): Result<readonly SpawnDestination[]> {
  if (!unique(destinations.map((d) => d.id))) return fail('invalid_destination', 'spawn 先の id が重複しています');
  for (const d of destinations) {
    const required = REQUIRED_ADDRESS_KEYS[d.kind];
    if (!required) return fail('invalid_destination', `spawn 先 ${d.id} の種別が不明です`);
    if (d.label.trim().length === 0) return fail('invalid_destination', `spawn 先 ${d.id} の表示名が空です`);
    for (const key of required) {
      if (!d.address[key]?.trim()) return fail('invalid_destination', `spawn 先 ${d.id} に ${key} が必要です`);
    }
  }
  return ok(destinations);
}

function validateRatingScale(scale: RatingScale): Result<RatingScale> {
  if (!Number.isInteger(scale.min) || !Number.isInteger(scale.max) || scale.min >= scale.max) {
    return fail('invalid_rating_scale', '評価尺度は整数で min < max にしてください');
  }
  if (scale.items.length === 0) return fail('invalid_rating_scale', '評価項目を 1 つ以上指定してください');
  if (!unique(scale.items.map((i) => i.key))) return fail('invalid_rating_scale', '評価項目のキーが重複しています');
  return ok(scale);
}

function validateBuild(build: BuildSettings): Result<BuildSettings> {
  if (build.triggers.some((t) => !BUILD_TRIGGERS.includes(t))) {
    return fail('invalid_build_settings', 'ビルド契機の指定が不明です');
  }
  if (!unique(build.platforms)) return fail('invalid_build_settings', '対応平台が重複しています');
  return ok(build);
}

function validateDeploy(deploy: DeploySettings): Result<DeploySettings> {
  if (!unique(deploy.environments) || deploy.environments.some((e) => e.trim().length === 0)) {
    return fail('invalid_deploy_settings', 'デプロイ環境名が空か重複しています');
  }
  if (deploy.managerRoles.some((r) => r.trim().length === 0)) {
    return fail('invalid_deploy_settings', '管理職ロール名が空です');
  }
  return ok(deploy);
}

/**
 * Validates a workspace's Cf-owned settings. Rv/GitHub workflow selection is deliberately
 * absent: it is Cc's setting and Cf Flow must not change it (CF-PROJECT-001).
 */
export function planWorkspace(
  existing: ProjectWorkspace | undefined,
  input: WorkspaceSettingsInput,
  now: string,
): Result<ProjectWorkspace> {
  if (!PROJECT_CODE.test(input.projectCode) || !PROJECT_CODE.test(input.ccProjectCode)) {
    return fail('invalid_project_code', 'プロジェクトコードは英字で始まる英数字 16 文字以内で指定してください');
  }
  if (input.name.trim().length === 0) return fail('missing_field', 'プロジェクト名を入力してください');
  if (input.branchNaming) {
    const naming = validateBranchNamingPolicy(input.branchNaming);
    if (!naming.ok) return naming;
  }
  const destinations = validateDestinations(input.spawnDestinations);
  if (!destinations.ok) return destinations;
  if (input.ratingScale) {
    const scale = validateRatingScale(input.ratingScale);
    if (!scale.ok) return scale;
  }
  const build = validateBuild(input.build);
  if (!build.ok) return build;
  const deploy = validateDeploy(input.deploy);
  if (!deploy.ok) return deploy;

  return ok({
    id: input.projectCode,
    projectCode: input.projectCode,
    name: input.name.trim(),
    ccProjectCode: input.ccProjectCode,
    ...(input.branchNaming ? { branchNaming: input.branchNaming } : {}),
    spawnDestinations: input.spawnDestinations,
    ...(input.ratingScale ? { ratingScale: input.ratingScale } : {}),
    build: input.build,
    deploy: input.deploy,
    debugIntake: input.debugIntake,
    // Observation belongs to Cc; configuring Cf never flips it.
    flowObservation: existing?.flowObservation ?? { state: 'unknown', reason: 'Cc 未照会' },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export function requireBranchNaming(ws: ProjectWorkspace): Result<BranchNamingPolicy> {
  return ws.branchNaming
    ? ok(ws.branchNaming)
    : fail('branch_naming_undecided', '本流ブランチの物理命名が未設定です (evolution/x/y/main か evolution/x/y かをプロジェクト設定で指定してください)');
}

export function isFlowEnabled(observation: FlowObservation): boolean {
  return observation.state === 'enabled';
}

export function describeFlowObservation(observation: FlowObservation): string {
  switch (observation.state) {
    case 'enabled':
      return 'Cf Flow 有効 (Cc 報告)';
    case 'disabled':
      return 'Cf Flow 無効 (Cc 報告)';
    case 'not_connected':
      return `Cf Flow 未接続: ${observation.reason}`;
    case 'unknown':
      return `Cf Flow 状態不明: ${observation.reason}`;
  }
}

/** Debug-screen posts are accepted only for projects Cc reports as Cf Flow AND that opted in. */
export function canIngestDebugFeedback(ws: ProjectWorkspace): boolean {
  return ws.debugIntake && isFlowEnabled(ws.flowObservation);
}

export function findDestination(ws: ProjectWorkspace, destinationId: string): SpawnDestination | undefined {
  return ws.spawnDestinations.find((d) => d.id === destinationId);
}
