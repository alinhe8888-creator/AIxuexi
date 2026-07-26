import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { studentApi } from '../services/studentApi'
import { useAppStore } from '../store/useAppStore'
import type { AppState } from '../types'

const CLEANUP_VERSION = '2026-07-19-clean-v2'
const COLLECTION_KEYS = [
  'questions',
  'mistakes',
  'knowledgePoints',
  'reviewTasks',
  'cards',
  'dailyPlans',
  'quizzes',
  'papers',
  'activityLogs',
] as const

type CleanableState = Record<string, unknown>

const delay = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

function hasStoredLearningData(state: CleanableState) {
  return COLLECTION_KEYS.some((key) => Array.isArray(state[key]) && state[key].length > 0)
}

function createCleanState(state: CleanableState): AppState {
  const nextState: CleanableState = { ...state }
  COLLECTION_KEYS.forEach((key) => {
    if (Array.isArray(nextState[key])) nextState[key] = []
  })
  return nextState as unknown as AppState
}

/**
 * One-time production migration for each student account.
 * It preserves the student's account/profile/settings, removes all seeded or
 * old learning records, and writes the clean snapshot back to the cloud.
 */
export function ProductionDataCleaner() {
  const { user } = useAuth()
  const { state, importData } = useAppStore()
  const stateRef = useRef(state)
  const importDataRef = useRef(importData)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    stateRef.current = state
    importDataRef.current = importData
  }, [state, importData])

  useEffect(() => {
    if (!user?.id) return

    const markerKey = `aixuexi:data-cleaned:${CLEANUP_VERSION}:${user.id}`
    if (localStorage.getItem(markerKey)) return

    let cancelled = false

    const runCleanup = async () => {
      setCleaning(true)

      try {
        // AppStore also hydrates the cloud snapshot on mount. Waiting for the
        // same endpoint here keeps an older cloud snapshot from restoring demo
        // records immediately after local cleanup.
        await studentApi.getSnapshot().catch((error) => {
          console.warn('[AIxuexi] 云端快照暂时不可用，将先清理本地数据。', error)
        })
        await delay(900)
        if (cancelled) return

        let cleanState = createCleanState(stateRef.current as unknown as CleanableState)
        importDataRef.current(JSON.stringify(cleanState))

        await studentApi.pushSnapshot(cleanState).catch((error) => {
          console.warn('[AIxuexi] 空白快照暂未同步到云端，本地清理已经完成。', error)
        })

        // A final guarded pass covers a slower AppStore hydration response.
        await delay(1800)
        if (cancelled) return

        const latest = stateRef.current as unknown as CleanableState
        if (hasStoredLearningData(latest)) {
          cleanState = createCleanState(latest)
          importDataRef.current(JSON.stringify(cleanState))
          await studentApi.pushSnapshot(cleanState).catch((error) => {
            console.warn('[AIxuexi] 二次同步空白快照失败。', error)
          })
        }

        localStorage.setItem(markerKey, new Date().toISOString())
      } catch (error) {
        console.error('[AIxuexi] 清理旧学习数据失败', error)
      } finally {
        if (!cancelled) setCleaning(false)
      }
    }

    void runCleanup()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (!cleaning) return null

  return (
    <div className="data-cleaning-overlay" role="status" aria-live="polite">
      <div className="data-cleaning-card">
        <div className="data-cleaning-card__icon" aria-hidden="true">✨</div>
        <strong>正在准备干净的学习空间</strong>
        <span>旧的示例记录正在清除，请不要关闭页面</span>
        <div className="data-cleaning-card__bar" aria-hidden="true"><i /></div>
      </div>
    </div>
  )
}
