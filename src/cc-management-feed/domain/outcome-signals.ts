import type { AdoptionDecision } from '../../adoption-decisions/domain/model.ts';
import type { Build } from '../../playable-results/domain/model.ts';
import type { PlaytestResult } from '../../playable-results/domain/playtest-result.ts';
import type { ManagementSignal } from './model.ts';
import { clip, variantTarget } from './signal-rules.ts';
import { contract } from '#augur-contract-runtime'; /* augur-inject:import:5c2b1eb7 */
import augurContract_7eaa7d73 from '../../../contracts/adoption-signal.contract.ts'; /* augur-inject:contract-predicate:259d31a9 */
import augurContract_de0d22a9 from '../../../contracts/build-signal.contract.ts'; /* augur-inject:contract-predicate:705b00e6 */
import augurContract_dbf934d5 from '../../../contracts/playtest-signal.contract.ts'; /* augur-inject:contract-predicate:5ba7fa94 */

export function adoptionSignal(decision: AdoptionDecision): ManagementSignal {
  const version = decision.target.commit ? ` (${decision.target.commit})` : '';
  return {
    eventKey: `cf:adoption:${decision.id}`,
    kind: 'adoption',
    projectCode: decision.projectCode,
    targetKey: variantTarget(decision.variantId),
    origin: decision.origin ?? 'human',
    summary: clip(`${decision.verdict} ${decision.reason} (${decision.decidedBy})${version}`),
    observedAt: decision.decidedAt,
  };
}
// @ts-expect-error augur-inject
adoptionSignal = contract(adoptionSignal, { ...augurContract_7eaa7d73, contractId: 'C-19', mode: 'observe', sample: 1, where: 'src/cc-management-feed/domain/outcome-signals.ts:7', rule: 'contract-wrap', id: '7eaa7d73' }); /* augur-inject:contract-wrap:7eaa7d73 */

export function buildSignal(build: Build): ManagementSignal | undefined {
  if (build.state !== 'succeeded' && build.state !== 'failed') return undefined;
  const detail = build.state === 'failed' && build.failureSummary ? `: ${build.failureSummary}` : '';
  return {
    eventKey: `cf:build:${build.id}`,
    kind: 'build',
    projectCode: build.projectCode,
    targetKey: variantTarget(build.variantId),
    origin: 'system',
    summary: clip(`${build.state} ${build.id} (${build.commit})${detail}`),
    observedAt: build.updatedAt,
  };
}
// @ts-expect-error augur-inject
buildSignal = contract(buildSignal, { ...augurContract_de0d22a9, contractId: 'C-20', mode: 'observe', sample: 1, where: 'src/cc-management-feed/domain/outcome-signals.ts:20', rule: 'contract-wrap', id: 'de0d22a9' }); /* augur-inject:contract-wrap:de0d22a9 */

export function playtestSignal(result: PlaytestResult): ManagementSignal {
  return {
    eventKey: `cf:playtest:${result.id}`,
    kind: 'playtest',
    projectCode: result.projectCode,
    targetKey: variantTarget(result.variantId),
    origin: result.origin,
    summary: clip(`${result.buildId} (${result.commit}): ${result.summary}`),
    observedAt: result.observedAt,
  };
}
// @ts-expect-error augur-inject
playtestSignal = contract(playtestSignal, { ...augurContract_dbf934d5, contractId: 'C-21', mode: 'observe', sample: 1, where: 'src/cc-management-feed/domain/outcome-signals.ts:34', rule: 'contract-wrap', id: 'dbf934d5' }); /* augur-inject:contract-wrap:dbf934d5 */
