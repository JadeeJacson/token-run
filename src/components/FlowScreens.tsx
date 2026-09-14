import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, Bot, CheckCircle2, ChevronRight, Coffee, Database, Flame, Gauge, Gift, Home, LockKeyhole, RotateCcw, Skull, Sparkles, Timer, Trophy } from 'lucide-react'
import { BUFFS, PRICE_SNAPSHOT, getModel } from '../game/data'
import { CACHE_DEADLINE_CONTEXT, availableRewards, cacheChoicePreview, finalScore, finalScoreBreakdown, formatCny, formatTokens, getCurrentEvent, totalUsage } from '../game/engine'
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

export function SummaryScreen({ state, meta, onRetry, onNewRun, onHome }: { state: RunState; meta: MetaProgress; onRetry: () => void; onNewRun: () => void; onHome: () => void }) {
  const usage = totalUsage(state)
  const victory = state.lastOutcome === 'victory'
  const score = finalScore(state)
  return (
    <main className={`summary-screen ${victory ? 'victory' : 'defeat'}`}>
      <div className="summary-glow" />
      <div className="summary-icon">{victory ? <Trophy size={34} /> : <Skull size={34} />}</div>
      <span className="eyebrow">{victory ? 'RUN COMPLETE / 成功交付' : 'RUN TERMINATED / 项目终止'}</span>
      <h1>{victory ? '周末保住了。大概。' : 'Token 烧完了，项目还在。'}</h1>
      <p>{state.lastMessage}</p>

      <div className="score-plaque"><span>FINAL SCORE</span><strong>{score.toLocaleString()}</strong><small>本局完成 {state.completedProjects} 个项目 · 失败交付 {state.failedProjects} 次</small></div>

      <div className="score-breakdown">
        {finalScoreBreakdown(state).filter((item) => item.value !== 0).map((item) => (
          <span key={item.key}>{item.label}<b>{item.value > 0 ? `+${item.value.toLocaleString()}` : item.value.toLocaleString()}</b></span>
        ))}
      </div>

      <div className="summary-metrics">
        <div><Flame size={17} /><span>实际费用</span><strong>{formatCny(usage.cost)}</strong><small>预算余 {formatCny(state.resources.budget)}</small></div>
        <div><Database size={17} /><span>总 Token</span><strong>{formatTokens(usage.input + usage.output)}</strong><small>缓存命中 {formatTokens(usage.cached)}</small></div>
        <div><Timer size={17} /><span>剩余时间</span><strong>{Math.max(0, state.resources.time)} 格</strong><small>稳定度 {Math.round(state.resources.stability)}%</small></div>
        <div><CheckCircle2 size={17} /><span>职业经验</span><strong>+{state.completedProjects + (victory ? 3 : 0)} XP</strong><small>累计 {meta.xp} XP</small></div>
      </div>

      <div className="summary-actions">
        {!victory && !state.retryUsed && <button className="primary-button big" onClick={onRetry}><RotateCcw size={17} />沿原路线重试一次</button>}
        <button className={victory || state.retryUsed ? 'primary-button big' : 'secondary-button big'} onClick={onNewRun}><Sparkles size={17} />生成新路线</button>
        <button className="ghost-button big" onClick={onHome}><Home size={17} />返回主界面</button>
      </div>
      {!victory && !state.retryUsed && <div className="retry-notice"><LockKeyhole size={14} />重试会使用同一随机种子，并从路线第一层开始；仅有一次机会。</div>}
      <small className="snapshot-note">计价快照：{PRICE_SNAPSHOT} · 本局为离线模拟，没有产生真实 API 费用。</small>
    </main>
  )
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
