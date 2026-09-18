import type { AppDeps } from '../../src/adapters/http/app-deps.ts';
import { createTide, createVariant } from '../../src/evolution-streams/application/flow-use-cases.ts';
import type { Tide, Variant } from '../../src/evolution-streams/domain/model.ts';
import { ingestBuildEvent } from '../../src/playable-results/application/build-use-cases.ts';
import type { Build } from '../../src/playable-results/domain/model.ts';
import { configureWorkspace } from '../../src/project-workspaces/application/workspace-use-cases.ts';
import type { ProjectWorkspace } from '../../src/project-workspaces/domain/model.ts';
import type { WorkspaceSettingsInput } from '../../src/project-workspaces/domain/workspace-rules.ts';
import type { Result } from '../../src/shared/result.ts';
import { workspaceInput } from './fixtures.ts';

export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  return result.value;
}

export interface Seeded {
  readonly workspace: ProjectWorkspace;
  readonly tide: Tide;
  readonly variant: Variant;
}

/** One project with one tide and one variant, optionally with Cf Flow observed as enabled. */
export async function seedProject(
  deps: AppDeps,
  options: { readonly flowEnabled?: boolean; readonly settings?: Partial<WorkspaceSettingsInput> } = {},
): Promise<Seeded> {
  let workspace = unwrap(await configureWorkspace(deps, workspaceInput(options.settings)));
  if (options.flowEnabled) {
    workspace = { ...workspace, flowObservation: { state: 'enabled', observedAt: '2026-09-18T00:00:00.000Z' } };
    await deps.workspaces.put(workspace);
  }
  const code = workspace.projectCode;
  const tide = unwrap(await createTide(deps, { projectCode: code, slug: 'rush', title: '速攻', concept: '短時間で決着する' }));
  const variant = unwrap(
    await createVariant(deps, {
      projectCode: code,
      tideId: tide.id,
      slug: 'combo',
      title: 'コンボ型',
      concept: '連鎖で加点',
      rules: [{ key: 'turn-limit', text: '10 ターン' }],
    }),
  );
  return { workspace, tide, variant };
}

/** Records a succeeded build with one downloadable and one deployable artifact via the hook path. */
export async function seedPlayableBuild(deps: AppDeps, seeded: Seeded, commit: string, seq = 1): Promise<Build> {
  const effect = unwrap(
    await ingestBuildEvent(deps, {
      dedupeKey: `hook:${commit}`,
      projectCode: seeded.workspace.projectCode,
      variantId: seeded.variant.id,
      commit,
      seq,
      state: 'succeeded',
      artifacts: [
        { platform: 'windows', delivery: 'download', uri: `https://builds.example/${commit}.zip` },
        { platform: 'web', delivery: 'deployable', uri: `https://builds.example/${commit}-web.zip` },
      ],
    }),
  );
  return effect.build;
}
