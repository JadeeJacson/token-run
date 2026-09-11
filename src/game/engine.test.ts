import { describe, expect, it } from 'vitest'
import { ACTION_CARDS, MODELS } from './data'
import {
  assessCardSequence,
  DEFAULT_META,
  beginNode,
  buildRoute,
  createRun,
  deliveryConfidence,
  playAction,
  randomAt,
  resolveCache,
  switchModel,
  totalUsage,
  updateMeta,
} from './engine'

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
