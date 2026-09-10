import { Bug, Coffee, GitBranch, RadioTower, Skull, Sparkles } from 'lucide-react'
import type { RouteNode } from '../game/types'

const MAP_WIDTH = 760
const MAP_HEIGHT = 650

function nodePoint(node: RouteNode) {
  return { x: (node.x / 100) * MAP_WIDTH, y: 55 + node.layer * 92 }
}

export function RouteMap({
  nodes,
  completed,
  available,
  current,
  onSelect,
}: {
  nodes: RouteNode[]
  completed: string[]
  available: string[]
  current: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="route-stage">
      <div className="route-heading">
        <div>
          <span className="eyebrow">RUN MAP / 七层交付路线</span>
          <h1>选择下一份“绝对不复杂”的需求</h1>
          <p>路径会分叉，但周五发布永远在那里等你。</p>
        </div>
        <div className="route-legend">
          <span><Bug size={14} /> 项目</span>
          <span><Sparkles size={14} /> 事件</span>
          <span><Coffee size={14} /> 休整</span>
        </div>
      </div>

      <div className="route-map" style={{ aspectRatio: `${MAP_WIDTH}/${MAP_HEIGHT}` }}>
        <div className="route-grid" />
        <svg className="route-lines" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
          {nodes.flatMap((node) => node.next.map((nextId) => {
            const next = nodes.find((candidate) => candidate.id === nextId)
            if (!next) return null
            const start = nodePoint(node)
            const end = nodePoint(next)
            const active = completed.includes(node.id) && (available.includes(next.id) || completed.includes(next.id))
            return <path key={`${node.id}-${next.id}`} className={active ? 'active' : ''} d={`M ${start.x} ${start.y + 24} C ${start.x} ${start.y + 58}, ${end.x} ${end.y - 58}, ${end.x} ${end.y - 24}`} />
          }))}
        </svg>

        {nodes.map((node) => {
          const point = nodePoint(node)
          const isComplete = completed.includes(node.id)
          const isAvailable = available.includes(node.id)
          const isCurrent = current === node.id
          const locked = !isComplete && !isAvailable && !isCurrent
          const Icon = node.type === 'boss' ? Skull : node.type === 'event' ? Sparkles : node.type === 'cache' ? Coffee : node.layer > 3 ? RadioTower : Bug
          return (
            <button
              type="button"
              key={node.id}
              className={`route-node ${node.type} ${isComplete ? 'complete' : ''} ${isAvailable ? 'available' : ''} ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}`}
              style={{ left: `${node.x}%`, top: `${(point.y / MAP_HEIGHT) * 100}%` }}
              disabled={!isAvailable}
              onClick={() => onSelect(node.id)}
              aria-label={`${node.label}${isAvailable ? '，可选择' : ''}`}
            >
              <span className="node-orbit" />
              <span className="node-icon"><Icon size={17} /></span>
              <span className="node-copy">
                <small>{node.type === 'boss' ? 'FINAL' : `0${node.layer + 1}`}</small>
                <strong>{node.label}</strong>
              </span>
            </button>
          )
        })}

        <div className="route-start-label"><GitBranch size={13} /> ENTRY</div>
      </div>
    </section>
  )
}
