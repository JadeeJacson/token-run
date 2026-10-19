import type { RunState } from './types'
import { clamp } from './util'

/**
 * 终局计分：预算不再单独主导总分。
 * 资源分只占一部分，交付质量、流程纪律与胜负同样进入总分，
 * 否则「少花钱」会压过「按顺序、留证据、低返工」的全部策略。
 */
export function finalScore(state: RunState): number {
  const resourceBonus =
    Math.max(0, state.resources.budget) * 0.28 +
    Math.max(0, state.resources.time) * 42 +
    state.resources.stability * 16
  const deliveryBonus = state.completedProjects * 300 - state.failedProjects * 180
  const disciplineBonus = clamp(state.disciplineScore, -12, 24) * 25
  const victoryBonus = state.lastOutcome === 'victory' ? 400 : 0
  return Math.round(state.score + resourceBonus + deliveryBonus + disciplineBonus + victoryBonus)
}

/** 分数构成，供结算界面与文档说明使用。 */
export function finalScoreBreakdown(state: RunState): Array<{ key: string; label: string; value: number }> {
  return [
    { key: 'actions', label: '行动得分', value: Math.round(state.score) },
    { key: 'projects', label: `交付 ${state.completedProjects} 个项目`, value: state.completedProjects * 300 - state.failedProjects * 180 },
    { key: 'discipline', label: '流程纪律', value: clamp(state.disciplineScore, -12, 24) * 25 },
    { key: 'resources', label: '剩余资源', value: Math.round(Math.max(0, state.resources.budget) * 0.28 + Math.max(0, state.resources.time) * 42 + state.resources.stability * 16) },
    { key: 'victory', label: '交付周五行', value: state.lastOutcome === 'victory' ? 400 : 0 },
  ]
}

export function totalUsage(state: RunState): { input: number; cached: number; output: number; cost: number } {
  return state.usage.reduce((total, item) => ({
    input: total.input + item.input,
    cached: total.cached + item.cached,
    output: total.output + item.output,
    cost: total.cost + item.cost,
  }), { input: 0, cached: 0, output: 0, cost: 0 })
}
