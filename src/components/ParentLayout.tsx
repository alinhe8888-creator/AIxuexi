import { AlertTriangle, BarChart3, BookX, ChevronRight, Home, Link2, LogOut, RefreshCw, Sparkles, TrendingUp, Users } from 'lucide-react'
import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useParentData } from '../parent/useParentData'
import { Button } from './ui'

const items = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/progress', label: '分析', icon: TrendingUp },
  { to: '/mistakes', label: '错题', icon: BookX },
  { to: '/reports', label: '报告', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Link2 },
]

export function ParentLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { children: linkedChildren, selectedChildId, setSelectedChildId, refresh, loading } = useParentData()
  const location = useLocation()
  const current = items.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))

  return (
    <div className="parent-shell">
      <aside className="parent-sidebar">
        <NavLink to="/" className="brand"><span className="brand-mark"><Sparkles size={20} /></span><span><strong>知航 AI</strong><small>学习概览</small></span></NavLink>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label}</span><ChevronRight className="nav-arrow" size={15} /></NavLink>)}
        </nav>
        <div className="parent-account-card"><div className="mini-avatar">{user?.displayName.slice(0, 1)}</div><div><strong>{user?.displayName}</strong><small>{user?.email}</small></div></div>
        <button className="parent-logout" onClick={logout}><LogOut size={17} />退出</button>
      </aside>
      <main className="parent-main">
        <header className="parent-topbar">
          <div><strong>{current?.label || '首页'}</strong></div>
          <div className="parent-topbar-actions">
            {linkedChildren.length > 1 ? <label className="child-select"><Users size={16} /><select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>{linkedChildren.map((child) => <option key={child.id} value={child.id}>{child.displayName}</option>)}</select></label> : linkedChildren.length === 0 ? <span className="no-child-pill"><AlertTriangle size={15} />暂无数据</span> : null}
            <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading} aria-label="同步"><RefreshCw size={15} className={loading ? 'spin' : ''} /></Button>
          </div>
        </header>
        <div className="parent-page-container">{children}</div>
      </main>
      <nav className="parent-mobile-nav" aria-label="手机导航">
        {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={20} /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  )
}
