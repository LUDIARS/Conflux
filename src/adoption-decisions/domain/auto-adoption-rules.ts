import type { TargetResultState } from '../../playable-results/domain/result-status.ts';
import type { AutonomousAdoptionPolicy } from '../../project-workspaces/domain/autonomous-adoption-policy.ts';
import type { AutomaticVerdict } from './model.ts';
import { contract } from '#augur-contract-runtime'; /* augur-inject:import:70ae0a32 */
import augurContract_fc029fa1 from '../../../contracts/assess-adoption.contract.ts'; /* augur-inject:contract-predicate:64e2fe7a */

export interface TrialMetrics {
  readonly target: TargetResultState;
  readonly measuredTrials: number;
  readonly ratingCount: number;
  readonly ratingScore: number | undefined;
  readonly criticalBugs: number;
  readonly failureRate: number;
}

export interface Assessment {
  readonly verdict: AutomaticVerdict;
  readonly rationale: string;
}

export function assessAdoption(policy: AutonomousAdoptionPolicy, evidence: TrialMetrics): Assessment {
  if (!policy.enabled) return { verdict: 'hold', rationale: '自動採否は無効です' };
  if (evidence.target !== 'playable') return { verdict: 'hold', rationale: `対象版の試遊可能ビルド待ち（${evidence.target}）` };
  if (evidence.criticalBugs > policy.maxCriticalBugs) {
    return { verdict: 'reject', rationale: `重大障害を報告した試遊が上限を超過（${evidence.criticalBugs}/${policy.maxCriticalBugs} 件）` };
  }
  if (evidence.measuredTrials < policy.minPlaytests) {
    return { verdict: 'hold', rationale: `計測済み試遊が不足（${evidence.measuredTrials}/${policy.minPlaytests} 件）` };
  }
  if (evidence.failureRate > policy.maxFailureRate) {
    return { verdict: 'reject', rationale: `試遊失敗率が上限を超過（${evidence.failureRate} > ${policy.maxFailureRate}）` };
  }
  if (evidence.ratingScore === undefined || evidence.ratingCount < policy.minRatings) {
    return { verdict: 'hold', rationale: `有効な評価が不足（${evidence.ratingCount}/${policy.minRatings} 件）` };
  }
  if (evidence.ratingScore < policy.minRatingScore) {
    return { verdict: 'reject', rationale: `平均評価が下限未満（${evidence.ratingScore} < ${policy.minRatingScore}）` };
  }
  return { verdict: 'adopt', rationale: `採用基準を充足（試遊 ${evidence.measuredTrials} 件、平均評価 ${evidence.ratingScore}、失敗率 ${evidence.failureRate}、重大障害 ${evidence.criticalBugs} 件）` };
}
// @ts-expect-error augur-inject
assessAdoption = contract(assessAdoption, { ...augurContract_fc029fa1, contractId: 'C-23', mode: 'observe', sample: 1, where: 'src/adoption-decisions/domain/auto-adoption-rules.ts:19', rule: 'contract-wrap', id: 'fc029fa1' }); /* augur-inject:contract-wrap:fc029fa1 */
