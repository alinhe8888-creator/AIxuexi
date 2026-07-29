import {
  lazy,
  Suspense,
  useEffect,
  useRef,
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
import './styles/final-upgrade.css'
import './styles/family-learning-v160.css'
import './styles/adaptive-tutor.css'

type UnknownModule = Record<string, unknown>

const CHUNK_RETRY_KEY = 'aixuexi:route-chunk-retry:v6'
const SCROLL_KEY_PREFIX = 'aixuexi:route-scroll:v1'
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
const StudyCyclePage = lazyNamed(() => import('./pages/StudyCyclePage'), 'StudyCyclePage')
const SimulationPage = lazyNamed(() => import('./pages/SimulationPage'), 'SimulationPage')

const studentPages = [
  { path: '/daily-plan', Component: DailyPlanPage },
  { path: '/photo-explain', Component: PhotoExplainPage },
  { path: '/paper-analysis', Component: PaperAnalysisPage },
  { path: '/mistakes', Component: MistakeBookPage },
  { path: '/study-cycle', Component: StudyCyclePage },
  { path: '/simulation', Component: SimulationPage },
  { path: '/profile', Component: LearningProfilePage },
  { path: '/knowledge', Component: KnowledgeBasePage },
  { path: '/settings', Component: SettingsPage },
] as const

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
  const previousPath = useRef(pathname)

  useEffect(() => {
    const previous = previousPath.current
    if (previous !== pathname) {
      sessionStorage.setItem(`${SCROLL_KEY_PREFIX}:${previous}`, String(window.scrollY))
    }

    previousPath.current = pathname
    const saved = Number(sessionStorage.getItem(`${SCROLL_KEY_PREFIX}:${pathname}`) || 0)
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number.isFinite(saved) ? saved : 0, behavior: 'auto' })
    })
    const timer = window.setTimeout(() => sessionStorage.removeItem(CHUNK_RETRY_KEY), 10_000)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      sessionStorage.setItem(`${SCROLL_KEY_PREFIX}:${pathname}`, String(window.scrollY))
    }
  }, [pathname])

  return null
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  if (status === 'loading') return <PageLoading label="正在确认登录状态" />
  if (user) return <Navigate to="/daily-plan" replace />
  return children
}

function StudentLearningApp() {
  return (
    <Layout>
      <div className="route-view">
        <Routes>
          <Route path="/" element={<Navigate to="/daily-plan" replace />} />
          {studentPages.map(({ path, Component }) => (
            <Route
              key={path}
              path={path}
              element={
                <AppErrorBoundary resetKey={path}>
                  <Suspense fallback={<PageLoading />}>
                    <Component />
                  </Suspense>
                </AppErrorBoundary>
              }
            />
          ))}
          <Route path="*" element={
            <AppErrorBoundary resetKey="student-not-found">
              <Suspense fallback={<PageLoading />}>
                <NotFoundPage />
              </Suspense>
            </AppErrorBoundary>
          } />
        </Routes>
      </div>
    </Layout>
  )
}

export default function StudentPortal() {
  return (
    <AppErrorBoundary resetKey="student-root">
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
