import { ArrowUpRight, Bot, CheckCircle2, Database, Flame, GitBranch, Info, MousePointer2, ShieldCheck, Sparkles, Terminal, TestTube2 } from 'lucide-react'
import { MODELS, PRICE_NOTE, PRICE_SNAPSHOT, USD_CNY_REFERENCE } from '../game/data'
import { Modal, TinyTag } from './Common'

export function PriceAtlas({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="模型价格图鉴" eyebrow={`PRICE SNAPSHOT / ${PRICE_SNAPSHOT}`} onClose={onClose} wide>
      <div className="atlas-intro">
        <div><Info size={17} /><p>所有费用均为离线模拟。游戏使用输入、缓存命中和输出三段费率计算每次操作，外币按参考汇率换算成人民币。</p></div>
        <TinyTag tone="ember">1 USD ≈ ¥{USD_CNY_REFERENCE.toFixed(2)}</TinyTag>
      </div>
      <div className="price-table-wrap">
        <table className="price-table">
          <thead><tr><th>游戏内模型</th><th>现实参考</th><th>输入 ¥/MTok</th><th>缓存 ¥/MTok</th><th>输出 ¥/MTok</th><th>官方原价</th><th>来源</th></tr></thead>
          <tbody>
            {MODELS.map((model) => (
              <tr key={model.id}>
                <td><span className="table-model-dot" style={{ background: model.color }} /><strong>{model.parodyName}</strong><small>{model.provider}</small></td>
                <td>{model.realName}<small>{model.contextLabel}</small></td>
                <td>{model.ratesCny.input.toFixed(model.ratesCny.input < 1 ? 3 : 2)}</td>
                <td>{model.ratesCny.cached.toFixed(model.ratesCny.cached < 1 ? 3 : 2)}</td>
                <td>{model.ratesCny.output.toFixed(2)}</td>
                <td>{model.nativePrice}<small>{model.note}</small></td>
                <td><a href={model.sourceUrl} target="_blank" rel="noreferrer">{model.sourceLabel}<ArrowUpRight size={13} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="formula-box">
        <code>费用 = 未缓存输入 × input_rate + 缓存输入 × cache_rate + 输出 × output_rate</code>
        <p>{PRICE_NOTE}</p>
      </div>
      <div className="legal-note"><ShieldCheck size={15} /><span>Codax、Cloude、DeepSick、Gemina、Gloom、Qwan 与 GBT 均为戏仿名称。本项目不隶属于、未获赞助于表中现实厂商。模型费率会变化，游戏快照不能替代真实账单。</span></div>
    </Modal>
  )
}

export function GuideOverlay({ onClose }: { onClose: () => void }) {
  const steps = [
    { icon: <GitBranch size={20} />, title: '选择路线', body: '从三份项目中选一份。路线中有项目、随机事件与上下文休整，最后汇聚到发布 Boss。' },
    { icon: <MousePointer2 size={20} />, title: '打出操作', body: '调查、实现、验证和控制类卡牌会消耗时间、Token 与预算。执行前只有模糊预测。' },
    { icon: <Terminal size={20} />, title: '看证据', body: '文件树、Diff、终端测试和 Agent 消息会告诉你项目是否真的接近完成。别只信模型的语气。' },
    { icon: <TestTube2 size={20} />, title: '决定交付', body: '达到要求不是硬门槛，你可以提前交付，但未发现的风险可能让项目被打回。' },
  ]
  return (
    <Modal title="六十秒上手" eyebrow="HOW TO BURN RESPONSIBLY" onClose={onClose} wide>
      <div className="guide-hero"><div className="guide-flame"><Flame size={28} /></div><div><h3>你管理的不是魔法，是上下文与概率。</h3><p>目标是在预算、上下文窗口、Deadline 或代码稳定度归零前抵达最终发布。</p></div></div>
      <div className="guide-steps">{steps.map((step, index) => <div key={step.title}><span className="guide-number">0{index + 1}</span><i>{step.icon}</i><h3>{step.title}</h3><p>{step.body}</p></div>)}</div>
      <div className="resource-guide">
        <div><Flame size={17} /><span><b>预算</b>按真实模型公开费率模拟结算</span></div>
        <div><Database size={17} /><span><b>上下文</b>满载时本局立刻失败</span></div>
        <div><Sparkles size={17} /><span><b>Buff</b>和新模型只在当前 Run 生效</span></div>
        <div><Bot size={17} /><span><b>职业 XP</b>永久解锁开局模型与图鉴</span></div>
      </div>
      <button className="primary-button guide-close" onClick={onClose}><CheckCircle2 size={16} />明白，开始烧</button>
    </Modal>
  )
}
