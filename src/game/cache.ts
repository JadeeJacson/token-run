import { appendLog, checkDefeat, completeUtilityNode } from './lifecycle'
import type { RunState } from './types'
import { clamp } from './util'

/** 休整节点「申请延期」换时间需要付出的上下文代价。 */
export const CACHE_DEADLINE_CONTEXT = 6000

export interface CacheOutcome {
  context: number
  time: number
  stability: number
  message: string
  /** 该选择本会把上下文推出窗口；执行前应当被禁用。 */
  overflow: boolean
}

export type CacheChoice = 'compact' | 'stabilize' | 'deadline'

/** Single source of truth for the rest node: used both by the engine and by the UI preview. */
export function cacheOutcome(state: RunState, choice: CacheChoice): CacheOutcome {
  const { context, time, stability, contextMax, timeMax } = state.resources
  const deadlineContext = context + CACHE_DEADLINE_CONTEXT
  const outcomes: Record<CacheChoice, CacheOutcome> = {
    compact: {
      context: Math.max(2000, Math.round(context * 0.3)),
      time: time - 1,
      stability,
      message: '上下文已压缩到必要摘要。三段闲聊和一个旧报错被遗忘。',
      overflow: false,
    },
    stabilize: {
      context,
      time: time - 1,
      stability: Math.min(100, stability + 18),
      message: '你整理了分支并补上检查点，代码稳定度恢复。',
      overflow: false,
    },
    deadline: {
      // 夹到窗口内但不贴边：休整不该因为一次 clamp 就直接判负，
      // 真正的溢出由 cacheChoicePreview 提前告知并在界面禁用该选项。
      context: clamp(deadlineContext, 2000, contextMax - 1),
      time: Math.min(timeMax, time + 5),
      stability: stability - 3,
      message: '你用一张精心制作的甘特图换来了五格时间。',
      overflow: deadlineContext >= contextMax,
    },
  }
  return outcomes[choice]
}

export interface CacheChoicePreview {
  context: number
  overflow: boolean
  disabled: boolean
}

/** Lets the rest screen show the exact context each choice produces, and block the overflowing one. */
export function cacheChoicePreview(state: RunState): Record<CacheChoice, CacheChoicePreview> {
  const choices: CacheChoice[] = ['compact', 'stabilize', 'deadline']
  return choices.reduce((acc, choice) => {
    const outcome = cacheOutcome(state, choice)
    acc[choice] = { context: outcome.context, overflow: outcome.overflow, disabled: outcome.overflow }
    return acc
  }, {} as Record<CacheChoice, CacheChoicePreview>)
}

export function resolveCache(state: RunState, choice: CacheChoice): RunState {
  if (state.screen !== 'event') return state
  const effects = cacheOutcome(state, choice)
  const next = completeUtilityNode({
    ...state,
    resources: { ...state.resources, context: effects.context, time: effects.time, stability: effects.stability },
    ...appendLog(state, 'system', '休整完成', effects.message),
  })
  return checkDefeat(next)
}
