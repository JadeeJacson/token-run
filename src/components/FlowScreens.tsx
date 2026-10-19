import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, Bot, CheckCircle2, ChevronLeft, ChevronRight, Coffee, Database, Flame, Gauge, Gift, Home, LockKeyhole, RotateCcw, Search, Skull, Sparkles, Timer, Trophy } from 'lucide-react'
import { BUFFS, PRICE_SNAPSHOT, getModel } from '../game/data'
import { ARCHETYPES, CACHE_DEADLINE_CONTEXT, availableRewards, cacheChoicePreview, finalScore, finalScoreBreakdown, formatCny, formatTokens, getArchetype, getCurrentEvent, totalUsage } from '../game/engine'
import type { ChoiceEffect, MetaProgress, RunState } from '../game/types'
import { TinyTag } from './Common'

export function EventScreen({ state, onEventChoice, onCacheChoice }: { state: RunState; onEventChoice: (effect: ChoiceEffect, result: string) => void; onCacheChoice: (choice: 'compact' | 'stabilize' | 'deadline') => void }) {
  const node = state.route.find((candidate) => candidate.id === state.currentNodeId)
  if (node?.type === 'cache') {
    const preview = cacheChoicePreview(state)
    const deadlineMeta = preview.deadline.overflow
      ? `${formatTokens(state.resources.context)} → 超出 ${formatTokens(state.resources.contextMax)} 上限`
      : `Deadline ${state.resources.time} 格 → ${Math.min(state.resources.timeMax, state.resources.time + 5)} 格 · 上下文 +${formatTokens(CACHE_DEADLINE_CONTEXT)}`
    return (
      <main className="interstitial-screen cache-screen">
        <div className="interstitial-symbol"><Coffee size={30} /></div>
        <span className="eyebrow">CONTEXT REST / 上下文休整</span>
        <h1>在继续烧 Token 前，喘口气</h1>
        <p className="interstitial-lede">你找到一间没有产品经理的会议室。只能完成一项维护。</p>
        <div className="choice-grid three">
          <ChoiceCard icon={<Database size={21} />} title="压缩上下文" description="把当前上下文压缩至 30%，消耗 1 格时间。" meta={`${formatTokens(state.resources.context)} → ${formatTokens(preview.compact.context)}`} onClick={() => onCacheChoice('compact')} />
          <ChoiceCard icon={<Gauge size={21} />} title="整理 Git 分支" description="消耗 1 格时间，恢复 18% 代码稳定度。" meta={`稳定度 ${Math.round(state.resources.stability)}% → ${Math.min(100, Math.round(state.resources.stability + 18))}%`} onClick={() => onCacheChoice('stabilize')} />
          <ChoiceCard icon={<Timer size={21} />} title="申请延期" description={preview.deadline.overflow ? '上下文已经贴住窗口上限，延期会直接触发溢出。这一项不可用。' : '甘特图换来 5 格时间，但稳定度 -3。'} meta={deadlineMeta} disabled={preview.deadline.disabled} onClick={() => onCacheChoice('deadline')} />
        </div>
      </main>
    )
  }

  const event = getCurrentEvent(state)
  return (
    <main className="interstitial-screen event-screen">
      <div className="interstitial-symbol event-symbol">{event.icon}</div>
      <span className="eyebrow">{event.eyebrow}</span>
      <h1>{event.title}</h1>
      <p className="interstitial-lede">{event.body}</p>
      <div className="choice-grid">
        {event.choices.map((choice, index) => (
          <ChoiceCard key={choice.label} index={index + 1} icon={<Sparkles size={21} />} title={choice.label} description={choice.detail} meta={effectSummary(choice.effect)} onClick={() => onEventChoice(choice.effect, choice.result)} />
        ))}
      </div>
      <small className="choice-hint">选择会立即结算，事件没有 Ctrl+Z。</small>
    </main>
  )
}

export function RewardScreen({ state, onChoose }: { state: RunState; onChoose: (reward: { type: 'model' | 'buff'; id: string }) => void }) {
  const rewards = availableRewards(state)
  return (
    <main className="interstitial-screen reward-screen">
      <div className="interstitial-symbol reward-symbol"><Gift size={31} /></div>
      <span className="eyebrow">MILESTONE CLEARED</span>
      <h1>交付通过，选择一项升级</h1>
      <p className="interstitial-lede">升级只在当前 Run 生效。职业 XP 会在本局结束后结算。</p>
      <div className="reward-grid">
        {rewards.map((reward, index) => {
          if (reward.type === 'model') {
            const model = getModel(reward.id)
            return (
              <button key={`${reward.type}-${reward.id}`} className="reward-card model-reward" onClick={() => onChoose(reward)} style={{ '--reward-color': model.color } as CSSProperties}>
                <span className="reward-number">0{index + 1}</span><Bot size={25} />
                <TinyTag tone="live">新模型 · 本局</TinyTag>
                <h2>{model.parodyName}</h2><p>{model.realName}</p><small className="model-trait reward-trait">{model.trait}</small>
                <div className="reward-stats"><span>能力 <b>{Math.round(model.power * 100)}</b></span><span>可靠 <b>{Math.round(model.reliability * 100)}</b></span><span>速度 <b>{Math.round(model.speed * 100)}</b></span></div>
                <strong className="reward-action">接入并切换<ChevronRight size={16} /></strong>
              </button>
            )
          }
          const buff = BUFFS.find((candidate) => candidate.id === reward.id)!
          return (
            <button key={`${reward.type}-${reward.id}`} className="reward-card buff-reward" onClick={() => onChoose(reward)}>
              <span className="reward-number">0{index + 1}</span><span className="large-buff-icon">{buff.icon}</span>
              <TinyTag tone="violet">运行时 Buff</TinyTag>
              <h2>{buff.name}</h2><p>{buff.description}</p>
              <div className="buff-code">install --run-only {buff.id}</div>
              <strong className="reward-action">安装 Buff<ChevronRight size={16} /></strong>
            </button>
          )
        })}
      </div>
    </main>
  )
}

export function SummaryScreen({ state, meta, onRetry, onNewRun, onHome, onReview }: { state: RunState; meta: MetaProgress; onRetry: () => void; onNewRun: () => void; onHome: () => void; onReview: () => void }) {
  const usage = totalUsage(state)
  const victory = state.lastOutcome === 'victory'
  const score = finalScore(state)
  const archetype = getArchetype(state.archetypeId)
  return (
    <main className={`summary-screen ${victory ? 'victory' : 'defeat'}`}>
      <div className="summary-glow" />
      <div className="summary-icon">{victory ? <Trophy size={34} /> : <Skull size={34} />}</div>
      <span className="eyebrow">{victory ? 'RUN COMPLETE / 成功交付' : 'RUN TERMINATED / 项目终止'} · {archetype.name}</span>
      <h1>{victory ? '周末保住了。大概。' : 'Token 烧完了，项目还在。'}</h1>
      <p>{state.lastMessage}</p>

      <div className="score-plaque"><span>FINAL SCORE</span><strong>{score.toLocaleString()}</strong><small>本局完成 {state.completedProjects} 个项目 · 失败交付 {state.failedProjects} 次</small></div>

      <div className="score-breakdown score-breakdown-animated">
        {finalScoreBreakdown(state).filter((item) => item.value !== 0).map((item, index) => (
          <span key={item.key} style={{ '--seg-delay': `${index * 90}ms` } as CSSProperties}>{item.label}<b>{item.value > 0 ? `+${item.value.toLocaleString()}` : item.value.toLocaleString()}</b></span>
        ))}
      </div>

      <div className="summary-metrics">
        <div><Flame size={17} /><span>实际费用</span><strong>{formatCny(usage.cost)}</strong><small>预算余 {formatCny(state.resources.budget)}</small></div>
        <div><Database size={17} /><span>总 Token</span><strong>{formatTokens(usage.input + usage.output)}</strong><small>缓存命中 {formatTokens(usage.cached)}</small></div>
        <div><Timer size={17} /><span>剩余时间</span><strong>{Math.max(0, state.resources.time)} 格</strong><small>稳定度 {Math.round(state.resources.stability)}%</small></div>
        <div><CheckCircle2 size={17} /><span>职业经验</span><strong>+{state.completedProjects + (victory ? 3 : 0)} XP</strong><small>累计 {meta.xp} XP</small></div>
      </div>

      <div className="summary-actions">
        <button className="secondary-button big" onClick={onReview}><Search size={16} />查看复盘</button>
        {!victory && !state.retryUsed && <button className="primary-button big" onClick={onRetry}><RotateCcw size={17} />沿原路线重试一次</button>}
        <button className={victory || state.retryUsed ? 'primary-button big' : 'secondary-button big'} onClick={onNewRun}><Sparkles size={17} />生成新路线</button>
        <button className="ghost-button big" onClick={onHome}><Home size={17} />返回主界面</button>
      </div>
      {!victory && !state.retryUsed && <div className="retry-notice"><LockKeyhole size={14} />重试会使用同一随机种子，并从路线第一层开始；仅有一次机会。</div>}
      <small className="snapshot-note">计价快照：{PRICE_SNAPSHOT} · 本局为离线模拟，没有产生真实 API 费用。</small>
    </main>
  )
}

export function ReviewScreen({ state, onBack }: { state: RunState; onBack: () => void }) {
  const usage = totalUsage(state)
  const score = finalScore(state)
  const archetype = getArchetype(state.archetypeId)
  const clean = Math.max(0, state.disciplineScore)
  const debt = Math.max(0, -state.disciplineScore)
  const mistakes = state.audits
    .map((audit) => audit.topMistake)
    .filter((item): item is string => Boolean(item))
  const mistakeCounts = mistakes.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {})
  const topMistakes = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <main className="summary-screen review-screen">
      <div className="summary-icon"><Search size={32} /></div>
      <span className="eyebrow">RUN REVIEW / 一局复盘</span>
      <h1>这局真正发生了什么</h1>
      <p>{state.lastMessage ?? '审计时间线已生成。'}</p>

      <div className="score-plaque"><span>SEED {state.seed} · {archetype.name}</span><strong>{score.toLocaleString()}</strong><small>纪律 +{clean} / 债务 {debt} · 费用 {formatCny(usage.cost)}</small></div>

      <div className="review-grid">
        <section className="review-card">
          <h3>分数五段</h3>
          {finalScoreBreakdown(state).map((item) => (
            <div className="review-row" key={item.key}><span>{item.label}</span><b>{item.value > 0 ? `+${item.value}` : item.value}</b></div>
          ))}
        </section>
        <section className="review-card">
          <h3>纪律与风险</h3>
          <div className="review-row"><span>按序连击贡献</span><b>+{clean}</b></div>
          <div className="review-row"><span>错序债务</span><b>{debt}</b></div>
          <div className="review-row"><span>项目审计</span><b>{state.audits.length}</b></div>
          <div className="review-mistakes">
            {topMistakes.length === 0 ? <p>本局没有突出风险标签。</p> : topMistakes.map(([label, count]) => (
              <span key={label}>{label} ×{count}</span>
            ))}
          </div>
        </section>
      </div>

      <section className="review-timeline">
        <h3>项目时间线与费用</h3>
        {state.audits.length === 0 ? <p className="review-empty">还没有完成项目审计。</p> : (
          <>
            <div className="review-bars">
              {state.audits.map((audit, index) => {
                const maxCost = Math.max(...state.audits.map((item) => item.cost), 0.001)
                const width = Math.min(100, (audit.cost / maxCost) * 100)
                return (
                  <div className="review-bar-row" key={`bar-${audit.nodeId}-${index}`}>
                    <span>{audit.title}</span>
                    <div className="review-bar"><i style={{ width: `${width}%` }} /></div>
                    <b>{formatCny(audit.cost)} · {formatTokens(audit.input + audit.output)}</b>
                  </div>
                )
              })}
            </div>
            {state.audits.map((audit, index) => (
              <article key={`${audit.nodeId}-${index}`} className={`timeline-item ${audit.outcome}`}>
                <div className="timeline-head">
                  <strong>0{index + 1} {audit.title}</strong>
                  <TinyTag tone={audit.outcome === 'delivered' ? 'live' : 'neutral'}>{audit.outcome === 'delivered' ? '已交付' : '被打回'}</TinyTag>
                </div>
                <div className="timeline-meta">
                  <span>操作 {audit.actions}</span>
                  <span>费用 {formatCny(audit.cost)}</span>
                  <span>Token {formatTokens(audit.input + audit.output)}</span>
                  <span>纪律 {audit.disciplineDelta >= 0 ? `+${audit.disciplineDelta}` : audit.disciplineDelta}</span>
                  {audit.topMistake && <span className="mistake">{audit.topMistake}</span>}
                </div>
              </article>
            ))}
          </>
        )}
      </section>

      <div className="summary-actions">
        <button className="primary-button big" onClick={onBack}><ChevronLeft size={16} />返回结算</button>
      </div>
    </main>
  )
}

export function ArchetypeBadge({ id }: { id: RunState['archetypeId'] }) {
  const archetype = getArchetype(id)
  return <TinyTag tone="violet">{ARCHETYPES.find((item) => item.id === id)?.name ?? archetype.name}</TinyTag>
}

function ChoiceCard({ icon, title, description, meta, onClick, index, disabled = false }: { icon: ReactNode; title: string; description: string; meta: string; onClick: () => void; index?: number; disabled?: boolean }) {
  return <button className={`choice-card${disabled ? ' is-disabled' : ''}`} disabled={disabled} onClick={onClick}>{index && <span className="choice-index">0{index}</span>}<span className="choice-icon">{icon}</span><h2>{title}</h2><p>{description}</p><strong>{meta}</strong><span className="choice-cta">{disabled ? '当前不可用' : '确认选择'}<ArrowRight size={15} /></span></button>
}

function effectSummary(effect: ChoiceEffect): string {
  const parts: string[] = []
  if (effect.budget) parts.push(`预算 ${effect.budget > 0 ? '+' : ''}${effect.budget}`)
  if (effect.context) parts.push(`上下文 ${effect.context > 0 ? '+' : ''}${formatTokens(effect.context)}`)
  if (effect.time) parts.push(`时间 ${effect.time > 0 ? '+' : ''}${effect.time}`)
  if (effect.stability) parts.push(`稳定 ${effect.stability > 0 ? '+' : ''}${effect.stability}`)
  if (effect.buffId) parts.push('获得 Buff')
  return parts.join(' · ') || '未知影响'
}
