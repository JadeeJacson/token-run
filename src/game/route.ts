import { PROJECTS, getProject } from './data'
import { shuffled } from './rng'
import type { NodeType, RouteNode } from './types'

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
