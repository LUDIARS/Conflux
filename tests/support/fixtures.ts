import { composeDeps, type Gateways } from '../../src/adapters/compose.ts';
import type { AppDeps } from '../../src/adapters/http/app-deps.ts';
import { MemoryDatabase } from '../../src/adapters/storage/memory-database.ts';
import type { FlowSelection } from '../../src/flow-isolation/domain/selection.ts';
import type { SpawnAccepted, SpawnLookup } from '../../src/implementation-requests/domain/model.ts';
import type { SpawnPayload } from '../../src/implementation-requests/ports.ts';
import type { IdentityVerification } from '../../src/playable-results/domain/deploy-authorization.ts';
import type { BuildRequestPayload, DeployPayload } from '../../src/playable-results/ports.ts';
import type { RegistryLookup } from '../../src/project-workspaces/domain/flow-observation.ts';
import type { WorkspaceSettingsInput } from '../../src/project-workspaces/domain/workspace-rules.ts';
import type { ExternalOutcome } from '../../src/shared/external-outcome.ts';
import type { Clock, IdGenerator } from '../../src/shared/runtime.ts';

/** Clock advancing one second per call from a fixed origin. */
export function steppingClock(start = Date.UTC(2026, 8, 18, 0, 0, 0)): Clock {
  let t = start;
  return {
    now: () => {
      const iso = new Date(t).toISOString();
      t += 1000;
      return iso;
    },
  };
}

export function sequentialIds(): IdGenerator {
  let n = 0;
  return { next: (prefix) => `${prefix}_${++n}` };
}

export interface FakeGateways extends Gateways {
  registryResult: RegistryLookup;
  harnessOutcome: ExternalOutcome<{ readonly accepted: true }>;
  spawnOutcome: ExternalOutcome<SpawnAccepted>;
  spawnLookup: SpawnLookup;
  buildOutcome: ExternalOutcome<{ readonly accepted: true }>;
  identityResult: IdentityVerification;
  deployOutcome: ExternalOutcome<{ readonly accepted: true }>;
  readonly calls: {
    select: { sessionId: string; selection: FlowSelection }[];
    spawn: SpawnPayload[];
    lookup: string[];
    build: BuildRequestPayload[];
    deploy: DeployPayload[];
    identityTokens: (string | undefined)[];
  };
}

/** Programmable fakes; every call is recorded so tests can assert what was (not) sent. */
export function fakeGateways(): FakeGateways {
  const g: FakeGateways = {
    registryResult: { kind: 'not_connected', reason: 'test' },
    harnessOutcome: { kind: 'not_connected', reason: 'harness endpoint absent' },
    spawnOutcome: { kind: 'not_connected', reason: 'spawn route absent' },
    spawnLookup: { kind: 'unavailable', reason: 'lookup route absent' },
    buildOutcome: { kind: 'not_connected', reason: 'build route absent' },
    identityResult: { status: 'unavailable', reason: 'identity route absent' },
    deployOutcome: { kind: 'not_connected', reason: 'deploy target undecided' },
    calls: { select: [], spawn: [], lookup: [], build: [], deploy: [], identityTokens: [] },
    registry: { lookup: async () => g.registryResult },
    harness: {
      select: async (sessionId, selection) => {
        g.calls.select.push({ sessionId, selection });
        return g.harnessOutcome;
      },
    },
    spawner: {
      spawn: async (payload) => {
        g.calls.spawn.push(payload);
        return g.spawnOutcome;
      },
      lookup: async (key) => {
        g.calls.lookup.push(key);
        return g.spawnLookup;
      },
    },
    buildTrigger: {
      requestBuild: async (payload) => {
        g.calls.build.push(payload);
        return g.buildOutcome;
      },
    },
    identity: {
      verify: async (token) => {
        g.calls.identityTokens.push(token);
        return g.identityResult;
      },
    },
    deployTarget: {
      deploy: async (payload) => {
        g.calls.deploy.push(payload);
        return g.deployOutcome;
      },
    },
  };
  return g;
}

export const HOOK_TOKEN = 'test-hook-token-0123456789abcdef0123';

export function testDeps(): { deps: AppDeps; gateways: FakeGateways; db: MemoryDatabase } {
  const db = new MemoryDatabase();
  const gateways = fakeGateways();
  const deps = composeDeps(db, gateways, { clock: steppingClock(), ids: sequentialIds(), hookToken: HOOK_TOKEN });
  return { deps, gateways, db };
}

export function workspaceInput(overrides: Partial<WorkspaceSettingsInput> = {}): WorkspaceSettingsInput {
  return {
    projectCode: 'KD',
    name: 'KonbiniDominant',
    ccProjectCode: 'KD',
    branchNaming: { evolutionPrefix: 'evolution', workPrefix: 'feature', mainline: 'suffix-main' },
    spawnDestinations: [{ id: 'discord-kd', kind: 'discord', label: 'KD Discord', address: { guildId: 'g1', channelId: 'c1' } }],
    ratingScale: { min: 1, max: 5, items: [{ key: 'fun', label: '面白さ' }, { key: 'fit', label: 'コンセプト適合' }] },
    build: { triggers: ['variant-mainline-updated'], platforms: ['windows'] },
    deploy: { environments: ['staging'], managerRoles: ['manager', 'director'] },
    debugIntake: true,
    ...overrides,
  };
}

export const COMMIT_A = 'aaaaaaa1111111';
export const COMMIT_B = 'bbbbbbb2222222';
