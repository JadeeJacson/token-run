export type Theme = 'dark' | 'light'
export type ShellStyle = 'codax' | 'cloude'
export type Screen = 'home' | 'map' | 'encounter' | 'event' | 'reward' | 'summary'
export type NodeType = 'project' | 'event' | 'cache' | 'boss'
export type CardKind = 'inspect' | 'build' | 'verify' | 'control'
export type RiskLevel = '低' | '中' | '高'
export type WorkflowStage = '调查' | '计划' | '实现' | '验证' | '控制'

export interface PriceRate {
  input: number
  cached: number
  output: number
}

export interface ModelSpec {
  id: string
  parodyName: string
  realName: string
  provider: string
  ratesCny: PriceRate
  nativePrice: string
  contextLabel: string
  power: number
  reliability: number
  speed: number
  reasoning: number
  contextEfficiency: number
  workflowDiscipline: number
  failureRecovery: number
  trait: string
  color: string
  sourceUrl: string
  sourceLabel: string
  note?: string
}

export interface CardEffect {
  analysis?: number
  code?: number
  test?: number
  review?: number
  stability?: number
  contextReduction?: number
}

export interface ActionCard {
  id: string
  name: string
  command: string
  description: string
  kind: CardKind
  risk: RiskLevel
  inputRange: [number, number]
  outputRange: [number, number]
  timeCost: number
  cooldown: number
  contextLoad: number
  effect: CardEffect
  requires?: Partial<Record<'analysis' | 'code' | 'test' | 'reviews', number>>
  workflowStage?: WorkflowStage
  sequenceTip?: string
  manual?: boolean
  testAction?: boolean
}

export interface ProjectRequirements {
  analysis: number
  code: number
  test: number
}

export interface ProjectSpec {
  id: string
  title: string
  subtitle: string
  client: string
  kind: string
  difficulty: 1 | 2 | 3 | 4 | 5
  reward: number
  brief: string
  humor: string
  requirements: ProjectRequirements
  hiddenRisk: number
  file: string
  language: string
  codeBefore: string
  codeAfter: string
  testCommand: string
  failureText: string
  successText: string
  files: string[]
}

export interface RouteNode {
  id: string
  layer: number
  x: number
  type: NodeType
  projectId?: string
  label: string
  next: string[]
}

export interface EncounterState {
  projectId: string
  analysis: number
  code: number
  test: number
  reviews: number
  revealedRisk: number
  deliveryAttempts: number
  actionCount: number
  workflowDebt: number
  sequenceStreak: number
  cooldowns: Record<string, number>
  codeMode: 'source' | 'diff' | 'terminal'
}

export interface LogEntry {
  id: string
  role: 'system' | 'agent' | 'tool' | 'warning' | 'success'
  title: string
  body: string
  meta?: string
}

export interface RunResources {
  budget: number
  budgetMax: number
  context: number
  contextMax: number
  time: number
  timeMax: number
  stability: number
}

export interface BuffState {
  id: string
  name: string
  description: string
  icon: string
  discountMultiplier?: number
  discountUses?: number
  cacheBonus?: number
  reliabilityBonus?: number
  contextBonus?: number
  testDiscountUses?: number
}

export interface UsageRecord {
  action: string
  modelId: string
  input: number
  cached: number
  output: number
  cost: number
}

export interface RunState {
  seed: number
  rngCursor: number
  retryUsed: boolean
  screen: Screen
  route: RouteNode[]
  currentNodeId: string | null
  completedNodes: string[]
  availableNodeIds: string[]
  selectedModelId: string
  availableModelIds: string[]
  resources: RunResources
  encounter: EncounterState | null
  logs: LogEntry[]
  buffs: BuffState[]
  usage: UsageRecord[]
  completedProjects: number
  failedProjects: number
  score: number
  pendingReward: number
  metaRecorded: boolean
  lastOutcome?: 'victory' | 'defeat'
  lastMessage?: string
}

export interface MetaProgress {
  version: 1
  xp: number
  runs: number
  victories: number
  bestScore: number
  unlockedModels: string[]
  seenProjects: string[]
}

export interface Settings {
  theme: Theme
  shell: ShellStyle
  sound: boolean
  reducedMotion: boolean
}

export interface ChoiceEffect {
  budget?: number
  context?: number
  time?: number
  stability?: number
  score?: number
  buffId?: string
}

export interface EventChoice {
  label: string
  detail: string
  effect: ChoiceEffect
  result: string
}

export interface EventSpec {
  id: string
  eyebrow: string
  title: string
  body: string
  icon: string
  choices: [EventChoice, EventChoice]
}
