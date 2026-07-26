import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parentApi } from '../services/parentApi'
import type { ParentChildSummary, ParentDashboard } from '../types'
import { ParentDataContext } from './ParentDataContextObject'

const CHILDREN_CACHE_KEY = 'aixuexi:family:children'
const DASHBOARD_CACHE_KEY = 'aixuexi:family:dashboard'

function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function ParentDataProvider({ children: content }: { children: ReactNode }) {
  const [children, setChildren] = useState<ParentChildSummary[]>(() =>
    readCache<ParentChildSummary[]>(CHILDREN_CACHE_KEY, []),
  )
  const [selectedChildId, setSelectedChildIdState] = useState(() => children[0]?.id || '')
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(() =>
    readCache<ParentDashboard | null>(DASHBOARD_CACHE_KEY, null),
  )
  const [loading, setLoading] = useState(children.length === 0)
  const [error, setError] = useState('')

  const setSelectedChildId = useCallback((id: string) => {
    setSelectedChildIdState(id)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const nextChildren = await parentApi.listChildren()
      const child = nextChildren[0]

      setChildren(nextChildren)
      localStorage.setItem(CHILDREN_CACHE_KEY, JSON.stringify(nextChildren))

      if (!child) {
        setSelectedChildIdState('')
        setError('未找到自动关联的学习账号，请确认 Render 的 FAMILY_STUDENT_EMAIL。')
        return
      }

      setSelectedChildIdState(child.id)

      const nextDashboard = await parentApi.getDashboard(child.id)
      setDashboard(nextDashboard)
      localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextDashboard))
    } catch (err) {
      setError(err instanceof Error ? err.message : '学习数据同步失败')
      // Keep the cached dashboard instead of clearing the whole page.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }

    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [load])

  // Kept for context API compatibility. Family mode no longer uses codes or unlinking.
  const linkChild = useCallback(async (_code: string) => {
    await load()
  }, [load])

  const unlinkChild = useCallback(async (_id: string) => {
    await load()
  }, [load])

  const value = useMemo(
    () => ({
      children,
      selectedChildId,
      dashboard,
      loading,
      error,
      setSelectedChildId,
      refresh: load,
      linkChild,
      unlinkChild,
    }),
    [
      children,
      selectedChildId,
      dashboard,
      loading,
      error,
      setSelectedChildId,
      load,
      linkChild,
      unlinkChild,
    ],
  )

  return <ParentDataContext.Provider value={value}>{content}</ParentDataContext.Provider>
}
