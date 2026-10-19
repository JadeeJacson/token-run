import { BUFFS, EVENTS, MODELS, getModel } from './data'
import { appendLog, checkDefeat, completeUtilityNode } from './lifecycle'
import { randomAt, shuffled } from './rng'
import type { ChoiceEffect, RunState } from './types'
import { clamp } from './util'

export function availableRewards(state: RunState): Array<{ type: 'model' | 'buff'; id: string }> {
  const lockedModels = MODELS.filter((model) => !state.availableModelIds.includes(model.id))
  const modelOrder = shuffled(lockedModels, state.seed + state.completedProjects * 37)
  const buffOrder = shuffled(BUFFS, state.seed + state.completedProjects * 53)
  const rewards: Array<{ type: 'model' | 'buff'; id: string }> = []
  if (modelOrder[0]) rewards.push({ type: 'model', id: modelOrder[0].id })
  rewards.push({ type: 'buff', id: buffOrder[0].id })
  if (state.completedProjects % 2 === 0 && modelOrder[1]) rewards.push({ type: 'model', id: modelOrder[1].id })
  else rewards.push({ type: 'buff', id: buffOrder[1].id })
  return rewards.slice(0, 3)
}

export function chooseReward(state: RunState, reward: { type: 'model' | 'buff'; id: string }): RunState {
  if (state.screen !== 'reward') return state
  if (reward.type === 'model') {
    return {
      ...state,
      screen: 'map',
      encounter: null,
      pendingReward: 0,
      selectedModelId: reward.id,
      availableModelIds: [...new Set([...state.availableModelIds, reward.id])],
      ...appendLog(state, 'system', '模型已接入', `${getModel(reward.id).parodyName} 已成为当前 Agent 后端。`, '本局解锁'),
    }
  }

  const selected = BUFFS.find((buff) => buff.id === reward.id)
  if (!selected) return state
  const already = state.buffs.find((buff) => buff.id === selected.id)
  const buffs = already
    ? state.buffs.map((buff) => buff.id === selected.id
      ? { ...buff, discountUses: (buff.discountUses ?? 0) + (selected.discountUses ?? 0), testDiscountUses: (buff.testDiscountUses ?? 0) + (selected.testDiscountUses ?? 0), reliabilityBonus: (buff.reliabilityBonus ?? 0) }
      : buff)
    : [...state.buffs, { ...selected }]
  // 上下文上限只在首次安装时扩张，避免重复领取把窗口无限抬高。
  const contextBonus = already ? 0 : (selected.contextBonus ?? 0)
  return {
    ...state,
    screen: 'map',
    encounter: null,
    pendingReward: 0,
    buffs,
    resources: { ...state.resources, contextMax: state.resources.contextMax + contextBonus },
    ...appendLog(state, 'system', 'Buff 已安装', selected.description, selected.name),
  }
}

export function resolveEvent(state: RunState, effect: ChoiceEffect, result: string): RunState {
  if (state.screen !== 'event') return state
  const buffs = [...state.buffs]
  if (effect.buffId) {
    const buff = BUFFS.find((candidate) => candidate.id === effect.buffId)
    if (buff && !buffs.some((candidate) => candidate.id === buff.id)) buffs.push({ ...buff })
  }
  const next = completeUtilityNode({
    ...state,
    buffs,
    score: state.score + (effect.score ?? 0),
    resources: {
      ...state.resources,
      budget: Math.min(state.resources.budgetMax, state.resources.budget + (effect.budget ?? 0)),
      context: clamp(state.resources.context + (effect.context ?? 0), 2000, state.resources.contextMax),
      time: Math.min(state.resources.timeMax, state.resources.time + (effect.time ?? 0)),
      stability: clamp(state.resources.stability + (effect.stability ?? 0), 0, 100),
    },
    ...appendLog(state, 'system', '事件结算', result),
  })
  return checkDefeat(next)
}

export function getCurrentEvent(state: RunState) {
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)
  const index = Math.floor(randomAt(state.seed, (node?.layer ?? 0) + 91) * EVENTS.length)
  return EVENTS[index]
}
