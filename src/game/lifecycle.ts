import type { RunState } from './types'
import { clamp } from './util'

export function finishRun(state: RunState, outcome: 'victory' | 'defeat', message: string): RunState {
  return { ...state, screen: 'summary', lastOutcome: outcome, lastMessage: message }
}

export function checkDefeat(state: RunState): RunState {
  if (state.resources.budget < 0) return finishRun(state, 'defeat', 'API 预算被烧穿，财务拔掉了网线。')
  if (state.resources.context >= state.resources.contextMax) return finishRun(state, 'defeat', '上下文窗口溢出，Agent 忘记了自己为什么在这里。')
  if (state.resources.time <= 0) return finishRun(state, 'defeat', '截止时间归零，客户先一步点击了“取消项目”。')
  if (state.resources.stability <= 0) return finishRun(state, 'defeat', '代码稳定度归零，main 分支变成了现代艺术。')
  return state
}

export function completeUtilityNode(state: RunState): RunState {
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)
  return {
    ...state,
    screen: 'map',
    completedNodes: state.currentNodeId ? [...state.completedNodes, state.currentNodeId] : state.completedNodes,
    availableNodeIds: node?.next ?? [],
    currentNodeId: state.currentNodeId,
  }
}

/**
 * Appends one log entry using the run's monotonic counter.
 * Avoids Date.now() so the same seed and the same decisions always reproduce the same run.
 */
export function appendLog(
  state: RunState,
  role: RunState['logs'][number]['role'],
  title: string,
  body: string,
  meta?: string,
): Pick<RunState, 'logs' | 'logSeq'> {
  const seq = state.logSeq ?? state.logs.length
  const entry = { id: `log-${seq}`, role, title, body, meta }
  return { logs: [...state.logs.slice(-11), entry], logSeq: seq + 1 }
}

export { clamp }
