import {
  lazy,
  Suspense,
  useEffect,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireRole } from './auth/RequireRole'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { ProductionDataCleaner } from './components/ProductionDataCleaner'
import { AppStoreProvider } from './store/AppStore'
import { useAppStore } from './store/useAppStore'
import './App.css'
import './styles/student-polish.css'

type UnknownModule = Record<string, unknown>

const CHUNK_RETRY_KEY = 'aixuexi:route-chunk-retry:v2'
const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk|dynamically imported module|module script|Failed to fetch/i

async function loadModuleWithRecovery(loader: () => Promise<unknown>) {
  try {
    return await loader()
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    const previousRetryAt = Number(sessionStorage.getItem(CHUNK_RETRY_KEY) || 0)
    const mayRetry = CHUNK_ERROR_PATTERN.test(message) && Date.now() - previousRetryAt > 30_000

    if (mayRetry) {
      sessionStorage.setItem(CHUNK_RETRY_KEY, String(Date.now()))
      window.location.reload()
      return new Promise<never>(() => undefined)
    }

    throw error
  }
}

function lazyNamed(loader: () => Promise<unknown>, exportName: string) {
  return lazy(async () => {
    const loaded = await loadModuleWithRecovery(loader) as UnknownModule
    const component = loaded[exportName]
    if (!component) throw new Error(`页面模块缺少导出：${exportName}`)
    return { default: component as ComponentType }
  })
}

const StudentAuthPage = lazyNamed(() => import('./pages/StudentAuthPage'), 'StudentAuthPage')
const ChallengePage = lazyNamed(() => import('./pages/ChallengePage'), 'ChallengePage')
const DailyPlanPage = lazyNamed(() => import('./pages/DailyPlanPage'), 'DailyPlanPage')
const HomePage = lazyNamed(() => import('./pages/HomePage'), 'HomePage')
const KnowledgeBasePage = lazyNamed(() => import('./pages/KnowledgeBasePage'), 'KnowledgeBasePage')
const LearningProfilePage = lazyNamed(() => import('./pages/LearningProfilePage'), 'LearningProfilePage')
const MistakeBookPage = lazyNamed(() => import('./pages/MistakeBookPage'), 'MistakeBookPage')
const NotFoundPage = lazyNamed(() => import('./pages/NotFoundPage'), 'NotFoundPage')
const OnboardingPage = lazyNamed(() => import('./pages/OnboardingPage'), 'OnboardingPage')
const PaperAnalysisPage = lazyNamed(() => import('./pages/PaperAnalysisPage'), 'PaperAnalysisPage')
const PhotoExplainPage = lazyNamed(() => import('./pages/PhotoExplainPage'), 'PhotoExplainPage')
const QuizPage = lazyNamed(() => import('./pages/QuizPage'), 'QuizPage')
const ReportsPage = lazyNamed(() => import('./pages/ReportsPage'), 'ReportsPage')
const SettingsPage = lazyNamed(() => import('./pages/SettingsPage'), 'SettingsPage')
const SimulationPage = lazyNamed(() => import('./pages/SimulationPage'), 'SimulationPage')

function PageLoading({ label = '正在打开学习页面' }: { label?: string }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading__planet" aria-hidden="true">
        <span />
      </div>
      <strong>{label}</strong>
      <small>马上就好</small>
    </div>
  )
}

function ScrollAndRouteRecovery() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    const timer = window.setTimeout(() => sessionStorage.removeItem(CHUNK_RETRY_KEY), 10_000)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    document.documentElement.classList.add('aixuexi-motion-ready')

    const recoverRejectedChunk = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)
      const previousRetryAt = Number(sessionStorage.getItem(CHUNK_RETRY_KEY) || 0)
      if (!CHUNK_ERROR_PATTERN.test(message) || Date.now() - previousRetryAt <= 30_000) return

      event.preventDefault()
      sessionStorage.setItem(CHUNK_RETRY_KEY, String(Date.now()))
      window.location.reload()
    }

    window.addEventListener('unhandledrejection', recoverRejectedChunk)
    return () => {
      document.documentElement.classList.remove('aixuexi-motion-ready')
      window.removeEventListener('unhandledrejection', recoverRejectedChunk)
    }
  }, [])

  return null
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  if (status === 'loading') return <PageLoading label="正在确认登录状态" />
  if (user) return <Navigate to="/" replace />
  return children
}

function StudentLearningApp() {
  const { state } = useAppStore()
  const location = useLocation()

  if (!state.profile.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (state.profile.onboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  if (location.pathname === '/onboarding') {
    return (
      <AppErrorBoundary resetKey={location.key}>
        <Suspense fallback={<PageLoading label="正在准备首次设置" />}>
          <OnboardingPage />
        </Suspense>
      </AppErrorBoundary>
    )
  }

  return (
    <Layout>
      <ProductionDataCleaner />
      <div className="route-view route-view--stable">
        <AppErrorBoundary resetKey={location.key}>
          <Suspense fallback={<PageLoading />}>
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
          </Suspense>
        </AppErrorBoundary>
      </div>
    </Layout>
  )
}

export default function StudentPortal() {
  const location = useLocation()

  return (
    <AppErrorBoundary resetKey={location.key}>
      <ScrollAndRouteRecovery />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<PublicOnly><StudentAuthPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><StudentAuthPage /></PublicOnly>} />
          <Route
            path="/*"
            element={(
              <RequireRole role="student">
                <AppStoreProvider>
                  <StudentLearningApp />
                </AppStoreProvider>
              </RequireRole>
            )}
          />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  )
}
