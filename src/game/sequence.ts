import type { ActionCard, EncounterState } from './types'

const PREREQUISITE_LABELS: Record<'analysis' | 'code' | 'test' | 'reviews', string> = {
  analysis: '调查',
  code: '实现',
  test: '验证',
  reviews: '评审',
}

export interface SequenceAssessment {
  missing: string[]
  severity: number
  ready: boolean
  hint: string
}

export function assessCardSequence(encounter: EncounterState, card: ActionCard): SequenceAssessment {
  const missing: string[] = []
  let severity = 0
  const requirements = Object.entries(card.requires ?? {}) as Array<[keyof typeof PREREQUISITE_LABELS, number]>
  for (const [key, required] of requirements) {
    const current = encounter[key]
    if (current < required) {
      const gap = required - current
      missing.push(`${PREREQUISITE_LABELS[key]} ${required}点`)
      severity += key === 'reviews' ? 0.8 * gap : 0.6 * gap
    }
  }
  return {
    missing,
    severity: Math.min(2.4, severity),
    ready: missing.length === 0,
    hint: card.sequenceTip ?? (missing.length ? `建议先补：${missing.join('、')}` : '顺序自由'),
  }
}
