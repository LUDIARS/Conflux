import type { projectViewHref } from '../src/adapters/http/html/view-state.ts';
import type { ContractOf } from './contract-types.ts';

/** C-15: changing pane, tab or zoom keeps the selected variant id in the link. */
export default {
  post: (href, projectCode, state, patch = {}) => {
    const url = new URL(href, 'http://conflux.local');
    if (url.pathname !== `/projects/${encodeURIComponent(projectCode)}`) return 'link left the project';
    const expected = 'variantId' in patch ? patch.variantId : state.variantId;
    if ((url.searchParams.get('variant') ?? undefined) !== expected) return 'selected variant id not kept';
    return true;
  },
} satisfies ContractOf<typeof projectViewHref>;
