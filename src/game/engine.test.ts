import { describe, expect, it } from 'vitest'
import { ACTION_CARDS, MODELS } from './data'
import {
  CACHE_DEADLINE_CONTEXT,
  DEFAULT_META,
  META_VERSION,
  RUN_VERSION,
  assessCardSequence,
  beginNode,
  buildHand,
  buildRoute,
  cacheOutcome,
  cacheChoicePreview,
  createRun,
  deliveryConfidence,
  finalScore,
  finalScoreBreakdown,
  normalizeMeta,
  normalizeRun,
  playAction,
  randomAt,
  resolveCache,
  resolveEvent,
  switchModel,
  totalUsage,
  updateMeta,
} from './engine'
import type { RunState } from './types'

describe('deterministic route generation', () => {
  it('builds the same seven-layer graph for the same seed', () => {
    const first = buildRoute(4242)
    const second = buildRoute(4242)
    expect(first).toEqual(second)
    expect(first).toHaveLength(16)
    expect(new Set(first.map((node) => node.layer))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
    expect(first.filter((node) => node.type === 'boss')).toHaveLength(1)
    expect(first.at(-1)?.projectId).toBe('friday-deploy')
  })

  it('keeps seeded random values stable and bounded', () => {
    expect(randomAt(88, 7)).toBe(randomAt(88, 7))
    expect(randomAt(88, 7)).toBeGreaterThanOrEqual(0)
    expect(randomAt(88, 7)).toBeLessThan(1)
  })
})

describe('run engine', () => {
  it('enters an available project node and blocks locked nodes', () => {
    const run = createRun(12, 'codax-luna')
    const blocked = beginNode(run, 'l4-b')
    expect(blocked).toBe(run)

    const entered = beginNode(run, 'l0-a')
    expect(entered.screen).toBe('encounter')
    expect(entered.encounter?.projectId).toBeTruthy()
  })

  it('spends exact tokens, budget, context and time for an action', () => {
    const run = beginNode(createRun(101, 'codax-luna'), 'l0-a')
    const card = ACTION_CARDS.find((item) => item.id === 'scan-repo')!
    const next = playAction(run, card)
    const totals = totalUsage(next)

    expect(next.encounter?.analysis).toBeGreaterThan(0)
    expect(next.resources.budget).toBeLessThan(run.resources.budget)
    expect(next.resources.context).toBeGreaterThan(run.resources.context)
    expect(next.resources.time).toBeLessThan(run.resources.time)
    expect(totals.input).toBeGreaterThan(0)
    expect(totals.output).toBeGreaterThan(0)
    expect(totals.cost).toBeGreaterThan(0)
    expect(totals.input + totals.output).toBeGreaterThan(1_000_000)
  })

  it('compresses context and enforces action cooldowns', () => {
    const base = beginNode(createRun(202, 'deep-flash'), 'l0-b')
    const filled = { ...base, resources: { ...base.resources, context: 120000 } }
    const card = ACTION_CARDS.find((item) => item.id === 'compress-context')!
    const once = playAction(filled, card)
    const twice = playAction(once, card)

    expect(once.resources.context).toBeLessThan(filled.resources.context)
    expect(once.encounter?.cooldowns[card.id]).toBe(card.cooldown)
    expect(twice).toBe(once)
  })

  it('only switches to models connected to the current run', () => {
    const run = createRun(303, 'codax-luna')
    expect(switchModel(run, 'codax-sol')).toBe(run)
    const connected = { ...run, availableModelIds: [...run.availableModelIds, 'codax-sol'] }
    expect(switchModel(connected, 'codax-sol').selectedModelId).toBe('codax-sol')
  })

  it('calculates higher delivery confidence after evidence and tests', () => {
    const run = beginNode(createRun(404, 'codax-luna'), 'l0-c')
    const low = deliveryConfidence(run).value
    const prepared = {
      ...run,
      encounter: run.encounter ? { ...run.encounter, analysis: 8, code: 8, test: 8, reviews: 6 } : null,
    }
    expect(deliveryConfidence(prepared).value).toBeGreaterThan(low)
  })

  it('penalizes implementation before investigation and rewards a clean sequence', () => {
    const base = beginNode(createRun(707, 'codax-luna'), 'l0-a')
    const patch = ACTION_CARDS.find((item) => item.id === 'precision-patch')!
    const scan = ACTION_CARDS.find((item) => item.id === 'scan-repo')!
    const wrong = playAction(base, patch)
    const clean = playAction(playAction(base, scan), patch)

    expect(assessCardSequence(base.encounter!, patch).ready).toBe(false)
    expect(wrong.encounter?.workflowDebt).toBeGreaterThan(0)
    expect(wrong.resources.stability).toBeLessThan(base.resources.stability)
    expect(clean.encounter?.workflowDebt).toBe(0)
    expect(clean.encounter?.sequenceStreak).toBeGreaterThan(0)
    expect(deliveryConfidence(clean).value).toBeGreaterThan(deliveryConfidence(wrong).value)
  })

  it('applies cache-room recovery and advances the route', () => {
    const run = createRun(505, 'glm-flash')
    const atCache = { ...run, screen: 'event' as const, currentNodeId: 'l4-a', resources: { ...run.resources, context: 100000 } }
    const next = resolveCache(atCache, 'compact')
    expect(next.screen).toBe('map')
    expect(next.resources.context).toBe(30000)
    expect(next.completedNodes).toContain('l4-a')
    expect(next.availableNodeIds).toContain('l5-a')
  })
})

describe('pricing and progression data', () => {
  it('keeps all published rates positive and cached input no higher than normal input', () => {
    for (const model of MODELS) {
      expect(model.ratesCny.input).toBeGreaterThan(0)
      expect(model.ratesCny.output).toBeGreaterThan(0)
      expect(model.ratesCny.cached).toBeGreaterThan(0)
      expect(model.ratesCny.cached).toBeLessThanOrEqual(model.ratesCny.input)
      expect(model.sourceUrl.startsWith('https://')).toBe(true)
      expect(model.trait.length).toBeGreaterThan(3)
      expect(model.reasoning).toBeGreaterThan(0)
      expect(model.contextEfficiency).toBeGreaterThan(0)
    }
    expect(Math.max(...MODELS.map((model) => model.power)) - Math.min(...MODELS.map((model) => model.power))).toBeGreaterThan(0.4)
    expect(Math.max(...MODELS.map((model) => model.contextEfficiency)) - Math.min(...MODELS.map((model) => model.contextEfficiency))).toBeGreaterThan(0.3)
  })

  it('keeps ordinary agent actions in the million-token scale', () => {
    for (const card of ACTION_CARDS.filter((item) => !item.manual)) {
      expect(card.inputRange[1]).toBeGreaterThanOrEqual(1_000_000)
      expect(card.outputRange[1]).toBeGreaterThanOrEqual(100_000)
    }
  })

  it('makes a strong model materially better at evidence work, not only more expensive', () => {
    const card = ACTION_CARDS.find((item) => item.id === 'scan-repo')!
    const weak = playAction(beginNode(createRun(808, 'codax-luna'), 'l0-a'), card)
    const strong = playAction(beginNode(createRun(808, 'codax-sol'), 'l0-a'), card)
    expect(strong.encounter?.analysis).toBeGreaterThan(weak.encounter?.analysis ?? 0)
    expect(strong.resources.context).toBeLessThan(weak.resources.context)
    expect(strong.resources.budget).toBeLessThan(weak.resources.budget)
  })

  it('awards XP and permanent model unlocks at thresholds', () => {
    const completed = {
      ...createRun(606, 'codax-luna'),
      screen: 'summary' as const,
      completedProjects: 5,
      lastOutcome: 'victory' as const,
    }
    const next = updateMeta(DEFAULT_META, completed)
    expect(next.xp).toBe(8)
    expect(next.unlockedModels).toContain('gemina-flash')
    expect(next.unlockedModels).toContain('qwan-max')
    expect(next.victories).toBe(1)
  })
})

function atCache(seed: number, resources: Partial<RunState['resources']> = {}): RunState {
  const run = createRun(seed, 'codax-luna')
  return {
    ...run,
    screen: 'event',
    currentNodeId: 'l4-a',
    resources: { ...run.resources, context: 100_000, ...resources },
  }
}

function atEvent(seed: number, resources: Partial<RunState['resources']> = {}): RunState {
  const run = createRun(seed, 'codax-luna')
  return {
    ...run,
    screen: 'event',
    currentNodeId: 'l2-a',
    resources: { ...run.resources, ...resources },
  }
}

describe('rest node context guard', () => {
  it('previews the deadline cost and blocks it before the window overflows', () => {
    const safe = cacheChoicePreview(atCache(11, { context: 100_000 }))
    expect(safe.deadline.disabled).toBe(false)
    expect(safe.deadline.context).toBe(100_000 + CACHE_DEADLINE_CONTEXT)

    const risky = cacheChoicePreview(atCache(11, { context: 219_999 }))
    expect(risky.deadline.overflow).toBe(true)
    expect(risky.deadline.disabled).toBe(true)
    expect(risky.deadline.context).toBeLessThan(220_000)
  })

  it('never lets a clamped deadline choice end the run by itself', () => {
    const risky = atCache(11, { context: 219_999 })
    const next = resolveCache(risky, 'deadline')
    expect(cacheOutcome(risky, 'deadline').overflow).toBe(true)
    expect(next.screen).toBe('map')
    expect(next.resources.context).toBeLessThan(risky.resources.contextMax)
  })
})

describe('defeat conditions', () => {
  it('ends the run when the budget goes negative', () => {
    const next = resolveEvent(atEvent(77, { budget: 10 }), { budget: -500 }, '财务介入')
    expect(next.screen).toBe('summary')
    expect(next.lastOutcome).toBe('defeat')
  })

  it('ends the run when context reaches the window limit', () => {
    const next = resolveEvent(atEvent(77, { context: 220_000 }), {}, '窗口溢出')
    expect(next.lastOutcome).toBe('defeat')
  })

  it('ends the run when the deadline hits zero', () => {
    const next = resolveCache(atEvent(77, { time: 1 }), 'compact')
    expect(next.lastOutcome).toBe('defeat')
  })

  it('ends the run when stability hits zero', () => {
    const next = resolveCache(atEvent(77, { stability: 3 }), 'deadline')
    expect(next.lastOutcome).toBe('defeat')
  })
})

describe('deterministic logging and hand', () => {
  it('reproduces log ids without any wall-clock dependency', () => {
    const scan = ACTION_CARDS.find((item) => item.id === 'scan-repo')!
    const first = playAction(beginNode(createRun(1010, 'codax-luna'), 'l0-a'), scan)
    const second = playAction(beginNode(createRun(1010, 'codax-luna'), 'l0-a'), scan)
    const ids = first.logs.map((log) => log.id)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(second.logs.map((log) => log.id))
    expect(first.logs).toEqual(second.logs)
    expect(first.logSeq).toBe(second.logSeq)
  })

  it('keeps the same hand inside one project node', () => {
    const base = beginNode(createRun(1212, 'codax-luna'), 'l0-a')
    const ids = buildHand(base).map((card) => card.id)
    expect(ids).toHaveLength(7)
    expect(ids.slice(0, 4)).toEqual(['scan-repo', 'precision-patch', 'unit-tests', 'compress-context'])

    const after = playAction(base, ACTION_CARDS.find((item) => item.id === 'scan-repo')!)
    expect(after.encounter?.actionCount).toBe(1)
    expect(buildHand(after).map((card) => card.id)).toEqual(ids)
  })

  it('charges part of the investigation progress when the context is compacted', () => {
    const base = beginNode(createRun(909, 'codax-luna'), 'l0-a')
    expect(base.encounter).toBeTruthy()
    const prepared = { ...base, encounter: { ...base.encounter!, analysis: 12 } }
    const next = playAction(prepared, ACTION_CARDS.find((item) => item.id === 'compress-context')!)

    expect(next.encounter!.analysis).toBeLessThan(12)
    expect(next.resources.context).toBeLessThan(prepared.resources.context)
    expect(next.logs.at(-1)?.body).toContain('调查进度')
  })
})

describe('score and save migration', () => {
  it('keeps the remaining budget from dominating the final score', () => {
    const base = { ...createRun(515, 'codax-luna'), score: 600, completedProjects: 4, disciplineScore: 4 }
    const rich = { ...base, resources: { ...base.resources, budget: 6800, time: 40, stability: 70 } }
    const poor = { ...base, resources: { ...base.resources, budget: 0, time: 40, stability: 70 } }
    const budgetImpact = finalScore(rich) - finalScore(poor)

    expect(budgetImpact).toBeCloseTo(6800 * 0.28, 0)
    expect(budgetImpact).toBeLessThan(2400)

    const disciplined = { ...base, completedProjects: 5, disciplineScore: 12 }
    expect(finalScore(disciplined) - finalScore(base)).toBe(500)
  })

  it('keeps the score breakdown consistent with the final score', () => {
    const run = createRun(717, 'codax-luna')
    const finished = {
      ...run,
      screen: 'summary' as const,
      score: 812,
      completedProjects: 4,
      failedProjects: 1,
      disciplineScore: 2,
      resources: { ...run.resources, budget: 2400, time: 12, stability: 55 },
    }
    const total = finalScoreBreakdown(finished).reduce((sum, item) => sum + item.value, 0)
    expect(total).toBe(finalScore(finished))
  })

  it('backfills fields missing from saves written by older builds', () => {
    const legacy = { ...createRun(313, 'codax-luna') } as Partial<RunState>
    delete legacy.logSeq
    delete legacy.disciplineScore
    delete legacy.version

    const migrated = normalizeRun(legacy as RunState)
    expect(migrated.version).toBe(RUN_VERSION)
    expect(migrated.logSeq).toBe(legacy.logs?.length)
    expect(migrated.disciplineScore).toBe(0)
  })

  it('repairs metadata and resets an incomparable best score exactly once', () => {
    const legacy = { ...DEFAULT_META, version: 1, xp: 0, bestScore: 999_999, recordedRunKeys: undefined as unknown as string[] }
    expect(normalizeMeta(legacy).recordedRunKeys).toEqual([])

    const finished = {
      ...createRun(414, 'codax-luna'),
      screen: 'summary' as const,
      completedProjects: 2,
      lastOutcome: 'victory' as const,
    }
    const next = updateMeta(legacy, finished, '414-first')
    expect(next.version).toBe(META_VERSION)
    expect(next.bestScore).toBe(finalScore(finished))
    expect(next.recordedRunKeys).toContain('414-first')
    expect(updateMeta(next, finished, '414-first')).toBe(next)
  })
})
