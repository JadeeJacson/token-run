import { STARTER_MODEL_IDS, getModel } from './data'
import { finalScore } from './scoring'
import type { MetaProgress, ModelSpec, RunState } from './types'

/** 当前存档结构版本。破坏性数值调整时递增，旧档的 bestScore 会随之重置。 */
export const META_VERSION = 2

export const DEFAULT_META: MetaProgress = {
  version: META_VERSION,
  xp: 0,
  runs: 0,
  victories: 0,
  bestScore: 0,
  unlockedModels: [...STARTER_MODEL_IDS],
  seenProjects: [],
  recordedRunKeys: [],
}

export const MODEL_UNLOCKS: Record<string, number> = {
  'gemina-flash': 4,
  'qwan-max': 8,
  'glm-air': 10,
  'cloude-sonnet': 13,
  'glm-5.3': 18,
  'deep-reasoner': 21,
  'codax-terra': 24,
  'qwan-long': 28,
  'codax-sol': 32,
}

export function updateMeta(meta: MetaProgress, state: RunState, runKey?: string): MetaProgress {
  // 同一局只会结算一次职业经验；runKey 让调用方可以幂等重放。
  if (runKey && (meta.recordedRunKeys ?? []).includes(runKey)) return meta
  const gainedXp = state.completedProjects + (state.lastOutcome === 'victory' ? 3 : 0)
  const xp = meta.xp + gainedXp
  const thresholdModels = Object.entries(MODEL_UNLOCKS)
    .filter(([, threshold]) => xp >= threshold)
    .map(([id]) => id)
  const seenProjects = [...new Set([
    ...meta.seenProjects,
    ...state.completedNodes.map((nodeId) => state.route.find((node) => node.id === nodeId)?.projectId).filter((id): id is string => Boolean(id)),
  ])]
  const score = finalScore(state)
  // 计分公式调整后旧最高分与新分数不可比：直接以本局重置，避免老纪录永远打不破。
  const legacyScore = meta.version < META_VERSION
  return {
    ...meta,
    version: META_VERSION,
    xp,
    runs: meta.runs + 1,
    victories: meta.victories + (state.lastOutcome === 'victory' ? 1 : 0),
    bestScore: legacyScore ? score : Math.max(meta.bestScore, score),
    unlockedModels: [...new Set([...meta.unlockedModels, ...thresholdModels])],
    seenProjects,
    recordedRunKeys: runKey ? [...(meta.recordedRunKeys ?? []), runKey].slice(-100) : (meta.recordedRunKeys ?? []),
  }
}

/** Backfills metadata saved by older builds so missing arrays never break the home screen. */
export function normalizeMeta(meta: MetaProgress): MetaProgress {
  return {
    ...DEFAULT_META,
    ...meta,
    unlockedModels: [...new Set([...DEFAULT_META.unlockedModels, ...(meta.unlockedModels ?? [])])],
    seenProjects: meta.seenProjects ?? [],
    recordedRunKeys: meta.recordedRunKeys ?? [],
  }
}

export function nextPermanentUnlock(meta: MetaProgress): { model: ModelSpec; threshold: number } | null {
  const next = Object.entries(MODEL_UNLOCKS)
    .filter(([id]) => !meta.unlockedModels.includes(id))
    .sort((a, b) => a[1] - b[1])[0]
  if (!next) return null
  return { model: getModel(next[0]), threshold: next[1] }
}
