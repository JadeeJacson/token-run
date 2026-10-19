import { STARTER_MODEL_IDS, BUFFS, getModel, getProject } from './data'
import { DEFAULT_ARCHETYPE_ID, getArchetype, normalizeArchetype } from './archetypes'
import { appendLog } from './lifecycle'
import { buildRoute } from './route'
import type { ArchetypeId, RunState } from './types'

export {
  ARCHETYPES,
  DEFAULT_ARCHETYPE_ID,
  getArchetype,
  normalizeArchetype,
} from './archetypes'
export {
  CACHE_DEADLINE_CONTEXT,
  cacheChoicePreview,
  cacheOutcome,
  resolveCache,
  type CacheChoice,
  type CacheChoicePreview,
  type CacheOutcome,
} from './cache'
export {
  assessCardSequence,
  type SequenceAssessment,
} from './sequence'
export { fuzzyTokenEstimate, playAction } from './actions'
export { deliveryConfidence, attemptDelivery } from './delivery'
export { FIXED_HAND_IDS, buildHand } from './hand'
export { randomAt, shuffled, weightedSample } from './rng'
export { buildRoute } from './route'
export { finalScore, finalScoreBreakdown, totalUsage } from './scoring'
export {
  DEFAULT_META,
  META_VERSION,
  MODEL_UNLOCKS,
  nextPermanentUnlock,
  normalizeMeta,
  updateMeta,
} from './progress'
export { availableRewards, chooseReward, getCurrentEvent, resolveEvent } from './events'
export { clamp, formatCny, formatTokens } from './util'
export { appendLog } from './lifecycle'

/** RunState 结构版本，用于旧档迁移。 */
export const RUN_VERSION = 2

export function createRun(seed: number, modelId: string, retry = false, archetypeId: ArchetypeId = DEFAULT_ARCHETYPE_ID): RunState {
  const availableModels = [...new Set([...STARTER_MODEL_IDS, modelId])]
  const archetype = getArchetype(archetypeId)
  const startBuff = archetype.startBuffId ? BUFFS.find((buff) => buff.id === archetype.startBuffId) : undefined
  const contextBonus = startBuff?.contextBonus ?? 0
  return {
    version: RUN_VERSION,
    seed,
    rngCursor: 1,
    retryUsed: retry,
    screen: 'map',
    archetypeId: archetype.id,
    audits: [],
    route: buildRoute(seed),
    currentNodeId: null,
    completedNodes: [],
    availableNodeIds: ['l0-a', 'l0-b', 'l0-c'],
    selectedModelId: modelId,
    availableModelIds: availableModels,
    // Token 量级已经提升到百万级；预算也同步放大，仍然保持一局约十分钟的资源压力。
    resources: {
      budget: 6800,
      budgetMax: 7600,
      context: 10000,
      contextMax: 220000 + contextBonus,
      time: 58,
      timeMax: 58,
      stability: 78,
    },
    encounter: null,
    logs: [
      { id: 'log-0', role: 'system', title: 'Workspace ready', body: '沙箱已创建。预算、上下文与 deadline 监控已接管。', meta: `seed:${seed}` },
      { id: 'log-1', role: 'agent', title: getModel(modelId).parodyName, body: `工作方式：${archetype.name}。我准备好了。理论上。请选择第一个项目。` },
      ...(startBuff ? [{ id: 'log-2', role: 'system' as const, title: '流派起手', body: startBuff.description, meta: startBuff.name }] : []),
    ],
    logSeq: startBuff ? 3 : 2,
    buffs: startBuff ? [{ ...startBuff }] : [],
    usage: [],
    completedProjects: 0,
    failedProjects: 0,
    score: 0,
    disciplineScore: 0,
    pendingReward: 0,
  }
}

/** Backfills fields added by later builds so runs saved by an older version stay playable. */
export function normalizeRun(state: RunState): RunState {
  return {
    ...state,
    version: RUN_VERSION,
    archetypeId: normalizeArchetype(state.archetypeId),
    audits: state.audits ?? [],
    logSeq: state.logSeq ?? state.logs.length,
    disciplineScore: state.disciplineScore ?? 0,
    encounter: state.encounter
      ? {
        ...state.encounter,
        workflowDebt: state.encounter.workflowDebt ?? 0,
        sequenceStreak: state.encounter.sequenceStreak ?? 0,
        usageStart: state.encounter.usageStart ?? 0,
        disciplineStart: state.encounter.disciplineStart ?? 0,
      }
      : null,
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
        workflowDebt: 0,
        sequenceStreak: 0,
        usageStart: state.usage.length,
        disciplineStart: state.disciplineScore,
        cooldowns: {},
        codeMode: 'diff',
      },
      ...appendLog(state, 'system', project.title, project.brief, `${project.kind} · 难度 ${project.difficulty}/5`),
    }
  }

  return { ...state, screen: 'event', currentNodeId: node.id, encounter: null }
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
    ...appendLog(state, 'system', '后端切换', `当前模型：${getModel(modelId).parodyName}`, '不消耗 Token'),
  }
}


