import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { parentApi } from '../services/parentApi'
import type { ParentChildSummary, ParentDashboard } from '../types'
import { ParentDataContext } from './ParentDataContextObject'

const SELECTED_KEY = 'aixuexi:parent:selected-child'

export function ParentDataProvider({ children: content }: { children: ReactNode }) {
  const [children, setChildren] = useState<ParentChildSummary[]>([])
  const [selectedChildId, setSelectedChildIdState] = useState(() => localStorage.getItem(SELECTED_KEY) || '')
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const setSelectedChildId = useCallback((id: string) => {
    setSelectedChildIdState(id)
    if (id) localStorage.setItem(SELECTED_KEY, id)
    else localStorage.removeItem(SELECTED_KEY)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const nextChildren = await parentApi.listChildren()
      setChildren(nextChildren)
      const targetId = nextChildren.some((item) => item.id === selectedChildId) ? selectedChildId : nextChildren[0]?.id || ''
      if (targetId !== selectedChildId) setSelectedChildId(targetId)
      if (!targetId) {
        setDashboard(null)
        return
      }
      setDashboard(await parentApi.getDashboard(targetId))
    } catch (err) {
      setDashboard(null)
      setError(err instanceof Error ? err.message : '家长端数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [selectedChildId, setSelectedChildId])

  useEffect(() => { void load() }, [load])

  const linkChild = useCallback(async (code: string) => {
    await parentApi.linkChild(code)
    await load()
  }, [load])

  const unlinkChild = useCallback(async (id: string) => {
    await parentApi.unlinkChild(id)
    if (selectedChildId === id) setSelectedChildId('')
    await load()
  }, [load, selectedChildId, setSelectedChildId])

  const value = useMemo(() => ({ children, selectedChildId, dashboard, loading, error, setSelectedChildId, refresh: load, linkChild, unlinkChild }), [children, selectedChildId, dashboard, loading, error, setSelectedChildId, load, linkChild, unlinkChild])
  return <ParentDataContext.Provider value={value}>{content}</ParentDataContext.Provider>
}

