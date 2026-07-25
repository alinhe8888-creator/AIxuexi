import { BarChart3, ChevronRight, Home, LogOut, RefreshCw, Settings, Users } from 'lucide-react'
import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useParentData } from '../parent/useParentData'
import { Button } from './ui'

const items = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/reports', label: '分析', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
]

export function ParentLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { children: linkedChildren, selectedChildId, setSelectedChildId, refresh, loading } = useParentData()
  const location = useLocation()
  const current = items.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))

  return (
    <div className="parent-shell">
      <aside className="parent-sidebar">
        <NavLink to="/" className="brand family-brand"><span className="brand-mark">家</span><span><strong>家长端</strong></span></NavLink>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} /><span>{label}</span><ChevronRight className="nav-arrow" size={15} />
            </NavLink>
          ))}
        </nav>
        <div className="parent-account-card"><div className="mini-avatar">{user?.displayName.slice(0, 1)}</div><div><strong>{user?.displayName}</strong><small>{user?.email}</small></div></div>
        <button className="parent-logout" onClick={logout}><LogOut size={17} />退出</button>
      </aside>
      <main className="parent-main">
        <header className="parent-topbar">
          <strong>{current?.label || '家长端'}</strong>
          <div className="parent-topbar-actions">
            {linkedChildren.length > 0 && (
              <label className="child-select"><Users size={16} /><select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)}>{linkedChildren.map((child) => <option key={child.id} value={child.id}>{child.displayName}</option>)}</select></label>
            )}
            <Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} />刷新</Button>
          </div>
        </header>
        <div className="parent-page-container">{children}</div>
      </main>
      <nav className="parent-mobile-nav" aria-label="家长端手机导航">
        {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={20} /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  )
}
