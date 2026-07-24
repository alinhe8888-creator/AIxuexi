import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { parentApi } from '../services/parentApi'
import type { ParentChildSummary, ParentDashboard } from '../types'
import { ParentDataContext } from './ParentDataContextObject'

const SELECTED_KEY = 'aixuexi:parent:selected-child'

export function ParentDataProvider({ children: content }: { children: ReactNode }) {
  const [children, setChildren] = useState<ParentChildSummary[]>([])
  const [selectedChildId, setSelectedChildIdState] = useState(() => localStorage.getItem(SELECTED_KEY) || '')
  const selectedChildRef = useRef(selectedChildId)
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null)
  const dashboardRef = useRef<ParentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadingRef = useRef(false)

  const setSelectedChildId = useCallback((id: string) => {
    selectedChildRef.current = id
    setSelectedChildIdState(id)
    if (id) localStorage.setItem(SELECTED_KEY, id)
    else localStorage.removeItem(SELECTED_KEY)
  }, [])

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (!dashboardRef.current) setLoading(true)
    setError('')
    try {
      const nextChildren = await parentApi.listChildren()
      setChildren(nextChildren)
      const currentId = selectedChildRef.current
      const targetId = nextChildren.some((item) => item.id === currentId) ? currentId : nextChildren[0]?.id || ''
      if (targetId !== currentId) setSelectedChildId(targetId)
      if (!targetId) {
        dashboardRef.current = null
        setDashboard(null)
        return
      }
      const nextDashboard = await parentApi.getDashboard(targetId)
      dashboardRef.current = nextDashboard
      setDashboard(nextDashboard)
    } catch (err) {
      setError(err instanceof Error ? err.message : '家长端数据加载失败')
      // 短暂网络失败时保留上次数据，不再把页面清空成白屏。
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [setSelectedChildId])

  useEffect(() => {
    void load()
    const onFocus = () => void load()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  useEffect(() => {
    if (!selectedChildId) return
    void load()
  }, [load, selectedChildId])

  const linkChild = useCallback(async (code: string) => {
    await parentApi.linkChild(code)
    await load()
  }, [load])

  const unlinkChild = useCallback(async (id: string) => {
    await parentApi.unlinkChild(id)
    if (selectedChildRef.current === id) setSelectedChildId('')
    await load()
  }, [load, setSelectedChildId])

  const value = useMemo(() => ({
    children,
    selectedChildId,
    dashboard,
    loading,
    error,
    setSelectedChildId,
    refresh: load,
    linkChild,
    unlinkChild,
  }), [children, selectedChildId, dashboard, loading, error, setSelectedChildId, load, linkChild, unlinkChild])

  return <ParentDataContext.Provider value={value}>{content}</ParentDataContext.Provider>
}
