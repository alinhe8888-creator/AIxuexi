import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAppStore } from './store/useAppStore'
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

function LearningApp() {
  const { state } = useAppStore()
  if (!state.profile.onboarded) return <Navigate to="/onboarding" replace />
  return (
    <Layout>
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
    </Layout>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/*" element={<LearningApp />} />
      </Routes>
    </>
  )
}
