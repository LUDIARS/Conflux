import type { resolveCcBaseUrl } from '../src/adapters/config/cc-url.ts';
import type { ContractOf } from './contract-types.ts';

/** C-16: an explicit CONFLUX_CC_URL wins; otherwise the Excubitor-injected CONCORDIA_URL is used. */
export default {
  post: (url, env) => {
    const explicit = env['CONFLUX_CC_URL']?.trim();
    const source = explicit || env['CONCORDIA_URL']?.trim();
    if (!source) return 'resolved a Cc URL although neither CONFLUX_CC_URL nor CONCORDIA_URL is set';
    if (url !== source.replace(/\/+$/, '')) return explicit ? 'CONFLUX_CC_URL did not take precedence' : 'CONCORDIA_URL was not used';
    if (!/^https?:\/\//.test(url)) return 'resolved a non-http(s) Cc URL';
    return true;
  },
} satisfies ContractOf<typeof resolveCcBaseUrl>;
