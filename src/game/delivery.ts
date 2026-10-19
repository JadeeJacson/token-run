import { getModel, getProject } from './data'
import { appendLog, checkDefeat, finishRun } from './lifecycle'
import { randomAt } from './rng'
import type { RunState } from './types'
import { clamp } from './util'

export function deliveryConfidence(state: RunState): { value: number; label: string; detail: string } {
  if (!state.encounter) return { value: 0, label: '未知', detail: '还没有可交付内容' }
  const project = getProject(state.encounter.projectId)
  const model = getModel(state.selectedModelId)
  const reliabilityBuff = state.buffs.reduce((sum, buff) => sum + (buff.reliabilityBonus ?? 0), 0)
  const analysisRatio = clamp(state.encounter.analysis / project.requirements.analysis, 0, 1.25)
  const codeRatio = clamp(state.encounter.code / project.requirements.code, 0, 1.25)
  const testRatio = clamp(state.encounter.test / project.requirements.test, 0, 1.25)
  const readiness = analysisRatio * 0.28 + codeRatio * 0.4 + testRatio * 0.32
  const unresolved = Math.max(0, project.hiddenRisk - state.encounter.reviews * 0.62 - state.encounter.test * 0.22 - state.encounter.analysis * 0.12)
  const stability = (state.resources.stability - 50) / 250
  const workflowPenalty = state.encounter.workflowDebt * 0.038
  const value = clamp(0.1 + readiness * 0.64 + (model.reliability + reliabilityBuff) * 0.15 + model.reasoning * 0.035 + stability - unresolved * 0.045 - workflowPenalty, 0.08, 0.98)
  const label = value >= 0.86 ? '很稳' : value >= 0.68 ? '可交付' : value >= 0.48 ? '有风险' : value >= 0.28 ? '危险' : '像在许愿'
  const riskDetail = state.encounter.revealedRisk >= project.hiddenRisk
    ? `已识别 ${project.hiddenRisk} 个主要风险`
    : `至少发现 ${state.encounter.revealedRisk} 个风险，可能还有遗漏`
  const debtDetail = state.encounter.workflowDebt > 0
    ? `流程债务 ${state.encounter.workflowDebt.toFixed(1)}，交付会打折`
    : '操作顺序干净，交付不吃暗亏'
  const detail = `${riskDetail} · ${debtDetail}`
  return { value, label, detail }
}

export function attemptDelivery(state: RunState): RunState {
  if (!state.encounter || state.screen !== 'encounter') return state
  const project = getProject(state.encounter.projectId)
  const confidence = deliveryConfidence(state)
  const roll = randomAt(state.seed, state.rngCursor)
  const success = roll <= confidence.value
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)
  const usageStart = state.encounter.usageStart ?? 0
  const usageSlice = state.usage.slice(usageStart)
  const input = usageSlice.reduce((sum, item) => sum + item.input, 0)
  const cached = usageSlice.reduce((sum, item) => sum + item.cached, 0)
  const output = usageSlice.reduce((sum, item) => sum + item.output, 0)
  const cost = usageSlice.reduce((sum, item) => sum + item.cost, 0)
  const disciplineDelta = state.disciplineScore - (state.encounter.disciplineStart ?? 0)
  const topMistake = state.encounter.workflowDebt > 1.2
    ? '流程债务累积'
    : state.encounter.revealedRisk < project.hiddenRisk
      ? '隐藏风险未清'
      : state.encounter.deliveryAttempts > 0
        ? '交付被打回后硬闯'
        : undefined
  const audit = {
    nodeId: state.currentNodeId ?? node?.id ?? 'unknown',
    projectId: project.id,
    title: project.title,
    outcome: (success ? 'delivered' : 'failed') as 'delivered' | 'failed',
    actions: state.encounter.actionCount,
    input,
    cached,
    output,
    cost,
    disciplineDelta,
    topMistake,
  }

  if (success) {
    const completedNodes = state.currentNodeId ? [...state.completedNodes, state.currentNodeId] : state.completedNodes
    const base: RunState = {
      ...state,
      rngCursor: state.rngCursor + 1,
      completedNodes,
      availableNodeIds: node?.next ?? [],
      completedProjects: state.completedProjects + 1,
      score: state.score + project.reward + Math.round(confidence.value * 240),
      resources: {
        ...state.resources,
        time: Math.min(state.resources.timeMax, state.resources.time + 2),
      },
      audits: [...(state.audits ?? []), audit],
      ...appendLog(state, 'success', '交付通过', project.successText, `置信判断：${confidence.label}`),
      pendingReward: node?.type === 'boss' ? 0 : 1,
    }
    if (node?.type === 'boss') {
      return finishRun({ ...base, encounter: null }, 'victory', project.successText)
    }
    return { ...base, screen: 'reward' }
  }

  const failed: RunState = {
    ...state,
    rngCursor: state.rngCursor + 1,
    failedProjects: state.failedProjects + 1,
    resources: {
      ...state.resources,
      time: state.resources.time - 3,
      budget: state.resources.budget - 12,
      stability: clamp(state.resources.stability - 13, 0, 100),
    },
    encounter: {
      ...state.encounter,
      test: Math.max(0, state.encounter.test - 2),
      deliveryAttempts: state.encounter.deliveryAttempts + 1,
      codeMode: 'terminal',
    },
    audits: [...(state.audits ?? []), audit],
    ...appendLog(state, 'warning', '交付被打回', project.failureText, `实际结果超出“${confidence.label}”预测`),
  }
  return checkDefeat(failed)
}
