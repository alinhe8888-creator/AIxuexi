import {
  BookMarked,
  BookOpenCheck,
  BrainCircuit,
  CalendarCheck2,
  Camera,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  LogOut,
  MoreHorizontal,
  RefreshCcw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useAppStore } from '../store/useAppStore'
import { ToastViewport } from './ToastViewport'

const navItems = [
  { to: '/daily-plan', label: '计划', icon: CalendarCheck2, mobile: true },
  { to: '/photo-explain', label: '拍题', icon: Camera, mobile: true },
  { to: '/paper-analysis', label: '试卷', icon: FileSearch },
  { to: '/mistakes', label: '错题', icon: BookMarked, mobile: true },
  { to: '/study-cycle', label: '预习复习', icon: RefreshCcw, mobile: true },
  { to: '/simulation', label: '训练', icon: ClipboardCheck, mobile: true },
  { to: '/profile', label: '画像', icon: BrainCircuit },
  { to: '/knowledge', label: '资料', icon: BookOpenCheck },
  { to: '/settings', label: '设置', icon: Settings },
]

function Brand() {
  return (
    <NavLink to="/daily-plan" className="brand">
      <span className="brand-mark"><Sparkles size={20} /></span>
      <span><strong>知航 AI</strong><small>学习</small></span>
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const { state } = useAppStore()
  const { user, logout } = useAuth()
  const current = navItems.find((item) => item.to === location.pathname)
  const primaryMobile = navItems.filter((item) => item.mobile).slice(0, 5)
  const otherItems = navItems.filter((item) => !primaryMobile.includes(item))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav" aria-label="主要导航">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} /><span>{label}</span><ChevronRight className="nav-arrow" size={15} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <div className="mini-avatar">{state.profile.name.slice(0, 1)}</div>
          <div><strong>{state.profile.name}</strong><small>{state.profile.grade} · {user?.email}</small></div>
        </div>
        <button className="student-logout" onClick={logout}><LogOut size={16} />退出</button>
      </aside>

      <main className="main-area">
        <header className="mobile-topbar">
          <Brand />
          <div className="mobile-current"><GraduationCap size={16} />{current?.label || '学习'}</div>
        </header>
        <div className="page-container">{children}</div>
      </main>

      <nav className="bottom-nav" aria-label="手机导航">
        {primaryMobile.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen((open) => !open)}>
          <MoreHorizontal size={22} /><span>更多</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header"><strong>全部功能</strong><button onClick={() => setMoreOpen(false)} aria-label="关闭"><X size={20} /></button></div>
            <div className="mobile-more-grid">
              {otherItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
                  <Icon size={22} /><span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
      <ToastViewport />
    </div>
  )
}
