import { useEffect, useRef, useState } from 'react'
import { BookOpen, Bot, ChevronRight, CircleDollarSign, Flame, Gauge, Home, Info, Layers3, Map, Sparkles } from 'lucide-react'
import { BrandMark, ResourceBar, ThemeShellControls, TinyTag } from './components/Common'
import { EncounterScreen } from './components/EncounterScreen'
import { EventScreen, RewardScreen, SummaryScreen } from './components/FlowScreens'
import { HomeScreen } from './components/HomeScreen'
import { GuideOverlay, PriceAtlas } from './components/Overlays'
import { RouteMap } from './components/RouteMap'
import { BUFFS, PRICE_SNAPSHOT, STARTER_MODEL_IDS, getModel } from './game/data'
import { audioDirector } from './game/audio'
import {
  DEFAULT_META,
  attemptDelivery,
  beginNode,
  chooseReward,
  createRun,
  normalizeRun,
  playAction,
  resolveCache,
  resolveEvent,
  setEncounterView,
  switchModel,
  updateMeta,
} from './game/engine'
import type { ActionCard, ChoiceEffect, MetaProgress, RunState, Settings } from './game/types'

const STORAGE_META = 'token-burner.meta.v1'
const STORAGE_RUN = 'token-burner.active-run.v1'
const STORAGE_SETTINGS = 'token-burner.settings.v1'
const STORAGE_MODEL = 'token-burner.start-model.v1'

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  shell: 'codax',
  sound: false,
  reducedMotion: false,
}

type Overlay = 'atlas' | 'guide' | null
export default function App() {
  const [meta, setMeta] = useState<MetaProgress>(() => readStorage(STORAGE_META, DEFAULT_META))
  const [settings, setSettings] = useState<Settings>(() => readStorage(STORAGE_SETTINGS, DEFAULT_SETTINGS))
  const [savedRun, setSavedRun] = useState<RunState | null>(() => {
    const stored = readStorage<RunState | null>(STORAGE_RUN, null)
    return stored ? normalizeRun(stored) : null
  })
  const [run, setRun] = useState<RunState | null>(null)
  const [selectedStartModel, setSelectedStartModel] = useState(() => localStorage.getItem(STORAGE_MODEL) ?? STARTER_MODEL_IDS[0])
  const [overlay, setOverlay] = useState<Overlay>(null)
  const recordedRuns = useRef(new Set<string>())

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.dataset.shell = settings.shell
    document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion)
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    audioDirector.setEnabled(settings.sound)
  }, [settings.sound])

  useEffect(() => {
    if (!run) return
    localStorage.setItem(STORAGE_RUN, JSON.stringify(run))
    setSavedRun(run)
    if (run.screen === 'summary' && !run.metaRecorded) {
      const runKey = `${run.seed}-${run.retryUsed ? 'retry' : 'first'}`
      if (!recordedRuns.current.has(runKey)) {
        recordedRuns.current.add(runKey)
        setMeta((current) => {
          const next = updateMeta(current, run)
          localStorage.setItem(STORAGE_META, JSON.stringify(next))
          return next
        })
      }
      setRun((current) => current ? { ...current, metaRecorded: true } : current)
    }
  }, [run])

  useEffect(() => {
    if (!meta.unlockedModels.includes(selectedStartModel) && !STARTER_MODEL_IDS.includes(selectedStartModel)) {
      setSelectedStartModel(STARTER_MODEL_IDS[0])
    }
  }, [meta, selectedStartModel])

  const startNewRun = () => {
    const seed = Math.floor(Date.now() % 2_147_483_647)
    const next = {
      ...createRun(seed, selectedStartModel),
      availableModelIds: [...new Set([...STARTER_MODEL_IDS, ...meta.unlockedModels, selectedStartModel])],
    }
    setRun(next)
    setSavedRun(next)
    audioDirector.play('start')
  }

  const retryRun = () => {
    if (!run || run.retryUsed) return
    const next = {
      ...createRun(run.seed, run.selectedModelId, true),
      availableModelIds: [...new Set([...STARTER_MODEL_IDS, ...meta.unlockedModels, run.selectedModelId])],
    }
    setRun(next)
    audioDirector.play('start')
  }

  const returnHome = () => {
    if (run?.screen === 'summary') {
      localStorage.removeItem(STORAGE_RUN)
      setSavedRun(null)
    }
    setRun(null)
  }

  const chooseStartModel = (id: string) => {
    setSelectedStartModel(id)
    localStorage.setItem(STORAGE_MODEL, id)
    audioDirector.play('model')
  }

  const toggleTheme = () => setSettings((current) => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }))
  const toggleShell = () => setSettings((current) => ({ ...current, shell: current.shell === 'codax' ? 'cloude' : 'codax' }))
  const toggleSound = () => {
    const next = !settings.sound
    audioDirector.setEnabled(next)
    setSettings((current) => ({ ...current, sound: next }))
    if (next) window.setTimeout(() => audioDirector.play('success'), 70)
  }
  const toggleMotion = () => {
    setSettings((current) => ({ ...current, reducedMotion: !current.reducedMotion }))
    audioDirector.play('ui')
  }

  const selectNode = (id: string) => {
    if (!run) return
    setRun(beginNode(run, id))
    audioDirector.play('ui')
  }

  const performAction = (card: ActionCard) => {
    if (!run) return
    const next = playAction(run, card)
    setRun(next)
    const latest = next.logs.at(-1)
    audioDirector.play(latest?.role === 'warning' ? 'warning' : 'action')
  }

  const deliverProject = () => {
    if (!run) return
    const next = attemptDelivery(run)
    setRun(next)
    const passed = next.screen === 'reward' || next.lastOutcome === 'victory'
    audioDirector.play(passed ? 'success' : 'warning')
  }

  const changeModel = (id: string) => {
    if (!run || id === run.selectedModelId) return
    setRun(switchModel(run, id))
    audioDirector.play('model')
  }

  const settleEvent = (effect: ChoiceEffect, result: string) => {
    if (!run) return
    setRun(resolveEvent(run, effect, result))
    audioDirector.play('ui')
  }

  const settleCache = (choice: 'compact' | 'stabilize' | 'deadline') => {
    if (!run) return
    setRun(resolveCache(run, choice))
    audioDirector.play('success')
  }

  const takeReward = (reward: { type: 'model' | 'buff'; id: string }) => {
    if (!run) return
    setRun(chooseReward(run, reward))
    audioDirector.play('reward')
  }

  if (!run) {
    return (
      <div className="app-root home-root">
        <HomeScreen
          meta={meta}
          settings={settings}
          selectedModel={selectedStartModel}
          savedRun={savedRun}
          onSelectModel={chooseStartModel}
          onStart={startNewRun}
          onContinue={() => savedRun && setRun(savedRun)}
          onOpenAtlas={() => setOverlay('atlas')}
          onOpenGuide={() => setOverlay('guide')}
          onTheme={toggleTheme}
          onShell={toggleShell}
          onSound={toggleSound}
          onMotion={toggleMotion}
        />
        {overlay === 'atlas' && <PriceAtlas onClose={() => setOverlay(null)} />}
        {overlay === 'guide' && <GuideOverlay onClose={() => setOverlay(null)} />}
      </div>
    )
  }

  return (
    <div className={`app-root game-root shell-${settings.shell}`}>
      <header className="game-topbar">
        <div className="topbar-left">
          <BrandMark compact />
          <span className="topbar-divider" />
          <span className="workspace-name">token-run / <b>{settings.shell === 'codax' ? 'agent-workspace' : 'claude-terminal'}</b></span>
          <TinyTag tone="neutral">seed {run.seed}</TinyTag>
        </div>
        <ResourceBar resources={run.resources} />
        <div className="topbar-actions">
          <button className="icon-button text-icon-button" onClick={() => setOverlay('guide')}><BookOpen size={15} /><span>规则</span></button>
          <button className="icon-button text-icon-button" onClick={() => setOverlay('atlas')}><CircleDollarSign size={15} /><span>价格</span></button>
          <ThemeShellControls compact theme={settings.theme} shell={settings.shell} sound={settings.sound} reducedMotion={settings.reducedMotion} onTheme={toggleTheme} onShell={toggleShell} onSound={toggleSound} onMotion={toggleMotion} />
          <button className="icon-button" onClick={returnHome} title="返回主界面"><Home size={16} /></button>
        </div>
      </header>

      <div className="game-body">
        {run.screen === 'map' && (
          <MapWorkspace state={run} onSelect={selectNode} onSwitchModel={changeModel} />
        )}
        {run.screen === 'encounter' && (
          <EncounterScreen
            state={run}
            onAction={performAction}
            onDeliver={deliverProject}
            onSwitchModel={changeModel}
            onView={(mode) => setRun((current) => current ? setEncounterView(current, mode) : current)}
            onOpenAtlas={() => setOverlay('atlas')}
          />
        )}
        {run.screen === 'event' && (
          <EventScreen
            state={run}
            onEventChoice={settleEvent}
            onCacheChoice={settleCache}
          />
        )}
        {run.screen === 'reward' && <RewardScreen state={run} onChoose={takeReward} />}
        {run.screen === 'summary' && <SummaryScreen state={run} meta={meta} onRetry={retryRun} onNewRun={startNewRun} onHome={returnHome} />}
      </div>
      {overlay === 'atlas' && <PriceAtlas onClose={() => setOverlay(null)} />}
      {overlay === 'guide' && <GuideOverlay onClose={() => setOverlay(null)} />}
    </div>
  )
}

function MapWorkspace({ state, onSelect, onSwitchModel }: { state: RunState; onSelect: (id: string) => void; onSwitchModel: (id: string) => void }) {
  const model = getModel(state.selectedModelId)
  const progress = state.completedNodes.length
  return (
    <div className="map-workspace">
      <RouteMap nodes={state.route} completed={state.completedNodes} available={state.availableNodeIds} current={state.currentNodeId} onSelect={onSelect} />
      <aside className="run-sidebar">
        <section className="run-side-card agent-status-card">
          <span className="eyebrow">ACTIVE BACKEND</span>
          <div className="side-model-title"><span key={model.id} className="model-swap" style={{ background: model.color }}><Bot size={18} /></span><div><h3>{model.parodyName}</h3><p>{model.provider} · {model.realName}</p><small className="model-trait">{model.trait}</small></div></div>
          <div className="side-model-bars"><StatBar label="能力" value={model.power / 1.45} /><StatBar label="可靠" value={model.reliability} /><StatBar label="流程" value={model.workflowDiscipline / 1.1} /><StatBar label="省上下文" value={Math.min(1, Math.max(0, (1.3 - model.contextEfficiency) / 0.8))} /></div>
          <label className="model-select-label">切换已接入模型<select value={state.selectedModelId} onChange={(event) => onSwitchModel(event.target.value)}>{state.availableModelIds.map((id) => <option key={id} value={id}>{getModel(id).parodyName}</option>)}</select></label>
        </section>

        <section className="run-side-card">
          <div className="side-card-heading"><span><Layers3 size={14} />本局进度</span><strong>{progress}/7</strong></div>
          <div className="run-progress"><span style={{ width: `${(progress / 7) * 100}%` }} /></div>
          <div className="run-stat-grid"><div><b>{state.completedProjects}</b><span>已交付</span></div><div><b>{state.failedProjects}</b><span>被打回</span></div><div><b>{state.score}</b><span>当前分</span></div></div>
        </section>

        <section className="run-side-card buff-list-card">
          <div className="side-card-heading"><span><Sparkles size={14} />运行时 Buff</span><strong>{state.buffs.length}</strong></div>
          {state.buffs.length === 0 ? <div className="no-buffs"><Flame size={18} /><p>还没有 Buff。<br />先完成一个项目。</p></div> : state.buffs.map((buff) => (
            <div className="buff-row" key={buff.id}><span>{buff.icon}</span><div><strong>{buff.name}</strong><small>{buff.description}</small></div>{(buff.discountUses ?? buff.testDiscountUses) !== undefined && <b>×{buff.discountUses ?? buff.testDiscountUses}</b>}</div>
          ))}
        </section>

        <section className="run-side-card briefing-card">
          <div className="side-card-heading"><span><Info size={14} />本局规则</span></div>
          <p><Map size={13} />只能选择发光节点</p><p><Flame size={13} />任一资源归零都会终止 Run</p><p><Gauge size={13} />模型更强，也可能更贵</p>
          <small>PRICE SNAPSHOT {PRICE_SNAPSHOT}</small>
        </section>
      </aside>
    </div>
  )
}

function StatBar({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><div className="meter"><span style={{ width: `${Math.min(100, value * 100)}%` }} /></div></div>
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}
