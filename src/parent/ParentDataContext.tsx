import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { parentApi } from '../services/parentApi'
import type { ParentChildSummary, ParentDashboard } from '../types'
import { ParentDataContext } from './ParentDataContextObject'

const LEGACY_CACHE_KEYS = ['aixuexi:family:children', 'aixuexi:family:dashboard']

export function ParentDataProvider({ children: content }: { children: ReactNode }) {
  const { user, status } = useAuth()
  const [children, setChildren] = useState<ParentChildSummary[]>([])
  const [selectedChildId, setSelectedChildIdState] = useState('')
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null)
  const [loading, setLoading] = useState(status === 'loading')
  const [error, setError] = useState('')
  const selectedRef = useRef('')

  useEffect(() => {
    LEGACY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key))
  }, [])

  const load = useCallback(async (requestedChildId?: string) => {
    if (status !== 'authenticated' || user?.role !== 'parent') {
      setChildren([])
      setSelectedChildIdState('')
      selectedRef.current = ''
      setDashboard(null)
      setError('')
      setLoading(status === 'loading')
      return
    }

    setLoading(true)
    setError('')

    try {
      const nextChildren = await parentApi.listChildren()
      const preferredId = requestedChildId || selectedRef.current
      const child = nextChildren.find((item) => item.id === preferredId) ?? nextChildren[0]

      setChildren(nextChildren)
      if (!child) {
        setSelectedChildIdState('')
        selectedRef.current = ''
        setDashboard(null)
        setError('未找到已绑定的学生账号，请检查家庭绑定配置。')
        return
      }

      setSelectedChildIdState(child.id)
      selectedRef.current = child.id
      const nextDashboard = await parentApi.getDashboard(child.id)
      setDashboard(nextDashboard)
    } catch (err) {
      setChildren([])
      setSelectedChildIdState('')
      selectedRef.current = ''
      setDashboard(null)
      setError(err instanceof Error ? err.message : '学习数据同步失败')
    } finally {
      setLoading(false)
    }
  }, [status, user?.role])

  const setSelectedChildId = useCallback((id: string) => {
    if (!id || id === selectedRef.current) return
    selectedRef.current = id
    setSelectedChildIdState(id)
    setDashboard(null)
    void load(id)
  }, [load])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const handleFocus = () => void load(selectedRef.current)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load(selectedRef.current)
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [load])

  // Kept for context API compatibility. Formal family mode uses server-managed bindings.
  const linkChild = useCallback(async (_code: string) => {
    await load(selectedRef.current)
  }, [load])

  const unlinkChild = useCallback(async (_id: string) => {
    throw new Error('家庭绑定由管理员配置，不能在家长端解除')
  }, [])

  const value = useMemo(
    () => ({
      children,
      selectedChildId,
      dashboard,
      loading,
      error,
      setSelectedChildId,
      refresh: () => load(selectedRef.current),
      linkChild,
      unlinkChild,
    }),
    [children, selectedChildId, dashboard, loading, error, setSelectedChildId, load, linkChild, unlinkChild],
  )

  return <ParentDataContext.Provider value={value}>{content}</ParentDataContext.Provider>
}
