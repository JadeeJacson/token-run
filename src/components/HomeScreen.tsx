import type { CSSProperties } from 'react'
import { ArrowRight, BookOpen, ChevronRight, Flame, Github, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { HOME_TIPS, MODELS, PRICE_SNAPSHOT, STARTER_MODEL_IDS, getModel } from '../game/data'
import { MODEL_UNLOCKS, nextPermanentUnlock } from '../game/engine'
import type { MetaProgress, RunState, Settings } from '../game/types'
import { BrandMark, ThemeShellControls, TinyTag } from './Common'

export function HomeScreen({
  meta,
  settings,
  selectedModel,
  savedRun,
  onSelectModel,
  onStart,
  onContinue,
  onOpenAtlas,
  onOpenGuide,
  onTheme,
  onShell,
}: {
  meta: MetaProgress
  settings: Settings
  selectedModel: string
  savedRun: RunState | null
  onSelectModel: (id: string) => void
  onStart: () => void
  onContinue: () => void
  onOpenAtlas: () => void
  onOpenGuide: () => void
  onTheme: () => void
  onShell: () => void
}) {
  const currentModel = getModel(selectedModel)
  const nextUnlock = nextPermanentUnlock(meta)
  const tip = HOME_TIPS[meta.runs % HOME_TIPS.length]
  const unlocked = new Set([...STARTER_MODEL_IDS, ...meta.unlockedModels])

  return (
    <main className="home-screen">
      <header className="home-nav">
        <BrandMark />
        <div className="home-nav-right">
          <button className="nav-text-button" onClick={onOpenGuide}><BookOpen size={15} />怎么玩</button>
          <button className="nav-text-button" onClick={onOpenAtlas}><Github size={15} />价格图鉴</button>
          <ThemeShellControls theme={settings.theme} shell={settings.shell} onTheme={onTheme} onShell={onShell} />
        </div>
      </header>

      <section className="home-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="live-dot" /> OFFLINE AGENT ROGUELIKE <b>v1.0</b></div>
          <h1>
            <span>上下文是燃料。</span>
            <strong>现在，点火。</strong>
          </h1>
          <p className="hero-lede">在十分钟内穿过需求、幻觉与账单。选择模型、打出操作、控制 Token，把项目活着送到周五发布。</p>

          <div className="hero-actions">
            <button className="primary-button big" onClick={onStart}><Play size={17} fill="currentColor" />开始新 Run<ArrowRight size={17} /></button>
            {savedRun && (
              <button className="secondary-button big" onClick={onContinue}><RotateCcw size={16} />{savedRun.screen === 'summary' ? '查看上次结算' : '继续未完成项目'}</button>
            )}
          </div>

          <div className="hero-proof">
            <span><ShieldCheck size={15} />不调用真实 API</span>
            <span><Flame size={15} />真实 Token 价格公式</span>
            <span><Sparkles size={15} />每局路线重新生成</span>
          </div>
        </div>

        <div className="burn-console" aria-label="Token 燃烧预览">
          <div className="console-chrome"><span /><span /><span /><small>burn-monitor.log</small></div>
          <div className="burn-visual">
            <div className="burn-ring ring-a" />
            <div className="burn-ring ring-b" />
            <div className="burn-core"><Flame size={38} fill="currentColor" /><strong>68.4K</strong><small>TOKENS BURNED</small></div>
            <div className="token-particle p1" /><div className="token-particle p2" /><div className="token-particle p3" /><div className="token-particle p4" />
          </div>
          <div className="console-lines">
            <code><i>01</i><span><span className="cmd">$ agent</span> --model {currentModel.parodyName.toLowerCase().replaceAll(' ', '-')}</span></code>
            <code><i>02</i><span className="muted">reading repository...</span> <b>+18.2K</b></code>
            <code><i>03</i><span className="muted">generating patch...</span> <b>+31.7K</b></code>
            <code><i>04</i><span className="warn">warning:</span> confidence exceeds evidence</code>
            <code className="cursor-line"><i>05</i><span className="cmd">$</span><span className="cursor" /></code>
          </div>
          <div className="console-total"><span>本次预估</span><strong>¥0.23 – ¥1.82</strong><small>模糊预测</small></div>
        </div>
      </section>

      <section className="launcher-grid">
        <div className="model-launcher panel-card">
          <div className="panel-title-row">
            <div><span className="eyebrow">STARTING BACKEND</span><h2>选择开局模型</h2></div>
            <TinyTag tone="live">已解锁 {unlocked.size}/{MODELS.length}</TinyTag>
          </div>
          <div className="model-strip">
            {MODELS.map((model) => {
              const isUnlocked = unlocked.has(model.id)
              const threshold = MODEL_UNLOCKS[model.id]
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`model-pill ${selectedModel === model.id ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`}
                  disabled={!isUnlocked}
                  onClick={() => onSelectModel(model.id)}
                  style={{ '--model-color': model.color } as CSSProperties}
                >
                  <span className="model-sigil">{isUnlocked ? model.parodyName.slice(0, 1) : <LockKeyhole size={14} />}</span>
                  <span><strong>{model.parodyName}</strong><small>{isUnlocked ? `${model.provider} · 可靠 ${Math.round(model.reliability * 100)}` : `${threshold ?? '?'} XP 解锁`}</small></span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="career-card panel-card">
          <div className="panel-title-row"><div><span className="eyebrow">CAREER CACHE</span><h2>程序员档案</h2></div><strong className="xp-number">{meta.xp} XP</strong></div>
          <div className="career-stats"><span><b>{meta.runs}</b>次 Run</span><span><b>{meta.victories}</b>次交付</span><span><b>{meta.bestScore}</b>最高分</span></div>
          {nextUnlock ? (
            <div className="unlock-progress">
              <div><span>下一个永久模型</span><strong>{nextUnlock.model.parodyName}</strong></div>
              <div className="meter"><span style={{ width: `${Math.min(100, (meta.xp / nextUnlock.threshold) * 100)}%` }} /></div>
              <small>{meta.xp} / {nextUnlock.threshold} XP</small>
            </div>
          ) : <div className="all-unlocked">所有模型已永久解锁。财务表示担忧。</div>}
        </div>
      </section>

      <footer className="home-footer">
        <p>“{tip}”</p>
        <button onClick={onOpenAtlas}>价格快照 {PRICE_SNAPSHOT}<ChevronRight size={14} /></button>
        <small>本作中的品牌均为戏仿名称，与现实厂商无隶属或赞助关系。</small>
      </footer>
    </main>
  )
}
