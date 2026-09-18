import type { SpawnAccepted, SpawnLookup } from '../../implementation-requests/domain/model.ts';
import type { CcSpawnGateway, SpawnPayload } from '../../implementation-requests/ports.ts';
import type { ExternalOutcome } from '../../shared/external-outcome.ts';
import type { CcHttpClient } from './cc-http-client.ts';
import { commandOutcome } from './status-mapping.ts';

export interface SpawnRoutes {
  /** Cc route that spawns a session for Cf. Undefined until Cc defines it (remaining work). */
  readonly spawnPath?: string;
  /** Cc route that looks a spawn up by idempotency key. */
  readonly lookupPath?: string;
}

function acceptSpawn(body: unknown): SpawnAccepted | undefined {
  const b = body as { session_id?: unknown; run_id?: unknown } | undefined;
  if (!b || typeof b.session_id !== 'string' || b.session_id.length === 0) return undefined;
  return { sessionId: b.session_id, ...(typeof b.run_id === 'string' ? { runId: b.run_id } : {}) };
}

/**
 * Spawn adapter. While Cc has no Cf spawn route configured it reports `not_connected`
 * (nothing sent) rather than pretending a session started.
 */
export class HttpCcSpawnGateway implements CcSpawnGateway {
  private readonly client: CcHttpClient;
  private readonly routes: SpawnRoutes;

  constructor(client: CcHttpClient, routes: SpawnRoutes) {
    this.client = client;
    this.routes = routes;
  }

  async spawn(payload: SpawnPayload): Promise<ExternalOutcome<SpawnAccepted>> {
    if (!this.routes.spawnPath) return { kind: 'not_connected', reason: 'Cc の Cf spawn 経路が未定義 (CONFLUX_CC_SPAWN_PATH 未設定)' };
    const result = await this.client.request('POST', this.routes.spawnPath, {
      idempotency_key: payload.idempotencyKey,
      project_code: payload.ccProjectCode,
      destination: payload.destination,
      selection: payload.selection,
      title: payload.title,
      brief: payload.brief,
      requested_by: payload.requestedBy,
      source_comments: payload.sourceComments,
    });
    return commandOutcome(result, acceptSpawn);
  }

  async lookup(idempotencyKey: string): Promise<SpawnLookup> {
    if (!this.routes.lookupPath) return { kind: 'unavailable', reason: 'Cc の spawn 照会経路が未定義 (CONFLUX_CC_SPAWN_LOOKUP_PATH 未設定)' };
    const result = await this.client.request('GET', `${this.routes.lookupPath}?idempotency_key=${encodeURIComponent(idempotencyKey)}`);
    if (result.kind !== 'response') return { kind: 'unavailable', reason: result.reason };
    if (result.status === 404) return { kind: 'absent' };
    if (result.status < 200 || result.status >= 300) return { kind: 'unavailable', reason: `Cc エラー ${result.status}` };
    const found = acceptSpawn(result.body);
    return found ? { kind: 'found', ...found } : { kind: 'unavailable', reason: '照会応答に session_id がありません' };
  }
}
