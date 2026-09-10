import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, Bot, Box, Check, ChevronDown, CircleDot, Code2, Cpu, Database, FileCode2, FileJson, FileText, Folder, GitCompareArrows, RotateCcw, Search, Send, ShieldCheck, Sparkles, Terminal, TestTube2, Wrench } from 'lucide-react'
import { ACTION_CARDS, getModel, getProject } from '../game/data'
import { deliveryConfidence, formatTokens, fuzzyTokenEstimate, randomAt } from '../game/engine'
import type { ActionCard, RunState } from '../game/types'
import { TinyTag } from './Common'

const KIND_ICON = {
  inspect: Search,
  build: Wrench,
  verify: TestTube2,
  control: Database,
}

function buildHand(state: RunState): ActionCard[] {
  if (!state.encounter) return []
  const requiredIds = ['scan-repo', 'precision-patch', 'unit-tests', 'compress-context']
  const extras = ACTION_CARDS.filter((card) => !requiredIds.includes(card.id))
    .map((card, index) => ({ card, order: randomAt(state.seed + state.encounter!.actionCount * 31, index + 200) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3)
    .map((entry) => entry.card)
  return [...requiredIds.map((id) => ACTION_CARDS.find((card) => card.id === id)!), ...extras]
}

export function EncounterScreen({
  state,
  onAction,
  onDeliver,
  onSwitchModel,
  onView,
  onOpenAtlas,
}: {
  state: RunState
  onAction: (card: ActionCard) => void
  onDeliver: () => void
  onSwitchModel: (modelId: string) => void
  onView: (mode: 'source' | 'diff' | 'terminal') => void
  onOpenAtlas: () => void
}) {
  if (!state.encounter) return null
  const encounter = state.encounter
  const project = getProject(encounter.projectId)
  const model = getModel(state.selectedModelId)
  const confidence = deliveryConfidence(state)
  const hand = buildHand(state)
  const hasCode = encounter.code > 0

  return (
    <div className="ide-workspace">
      <aside className="explorer-pane">
        <div className="pane-heading"><span>EXPLORER</span><small>•••</small></div>
        <div className="repo-title"><ChevronDown size={13} /><strong>{project.id.toUpperCase().replaceAll('-', '_')}</strong></div>
        <div className="file-tree">
          {project.files.map((file, index) => {
            const depth = file.length - file.trimStart().length
            const name = file.trim()
            const folder = !name.includes('.')
            const active = name === project.file.split('/').at(-1)
            const Icon = folder ? Folder : name.endsWith('.json') ? FileJson : name.endsWith('.md') ? FileText : FileCode2
            return <div key={`${file}-${index}`} className={`file-row ${active ? 'active' : ''}`} style={{ paddingLeft: `${12 + depth * 7}px` }}><Icon size={13} /><span>{name}</span>{active && <CircleDot size={8} />}</div>
          })}
        </div>
        <div className="side-section">
          <div className="section-label"><GitCompareArrows size={13} />SOURCE CONTROL <span>{hasCode ? 1 : 0}</span></div>
          {hasCode ? <div className="change-file"><b>M</b><span>{project.file.split('/').at(-1)}</span><small>+{Math.max(2, encounter.code * 2)} −{Math.max(1, encounter.code)}</small></div> : <p className="side-muted">暂无工作区更改</p>}
        </div>
        <div className="side-section context-list">
          <div className="section-label"><Box size={13} />CONTEXT</div>
          <div><span>需求 brief.md</span><b>PIN</b></div>
          <div><span>{project.file.split('/').at(-1)}</span><b>HOT</b></div>
          {encounter.analysis > 1 && <div><span>error-stack.log</span><b>NEW</b></div>}
          {encounter.test > 0 && <div><span>test-results.xml</span><b>NEW</b></div>}
        </div>
      </aside>

      <section className="editor-pane">
        <div className="editor-breadcrumb"><span>{project.id}</span><i>/</i><span>{project.file}</span><i>/</i><strong>{project.language}</strong></div>
        <div className="editor-tabs">
          <button className={encounter.codeMode === 'source' ? 'active' : ''} onClick={() => onView('source')}><Code2 size={13} />源码</button>
          <button className={encounter.codeMode === 'diff' ? 'active' : ''} onClick={() => onView('diff')}><GitCompareArrows size={13} />Diff{hasCode && <em>1</em>}</button>
          <button className={encounter.codeMode === 'terminal' ? 'active' : ''} onClick={() => onView('terminal')}><Terminal size={13} />终端</button>
          <div className="editor-spacer" />
          <span className="language-indicator">{project.language.toUpperCase()}</span>
        </div>

        <div className="editor-content">
          {encounter.codeMode === 'source' && <CodeBlock code={hasCode ? project.codeAfter : project.codeBefore} />}
          {encounter.codeMode === 'diff' && (
            <div className="diff-view">
              <div className="diff-header"><span>{project.file}</span><small>{hasCode ? '工作区修改' : '等待修改'}</small></div>
              {!hasCode ? (
                <div className="no-diff"><GitCompareArrows size={28} /><strong>还没有 Diff</strong><span>先调查问题，再打出一张实现类操作卡。</span></div>
              ) : <DiffBlock before={project.codeBefore} after={project.codeAfter} />}
            </div>
          )}
          {encounter.codeMode === 'terminal' && <TerminalView state={state} command={project.testCommand} />}
        </div>

        <div className="task-drawer">
          <div className="task-identity">
            <div><TinyTag tone={project.difficulty >= 4 ? 'danger' : 'neutral'}>{project.kind}</TinyTag><span>难度 {'◆'.repeat(project.difficulty)}{'◇'.repeat(5 - project.difficulty)}</span></div>
            <h2>{project.title}</h2>
            <p>{project.brief}</p>
            <blockquote>“{project.humor}”</blockquote>
          </div>
          <div className="milestones">
            <Milestone name="调查" value={encounter.analysis} target={project.requirements.analysis} icon={<Search size={14} />} />
            <Milestone name="实现" value={encounter.code} target={project.requirements.code} icon={<Code2 size={14} />} />
            <Milestone name="验证" value={encounter.test} target={project.requirements.test} icon={<TestTube2 size={14} />} />
            <div className={`confidence-card confidence-${confidence.label}`}>
              <span>交付预测</span><strong>{confidence.label}</strong><small>{confidence.detail}</small>
            </div>
            <button className="deliver-button" disabled={encounter.code < 1} onClick={onDeliver}><Send size={15} />提交交付</button>
          </div>
        </div>
      </section>

      <aside className="agent-pane">
        <div className="agent-header">
          <div className="agent-avatar" style={{ '--model-color': model.color } as CSSProperties}><Bot size={17} /></div>
          <div><span>当前后端</span><strong>{model.parodyName}</strong></div>
          <select value={state.selectedModelId} onChange={(event) => onSwitchModel(event.target.value)} aria-label="切换模型">
            {state.availableModelIds.map((id) => <option value={id} key={id}>{getModel(id).parodyName}</option>)}
          </select>
          <button className="price-peek" onClick={onOpenAtlas} title="查看模型价格"><Cpu size={15} /></button>
        </div>

        <div className="agent-stream">
          {state.logs.slice(-6).map((log) => (
            <article key={log.id} className={`agent-message ${log.role}`}>
              <div className="message-icon">
                {log.role === 'warning' ? <AlertTriangle size={13} /> : log.role === 'success' ? <Check size={13} /> : log.role === 'tool' ? <Terminal size={13} /> : log.role === 'system' ? <Sparkles size={13} /> : <Bot size={13} />}
              </div>
              <div><header><strong>{log.title}</strong>{log.meta && <small>{log.meta}</small>}</header><p>{log.body}</p></div>
            </article>
          ))}
        </div>

        <div className="action-deck">
          <div className="deck-heading">
            <div><span className="eyebrow">ACTION DECK</span><strong>选择下一步</strong></div>
            <small>{encounter.actionCount} 次操作</small>
          </div>
          <div className="card-hand">
            {hand.map((card) => {
              const Icon = KIND_ICON[card.kind]
              const estimate = fuzzyTokenEstimate(card, model)
              const cooldown = encounter.cooldowns[card.id] ?? 0
              const resourceBlocked = state.resources.time < card.timeCost
              return (
                <button
                  type="button"
                  className={`action-card kind-${card.kind} risk-${card.risk} ${cooldown ? 'cooling' : ''}`}
                  key={card.id}
                  disabled={Boolean(cooldown) || resourceBlocked}
                  onClick={() => onAction(card)}
                >
                  <div className="card-top"><span className="card-kind"><Icon size={13} />{kindName(card.kind)}</span><span className="risk-dot">风险 {card.risk}</span></div>
                  <strong>{card.name}</strong>
                  <code>{card.command}</code>
                  <p>{card.description}</p>
                  <div className="card-cost"><span>{estimate.tokens}</span><b>{estimate.cost}</b><small>{card.timeCost} 格</small></div>
                  {cooldown > 0 && <div className="cooldown-mask"><RotateCcw size={15} />冷却 {cooldown}</div>}
                </button>
              )
            })}
          </div>
          <div className="deck-footnote"><ShieldCheck size={12} />执行前仅提供模糊预测，准确 Token 与费用在结算后显示。</div>
        </div>
      </aside>
    </div>
  )
}

function Milestone({ name, value, target, icon }: { name: string; value: number; target: number; icon: ReactNode }) {
  const ratio = Math.min(100, (value / target) * 100)
  return <div className={`milestone ${ratio >= 100 ? 'done' : ''}`}><div><span>{icon}{name}</span><strong>{value}/{target}</strong></div><div className="meter"><span style={{ width: `${ratio}%` }} /></div></div>
}

function CodeBlock({ code }: { code: string }) {
  return <pre className="code-block">{code.split('\n').map((line, index) => <code key={index}><i>{index + 1}</i><span>{highlight(line)}</span></code>)}</pre>
}

function DiffBlock({ before, after }: { before: string; after: string }) {
  const oldLines = before.split('\n')
  const newLines = after.split('\n')
  return <pre className="code-block diff-block">
    <code className="diff-context"><i>@@</i><span>@@ -1,{oldLines.length} +1,{newLines.length} @@</span></code>
    {oldLines.map((line, index) => <code className="removed" key={`o-${index}`}><i>-</i><span>{line}</span></code>)}
    {newLines.map((line, index) => <code className="added" key={`n-${index}`}><i>+</i><span>{line}</span></code>)}
  </pre>
}

function TerminalView({ state, command }: { state: RunState; command: string }) {
  const testLogs = state.logs.filter((log) => log.role === 'tool' || log.role === 'warning' || log.role === 'success').slice(-5)
  return <div className="terminal-view">
    <div><span className="prompt">token-run ❯</span> {command}</div>
    {testLogs.length === 0 ? <p className="terminal-muted">等待测试运行…</p> : testLogs.map((log) => <div key={log.id} className={`terminal-log ${log.role}`}><span>{log.role === 'warning' ? 'FAIL' : log.role === 'success' ? 'PASS' : 'INFO'}</span>{log.body}<small>{log.meta}</small></div>)}
    <div><span className="prompt">token-run ❯</span><span className="terminal-cursor" /></div>
  </div>
}

function highlight(line: string) {
  return line
}

function kindName(kind: ActionCard['kind']) {
  return { inspect: '调查', build: '实现', verify: '验证', control: '控制' }[kind]
}
