import type { playtestSignal } from '../src/cc-management-feed/domain/outcome-signals.ts';
import type { ContractOf } from './contract-types.ts';

export default {
  post: (signal, result) => (
    signal.eventKey === `cf:playtest:${result.id}` && signal.kind === 'playtest'
    && signal.projectCode === result.projectCode && signal.targetKey === `variant/${result.variantId}`
    && signal.origin === result.origin && signal.observedAt === result.observedAt
    && signal.summary.startsWith(`${result.buildId} `) && signal.summary.length <= 2000
  ) || 'playtest signal lost its saved result context',
} satisfies ContractOf<typeof playtestSignal>;
