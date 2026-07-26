import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parentApi } from '../services/parentApi'
import type { ParentChildSummary, ParentDashboard } from '../types'
import { ParentDataContext } from './ParentDataContextObject'

const SELECTED_KEY = 'aixuexi:parent:selected-child'
const CACHE_KEY = 'aixuexi:parent:last-data'

function readCache(): { children: ParentChildSummary[]; dashboard: ParentDashboard | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { children: [], dashboard: null }
    const value = JSON.parse(raw) as { children?: ParentChildSummary[]; dashboard?: ParentDashboard | null }
    return { children: value.children ?? [], dashboard: value.dashboard ?? null }
  } catch {
    return { children: [], dashboard: null }
  }
}

export function ParentDataProvider({ children: content }: { children: ReactNode }) {
  const cached = readCache()
  const [children, setChildren] = useState<ParentChildSummary[]>(cached.children)
  const [selectedChildId, setSelectedChildIdState] = useState(() => localStorage.getItem(SELECTED_KEY) || cached.children[0]?.id || '')
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(cached.dashboard)
  const [loading, setLoading] = useState(!cached.dashboard)
  const [error, setError] = useState('')

  const setSelectedChildId = useCallback((id: string) => {
    setSelectedChildIdState(id)
    if (id) localStorage.setItem(SELECTED_KEY, id)
    else localStorage.removeItem(SELECTED_KEY)
  }, [])

  const load = useCallback(async () => {
    if (!dashboard) setLoading(true)
    setError('')
    try {
      const nextChildren = await parentApi.listChildren()
      setChildren(nextChildren)
      const targetId = nextChildren.some((item) => item.id === selectedChildId) ? selectedChildId : nextChildren[0]?.id || ''
      if (targetId !== selectedChildId) setSelectedChildId(targetId)
      if (!targetId) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ children: nextChildren, dashboard: null }))
        setDashboard(null)
        return
      }
      const nextDashboard = await parentApi.getDashboard(targetId)
      setDashboard(nextDashboard)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ children: nextChildren, dashboard: nextDashboard }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步失败')
      // 保留上一次数据，不再因为一次网络失败清空页面。
    } finally {
      setLoading(false)
    }
  }, [dashboard, selectedChildId, setSelectedChildId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [load])

  const linkChild = useCallback(async (code: string) => { await parentApi.linkChild(code); await load() }, [load])
  const unlinkChild = useCallback(async (id: string) => { await parentApi.unlinkChild(id); if (selectedChildId === id) setSelectedChildId(''); await load() }, [load, selectedChildId, setSelectedChildId])
  const value = useMemo(() => ({ children, selectedChildId, dashboard, loading, error, setSelectedChildId, refresh: load, linkChild, unlinkChild }), [children, selectedChildId, dashboard, loading, error, setSelectedChildId, load, linkChild, unlinkChild])
  return <ParentDataContext.Provider value={value}>{content}</ParentDataContext.Provider>
}
