import { Component, type ErrorInfo, type ReactNode } from 'react'

type AppErrorBoundaryProps = {
  children: ReactNode
  resetKey?: string
}

type AppErrorBoundaryState = {
  error: Error | null
  resetKey?: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromProps(
    props: AppErrorBoundaryProps,
    state: AppErrorBoundaryState,
  ): Partial<AppErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey }
    }
    return null
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AIxuexi] 页面渲染失败', error, info)
  }

  private retryCurrentPage = () => {
    this.setState({ error: null })
  }

  private returnHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section className="route-error-card" role="alert" aria-live="assertive">
        <div className="route-error-card__icon" aria-hidden="true">🧩</div>
        <p className="route-error-card__eyebrow">页面没有丢失</p>
        <h1>刚才这个功能没有正常打开</h1>
        <p>系统已经拦住了异常，不需要反复刷新。先重试当前页面，仍有问题时返回首页重新进入。</p>
        <div className="route-error-card__actions">
          <button type="button" className="route-error-card__primary" onClick={this.retryCurrentPage}>
            重试当前页面
          </button>
          <button type="button" className="route-error-card__secondary" onClick={this.returnHome}>
            返回首页
          </button>
        </div>
      </section>
    )
  }
}
