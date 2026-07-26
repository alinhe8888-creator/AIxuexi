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
import { AppStoreProvider } from './store/AppStore'
import './App.css'
import './styles/student-polish.css'
import './styles/private-family.css'

type UnknownModule = Record<string, unknown>

const CHUNK_RETRY_KEY = 'aixuexi:route-chunk-retry:v3'
const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk|dynamically imported module|module script|Failed to fetch/i

async function loadModuleWithRecovery(loader: () => Promise<unknown>) {
  try {
    return await loader()
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    const previousRetryAt = Number(sessionStorage.getItem(CHUNK_RETRY_KEY) || 0)
    if (CHUNK_ERROR_PATTERN.test(message) && Date.now() - previousRetryAt > 30_000) {
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
const DailyPlanPage = lazyNamed(() => import('./pages/DailyPlanPage'), 'DailyPlanPage')
const KnowledgeBasePage = lazyNamed(() => import('./pages/KnowledgeBasePage'), 'KnowledgeBasePage')
const LearningProfilePage = lazyNamed(() => import('./pages/LearningProfilePage'), 'LearningProfilePage')
const MistakeBookPage = lazyNamed(() => import('./pages/MistakeBookPage'), 'MistakeBookPage')
const NotFoundPage = lazyNamed(() => import('./pages/NotFoundPage'), 'NotFoundPage')
const PaperAnalysisPage = lazyNamed(() => import('./pages/PaperAnalysisPage'), 'PaperAnalysisPage')
const PhotoExplainPage = lazyNamed(() => import('./pages/PhotoExplainPage'), 'PhotoExplainPage')
const SettingsPage = lazyNamed(() => import('./pages/SettingsPage'), 'SettingsPage')
const SimulationPage = lazyNamed(() => import('./pages/SimulationPage'), 'SimulationPage')

function PageLoading({ label = '正在打开' }: { label?: string }) {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading__planet" aria-hidden="true"><span /></div>
      <strong>{label}</strong>
    </div>
  )
}

function RouteRecovery() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    const timer = window.setTimeout(() => sessionStorage.removeItem(CHUNK_RETRY_KEY), 10_000)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return null
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  if (status === 'loading') return <PageLoading label="正在确认登录状态" />
  if (user) return <Navigate to="/photo-explain" replace />
  return children
}

function StudentLearningApp() {
  const location = useLocation()

  return (
    <Layout>
      <div className="route-view route-view--stable">
        <AppErrorBoundary resetKey={location.key}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/photo-explain" replace />} />
              <Route path="/photo-explain" element={<PhotoExplainPage />} />
              <Route path="/paper-analysis" element={<PaperAnalysisPage />} />
              <Route path="/mistakes" element={<MistakeBookPage />} />
              <Route path="/simulation" element={<SimulationPage />} />
              <Route path="/daily-plan" element={<DailyPlanPage />} />
              <Route path="/profile" element={<LearningProfilePage />} />
              <Route path="/knowledge" element={<KnowledgeBasePage />} />
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
      <RouteRecovery />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<PublicOnly><StudentAuthPage /></PublicOnly>} />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route
            path="/*"
            element={
              <RequireRole role="student">
                <AppStoreProvider>
                  <StudentLearningApp />
                </AppStoreProvider>
              </RequireRole>
            }
          />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  )
}
