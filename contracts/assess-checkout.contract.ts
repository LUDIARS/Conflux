import type { assessCheckout } from '../src/flow-isolation/domain/selection.ts';
import type { ContractOf } from './contract-types.ts';

/** C-14: uncommitted changes are never carried into another branch. */
export default {
  post: (result, _policy, _selection, checkout) => !checkout.dirty || !result.canSwitch || 'dirty tree switch allowed',
} satisfies ContractOf<typeof assessCheckout>;
