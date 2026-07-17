import { AlertTriangle, BarChart3, BookX, ChevronRight, Home, Link2, LogOut, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Users } from 'lucide-react'
import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useParentData } from '../parent/useParentData'
import { Button } from './ui'

const items = [
  { to: '/', label: '家长首页', icon: Home, end: true },
  { to: '/progress', label: '学习进度', icon: TrendingUp },
  { to: '/mistakes', label: '错题与错因', icon: BookX },
  { to: '/reports', label: '学习报告', icon: BarChart3 },
  { to: '/settings', label: '绑定与设置', icon: Link2 },
]

export function ParentLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { children: linkedChildren, selectedChildId, setSelectedChildId, refresh, loading } = useParentData()
  const location = useLocation()
  const current = items.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  return (
    <div className="parent-shell">
      <aside className="parent-sidebar">
        <NavLink to="/" className="brand"><span className="brand-mark"><Sparkles size={20} /></span><span><strong>知航 AI</strong><small>家长端</small></span></NavLink>
        <div className="parent-private-badge"><ShieldCheck size={16} /><span>仅家长账号可见</span></div>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={19} /><span>{label}</span><ChevronRight className="nav-arrow" size={15} /></NavLink>)}
        </nav>
        <div className="parent-account-card"><div className="mini-avatar">{user?.displayName.slice(0, 1)}</div><div><strong>{user?.displayName}</strong><small>{user?.email}</small></div></div>
        <button className="parent-logout" onClick={logout}><LogOut size={17} />退出登录</button>
      </aside>

      <main className="parent-main">
        <header className="parent-topbar">
          <div><span className="eyebrow">家长独立视图</span><strong>{current?.label || '家长端'}</strong></div>
          <div className="parent-topbar-actions">
            {linkedChildren.length > 0 ? <label className="child-select"><Users size={16} /><select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>{linkedChildren.map((child) => <option key={child.id} value={child.id}>{child.displayName}</option>)}</select></label> : <span className="no-child-pill"><AlertTriangle size={15} />尚未绑定学生</span>}
            <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} />刷新</Button>
          </div>
        </header>
        <div className="parent-page-container">{children}</div>
      </main>
      <nav className="parent-mobile-nav" aria-label="家长端手机导航">
        {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={20} /><span>{label.replace('家长','')}</span></NavLink>)}
      </nav>
    </div>
  )
}
