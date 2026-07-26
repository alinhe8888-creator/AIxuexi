import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireRole } from './auth/RequireRole'
import { useAuth } from './auth/useAuth'
import { ParentLayout } from './components/ParentLayout'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { ParentDataProvider } from './parent/ParentDataContext'
import { ParentAuthPage } from './pages/ParentAuthPage'
import { ParentHomePage } from './pages/parent/ParentHomePage'
import { ParentMistakesPage } from './pages/parent/ParentMistakesPage'
import { ParentProgressPage } from './pages/parent/ParentProgressPage'
import { ParentReportsPage } from './pages/parent/ParentReportsPage'
import { ParentSettingsPage } from './pages/parent/ParentSettingsPage'
import './App.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0, behavior: 'instant' }), [pathname])
  return null
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  if (status === 'loading') return null
  if (user) return <Navigate to="/" replace />
  return children
}

function ParentDashboardApp() {
  const location = useLocation()
  return (
    <ParentDataProvider>
      <ParentLayout>
        <div className="route-view">
          <AppErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<ParentHomePage />} />
            <Route path="/progress" element={<ParentProgressPage />} />
            <Route path="/mistakes" element={<ParentMistakesPage />} />
            <Route path="/reports" element={<ParentReportsPage />} />
            <Route path="/settings" element={<ParentSettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </AppErrorBoundary>
        </div>
      </ParentLayout>
    </ParentDataProvider>
  )
}

export default function ParentPortal() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<PublicOnly><ParentAuthPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><ParentAuthPage /></PublicOnly>} />
        <Route path="/*" element={<RequireRole role="parent"><ParentDashboardApp /></RequireRole>} />
      </Routes>
    </>
  )
}
