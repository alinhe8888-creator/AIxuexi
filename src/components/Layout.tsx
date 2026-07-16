import {
  BarChart3,
  BookMarked,
  BookOpenCheck,
  BrainCircuit,
  CalendarCheck2,
  Camera,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  Home,
  Menu,
  MoreHorizontal,
  Settings,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { ToastViewport } from './ToastViewport'

const navItems = [
  { to: '/', label: '首页', icon: Home, mobile: true },
  { to: '/photo-explain', label: '拍题讲解', icon: Camera, mobile: true },
  { to: '/paper-analysis', label: '试卷分析', icon: FileSearch },
  { to: '/mistakes', label: '错题本', icon: BookMarked, mobile: true },
  { to: '/challenge', label: '闯关学习', icon: Target, mobile: true },
  { to: '/simulation', label: '模拟训练', icon: ClipboardCheck },
  { to: '/daily-plan', label: '每日计划', icon: CalendarCheck2, mobile: true },
  { to: '/profile', label: '学习画像', icon: BrainCircuit },
  { to: '/knowledge', label: '知识库', icon: BookOpenCheck },
  { to: '/reports', label: '学习报告', icon: BarChart3 },
  { to: '/settings', label: '个人设置', icon: Settings },
]

function Brand() {
  return (
    <NavLink to="/" className="brand">
      <span className="brand-mark"><Sparkles size={20} /></span>
      <span><strong>知航 AI</strong><small>高中学习助手</small></span>
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const { state } = useAppStore()
  const current = navItems.find((item) => item.to === location.pathname)
  const primaryMobile = navItems.filter((item) => item.mobile).slice(0, 5)
  const otherItems = navItems.filter((item) => !primaryMobile.includes(item))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav" aria-label="主要导航">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon size={19} /><span>{label}</span><ChevronRight className="nav-arrow" size={15} />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <div className="mini-avatar">{state.profile.name.slice(0, 1)}</div>
          <div><strong>{state.profile.name}</strong><small>{state.profile.grade} · 每日 {state.profile.dailyMinutes} 分钟</small></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="mobile-topbar">
          <Brand />
          <div className="mobile-current"><GraduationCap size={16} />{current?.label || '学习助手'}</div>
        </header>
        <div className="page-container">{children}</div>
      </main>

      <nav className="bottom-nav" aria-label="手机导航">
        {primaryMobile.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setMoreOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon size={21} /><span>{label}</span>
          </NavLink>
        ))}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen((open) => !open)}><MoreHorizontal size={22} /><span>更多</span></button>
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

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return <button className="icon-button" onClick={onClick}><Menu size={20} /></button>
}
