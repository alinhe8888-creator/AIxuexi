import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { error: Error | null; eventId: string | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, eventId: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, eventId: crypto.randomUUID() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AIxuexi page error]', { error, componentStack: info.componentStack, eventId: this.state.eventId })
  }

  private retry = () => this.setState({ error: null, eventId: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="route-error" role="alert">
        <span className="route-error-icon"><AlertTriangle size={26} /></span>
        <div>
          <h2>这个页面暂时没有正常显示</h2>
          <p>系统已经阻止异常影响其他功能。请先重试；如果仍然失败，可返回首页继续使用。</p>
          <small>错误编号：{this.state.eventId}</small>
          <div className="route-error-actions">
            <button className="btn btn-primary" onClick={this.retry}><RefreshCw size={16} />重新加载本页面</button>
            <a className="btn btn-secondary" href="/"><Home size={16} />返回首页</a>
          </div>
        </div>
      </section>
    )
  }
}
