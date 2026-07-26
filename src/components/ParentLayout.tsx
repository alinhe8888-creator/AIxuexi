import { BarChart3, BookX, ChevronRight, Home, LogOut, RefreshCw, Settings, Sparkles, TrendingUp } from 'lucide-react'
import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useParentData } from '../parent/useParentData'
import { Button } from './ui'

const items = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/progress', label: '学习进度', icon: TrendingUp },
  { to: '/mistakes', label: '错题', icon: BookX },
  { to: '/reports', label: '报告', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
]

export function ParentLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { children: linkedChildren, refresh, loading } = useParentData()
  const location = useLocation()
  const current = items.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )
  const child = linkedChildren[0]

  return (
    <div className="parent-shell">
      <aside className="parent-sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <Sparkles size={20} />
          </span>
          <span>
            <strong>知航 AI</strong>
            <small>学习概览</small>
          </span>
        </NavLink>

        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon size={19} />
              <span>{label}</span>
              <ChevronRight className="nav-arrow" size={15} />
            </NavLink>
          ))}
        </nav>

        <div className="parent-account-card">
          <div className="mini-avatar">{user?.displayName.slice(0, 1)}</div>
          <div>
            <strong>{user?.displayName}</strong>
            <small>{user?.email}</small>
          </div>
        </div>

        <button className="parent-logout" onClick={logout}>
          <LogOut size={17} />
          退出
        </button>
      </aside>

      <main className="parent-main">
        <header className="parent-topbar">
          <div>
            <span className="eyebrow">{child ? `${child.displayName}的学习数据` : '学习数据'}</span>
            <strong>{current?.label || '首页'}</strong>
          </div>

          <div className="parent-topbar-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              刷新
            </Button>
          </div>
        </header>

        <div className="parent-page-container">{children}</div>
      </main>

      <nav className="parent-mobile-nav" aria-label="手机导航">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
