import type { WebAccess } from '../config/web-access.ts';
import { matchesHost } from './host-matching.ts';
import type { HttpResponse } from './http-types.ts';
import { jsonResponse } from './responses.ts';
import { contract } from '#augur-contract-runtime'; /* augur-inject:import:8a6deb38 */
import augurContract_068c4d58 from '../../../contracts/admit-web-request.contract.ts'; /* augur-inject:contract-predicate:78c02774 */

export { matchesHost } from './host-matching.ts';

/**
 * Admission check run before routing. Unknown Host is refused (DNS rebinding); an Origin,
 * when the browser sends one (POST, module scripts, fetch), must be in the exact set.
 * Returns the refusal, or undefined when the request may proceed.
 */
export function admitWebRequest(headers: Readonly<Record<string, string | undefined>>, access: WebAccess): HttpResponse | undefined {
  if (!matchesHost(headers['host'], access.hosts)) return jsonResponse(403, { error: 'host_not_allowed' });
  const origin = headers['origin'];
  if (origin !== undefined && !access.origins.has(origin)) return jsonResponse(403, { error: 'origin_not_allowed' });
  return undefined;
}
// @ts-expect-error augur-inject
admitWebRequest = contract(admitWebRequest, { ...augurContract_068c4d58, contractId: 'C-17', mode: 'observe', sample: 1, where: 'src/adapters/http/host-origin-guard.ts:33', rule: 'contract-wrap', id: '068c4d58' }); /* augur-inject:contract-wrap:068c4d58 */
