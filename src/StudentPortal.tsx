import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireRole } from './auth/RequireRole'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppStoreProvider } from './store/AppStore'
import { useAppStore } from './store/useAppStore'
import { StudentAuthPage } from './pages/StudentAuthPage'
import { ChallengePage } from './pages/ChallengePage'
import { DailyPlanPage } from './pages/DailyPlanPage'
import { HomePage } from './pages/HomePage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { LearningProfilePage } from './pages/LearningProfilePage'
import { MistakeBookPage } from './pages/MistakeBookPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PaperAnalysisPage } from './pages/PaperAnalysisPage'
import { PhotoExplainPage } from './pages/PhotoExplainPage'
import { QuizPage } from './pages/QuizPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SimulationPage } from './pages/SimulationPage'
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

function StudentLearningApp() {
  const { state } = useAppStore()
  const location = useLocation()
  if (!state.profile.onboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (state.profile.onboarded && location.pathname === '/onboarding') return <Navigate to="/" replace />
  if (location.pathname === '/onboarding') return <OnboardingPage />
  return (
    <Layout>
      <div className="route-view">
        <AppErrorBoundary key={location.pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/photo-explain" element={<PhotoExplainPage />} />
          <Route path="/paper-analysis" element={<PaperAnalysisPage />} />
          <Route path="/mistakes" element={<MistakeBookPage />} />
          <Route path="/challenge" element={<ChallengePage />} />
          <Route path="/simulation" element={<SimulationPage />} />
          <Route path="/daily-plan" element={<DailyPlanPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/profile" element={<LearningProfilePage />} />
          <Route path="/knowledge" element={<KnowledgeBasePage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </AppErrorBoundary>
      </div>
    </Layout>
  )
}

export default function StudentPortal() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<PublicOnly><StudentAuthPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><StudentAuthPage /></PublicOnly>} />
        <Route path="/*" element={<RequireRole role="student"><AppStoreProvider><StudentLearningApp /></AppStoreProvider></RequireRole>} />
      </Routes>
    </>
  )
}
