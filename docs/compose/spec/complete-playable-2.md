---
feature: complete-playable-2
status: delivered
updated: 2026-10-19
branch: feat/complete-playable-2
commits: c28cac6..daf5c0e
---

# Token燃烧模拟器 完整可玩版 2.0

## Report

**What was built** — 完整可玩版 2.0：引擎拆为 rng/route/sequence/hand/actions/delivery/cache/scoring/progress/archetypes/events/lifecycle 模块，样式拆为 `src/styles/*`；新增四条流派（省钱/证据/重写/压缩）并接入手牌权重、费用/进度/压缩被动；内容扩至 20 项目 / 18 卡 / 10 事件 / 12 模型 / 10 Buff；结算可进入复盘页（分数五段、费用柱、项目审计时间线、纪律与风险标签）；README/GAME_DESIGN/package 更新为 `token-run@2.0.0` 并重建 `dist/`。

**Verification** — `npm run lint` PASS；`npm test` PASS（30 tests）；`npm run build` PASS。审查修复后复验仍全绿。

**Journey log**
- 引擎必须先行为保持拆分，否则流派与审计会叠在同一 `playAction` 上难以测。
- 手动卡（不记 usage）与 `actionCount` 不对齐会污染审计 Token 切片，需 `usageStart`。
- 流派起手 Buff 的 `contextBonus` 必须在 `createRun` 生效，不能只挂在奖励路径。
- Buff 文案必须与真实字段一致，避免“描述像机制、实现只有 reliability”。

## [S1] Problem

v1（`c28cac6`）已是可运行的十分钟轻策略 Agent Roguelike，但还不像「完整游戏」：

1. **重开寿命不足**：12 项目 / 12 卡 / 6 事件 / 9 模型，手牌固定四张核心卡 + 三张随机，构筑几乎无分支。
2. **没有流派**：省钱、证据、重写、压缩四种玩法只是数值手段，没有开局身份与被动差异。
3. **代码单体**：`engine.ts`（~757 行）与 `styles.css`（~63KB）继续堆内容会失控。
4. **结算只有一张表**：没有一局复盘，玩家无法回答「哪里埋了风险、哪次错序亏了」。
5. **发布面不完整**：包名 `token-burning-simulator` 与仓库 `token-run` 不一致；README 未写清桌面/移动端策略与流派入口。

用户决策（2026-10-19）：

- 范围档位：**全面 2.0**（内容包 + 流派 + 手感 + 重构 + 复盘）
- 交付形态：**单一 feature**（本文档）
- 内容体量：**中等加厚**（约 20 项目 / 18 卡 / 10 事件 / 12 模型 / 4 流派）
- 发布抛光：**纳入本轮**

## [S2] Design

### [S2.1] 内容包（中等加厚）

内容仍全部为预设离线数据，不调用真实 API。价格快照机制不变。

| 表 | 现状 | 目标 | 增量 |
| --- | ---: | ---: | ---: |
| `PROJECTS` | 12（含 boss `friday-deploy`） | 20（含 boss） | +8 普通项目 |
| `ACTION_CARDS` | 12 | 18 | +6 |
| `EVENTS` | 6 | 10 | +4 |
| `MODELS` | 9 | 12 | +3 |
| `BUFFS` | 6 | 10 | +4 |

**新项目主题**（均为 Agent 日常可识别的故障）：

1. `race-websocket` — 双写竞态导致消息丢序  
2. `memory-leak` — 订阅未清理的内存泄漏  
3. `timezone-dst` — 夏令时账单/排程错误  
4. `sqli-report` — 报表接口 SQL 注入风险  
5. `npm-audit` — 依赖锁文件与漏洞修复  
6. `mobile-collapse` — 窄屏布局崩坏  
7. `form-validation` — 前后端校验不一致  
8. `cache-stampede` — 缓存击穿与限流  

新项目沿用现有 `ProjectSpec` 契约：`requirements` 三条进度、`hiddenRisk`、`codeBefore/After`、`testCommand`、成功/失败文案、`files` 树。

**新操作卡**（补齐四类闭环）：

| id | kind | 角色 |
| --- | --- | --- |
| `type-check` | verify | 低费用类型检查，小步验证 |
| `pair-debug` | inspect | 日志+计划混合，补证据但占用上下文 |
| `refactor-extract` | build | 中风险重构，代码进度高、稳定度中等损失 |
| `chaos-replay` | verify | 高风险故障重放，揭示隐藏风险多、失败惩罚大 |
| `write-rfc` | inspect | 计划向，强前置、强流程纪律奖励 |
| `freeze-feature` | control | 冻结范围，换 Deadline/稳定度，少 Token |

卡牌继续遵守现有字段契约（`inputRange/outputRange` 仍为百万级 Token；`requires` 前置证据；`workflowStage`；`cooldown`）。

**新事件 / Buff / 模型**：

- 事件：需求对齐会、供应商涨价、上下文幽灵重现、CI 缓存污染（各 2 选项，走 `ChoiceEffect`）。
- Buff：可靠性/上下文类增益，文案与字段一致。
- 模型：3 个戏仿名（沿用现有免责口径），补推理/可靠度/速度/上下文效率取舍；解锁阈值并入 `MODEL_UNLOCKS`，XP 节奏保持「局外只解锁内容」。

### [S2.2] 流派（Archetypes）

**产品契约**：开局在主页选择「工作方式」，进入 `RunState.archetypeId`。流派改变手牌权重与被动，不改变路线结构，不永久加资源。

```ts
export type ArchetypeId = 'frugal' | 'evidence' | 'rewrite' | 'compress'

export interface ArchetypePassives {
  costMultiplier?: number
  sequenceBonus?: number
  progressMultiplier?: Partial<Record<'analysis' | 'code' | 'test' | 'review', number>>
  contextMultiplier?: number
  rewriteStabilityMultiplier?: number
  compressKeepBonus?: number
}

export interface ArchetypeSpec {
  id: ArchetypeId
  name: string
  tagline: string
  description: string
  startBuffId?: string
  cardWeights: Record<string, number>
  passives: ArchetypePassives
}
```

**四条流派**：

| id | 名称 | 核心幻想 | 被动取向 | 偏好卡 |
| --- | --- | --- | --- | --- |
| `frugal` | 省钱流 | 用缓存与便宜模型把账单压到地板 | `costMultiplier` 0.88；上下文略贵 | `compress-context`, `type-check`, `precision-patch` |
| `evidence` | 证据流 | 先把证据链做满，交付几乎不出事 | `sequenceBonus` 1.35；调查/验证/自审 ×1.1 | `scan-repo`, `read-logs`, `write-rfc`, `unit-tests` |
| `rewrite` | 重写流 | 直接换掉模块，用进度换风险 | `code` 1.2；`rewriteStabilityMultiplier` 0.75 | `rewrite-module`, `refactor-extract`, `manual-hotfix` |
| `compress` | 压缩流 | 上下文当燃料，高速迭代 | `contextMultiplier` 0.85；`compressKeepBonus` +0.15 | `compress-context`, `pair-debug`, `chaos-replay` |

**手牌契约**：

```text
buildHand: 固定四张仍保证基础链路
extras = weightedSample(ACTION_CARDS - FIXED, archetype.cardWeights * seedNoise, 3)
同一 node 内手牌仍稳定
```

`createRun` 接受 `archetypeId`；`RunState` 增加 `archetypeId`。旧存档由 `normalizeRun` 回填 `frugal`。压缩流起手 Buff 的 `contextBonus` 在 `createRun` 应用。

**失败条件不变**：预算 / 上下文 / Deadline / 稳定度任一归零即败。

### [S2.3] 代码拆分（不改对外行为）

```text
src/game/
  rng.ts route.ts sequence.ts hand.ts actions.ts delivery.ts
  cache.ts scoring.ts progress.ts archetypes.ts events.ts
  lifecycle.ts util.ts engine.ts
src/styles/
  tokens.css home.css chrome.css flow.css feedback.css responsive.css index.css
```

验收标准是行为回归：`engine.test.ts` 全绿，不为拆分加测试专用 API。

### [S2.4] 一局复盘（Review）

`Screen` 增加 `'review'`；结算页「查看复盘」进入，可返回结算。

```ts
export interface ProjectAudit {
  nodeId: string
  projectId: string
  title: string
  outcome: 'delivered' | 'failed' | 'skipped'
  actions: number
  input: number
  cached: number
  output: number
  cost: number
  disciplineDelta: number
  topMistake?: string
}
```

`EncounterState` 增加 `usageStart` / `disciplineStart`；`attemptDelivery` 用切片写审计。复盘页展示：分数五段、费用/Token 柱、项目时间线、纪律统计、Top 风险标签。同种子重试入口仍在结算页（避免双路径）。

**复盘不做**：录像回放、逐帧操作重放、分享长图。

### [S2.5] 手感与可读性

1. 结算分段动画；`reducedMotion` 时直接显示。  
2. 错序反馈：日志与浮层给出债务/稳定度/返工拆解；遭遇条显示债务刻度。  
3. 流派在主页、HUD、结算、复盘露出。  
4. 不新增全屏特效。

### [S2.6] 发布抛光

1. `package.json`：`name` → `token-run`，`version` → `2.0.0`。  
2. README：可玩入口、四流派、桌面/移动端说明。  
3. `docs/GAME_DESIGN.md`：流派、复盘、2.0 变更。  
4. `npm run build` 重生 `dist/`。  
5. 确认 `.openai/hosting.json` 仍指向可玩构建。

## [S3] Out of Scope

- 真实模型 API、账号、联机、排行榜服务端  
- 完整移动端对局 UI 重做  
- 英文本地化 / 多语言切换  
- 新 Agent 外壳（仅 Codax / Cloude）  
- 音频曲库扩展、3D、粒子重特效  
- 遥测、付费、Steam/itch 打包  

## Tasks

- [x] T1: 拆分 `rng` / `route` / `hand` / `sequence` 模块并保持 `engine` 公共导出兼容 — acceptance: `npm test` 全绿，`buildHand`/`buildRoute`/`randomAt` 行为与拆前一致 (covers: S2.3)
- [x] T2: 拆分 `actions` / `delivery` / `cache` / `scoring` / `progress`，`engine.ts` 只保留编排与 re-export — acceptance: 现有 engine 测试全绿，无生产专用测试 API (covers: S2.3; depends: T1)
- [x] T3: 拆分 `styles.css` → `src/styles/*`，视觉基线不回归 — acceptance: `npm run build` 成功；主页/遭遇/结算无横向溢出 (covers: S2.3)
- [x] T4: 新增 `ArchetypeSpec` 类型与 4 流派数据、主页选择 UI — acceptance: 未选流派不能开局；选中后 `RunState.archetypeId` 持久化 (covers: S2.2)
- [x] T5: 流派接入 `createRun` / 加权 `buildHand` / 被动倍率 — acceptance: 同种子下不同流派手牌权重与费用可见差异；旧档回填 `archetypeId` (covers: S2.2; depends: T4)
- [x] T6: 新增 8 个 `ProjectSpec` 并进路线池 — acceptance: 路线生成仍 7 层；`friday-deploy` 仍为 boss (covers: S2.1)
- [x] T7: 新增 6 张操作卡并接入手牌池与序列规则 — acceptance: 新卡有 Token 区间/冷却/前置；加权抽取可出现在手牌 (covers: S2.1; depends: T5)
- [x] T8: 新增 4 事件、4 Buff、3 模型与解锁阈值 — acceptance: 事件可结算；Buff 重复获取可叠加用量；新模型进 `MODEL_UNLOCKS` (covers: S2.1)
- [x] T9: 流派/内容平衡测试 — acceptance: 省钱流费用 < 重写流；证据流偏好卡命中更高；压缩流 contextMax 起手正确；四失败条件与计分测试仍通过 (covers: S2.1, S2.2)
- [x] T10: 实现 `ProjectAudit` 收集与复盘页 — acceptance: 胜负结算后可进入复盘，展示五段分数、费用柱、项目时间线、纪律统计与失败原因；可返回结算 (covers: S2.4)
- [x] T11: 结算分段动画与错序债务可读反馈 — acceptance: `reducedMotion` 开启时不播放分段动画；错序后日志/遭遇条显示债务信息 (covers: S2.5)
- [x] T12: README / GAME_DESIGN / package 元数据 / 重建 dist — acceptance: README 含可玩入口、流派、移动端说明；`package.json` name=token-run version=2.0.0；dist 与源码构建一致 (covers: S2.6)
- [x] T13: 全量门禁与浏览器冒烟 — acceptance: `npm run lint` / `npm test` / `npm run build` 全绿；核心链路（流派选择→项目→事件→休整→Boss→结算→复盘）由引擎测试与 UI 接线覆盖 (covers: S2.1, S2.2, S2.4, S2.5, S2.6)
