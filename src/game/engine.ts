import { ACTION_CARDS, BUFFS, EVENTS, MODELS, PROJECTS, STARTER_MODEL_IDS, getModel, getProject } from './data'
import type {
  ActionCard,
  BuffState,
  ChoiceEffect,
  EventSpec,
  MetaProgress,
  ModelSpec,
  NodeType,
  RouteNode,
  RunState,
} from './types'

export const DEFAULT_META: MetaProgress = {
  version: 1,
  xp: 0,
  runs: 0,
  victories: 0,
  bestScore: 0,
  unlockedModels: [...STARTER_MODEL_IDS],
  seenProjects: [],
}

export const MODEL_UNLOCKS: Record<string, number> = {
  'gemina-flash': 4,
  'qwan-max': 8,
  'cloude-sonnet': 13,
  'glm-5.3': 18,
  'codax-terra': 24,
  'codax-sol': 32,
}

const ROUTE_LAYOUT: Array<{ id: string; layer: number; x: number; type: NodeType; next: string[] }> = [
  { id: 'l0-a', layer: 0, x: 18, type: 'project', next: ['l1-a'] },
  { id: 'l0-b', layer: 0, x: 50, type: 'project', next: ['l1-a', 'l1-b'] },
  { id: 'l0-c', layer: 0, x: 82, type: 'project', next: ['l1-b'] },
  { id: 'l1-a', layer: 1, x: 34, type: 'project', next: ['l2-a', 'l2-b'] },
  { id: 'l1-b', layer: 1, x: 66, type: 'project', next: ['l2-b', 'l2-c'] },
  { id: 'l2-a', layer: 2, x: 20, type: 'event', next: ['l3-a'] },
  { id: 'l2-b', layer: 2, x: 50, type: 'project', next: ['l3-a', 'l3-b'] },
  { id: 'l2-c', layer: 2, x: 80, type: 'event', next: ['l3-b'] },
  { id: 'l3-a', layer: 3, x: 35, type: 'project', next: ['l4-a', 'l4-b'] },
  { id: 'l3-b', layer: 3, x: 65, type: 'project', next: ['l4-b', 'l4-c'] },
  { id: 'l4-a', layer: 4, x: 22, type: 'cache', next: ['l5-a'] },
  { id: 'l4-b', layer: 4, x: 50, type: 'project', next: ['l5-a', 'l5-b'] },
  { id: 'l4-c', layer: 4, x: 78, type: 'cache', next: ['l5-b'] },
  { id: 'l5-a', layer: 5, x: 36, type: 'project', next: ['l6-boss'] },
  { id: 'l5-b', layer: 5, x: 64, type: 'project', next: ['l6-boss'] },
  { id: 'l6-boss', layer: 6, x: 50, type: 'boss', next: [] },
]

export function randomAt(seed: number, cursor: number): number {
  let x = (seed + cursor * 0x6d2b79f5) | 0
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

export function shuffled<T>(items: T[], seed: number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomAt(seed, i + 19) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function buildRoute(seed: number): RouteNode[] {
  const projectPool = shuffled(PROJECTS.filter((project) => project.id !== 'friday-deploy'), seed)
  let projectCursor = 0
  return ROUTE_LAYOUT.map((node) => {
    const project = node.type === 'boss'
      ? getProject('friday-deploy')
      : node.type === 'project'
        ? projectPool[projectCursor++ % projectPool.length]
        : undefined
    const label = project?.title ?? (node.type === 'event' ? '未知事件' : '上下文休整')
    return { ...node, projectId: project?.id, label }
  })
}

export function createRun(seed: number, modelId: string, retry = false): RunState {
  const availableModels = [...new Set([...STARTER_MODEL_IDS, modelId])]
  return {
    seed,
    rngCursor: 1,
    retryUsed: retry,
    screen: 'map',
    route: buildRoute(seed),
    currentNodeId: null,
    completedNodes: [],
    availableNodeIds: ['l0-a', 'l0-b', 'l0-c'],
    selectedModelId: modelId,
    availableModelIds: availableModels,
    resources: { budget: 9.6, budgetMax: 9.6, context: 8000, contextMax: 180000, time: 58, timeMax: 58, stability: 78 },
    encounter: null,
    logs: [
      { id: 'boot-1', role: 'system', title: 'Workspace ready', body: '沙箱已创建。预算、上下文与 deadline 监控已接管。', meta: `seed:${seed}` },
      { id: 'boot-2', role: 'agent', title: getModel(modelId).parodyName, body: '我准备好了。理论上。请选择第一个项目。' },
    ],
    buffs: [],
    usage: [],
    completedProjects: 0,
    failedProjects: 0,
    score: 0,
    pendingReward: 0,
    metaRecorded: false,
  }
}

export function beginNode(state: RunState, nodeId: string): RunState {
  if (!state.availableNodeIds.includes(nodeId)) return state
  const node = state.route.find((candidate) => candidate.id === nodeId)
  if (!node) return state

  if (node.type === 'project' || node.type === 'boss') {
    const project = getProject(node.projectId ?? 'friday-deploy')
    return {
      ...state,
      screen: 'encounter',
      currentNodeId: node.id,
      encounter: {
        projectId: project.id,
        analysis: 0,
        code: 0,
        test: 0,
        reviews: 0,
        revealedRisk: 0,
        deliveryAttempts: 0,
        actionCount: 0,
        cooldowns: {},
        codeMode: 'diff',
      },
      logs: pushLog(state.logs, 'system', project.title, project.brief, `${project.kind} · 难度 ${project.difficulty}/5`),
    }
  }

  return { ...state, screen: 'event', currentNodeId: node.id, encounter: null }
}

export function getCurrentEvent(state: RunState): EventSpec {
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)
  const index = Math.floor(randomAt(state.seed, (node?.layer ?? 0) + 91) * EVENTS.length)
  return EVENTS[index]
}

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
  let cursor = state.rngCursor
  const complexity = 0.82 + project.difficulty * 0.08
  const input = card.manual ? 0 : Math.round(lerp(card.inputRange[0], card.inputRange[1], randomAt(state.seed, cursor++)) * complexity)
  const output = card.manual ? 0 : Math.round(lerp(card.outputRange[0], card.outputRange[1], randomAt(state.seed, cursor++)) * complexity)
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

  const reliabilityBuff = buffs.reduce((sum, buff) => sum + (buff.reliabilityBonus ?? 0), 0)
  const effectiveReliability = clamp(model.reliability + reliabilityBuff, 0.2, 0.99)
  const outcomeRoll = randomAt(state.seed, cursor++)
  const isClean = outcomeRoll <= effectiveReliability - (card.risk === '高' ? 0.12 : card.risk === '中' ? 0.04 : 0)
  const power = isClean ? model.power : Math.max(0.55, model.power * 0.62)
  const deltaAnalysis = scaledEffect(card.effect.analysis, power)
  const deltaCode = scaledEffect(card.effect.code, power)
  const deltaTest = scaledEffect(card.effect.test, power)
  const deltaReview = scaledEffect(card.effect.review, isClean ? 1 : 0.65)
  const unstable = !isClean ? (card.risk === '高' ? -9 : card.risk === '中' ? -5 : -2) : 0
  const stabilityDelta = (card.effect.stability ?? 0) + unstable
  const timeCost = card.manual ? card.timeCost : Math.max(1, Math.ceil(card.timeCost / model.speed))
  const addedContext = Math.round((input * 0.16 + output) * card.contextLoad)
  const reduction = card.effect.contextReduction ?? 0
  const nextContext = Math.max(2000, Math.round((state.resources.context + addedContext) * (1 - reduction)))
  const progressLabel = progressSummary(deltaAnalysis, deltaCode, deltaTest)
  const exactMeta = `↑${formatTokens(input)} · cache ${formatTokens(cached)} · ↓${formatTokens(output)} · ¥${cost.toFixed(3)}${discountLabel}`
  const body = isClean
    ? `${card.description} ${progressLabel}`
    : `Agent 给出了一个很自信的结果，但留下了可疑改动。${progressLabel}`

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
      analysis: Math.max(0, state.encounter.analysis + deltaAnalysis),
      code: Math.max(0, state.encounter.code + deltaCode),
      test: Math.max(0, state.encounter.test + deltaTest),
      reviews: Math.max(0, state.encounter.reviews + deltaReview),
      revealedRisk: Math.min(project.hiddenRisk, state.encounter.revealedRisk + Math.max(0, deltaReview) + (card.id === 'read-logs' ? 1 : 0)),
      actionCount: state.encounter.actionCount + 1,
      cooldowns,
      codeMode: card.testAction ? 'terminal' : card.kind === 'build' ? 'diff' : state.encounter.codeMode,
    },
    usage: card.manual ? state.usage : [...state.usage, { action: card.name, modelId: model.id, input, cached, output, cost }],
    score: state.score + Math.max(0, deltaAnalysis + deltaCode + deltaTest + deltaReview) * 12,
    logs: pushLog(state.logs, isClean ? (card.testAction ? 'tool' : 'agent') : 'warning', card.name, body, exactMeta),
  }

  return checkDefeat(next)
}

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
  const value = clamp(0.1 + readiness * 0.64 + (model.reliability + reliabilityBuff) * 0.15 + stability - unresolved * 0.045, 0.08, 0.98)
  const label = value >= 0.86 ? '很稳' : value >= 0.68 ? '可交付' : value >= 0.48 ? '有风险' : value >= 0.28 ? '危险' : '像在许愿'
  const detail = state.encounter.revealedRisk >= project.hiddenRisk
    ? `已识别 ${project.hiddenRisk} 个主要风险`
    : `至少发现 ${state.encounter.revealedRisk} 个风险，可能还有遗漏`
  return { value, label, detail }
}

export function attemptDelivery(state: RunState): RunState {
  if (!state.encounter || state.screen !== 'encounter') return state
  const project = getProject(state.encounter.projectId)
  const confidence = deliveryConfidence(state)
  const roll = randomAt(state.seed, state.rngCursor)
  const success = roll <= confidence.value
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)

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
      logs: pushLog(state.logs, 'success', '交付通过', project.successText, `置信判断：${confidence.label}`),
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
      budget: state.resources.budget - 0.16,
      stability: clamp(state.resources.stability - 13, 0, 100),
    },
    encounter: {
      ...state.encounter,
      test: Math.max(0, state.encounter.test - 2),
      deliveryAttempts: state.encounter.deliveryAttempts + 1,
      codeMode: 'terminal',
    },
    logs: pushLog(state.logs, 'warning', '交付被打回', project.failureText, `实际结果超出“${confidence.label}”预测`),
  }
  return checkDefeat(failed)
}

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
      logs: pushLog(state.logs, 'system', '模型已接入', `${getModel(reward.id).parodyName} 已成为当前 Agent 后端。`, '本局解锁'),
    }
  }

  const selected = BUFFS.find((buff) => buff.id === reward.id)
  if (!selected) return state
  const already = state.buffs.find((buff) => buff.id === selected.id)
  const buffs = already
    ? state.buffs.map((buff) => buff.id === selected.id
      ? { ...buff, discountUses: (buff.discountUses ?? 0) + (selected.discountUses ?? 0), testDiscountUses: (buff.testDiscountUses ?? 0) + (selected.testDiscountUses ?? 0) }
      : buff)
    : [...state.buffs, { ...selected }]
  const contextBonus = selected.contextBonus ?? 0
  return {
    ...state,
    screen: 'map',
    encounter: null,
    pendingReward: 0,
    buffs,
    resources: { ...state.resources, contextMax: state.resources.contextMax + contextBonus },
    logs: pushLog(state.logs, 'system', 'Buff 已安装', selected.description, selected.name),
  }
}

export function resolveEvent(state: RunState, effect: ChoiceEffect, result: string): RunState {
  if (state.screen !== 'event') return state
  let buffs = [...state.buffs]
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
    logs: pushLog(state.logs, 'system', '事件结算', result),
  })
  return checkDefeat(next)
}

export function resolveCache(state: RunState, choice: 'compact' | 'stabilize' | 'deadline'): RunState {
  if (state.screen !== 'event') return state
  const effects = {
    compact: { context: Math.max(2000, Math.round(state.resources.context * 0.3)), time: state.resources.time - 1, stability: state.resources.stability, message: '上下文已压缩到必要摘要。三段闲聊和一个旧报错被遗忘。' },
    stabilize: { context: state.resources.context, time: state.resources.time - 1, stability: Math.min(100, state.resources.stability + 18), message: '你整理了分支并补上检查点，代码稳定度恢复。' },
    deadline: { context: state.resources.context + 6000, time: Math.min(state.resources.timeMax, state.resources.time + 5), stability: state.resources.stability - 3, message: '你用一张精心制作的甘特图换来了五格时间。' },
  }[choice]
  const next = completeUtilityNode({
    ...state,
    resources: { ...state.resources, context: effects.context, time: effects.time, stability: effects.stability },
    logs: pushLog(state.logs, 'system', '休整完成', effects.message),
  })
  return checkDefeat(next)
}

export function setEncounterView(state: RunState, mode: 'source' | 'diff' | 'terminal'): RunState {
  if (!state.encounter) return state
  return { ...state, encounter: { ...state.encounter, codeMode: mode } }
}

export function switchModel(state: RunState, modelId: string): RunState {
  if (!state.availableModelIds.includes(modelId)) return state
  return {
    ...state,
    selectedModelId: modelId,
    logs: pushLog(state.logs, 'system', '后端切换', `当前模型：${getModel(modelId).parodyName}`, '不消耗 Token'),
  }
}

export function updateMeta(meta: MetaProgress, state: RunState): MetaProgress {
  const gainedXp = state.completedProjects + (state.lastOutcome === 'victory' ? 3 : 0)
  const xp = meta.xp + gainedXp
  const thresholdModels = Object.entries(MODEL_UNLOCKS)
    .filter(([, threshold]) => xp >= threshold)
    .map(([id]) => id)
  const seenProjects = [...new Set([
    ...meta.seenProjects,
    ...state.completedNodes.map((nodeId) => state.route.find((node) => node.id === nodeId)?.projectId).filter((id): id is string => Boolean(id)),
  ])]
  return {
    ...meta,
    xp,
    runs: meta.runs + 1,
    victories: meta.victories + (state.lastOutcome === 'victory' ? 1 : 0),
    bestScore: Math.max(meta.bestScore, finalScore(state)),
    unlockedModels: [...new Set([...meta.unlockedModels, ...thresholdModels])],
    seenProjects,
  }
}

export function finalScore(state: RunState): number {
  const resourceBonus = Math.max(0, state.resources.budget) * 90 + Math.max(0, state.resources.time) * 12 + state.resources.stability * 4
  return Math.round(state.score + resourceBonus)
}

export function totalUsage(state: RunState): { input: number; cached: number; output: number; cost: number } {
  return state.usage.reduce((total, item) => ({
    input: total.input + item.input,
    cached: total.cached + item.cached,
    output: total.output + item.output,
    cost: total.cost + item.cost,
  }), { input: 0, cached: 0, output: 0, cost: 0 })
}

export function nextPermanentUnlock(meta: MetaProgress): { model: ModelSpec; threshold: number } | null {
  const next = Object.entries(MODEL_UNLOCKS)
    .filter(([id]) => !meta.unlockedModels.includes(id))
    .sort((a, b) => a[1] - b[1])[0]
  if (!next) return null
  return { model: getModel(next[0]), threshold: next[1] }
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 100_000 ? 0 : 1)}K`
  return String(value)
}

export function formatCny(value: number): string {
  return `¥${Math.max(0, value).toFixed(2)}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function finishRun(state: RunState, outcome: 'victory' | 'defeat', message: string): RunState {
  return { ...state, screen: 'summary', lastOutcome: outcome, lastMessage: message }
}

function checkDefeat(state: RunState): RunState {
  if (state.resources.budget < 0) return finishRun(state, 'defeat', 'API 预算被烧穿，财务拔掉了网线。')
  if (state.resources.context >= state.resources.contextMax) return finishRun(state, 'defeat', '上下文窗口溢出，Agent 忘记了自己为什么在这里。')
  if (state.resources.time <= 0) return finishRun(state, 'defeat', '截止时间归零，客户先一步点击了“取消项目”。')
  if (state.resources.stability <= 0) return finishRun(state, 'defeat', '代码稳定度归零，main 分支变成了现代艺术。')
  return state
}

function completeUtilityNode(state: RunState): RunState {
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)
  return {
    ...state,
    screen: 'map',
    completedNodes: state.currentNodeId ? [...state.completedNodes, state.currentNodeId] : state.completedNodes,
    availableNodeIds: node?.next ?? [],
    currentNodeId: state.currentNodeId,
  }
}

function pushLog(logs: RunState['logs'], role: RunState['logs'][number]['role'], title: string, body: string, meta?: string): RunState['logs'] {
  const entry = { id: `${Date.now()}-${logs.length}`, role, title, body, meta }
  return [...logs.slice(-11), entry]
}

function lerp(min: number, max: number, amount: number): number {
  return min + (max - min) * amount
}

function scaledEffect(value = 0, multiplier = 1): number {
  if (value === 0) return 0
  const sign = Math.sign(value)
  const scaled = value > 0 ? Math.ceil(Math.abs(value) * multiplier) : Math.round(Math.abs(value) * multiplier)
  return sign * Math.max(1, scaled)
}

function progressSummary(analysis: number, code: number, test: number): string {
  const pieces: string[] = []
  if (analysis) pieces.push(`调查${signed(analysis)}`)
  if (code) pieces.push(`实现${signed(code)}`)
  if (test) pieces.push(`验证${signed(test)}`)
  return pieces.length ? `进度：${pieces.join(' / ')}。` : ''
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
