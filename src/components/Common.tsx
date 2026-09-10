import type { ReactNode } from 'react'
import { Activity, Clock3, Database, Flame, Moon, Sun, TerminalSquare, X } from 'lucide-react'
import { formatCny, formatTokens } from '../game/engine'
import type { RunResources, ShellStyle, Theme } from '../game/types'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-label="Token燃烧模拟器">
      <span className="brand-glyph"><Flame size={compact ? 15 : 22} strokeWidth={2.2} /></span>
      <span className="brand-copy">
        <strong>Token燃烧模拟器</strong>
        {!compact && <small>CONTEXT IS FUEL</small>}
      </span>
    </div>
  )
}

export function ResourceBar({ resources }: { resources: RunResources }) {
  const items = [
    { key: 'budget', icon: <Flame size={15} />, label: '预算', value: formatCny(resources.budget), ratio: resources.budget / resources.budgetMax, tone: 'ember' },
    { key: 'context', icon: <Database size={15} />, label: '上下文', value: `${formatTokens(resources.context)} / ${formatTokens(resources.contextMax)}`, ratio: 1 - resources.context / resources.contextMax, tone: 'violet', inverse: true },
    { key: 'time', icon: <Clock3 size={15} />, label: 'Deadline', value: `${resources.time} 格`, ratio: resources.time / resources.timeMax, tone: 'blue' },
    { key: 'stability', icon: <Activity size={15} />, label: '稳定度', value: `${Math.round(resources.stability)}%`, ratio: resources.stability / 100, tone: 'green' },
  ]
  return (
    <div className="resource-bar" aria-label="本局资源">
      {items.map((item) => {
        const danger = item.inverse ? item.ratio < 0.22 : item.ratio < 0.22
        return (
          <div className={`resource-item ${danger ? 'danger' : ''}`} key={item.key}>
            <div className="resource-label">{item.icon}<span>{item.label}</span><strong>{item.value}</strong></div>
            <div className="micro-meter"><span className={item.tone} style={{ width: `${Math.max(0, Math.min(100, item.ratio * 100))}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}

export function ThemeShellControls({
  theme,
  shell,
  onTheme,
  onShell,
}: {
  theme: Theme
  shell: ShellStyle
  onTheme: () => void
  onShell: () => void
}) {
  return (
    <div className="shell-controls">
      <button className="icon-button text-icon-button" onClick={onShell} title="切换 Agent 外壳">
        <TerminalSquare size={15} />
        <span>{shell === 'codax' ? 'Codax' : 'Cloude'}</span>
      </button>
      <button className="icon-button" onClick={onTheme} title="切换浅色/深色">
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  )
}

export function Modal({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

export function TinyTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`tiny-tag ${tone}`}>{children}</span>
}

export function EmptyPanel({ children }: { children: ReactNode }) {
  return <div className="empty-panel">{children}</div>
}
