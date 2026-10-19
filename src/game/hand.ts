import { ACTION_CARDS } from './data'
import { archetypeWeights } from './archetypes'
import { randomAt, weightedSample } from './rng'
import type { ActionCard, RunState } from './types'

/** 每个项目节点都会出现的固定卡，保证基础链路永远可用。 */
export const FIXED_HAND_IDS = ['scan-repo', 'precision-patch', 'unit-tests', 'compress-context'] as const

/** 由节点 id 派生的稳定盐值：同一节点内手牌固定，不会每执行一次操作就重洗。 */
function nodeSalt(nodeId: string | null): number {
  const key = nodeId ?? 'node'
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 100_000
}

export function buildHand(state: RunState): ActionCard[] {
  if (!state.encounter) return []
  const salt = state.seed + nodeSalt(state.currentNodeId) * 7 + state.completedNodes.length * 13
  const fixed = FIXED_HAND_IDS
    .map((id) => ACTION_CARDS.find((card) => card.id === id))
    .filter((card): card is ActionCard => Boolean(card))
  const weights = archetypeWeights(state.archetypeId)
  const extras = weightedSample(
    ACTION_CARDS
      .filter((card) => !(FIXED_HAND_IDS as readonly string[]).includes(card.id))
      .map((card, index) => ({
        item: card,
        weight: (weights[card.id] ?? 1) * (0.55 + randomAt(salt, index + 200)),
      })),
    salt,
    3,
  )
  return [...fixed, ...extras]
}
