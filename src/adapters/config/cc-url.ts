import { contract } from '#augur-contract-runtime'; /* augur-inject:import:d1a3a4e0 */
import augurContract_3796bfce from '../../../contracts/resolve-cc-base-url.contract.ts'; /* augur-inject:contract-predicate:34ec0125 */
type Env = Readonly<Record<string, string | undefined>>;

export class CcUrlError extends Error {}

/**
 * Concordia base URL. An explicit `CONFLUX_CC_URL` wins; otherwise the `CONCORDIA_URL`
 * that Excubitor injects from Concordia's own catalog (`provides`) is used, so the Cc
 * address is never duplicated in Conflux's catalog. Neither set is a startup error.
 */
export function resolveCcBaseUrl(env: Env): string {
  const explicit = env['CONFLUX_CC_URL']?.trim();
  const key = explicit ? 'CONFLUX_CC_URL' : 'CONCORDIA_URL';
  const value = explicit || env['CONCORDIA_URL']?.trim();
  if (!value) throw new CcUrlError('CONFLUX_CC_URL or the Excubitor-injected CONCORDIA_URL is required');
  if (!/^https?:\/\/[^/\s]+/.test(value)) throw new CcUrlError(`${key} must be an http(s) URL`);
  return value.replace(/\/+$/, '');
}
// @ts-expect-error augur-inject
resolveCcBaseUrl = contract(resolveCcBaseUrl, { ...augurContract_3796bfce, contractId: 'C-16', mode: 'observe', sample: 1, where: 'src/adapters/config/cc-url.ts:10', rule: 'contract-wrap', id: '3796bfce' }); /* augur-inject:contract-wrap:3796bfce */
