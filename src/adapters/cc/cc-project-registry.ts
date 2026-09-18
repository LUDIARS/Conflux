import type { RegistryLookup } from '../../project-workspaces/domain/flow-observation.ts';
import type { CcProjectRegistry } from '../../project-workspaces/ports.ts';
import type { CcHttpClient } from './cc-http-client.ts';

/**
 * Reads `GET /v1/project-codes`. Assumed response shape (not verified against a deployed Cc):
 * an array of entries, or an object holding the array under `project_codes` / `projects`,
 * each entry carrying `code`. An unrecognised shape is `unknown`, never "enabled".
 */
function entriesOf(body: unknown): readonly Record<string, unknown>[] | undefined {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === 'object'
      ? ((body as { project_codes?: unknown }).project_codes ?? (body as { projects?: unknown }).projects)
      : undefined;
  return Array.isArray(list) ? list.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object') : undefined;
}

export class HttpCcProjectRegistry implements CcProjectRegistry {
  private readonly client: CcHttpClient;

  constructor(client: CcHttpClient) {
    this.client = client;
  }

  async lookup(ccProjectCode: string): Promise<RegistryLookup> {
    const result = await this.client.request('GET', '/v1/project-codes');
    if (result.kind !== 'response') return result;
    if (result.status === 404) return { kind: 'not_connected', reason: 'Cc に /v1/project-codes がありません' };
    if (result.status >= 500) return { kind: 'unknown', reason: `Cc エラー ${result.status}` };
    if (result.status >= 400) return { kind: 'unknown', reason: `Cc が照会を拒否 ${result.status}` };
    const entries = entriesOf(result.body);
    if (!entries) return { kind: 'unknown', reason: 'project-codes の応答形式を解釈できません' };
    const entry = entries.find((e) => e.code === ccProjectCode);
    if (!entry) return { kind: 'missing' };
    return { kind: 'found', hasConfluxFlowField: Object.hasOwn(entry, 'conflux_flow'), confluxFlow: entry.conflux_flow };
  }
}
