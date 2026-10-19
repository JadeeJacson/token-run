import { getModel, getProject } from './data'
import { getArchetype, progressMultiplierFor } from './archetypes'
import { appendLog, checkDefeat } from './lifecycle'
import { randomAt } from './rng'
import { assessCardSequence } from './sequence'
import type { ActionCard, ModelSpec, RunState } from './types'
import { clamp, formatTokens, lerp, progressSummary, scaledEffect } from './util'

export function fuzzyTokenEstimate(card: ActionCard, model: ModelSpec): { tokens: string; cost: string; latency: string } {
  if (card.manual) return { tokens: '0 Token', cost: '¥0', latency: `${card.timeCost} 格时间` }
  const totalLow = card.inputRange[0] + card.outputRange[0]
  const totalHigh = card.inputRange[1] + card.outputRange[1]
  const cheapLow = (card.inputRange[0] * model.ratesCny.cached * 0.3 + card.inputRange[0] * model.ratesCny.input * 0.7 + card.outputRange[0] * model.ratesCny.output) / 1_000_000
  const expensiveHigh = (card.inputRange[1] * model.ratesCny.input + card.outputRange[1] * model.ratesCny.output) / 1_000_000
  return {
    tokens: `约 ${formatTokens(totalLow)}–${formatTokens(totalHigh)}`,
    cost: `约 ¥${cheapLow.toFixed(2)}–${expensiveHigh.toFixed(2)}`,
    latency: model.speed >= 1.2 ? '很快' : model.speed >= 1 ? '普通' : '偏慢',
  }
}

export function playAction(state: RunState, card: ActionCard): RunState {
  if (!state.encounter || state.screen !== 'encounter') return state
  if ((state.encounter.cooldowns[card.id] ?? 0) > 0) return state

  const project = getProject(state.encounter.projectId)
  const model = getModel(state.selectedModelId)
  const sequence = assessCardSequence(state.encounter, card)
  let cursor = state.rngCursor
  const complexity = 0.82 + project.difficulty * 0.08
  const sequenceTokenMultiplier = sequence.ready
    ? Math.max(0.9, 1 - Math.min(0.1, state.encounter.sequenceStreak * 0.018 * model.workflowDiscipline))
    : 1 + sequence.severity * 0.17
  const baseInput = card.manual ? 0 : Math.round(lerp(card.inputRange[0], card.inputRange[1], randomAt(state.seed, cursor++)) * complexity)
  const baseOutput = card.manual ? 0 : Math.round(lerp(card.outputRange[0], card.outputRange[1], randomAt(state.seed, cursor++)) * complexity)
  const input = Math.round(baseInput * sequenceTokenMultiplier)
  const output = Math.round(baseOutput * sequenceTokenMultiplier)
  const cacheBuff = state.buffs.reduce((sum, buff) => sum + (buff.cacheBonus ?? 0), 0)
  const cacheRatio = card.manual ? 0 : clamp(0.08 + (state.resources.context / state.resources.contextMax) * 0.42 + cacheBuff, 0.04, 0.82)
  const cached = Math.round(input * cacheRatio)
  const uncached = input - cached
  let cost = (uncached * model.ratesCny.input + cached * model.ratesCny.cached + output * model.ratesCny.output) / 1_000_000

  const buffs = state.buffs.map((buff) => ({ ...buff }))
  let discountLabel = ''
  const testCoupon = card.testAction ? buffs.find((buff) => (buff.testDiscountUses ?? 0) > 0) : undefined
  if (testCoupon) {
    cost = 0
    testCoupon.testDiscountUses = (testCoupon.testDiscountUses ?? 1) - 1
    discountLabel = ' · CI券 ¥0'
  } else {
    const discount = buffs.find((buff) => (buff.discountUses ?? 0) > 0 && buff.discountMultiplier)
    if (discount) {
      cost *= discount.discountMultiplier ?? 1
      discount.discountUses = (discount.discountUses ?? 1) - 1
      discountLabel = ` · ${discount.name}`
    }
  }

  const archetype = getArchetype(state.archetypeId)
  cost *= archetype.passives.costMultiplier ?? 1
  if ((archetype.passives.costMultiplier ?? 1) < 1) discountLabel += ` · ${archetype.name}`

  const reliabilityBuff = buffs.reduce((sum, buff) => sum + (buff.reliabilityBonus ?? 0), 0)
  const effectiveReliability = clamp(model.reliability + reliabilityBuff, 0.2, 0.99)
  const orderReliabilityPenalty = sequence.ready ? 0 : sequence.severity * Math.max(0.055, 0.13 - model.workflowDiscipline * 0.045)
  const outcomeRoll = randomAt(state.seed, cursor++)
  const isClean = outcomeRoll <= effectiveReliability - orderReliabilityPenalty - (card.risk === '高' ? 0.12 : card.risk === '中' ? 0.04 : 0)
  const reasoningFactor = 0.94 + model.reasoning * 0.06
  const sequenceEffectMultiplier = sequence.ready ? 1 + Math.min(0.1, state.encounter.sequenceStreak * 0.02 * model.workflowDiscipline) : 0.86
  const power = isClean
    ? model.power * reasoningFactor * sequenceEffectMultiplier
    : Math.max(0.55, model.power * (0.56 + model.failureRecovery * 0.1))
  const analysisMult = progressMultiplierFor(state.archetypeId, 'analysis')
  const codeMult = progressMultiplierFor(state.archetypeId, 'code')
  const testMult = progressMultiplierFor(state.archetypeId, 'test')
  const reviewMult = progressMultiplierFor(state.archetypeId, 'review')
  const deltaAnalysis = scaledEffect(card.effect.analysis, power * analysisMult)
  const deltaCode = scaledEffect(card.effect.code, power * codeMult)
  const deltaTest = scaledEffect(card.effect.test, power * testMult)
  const deltaReview = scaledEffect(card.effect.review, (isClean ? reasoningFactor : 0.58 + model.failureRecovery * 0.12) * reviewMult)
  const rewriteIds = new Set(['rewrite-module', 'refactor-extract', 'manual-hotfix'])
  const rewriteMultiplier = rewriteIds.has(card.id) ? (archetype.passives.rewriteStabilityMultiplier ?? 1) : 1
  const unstable = !isClean ? (card.risk === '高' ? -9 : card.risk === '中' ? -5 : -2) * (1 - model.failureRecovery * 0.18) : 0
  const orderStability = sequence.ready ? (state.encounter.sequenceStreak > 0 ? 1 : 0) : -Math.max(2, Math.ceil(sequence.severity * (4.2 - model.workflowDiscipline * 1.35)))
  const stabilityDelta = (card.effect.stability ?? 0) + unstable * rewriteMultiplier + orderStability
  const timeCost = card.manual ? card.timeCost : Math.max(1, Math.ceil(card.timeCost / model.speed))
  const sequenceContextMultiplier = sequence.ready
    ? Math.max(0.84, 1 - Math.min(0.12, state.encounter.sequenceStreak * 0.02 * model.workflowDiscipline))
    : 1 + sequence.severity * 0.3
  const addedContext = card.manual
    ? 0
    : Math.round(((input * 0.0006 + output * 0.004) * card.contextLoad * model.contextEfficiency) * sequenceContextMultiplier * (archetype.passives.contextMultiplier ?? 1))
  const reduction = card.effect.contextReduction ?? 0
  const nextContext = Math.max(2000, Math.round((state.resources.context + addedContext) * (1 - reduction)))
  // 压缩上下文会顺带丢掉一部分调查进度（设计文档里的压缩代价）。
  // 卡牌自带 analysis: -1，这里再按压缩比例扣一点；压缩流可以少丢一点。
  const keepRatio = Math.max(0.08, 0.25 - (archetype.passives.compressKeepBonus ?? 0))
  const analysisLoss = reduction > 0 && state.encounter.analysis > 0
    ? Math.min(state.encounter.analysis, Math.max(1, Math.round(state.encounter.analysis * reduction * keepRatio)))
    : 0
  const progressLabel = progressSummary(deltaAnalysis - analysisLoss, deltaCode, deltaTest)
  const sequenceMeta = sequence.ready
    ? (state.encounter.sequenceStreak > 0 ? ` · 顺序连击 ${state.encounter.sequenceStreak + 1}` : '')
    : ` · 顺序罚则：缺少${sequence.missing.join('、')} · 流程债务 +${sequence.severity.toFixed(1)}`
  const exactMeta = `↑${formatTokens(input)} · cache ${formatTokens(cached)} · ↓${formatTokens(output)} · ¥${cost.toFixed(3)}${discountLabel}${sequenceMeta}`
  const compressionNote = analysisLoss > 0 ? `压缩顺带丢掉了 ${analysisLoss} 点调查进度。` : ''
  const body = sequence.ready
    ? `${isClean ? card.description : 'Agent 给出了一个很自信的结果，但留下了可疑改动。'} ${progressLabel} ${compressionNote}`
    : `顺序错位：${card.name} 早于必要证据执行，返工与风险一起增加。${isClean ? progressLabel : '结果还留下了可疑改动。'} ${compressionNote}`

  const cooldowns: Record<string, number> = {}
  for (const [id, value] of Object.entries(state.encounter.cooldowns)) {
    if (value > 1) cooldowns[id] = value - 1
  }
  if (card.cooldown > 0) cooldowns[card.id] = card.cooldown

  const next: RunState = {
    ...state,
    rngCursor: cursor,
    buffs,
    resources: {
      ...state.resources,
      budget: state.resources.budget - cost,
      context: nextContext,
      time: state.resources.time - timeCost,
      stability: clamp(state.resources.stability + stabilityDelta, 0, 100),
    },
    encounter: {
      ...state.encounter,
      analysis: Math.max(0, state.encounter.analysis + deltaAnalysis - analysisLoss),
      code: Math.max(0, state.encounter.code + deltaCode),
      test: Math.max(0, state.encounter.test + deltaTest),
      reviews: Math.max(0, state.encounter.reviews + deltaReview),
      revealedRisk: Math.min(project.hiddenRisk, state.encounter.revealedRisk + Math.max(0, deltaReview) + (card.id === 'read-logs' ? 1 : 0)),
      actionCount: state.encounter.actionCount + 1,
      workflowDebt: clamp(state.encounter.workflowDebt + (sequence.ready ? -0.18 : sequence.severity), 0, 5),
      sequenceStreak: sequence.ready ? Math.min(6, state.encounter.sequenceStreak + 1) : 0,
      cooldowns,
      codeMode: card.testAction ? 'terminal' : card.kind === 'build' ? 'diff' : state.encounter.codeMode,
    },
    usage: card.manual ? state.usage : [...state.usage, { action: card.name, modelId: model.id, input, cached, output, cost }],
    score: state.score + Math.max(0, deltaAnalysis + deltaCode + deltaTest + deltaReview) * 12 + (sequence.ready ? 8 : -Math.round(sequence.severity * 5)),
    disciplineScore: state.disciplineScore + (sequence.ready ? Math.round(archetype.passives.sequenceBonus ?? 1) : -1),
    ...appendLog(state, !isClean || !sequence.ready ? 'warning' : (card.testAction ? 'tool' : 'agent'), card.name, body, exactMeta),
  }

  return checkDefeat(next)
}
