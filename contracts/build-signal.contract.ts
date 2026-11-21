import type { buildSignal } from '../src/cc-management-feed/domain/outcome-signals.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (signal, build) => {
    if (build.state !== 'succeeded' && build.state !== 'failed') {
      return signal === undefined || 'non-terminal build produced a result signal';
    }
    return (!!signal && signal.eventKey === `cf:build:${build.id}` && signal.kind === 'build'
      && signal.projectCode === build.projectCode && signal.targetKey === `variant/${build.variantId}`
      && signal.origin === 'system' && signal.observedAt === build.updatedAt
      && signal.summary.startsWith(`${build.state} `) && signal.summary.length <= 2000
    ) || 'build signal lost its saved outcome context';
  },
} satisfies ContractOf<typeof buildSignal>;
