import type { ConfluxConfig } from '../config/load-config.ts';
import { jsonResponse } from './responses.ts';
import type { Router } from './router.ts';

export type CapabilityState = 'configured' | 'not_connected';

/**
 * `GET /health` body. `status: alive` only means the process serves HTTP. Cc reachability
 * is never probed here (`not_checked`), and each external capability reports whether its
 * route is configured at all, so an alive service is not read as "Cc connected".
 */
export interface HealthReport {
  readonly service: 'conflux';
  readonly status: 'alive';
  readonly startedAt: string;
  readonly cc: { readonly reachability: 'not_checked' };
  readonly capabilities: {
    readonly spawn: CapabilityState;
    readonly spawnLookup: CapabilityState;
    readonly build: CapabilityState;
    readonly identity: CapabilityState;
    readonly hookIntake: CapabilityState;
    readonly deploy: 'not_connected';
  };
}

const state = (value: string | undefined): CapabilityState => (value ? 'configured' : 'not_connected');

export function describeHealth(config: ConfluxConfig, startedAt: string): HealthReport {
  return {
    service: 'conflux',
    status: 'alive',
    startedAt,
    cc: { reachability: 'not_checked' },
    capabilities: {
      spawn: state(config.ccSpawnPath),
      spawnLookup: state(config.ccSpawnLookupPath),
      build: state(config.ccBuildPath),
      identity: state(config.ccIdentityPath),
      hookIntake: state(config.hookToken),
      // The deploy mechanism is undecided (CF-DEPLOY-001); UnconfiguredDeployGateway is the only one.
      deploy: 'not_connected',
    },
  };
}

/** Liveness route for Excubitor's health check; the report is fixed at startup. */
export function registerHealthRoute(router: Router, report: HealthReport): Router {
  return router.add('GET', '/health', async () => jsonResponse(200, report));
}
