import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { clearGameStorage } from '../game/storage'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 兜底错误边界。
 * 最可能的崩溃源是浏览器里残留的旧存档或坏存档，所以除了重试，
 * 还可以一键清空本游戏的 localStorage 后重载。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[token-run] 渲染失败', error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  private handleReset = () => {
    clearGameStorage()
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="crash-screen" role="alert">
        <span className="eyebrow">RUNTIME ERROR</span>
        <h1>Agent 进程崩了</h1>
        <p>页面渲染时抛出了未捕获的异常。多数情况下，这是浏览器里残留的旧存档造成的。</p>
        <pre className="crash-detail">{error.message || String(error)}</pre>
        <div className="crash-actions">
          <button className="primary-button" onClick={this.handleRetry}>重试渲染</button>
          <button className="ghost-button" onClick={this.handleReset}>清除本地存档并重载</button>
        </div>
        <small>清除只会删除本游戏写入的 4 个 localStorage 键，不影响其它网站数据。</small>
      </div>
    )
  }
}
