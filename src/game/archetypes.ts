import type { ArchetypeId, ArchetypeSpec, RunState } from './types'

export const ARCHETYPES: ArchetypeSpec[] = [
  {
    id: 'frugal',
    name: '省钱流',
    tagline: '账单比代码更可怕',
    description: '用缓存、折扣与便宜模型把费用压到地板。进度略慢，但预算压力最小。',
    icon: '¥',
    startBuffId: 'flash-sale',
    cardWeights: {
      'compress-context': 1.8,
      'type-check': 1.7,
      'precision-patch': 1.4,
      'freeze-feature': 1.3,
    },
    passives: { costMultiplier: 0.88, contextMultiplier: 1.05 },
  },
  {
    id: 'evidence',
    name: '证据流',
    tagline: '先留证据，再谈交付',
    description: '调查、测试与自审更容易按序连击。流程纪律加分更高，交付置信更稳。',
    icon: '≡',
    startBuffId: 'prompt-linter',
    cardWeights: {
      'scan-repo': 1.6,
      'read-logs': 1.6,
      'write-rfc': 1.5,
      'unit-tests': 1.4,
      'full-suite': 1.3,
    },
    passives: { sequenceBonus: 1.35, progressMultiplier: { analysis: 1.1, test: 1.1, review: 1.1 } },
  },
  {
    id: 'rewrite',
    name: '重写流',
    tagline: '修什么修，整段换掉',
    description: '重写与重构卡推进更快，稳定度惩罚更低。适合敢赌的交付节奏。',
    icon: '↻',
    startBuffId: 'night-shift',
    cardWeights: {
      'rewrite-module': 1.8,
      'refactor-extract': 1.6,
      'manual-hotfix': 1.4,
      'precision-patch': 1.2,
    },
    passives: { progressMultiplier: { code: 1.2 }, rewriteStabilityMultiplier: 0.75 },
  },
  {
    id: 'compress',
    name: '压缩流',
    tagline: '上下文是燃料，不是仓库',
    description: '操作占上下文更少，压缩时更少丢失调查。适合高速迭代与混乱重放。',
    icon: '»',
    startBuffId: 'elastic-context',
    cardWeights: {
      'compress-context': 1.7,
      'pair-debug': 1.6,
      'chaos-replay': 1.4,
      'git-rollback': 1.2,
    },
    passives: { contextMultiplier: 0.85, compressKeepBonus: 0.15 },
  },
]

export const DEFAULT_ARCHETYPE_ID: ArchetypeId = 'frugal'

export function getArchetype(id: ArchetypeId): ArchetypeSpec {
  return ARCHETYPES.find((item) => item.id === id) ?? ARCHETYPES[0]
}

export function archetypeWeights(id: ArchetypeId): Record<string, number> {
  return getArchetype(id).cardWeights
}

export function applyArchetypeCost(id: ArchetypeId, cost: number): number {
  const multiplier = getArchetype(id).passives.costMultiplier ?? 1
  return cost * multiplier
}

export function progressMultiplierFor(id: ArchetypeId, key: 'analysis' | 'code' | 'test' | 'review'): number {
  return getArchetype(id).passives.progressMultiplier?.[key] ?? 1
}

export function normalizeArchetype(id: string | undefined | null): ArchetypeId {
  if (id === 'evidence' || id === 'rewrite' || id === 'compress' || id === 'frugal') return id
  return DEFAULT_ARCHETYPE_ID
}

export function startBuffFor(archetypeId: ArchetypeId): { id: string; description?: string } | null {
  const id = getArchetype(archetypeId).startBuffId
  return id ? { id } : null
}

export type { RunState }
