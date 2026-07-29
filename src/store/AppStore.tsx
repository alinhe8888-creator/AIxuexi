import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createSeedState } from '../data/seed'
import { AppStoreContext, type AppStoreValue, type ToastMessage } from './AppStoreContext'
import type {
  AiExplanation,
  AppSettings,
  AppState,
  KnowledgePoint,
  LearningStrategyPreference,
  MistakeRecord,
  PaperRecord,
  StudentProfile,
} from '../types'
import { addDays, toDateKey } from '../utils/date'
import { useAuth } from '../auth/useAuth'
import { studentApi, type StudentCloudSnapshot } from '../services/studentApi'
import { clamp, getMasteryLevel, getRiskLevel, ratingMasteryDelta, reviewIntervalDays } from '../utils/learning'
import { clearWorkspaceData, getWorkspaceSnapshot, hydrateWorkspaceSnapshot, type WorkspaceSnapshot } from '../utils/familyLearningWorkspace'

const STORAGE_KEY_PREFIX = 'aixuexi:private-family:v6'
const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}:${userId}`

for (let index = localStorage.length - 1; index >= 0; index -= 1) {
  const key = localStorage.key(index)
  if (key?.startsWith('aixuexi:private-family:v3:') || key?.includes(':mock-user')) localStorage.removeItem(key)
}

const normalizeExplanation = (explanation?: Partial<AiExplanation>): AiExplanation | undefined => {
  if (!explanation) return undefined
  if (Array.isArray(explanation.methods) && explanation.methods.length && explanation.diagnosis) {
    return {
      ...explanation,
      answerRevealAfterAttempts: Math.max(2, explanation.answerRevealAfterAttempts || 2),
    } as AiExplanation
  }
  const steps = Array.isArray(explanation.steps) ? explanation.steps : []
  const finalAnswer = explanation.finalAnswer || ''
  return {
    knowledgePoints: Array.isArray(explanation.knowledgePoints) ? explanation.knowledgePoints : [],
    diagnosis: {
      likelyCause: '知识点不会',
      confidence: 0.45,
      evidence: '这是旧版讲解记录，需要通过新的订正作答继续确认卡点。',
      firstQuestion: explanation.thinking || '你认为这道题最先应该判断什么？',
    },
    recommendedMethodId: 'legacy-guided',
    methods: [{
      id: 'legacy-guided',
      name: '分步启发讲法',
      style: '步骤拆解',
      bestFor: '把旧讲解转入新的两轮订正流程',
      openingQuestion: explanation.thinking || '先说说你卡在哪一步。',
      hints: ['圈出已知条件和所求对象', '写出最直接相关的概念或公式'],
      steps,
      checkpointQuestion: explanation.instantCheck?.question || '请用自己的话复述关键步骤。',
      checkpointAnswer: explanation.instantCheck?.answer || finalAnswer,
      checkpointExplanation: explanation.instantCheck?.explanation || '',
      memoryTip: '先审题，再定位知识点，再分步作答，最后检查。',
    }],
    answerRevealAfterAttempts: 2,
    thinking: explanation.thinking || '',
    steps,
    finalAnswer,
    commonMistakes: Array.isArray(explanation.commonMistakes) ? explanation.commonMistakes : [],
    lifeExample: explanation.lifeExample || '',
    instantCheck: explanation.instantCheck || {
      question: '请完成一道同类迁移题。',
      answer: finalAnswer,
      explanation: '用于确认是否真正掌握方法。',
    },
  }
}

const normalizeState = (candidate?: Partial<AppState> | null): AppState => {
  const seed = createSeedState()
  if (!candidate?.profile || !Array.isArray(candidate.mistakes)) return seed
  return {
    ...seed,
    ...candidate,
    version: 6,
    profile: { ...seed.profile, ...candidate.profile },
    questions: Array.isArray(candidate.questions) ? candidate.questions.map((question) => ({ ...question, explanation: normalizeExplanation(question.explanation) })) : [],
    mistakes: candidate.mistakes.map((mistake) => ({
      ...mistake,
      correction: mistake.correction ?? {
        status: '待订正',
        triedMethodIds: [],
        attempts: [],
        finalAnswerRevealed: false,
        transferPassed: false,
      },
    })),
    papers: Array.isArray(candidate.papers) ? candidate.papers : [],
    knowledgePoints: Array.isArray(candidate.knowledgePoints) ? candidate.knowledgePoints : [],
    reviewTasks: Array.isArray(candidate.reviewTasks) ? candidate.reviewTasks : [],
    dailyPlans: Array.isArray(candidate.dailyPlans) ? candidate.dailyPlans : [],
    quizzes: Array.isArray(candidate.quizzes) ? candidate.quizzes : [],
    cards: Array.isArray(candidate.cards) ? candidate.cards : [],
    knowledgeItems: Array.isArray(candidate.knowledgeItems) ? candidate.knowledgeItems : [],
    activityLogs: Array.isArray(candidate.activityLogs) ? candidate.activityLogs : [],
    strategyPreferences: Array.isArray(candidate.strategyPreferences) ? candidate.strategyPreferences : [],
    settings: { ...seed.settings, ...(candidate.settings || {}), dataVersion: 6 },
  }
}

const applyAccountIdentity = (state: AppState, userId: string, displayName?: string): AppState => ({
  ...state,
  profile: {
    ...state.profile,
    id: userId,
    name: state.profile.name.trim() || displayName?.trim() || '',
  },
})

const loadState = (userId: string, displayName?: string): AppState => {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return applyAccountIdentity(createSeedState(), userId, displayName)
    return applyAccountIdentity(normalizeState(JSON.parse(raw) as Partial<AppState>), userId, displayName)
  } catch {
    return applyAccountIdentity(createSeedState(), userId, displayName)
  }
}

const persistState = (userId: string, state: AppState) => {
  const key = storageKey(userId)
  try {
    localStorage.setItem(key, JSON.stringify(state))
    return
  } catch (error) {
    console.warn('Local state exceeded browser storage; retrying without uploaded images.', error)
  }
  try {
    const compact: AppState = {
      ...state,
      questions: state.questions.map(({ imageDataUrl: _imageDataUrl, ...item }) => item),
      mistakes: state.mistakes.map(({ imageDataUrl: _imageDataUrl, ...item }) => item),
      papers: state.papers.map((paper) => ({ ...paper, imageDataUrls: [] })),
    }
    localStorage.setItem(key, JSON.stringify(compact))
    window.dispatchEvent(new CustomEvent('aixuexi:storage-compacted'))
  } catch (error) {
    console.error('Unable to persist local learning state.', error)
  }
}

type CloudSnapshot = AppState & { workspace?: WorkspaceSnapshot }

const cloudSnapshot = (state: AppState): CloudSnapshot => ({
  ...state,
  workspace: getWorkspaceSnapshot(),
})

const makeLog = (type: AppState['activityLogs'][number]['type'], title: string, description: string) => ({
  id: crypto.randomUUID(), type, title, description, createdAt: new Date().toISOString(),
})

const updateKnowledge = (
  points: KnowledgePoint[],
  input: { id: string; name: string; subject: KnowledgePoint['subject']; grade?: KnowledgePoint['grade']; chapter?: string; correct: boolean; cause?: KnowledgePoint['mainCause']; delta?: number },
): KnowledgePoint[] => {
  const existing = points.find((item) => item.id === input.id)
  const now = new Date().toISOString()
  const delta = input.delta ?? (input.correct ? 8 : -12)
  if (!existing) {
    const mastery = clamp(input.correct ? 62 : 35)
    return [
      ...points,
      {
        id: input.id,
        subject: input.subject,
        grade: input.grade || '',
        chapter: input.chapter || '待分类章节',
        name: input.name,
        mastery,
        accuracy: input.correct ? 100 : 0,
        errorCount: input.correct ? 0 : 1,
        reviewCount: 1,
        mainCause: input.cause,
        lastReviewedAt: now,
        nextReviewAt: addDays(now, input.correct ? 3 : 1),
        forgettingRisk: input.correct ? '低' : '高',
        trend: [mastery],
      },
    ]
  }
  const mastery = clamp(existing.mastery + delta)
  const reviewCount = existing.reviewCount + 1
  const accuracy = Math.round(((existing.accuracy * existing.reviewCount) + (input.correct ? 100 : 0)) / reviewCount)
  return points.map((item) => item.id === input.id ? {
    ...item,
    mastery,
    accuracy,
    errorCount: item.errorCount + (input.correct ? 0 : 1),
    reviewCount,
    mainCause: input.correct ? item.mainCause : input.cause ?? item.mainCause,
    lastReviewedAt: now,
    nextReviewAt: addDays(now, input.correct ? 3 : 1),
    forgettingRisk: getRiskLevel(mastery, 0, item.errorCount + (input.correct ? 0 : 1)),
    trend: [...item.trend.slice(-7), mastery],
  } : item)
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const userRole = user?.role
  const [state, setState] = useState<AppState>(() => createSeedState())
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [cloudReady, setCloudReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<AppStoreValue['syncStatus']>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [syncError, setSyncError] = useState('')
  const skipNextCloudPush = useRef(true)
  const hydratedUser = useRef<string | undefined>(undefined)
  const stateRef = useRef(state)
  const snapshotQueue = useRef<Promise<void>>(Promise.resolve())

  const pushSnapshotQueued = useCallback((snapshot: StudentCloudSnapshot, accountId: string) => {
    const request = snapshotQueue.current
      .catch(() => undefined)
      .then(async () => {
        if (hydratedUser.current !== accountId) throw new Error('SYNC_ACCOUNT_CHANGED')
        return studentApi.pushSnapshot(snapshot)
      })
    snapshotQueue.current = request.then(() => undefined, () => undefined)
    return request
  }, [])

  useEffect(() => {
    stateRef.current = state
    document.documentElement.dataset.theme = state.settings.theme
    if (userId && userRole === 'student' && hydratedUser.current === userId) persistState(userId, state)
  }, [state, userId, userRole])

  useEffect(() => {
    if (!userId || userRole !== 'student') {
      hydratedUser.current = undefined
      stateRef.current = createSeedState()
      setState(stateRef.current)
      setCloudReady(false)
      setSyncStatus('idle')
      setLastSyncedAt(null)
      setSyncError('')
      return
    }
    const localState = loadState(userId, user?.displayName)
    hydratedUser.current = userId
    stateRef.current = localState
    setState(localState)
  }, [userId, userRole, user?.displayName])

  useEffect(() => {
    let cancelled = false
    if (!userId || userRole !== 'student' || hydratedUser.current !== userId) {
      setCloudReady(false)
      return () => { cancelled = true }
    }
    setCloudReady(false)
    setSyncStatus('loading')
    setSyncError('')
    skipNextCloudPush.current = true
    studentApi.getSnapshot()
      .then(async ({ snapshot, updatedAt }) => {
        if (cancelled) return
        const remote = snapshot as (Partial<CloudSnapshot> | null)
        let syncedAt = updatedAt
        if (remote?.profile && Array.isArray(remote.mistakes)) {
          hydrateWorkspaceSnapshot(remote.workspace, false)
          const next = applyAccountIdentity(normalizeState(remote), userId, user?.displayName)
          stateRef.current = next
          setState(next)
        } else {
          clearWorkspaceData(false)
          const result = await pushSnapshotQueued(cloudSnapshot(stateRef.current), userId)
          syncedAt = result.updatedAt
          skipNextCloudPush.current = false
        }
        if (cancelled) return
        setLastSyncedAt(syncedAt || new Date().toISOString())
        setSyncStatus('synced')
        setCloudReady(true)
      })
      .catch((error) => {
        console.warn('Cloud snapshot load failed.', error)
        if (!cancelled) {
          setCloudReady(false)
          setSyncStatus('error')
          setSyncError(error instanceof Error ? error.message : '学习数据同步失败')
        }
      })
    return () => { cancelled = true }
  }, [userId, userRole, user?.displayName, pushSnapshotQueued])

  useEffect(() => {
    if (!cloudReady || !userId || userRole !== 'student' || hydratedUser.current !== userId) return
    if (skipNextCloudPush.current) {
      skipNextCloudPush.current = false
      return
    }
    const timer = window.setTimeout(() => {
      setSyncStatus('loading')
      setSyncError('')
      pushSnapshotQueued(cloudSnapshot(state), userId)
        .then((result) => {
          if (hydratedUser.current !== userId) return
          setLastSyncedAt(result.updatedAt)
          setSyncStatus('synced')
        })
        .catch((error) => {
          if (hydratedUser.current !== userId || (error instanceof Error && error.message === 'SYNC_ACCOUNT_CHANGED')) return
          console.warn('Cloud snapshot sync failed.', error)
          setSyncStatus('error')
          setSyncError(error instanceof Error ? error.message : '学习数据同步失败')
        })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [state, cloudReady, userId, userRole, pushSnapshotQueued])

  useEffect(() => {
    if (!cloudReady || !userId || userRole !== 'student') return
    const syncWorkspace = () => {
      setSyncStatus('loading')
      setSyncError('')
      pushSnapshotQueued(cloudSnapshot(stateRef.current), userId)
        .then((result) => {
          if (hydratedUser.current !== userId) return
          setLastSyncedAt(result.updatedAt)
          setSyncStatus('synced')
        })
        .catch((error) => {
          if (hydratedUser.current !== userId || (error instanceof Error && error.message === 'SYNC_ACCOUNT_CHANGED')) return
          console.warn('Workspace sync failed.', error)
          setSyncStatus('error')
          setSyncError(error instanceof Error ? error.message : '学习数据同步失败')
        })
    }
    window.addEventListener('aixuexi:workspace-changed', syncWorkspace)
    return () => window.removeEventListener('aixuexi:workspace-changed', syncWorkspace)
  }, [cloudReady, userId, userRole, pushSnapshotQueued])

  const syncNow = useCallback(async () => {
    if (!userId || userRole !== 'student') throw new Error('请先登录学生账号')
    setSyncStatus('loading')
    setSyncError('')
    try {
      const result = await pushSnapshotQueued(cloudSnapshot(stateRef.current), userId)
      if (hydratedUser.current !== userId) return
      setLastSyncedAt(result.updatedAt)
      setSyncStatus('synced')
      setCloudReady(true)
    } catch (error) {
      if (hydratedUser.current !== userId || (error instanceof Error && error.message === 'SYNC_ACCOUNT_CHANGED')) return
      const message = error instanceof Error ? error.message : '学习数据同步失败'
      setSyncStatus('error')
      setSyncError(message)
      throw error
    }
  }, [userId, userRole, pushSnapshotQueued])

  const notify: AppStoreValue['notify'] = (type, title, message) => {
    const id = crypto.randomUUID()
    setToasts((items) => [...items, { id, type, title, message }])
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3200)
  }

  const dismissToast = (id: string) => setToasts((items) => items.filter((item) => item.id !== id))

  const updateProfile = (profile: Partial<StudentProfile>) => {
    setState((current) => ({ ...current, profile: { ...current.profile, ...profile, updatedAt: new Date().toISOString() } }))
    notify('success', '学生档案已保存')
  }

  const updateSettings = (settings: Partial<AppSettings>) => {
    setState((current) => ({ ...current, settings: { ...current.settings, ...settings } }))
    notify('success', '设置已更新')
  }

  const saveMistake: AppStoreValue['saveMistake'] = ({ question, studentAnswer, primaryCause, secondaryCause, note }) => {
    const now = new Date().toISOString()
    const existingBefore = stateRef.current.mistakes.find((item) => (
      item.questionId === question.id
      || (
        !item.archived
        && item.subject === question.subject
        && item.knowledgePointId === question.knowledgePointId
        && item.originalQuestion.trim() === question.content.trim()
      )
    ))
    const actualId = existingBefore?.id ?? crypto.randomUUID()

    setState((current) => {
      const existing = current.mistakes.find((item) => item.id === actualId)
      const questions = current.questions.some((item) => item.id === question.id)
        ? current.questions.map((item) => item.id === question.id ? { ...item, ...question } : item)
        : [question, ...current.questions]
      const sameSubmission = Boolean(existing && existing.questionId === question.id && !(existing.correction?.attempts.length))
      const mastery = existing ? clamp(existing.mastery - (sameSubmission ? 0 : 5)) : 35
      const correction = existing?.correction ?? {
        status: '待订正' as const,
        triedMethodIds: [],
        attempts: [],
        finalAnswerRevealed: false,
        transferPassed: false,
      }
      const mistake: MistakeRecord = existing ? {
        ...existing,
        questionId: question.id,
        studentAnswer,
        correctAnswer: question.correctAnswer || existing.correctAnswer,
        primaryCause,
        secondaryCause,
        note,
        wrongAt: now,
        wrongCount: existing.wrongCount + (sameSubmission ? 0 : 1),
        mastery,
        masteryLevel: getMasteryLevel(mastery),
        nextReviewAt: addDays(now, 1),
        correction: {
          ...correction,
          status: correction.status === '已验证' ? '待订正' : correction.status,
          transferPassed: correction.status === '已验证' ? false : correction.transferPassed,
        },
      } : {
        id: actualId,
        questionId: question.id,
        subject: question.subject,
        chapter: question.chapter,
        knowledgePointId: question.knowledgePointId,
        knowledgePointName: question.knowledgePointName,
        originalQuestion: question.content,
        imageDataUrl: question.imageDataUrl,
        imageKey: question.imageKey,
        studentAnswer,
        correctAnswer: question.correctAnswer,
        wrongAt: now,
        wrongCount: 1,
        primaryCause,
        secondaryCause,
        mastery,
        masteryLevel: getMasteryLevel(mastery),
        nextReviewAt: addDays(now, 1),
        note,
        sourceType: question.sourceType,
        correction,
      }
      const mistakes = existing
        ? current.mistakes.map((item) => item.id === actualId ? mistake : item)
        : [mistake, ...current.mistakes]
      const reviewExists = current.reviewTasks.some((task) => task.sourceId === actualId && task.status === 'pending')
      return {
        ...current,
        questions,
        mistakes,
        knowledgePoints: updateKnowledge(current.knowledgePoints, { id: question.knowledgePointId, name: question.knowledgePointName, subject: question.subject, grade: current.profile.grade, chapter: question.chapter, correct: false, cause: primaryCause }),
        reviewTasks: reviewExists ? current.reviewTasks : [{ id: crypto.randomUUID(), sourceId: actualId, sourceKind: 'mistake', subject: question.subject, title: `订正：${question.knowledgePointName}`, knowledgePointId: question.knowledgePointId, scheduledDate: toDateKey(now), status: 'pending', priority: 3, createdAt: now }, ...current.reviewTasks],
        activityLogs: [makeLog('mistake', `新增${question.subject}错题`, `${question.knowledgePointName}已进入两轮订正流程`), ...current.activityLogs].slice(0, 60),
      }
    })
    notify('success', '已先放入错题本', '不会直接显示答案；完成两轮订正和迁移检测后再更新掌握度。')
    return actualId
  }

  const updateMistakeDetails: AppStoreValue['updateMistakeDetails'] = (id, patch) => {
    setState((current) => ({
      ...current,
      mistakes: current.mistakes.map((item) => item.id === id ? { ...item, ...patch } : item),
    }))
  }

  const setCorrectionMethod: AppStoreValue['setCorrectionMethod'] = (id, methodId) => {
    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      mistakes: current.mistakes.map((item) => item.id === id ? {
        ...item,
        correction: {
          status: item.correction?.status === '已验证' ? '已验证' : '订正中',
          currentMethodId: methodId,
          triedMethodIds: [...new Set([...(item.correction?.triedMethodIds || []), methodId])],
          preferredMethodId: item.correction?.preferredMethodId,
          preferredStyle: item.correction?.preferredStyle,
          attempts: item.correction?.attempts || [],
          finalAnswerRevealed: item.correction?.finalAnswerRevealed || false,
          transferPassed: item.correction?.transferPassed || false,
          selfExplanation: item.correction?.selfExplanation,
          startedAt: item.correction?.startedAt || now,
          verifiedAt: item.correction?.verifiedAt,
        },
      } : item),
    }))
  }

  const recordCorrectionAttempt: AppStoreValue['recordCorrectionAttempt'] = (id, attempt) => {
    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      mistakes: current.mistakes.map((item) => item.id === id ? {
        ...item,
        primaryCause: attempt.errorCause,
        studentAnswer: attempt.answer,
        correction: {
          status: attempt.correct ? '待验证' : '订正中',
          currentMethodId: attempt.methodId,
          triedMethodIds: [...new Set([...(item.correction?.triedMethodIds || []), attempt.methodId])],
          preferredMethodId: item.correction?.preferredMethodId,
          preferredStyle: item.correction?.preferredStyle,
          attempts: [...(item.correction?.attempts || []), { ...attempt, id: crypto.randomUUID(), createdAt: now }].slice(-12),
          finalAnswerRevealed: item.correction?.finalAnswerRevealed || false,
          transferPassed: item.correction?.transferPassed || false,
          selfExplanation: item.correction?.selfExplanation,
          startedAt: item.correction?.startedAt || now,
          verifiedAt: item.correction?.verifiedAt,
        },
      } : item),
      activityLogs: [makeLog('review', `完成第 ${attempt.attemptNumber} 次订正`, attempt.correct ? '已答对，进入迁移检测' : '系统将切换讲解方法继续引导'), ...current.activityLogs].slice(0, 60),
    }))
  }

  const completeCorrection: AppStoreValue['completeCorrection'] = (id, input) => {
    const now = new Date().toISOString()
    setState((current) => {
      const mistake = current.mistakes.find((item) => item.id === id)
      if (!mistake) return current
      const attempts = mistake.correction?.attempts || []
      const latestScore = input.transferScore ?? attempts.at(-1)?.score ?? 0
      const mastery = clamp(mistake.mastery + (input.transferPassed ? 18 : 0))
      const existingPreference = current.strategyPreferences.find((item) => item.style === input.style && item.subject === mistake.subject)
      const preference: LearningStrategyPreference = existingPreference ? {
        ...existingPreference,
        methodName: input.methodName,
        usedCount: existingPreference.usedCount + 1,
        successCount: existingPreference.successCount + (input.transferPassed ? 1 : 0),
        totalScore: existingPreference.totalScore + latestScore,
        lastUsedAt: now,
      } : {
        style: input.style,
        methodName: input.methodName,
        subject: mistake.subject,
        usedCount: 1,
        successCount: input.transferPassed ? 1 : 0,
        totalScore: latestScore,
        lastUsedAt: now,
      }
      const strategyPreferences = current.settings.saveEffectiveMethods === false || !input.transferPassed
        ? current.strategyPreferences
        : existingPreference
          ? current.strategyPreferences.map((item) => item === existingPreference ? preference : item)
          : [preference, ...current.strategyPreferences]
      return {
        ...current,
        strategyPreferences,
        mistakes: current.mistakes.map((item) => item.id === id ? {
          ...item,
          mastery,
          masteryLevel: getMasteryLevel(mastery),
          lastReviewedAt: now,
          nextReviewAt: addDays(now, input.transferPassed ? 3 : 1),
          correction: {
            status: input.transferPassed ? '已验证' : '待验证',
            currentMethodId: input.methodId,
            triedMethodIds: [...new Set([...(item.correction?.triedMethodIds || []), input.methodId])],
            preferredMethodId: input.methodId,
            preferredStyle: input.style,
            attempts: item.correction?.attempts || [],
            finalAnswerRevealed: input.finalAnswerRevealed ?? item.correction?.finalAnswerRevealed ?? false,
            transferPassed: input.transferPassed,
            selfExplanation: input.selfExplanation,
            startedAt: item.correction?.startedAt || now,
            verifiedAt: input.transferPassed ? now : undefined,
          },
        } : item),
        knowledgePoints: updateKnowledge(current.knowledgePoints, {
          id: mistake.knowledgePointId,
          name: mistake.knowledgePointName,
          subject: mistake.subject,
          grade: current.profile.grade,
          chapter: mistake.chapter,
          correct: input.transferPassed,
          cause: mistake.primaryCause,
          delta: input.transferPassed ? 12 : -2,
        }),
        reviewTasks: current.reviewTasks.map((task) => task.sourceId === id && task.status === 'pending'
          ? { ...task, status: input.transferPassed ? 'completed' as const : task.status, completedAt: input.transferPassed ? now : task.completedAt }
          : task),
        activityLogs: [makeLog('review', input.transferPassed ? `订正验证通过：${mistake.knowledgePointName}` : `订正待再次验证：${mistake.knowledgePointName}`, `最有效讲法：${input.methodName}`), ...current.activityLogs].slice(0, 60),
      }
    })
    notify(input.transferPassed ? 'success' : 'info', input.transferPassed ? '订正闭环完成' : '已保存本次讲解方法', input.transferPassed ? '最有效讲法已进入学习画像，3 天后安排巩固。' : '系统会继续安排一道迁移题。')
  }

  const removeMistake = (id: string) => {
    setState((current) => ({ ...current, mistakes: current.mistakes.filter((item) => item.id !== id), reviewTasks: current.reviewTasks.filter((item) => item.sourceId !== id) }))
    notify('info', '错题已删除')
  }

  const archiveMistake = (id: string) => {
    const mistake = stateRef.current.mistakes.find((item) => item.id === id)
    if (stateRef.current.settings.strictCorrectionMode !== false && !mistake?.correction?.transferPassed) {
      notify('info', '还不能标记掌握', '先完成多轮订正和迁移检测，避免只是看懂答案。')
      return
    }
    setState((current) => ({ ...current, mistakes: current.mistakes.map((item) => item.id === id ? { ...item, archived: true, mastery: 100, masteryLevel: '熟练' } : item) }))
    notify('success', '已标记为掌握')
  }

  const reviewMistake: AppStoreValue['reviewMistake'] = (id, rating) => {
    const now = new Date().toISOString()
    setState((current) => {
      const mistake = current.mistakes.find((item) => item.id === id)
      if (!mistake) return current
      const delta = ratingMasteryDelta(rating)
      const mastery = clamp(mistake.mastery + delta)
      const interval = reviewIntervalDays(rating, Math.floor(mastery / 25))
      const nextReviewAt = addDays(now, interval)
      const task = { id: crypto.randomUUID(), sourceId: id, sourceKind: 'mistake' as const, subject: mistake.subject, title: `复习：${mistake.knowledgePointName}`, knowledgePointId: mistake.knowledgePointId, scheduledDate: toDateKey(nextReviewAt), status: 'pending' as const, priority: rating === 'again' ? 3 as const : 2 as const, createdAt: now }
      return {
        ...current,
        mistakes: current.mistakes.map((item) => item.id === id ? { ...item, mastery, masteryLevel: getMasteryLevel(mastery), lastReviewedAt: now, nextReviewAt, wrongCount: item.wrongCount + (rating === 'again' ? 1 : 0) } : item),
        reviewTasks: [task, ...current.reviewTasks.map((item) => item.sourceId === id && item.status === 'pending' ? { ...item, status: 'completed' as const, completedAt: now } : item)],
        knowledgePoints: updateKnowledge(current.knowledgePoints, { id: mistake.knowledgePointId, name: mistake.knowledgePointName, subject: mistake.subject, grade: current.profile.grade, chapter: mistake.chapter, correct: rating === 'good' || rating === 'easy', cause: mistake.primaryCause, delta }),
        activityLogs: [makeLog('review', `复习${mistake.knowledgePointName}`, `掌握度更新为 ${mastery}%`), ...current.activityLogs].slice(0, 60),
      }
    })
    notify('success', '复习结果已记录', '下次复习日期已自动调整。')
  }

  const reviewCard: AppStoreValue['reviewCard'] = (id, rating) => {
    const now = new Date().toISOString()
    setState((current) => {
      const card = current.cards.find((item) => item.id === id)
      if (!card) return current
      const correct = rating === 'good' || rating === 'easy'
      const streak = correct ? card.correctStreak + 1 : 0
      const interval = reviewIntervalDays(rating, streak)
      const familiarity = clamp(card.familiarity + (rating === 'again' ? -1 : rating === 'hard' ? 0 : rating === 'good' ? 1 : 2), 0, 5) as 0 | 1 | 2 | 3 | 4 | 5
      return {
        ...current,
        cards: current.cards.map((item) => item.id === id ? { ...item, familiarity, reviewCount: item.reviewCount + 1, correctStreak: streak, lastReviewedAt: now, nextReviewAt: addDays(now, interval) } : item),
        reviewTasks: current.reviewTasks.map((task) => task.sourceId === id && task.status === 'pending' ? { ...task, status: 'completed' as const, completedAt: now } : task),
        activityLogs: [makeLog('card', `复习卡片：${card.front}`, `熟悉度 ${familiarity}/5，下次 ${interval} 天后复习`), ...current.activityLogs].slice(0, 60),
      }
    })
  }

  const toggleTask = (planId: string, taskId: string) => {
    setState((current) => ({
      ...current,
      dailyPlans: current.dailyPlans.map((plan) => plan.id === planId ? { ...plan, tasks: plan.tasks.map((task) => task.id === taskId ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' } : task) } : plan),
    }))
  }

  const addDailyTask: AppStoreValue['addDailyTask'] = (task) => {
    const today = toDateKey()
    setState((current) => {
      const existing = current.dailyPlans.find((plan) => plan.date === today)
      const newTask = { ...task, id: crypto.randomUUID(), status: 'pending' as const }
      return {
        ...current,
        dailyPlans: existing ? current.dailyPlans.map((plan) => plan.date === today ? { ...plan, tasks: [...plan.tasks, newTask] } : plan) : [{ id: `plan-${today}`, date: today, generatedAt: new Date().toISOString(), tasks: [newTask] }, ...current.dailyPlans],
      }
    })
    notify('success', '任务已加入今日计划')
  }

  const completeQuiz: AppStoreValue['completeQuiz'] = (quizId, answers) => {
    const quiz = state.quizzes.find((item) => item.id === quizId)
    if (!quiz) return { correct: 0, total: 0, correctRate: 0, wrongQuestions: [] }
    const completed = quiz.questions.map((item) => ({ ...item, userAnswer: answers[item.id] || '' }))
    const wrongQuestions = completed.filter((item) => item.userAnswer.trim() !== item.correctAnswer.trim())
    const correct = completed.length - wrongQuestions.length
    const correctRate = completed.length ? Math.round((correct / completed.length) * 100) : 0
    const now = new Date().toISOString()

    setState((current) => {
      let knowledge = current.knowledgePoints
      let mistakes = [...current.mistakes]
      let questions = [...current.questions]
      let reviews = [...current.reviewTasks]
      completed.forEach((item) => {
        const isCorrect = item.userAnswer.trim() === item.correctAnswer.trim()
        knowledge = updateKnowledge(knowledge, { id: item.knowledgePointId, name: item.knowledgePointName, subject: item.subject, grade: current.profile.grade, correct: isCorrect, cause: isCorrect ? undefined : '知识点不会' })
        if (!isCorrect && current.settings.autoAddMistakes) {
          const questionId = `quiz-question-${item.id}`
          const existingMistake = mistakes.find((mistake) => mistake.questionId === questionId && !mistake.archived)
          if (existingMistake) {
            mistakes = mistakes.map((mistake) => mistake.id === existingMistake.id ? { ...mistake, wrongCount: mistake.wrongCount + 1, wrongAt: now, studentAnswer: item.userAnswer || '', nextReviewAt: addDays(now, 1), mastery: clamp(mistake.mastery - 8), masteryLevel: getMasteryLevel(clamp(mistake.mastery - 8)) } : mistake)
          } else {
            const mistakeId = crypto.randomUUID()
            questions.unshift({ id: questionId, subject: item.subject, chapter: '每日小测', knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, content: item.content, studentAnswer: item.userAnswer, correctAnswer: item.correctAnswer, questionFormat: item.format, sourceType: item.sourceType, createdAt: now })
            mistakes.unshift({ id: mistakeId, questionId, subject: item.subject, chapter: '每日小测', knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, originalQuestion: item.content, studentAnswer: item.userAnswer || '', correctAnswer: item.correctAnswer, wrongAt: now, wrongCount: 1, primaryCause: '知识点不会', mastery: 35, masteryLevel: '薄弱', nextReviewAt: addDays(now, 1), sourceType: item.sourceType, correction: { status: '待订正', triedMethodIds: [], attempts: [], finalAnswerRevealed: false, transferPassed: false } })
            reviews.unshift({ id: crypto.randomUUID(), sourceId: mistakeId, sourceKind: 'mistake', subject: item.subject, title: `复习：${item.knowledgePointName}`, knowledgePointId: item.knowledgePointId, scheduledDate: toDateKey(addDays(now, 1)), status: 'pending', priority: 3, createdAt: now })
          }
        }
      })
      const tomorrow = toDateKey(addDays(now, 1))
      const tomorrowPlan = current.dailyPlans.find((plan) => plan.date === tomorrow)
      const weakTasks = wrongQuestions.slice(0, 3).map((item) => ({ id: crypto.randomUUID(), title: `加强：${item.knowledgePointName}`, description: '复习今日错题并完成 1 道同类题', subject: item.subject, type: 'review' as const, estimatedMinutes: 15, status: 'pending' as const, linkedId: item.knowledgePointId }))
      const dailyPlans = tomorrowPlan
        ? current.dailyPlans.map((plan) => plan.date === tomorrow ? { ...plan, tasks: [...plan.tasks, ...weakTasks.filter((task) => !plan.tasks.some((old) => old.linkedId === task.linkedId))] } : plan)
        : [{ id: `plan-${tomorrow}`, date: tomorrow, generatedAt: now, tasks: weakTasks }, ...current.dailyPlans]
      return {
        ...current,
        questions,
        mistakes,
        knowledgePoints: knowledge,
        reviewTasks: reviews,
        dailyPlans: dailyPlans.map((plan) => plan.date === quiz.date ? { ...plan, tasks: plan.tasks.map((task) => task.type === 'quiz' ? { ...task, status: 'completed' as const } : task) } : plan),
        quizzes: current.quizzes.map((item) => item.id === quizId ? { ...item, questions: completed, score: correct, correctRate, completedAt: now, status: 'completed' as const, weakPoints: [...new Set(wrongQuestions.map((question) => question.knowledgePointName))] } : item),
        activityLogs: [makeLog('quiz', `完成${quiz.title}`, `正确率 ${correctRate}%，${wrongQuestions.length} 道题需要加强`), ...current.activityLogs].slice(0, 60),
      }
    })
    notify(correctRate >= 80 ? 'success' : 'info', '每日小测已完成', `正确率 ${correctRate}%，结果已同步到学习画像和明日计划。`)
    return { correct, total: completed.length, correctRate, wrongQuestions }
  }

  const addPaper = (paper: PaperRecord) => {
    setState((current) => {
      let knowledge = current.knowledgePoints
      let mistakes = [...current.mistakes]
      let questions = [...current.questions]
      let reviews = [...current.reviewTasks]
      paper.questions.forEach((item) => {
        const correct = item.isCorrect
        knowledge = updateKnowledge(knowledge, { id: item.knowledgePointId, name: item.knowledgePointName, subject: item.subject, grade: current.profile.grade, chapter: paper.title, correct, cause: item.errorCause })
        if (!correct) {
          const questionId = `paper-${paper.id}-${item.id}`
          const mistakeId = crypto.randomUUID()
          questions.unshift({ id: questionId, subject: item.subject, chapter: paper.title, knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, content: item.content, studentAnswer: item.studentAnswer, correctAnswer: item.correctAnswer, questionFormat: item.fullScore > 5 ? '解答题' : '选择题', sourceType: 'user_upload', createdAt: paper.createdAt })
          mistakes.unshift({ id: mistakeId, questionId, subject: item.subject, chapter: paper.title, knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, originalQuestion: item.content, studentAnswer: item.studentAnswer, correctAnswer: item.correctAnswer, wrongAt: paper.date, wrongCount: 1, primaryCause: item.errorCause || '知识点不会', mastery: 35, masteryLevel: '薄弱', nextReviewAt: addDays(paper.createdAt, 1), sourceType: 'user_upload', correction: { status: '待订正', triedMethodIds: [], attempts: [], finalAnswerRevealed: false, transferPassed: false } })
          reviews.unshift({ id: crypto.randomUUID(), sourceId: mistakeId, sourceKind: 'mistake', subject: item.subject, title: `试卷订正：${item.knowledgePointName}`, knowledgePointId: item.knowledgePointId, scheduledDate: toDateKey(addDays(paper.createdAt, 1)), status: 'pending', priority: 3, createdAt: paper.createdAt })
        }
      })
      return { ...current, papers: [paper, ...current.papers], questions, mistakes, knowledgePoints: knowledge, reviewTasks: reviews, activityLogs: [makeLog('paper', `完成试卷分析：${paper.title}`, `得分率 ${paper.summary.scoreRate}%，错题已进入错题本`), ...current.activityLogs].slice(0, 60) }
    })
    notify('success', '试卷分析已保存', '错题、薄弱知识点和复习计划已联动更新。')
  }

  const applySimulation: AppStoreValue['applySimulation'] = (title, items) => {
    const correct = items.filter((item) => item.isCorrect).length
    const total = items.length
    const correctRate = total ? Math.round((correct / total) * 100) : 0
    const wrongQuestions = items.filter((item) => !item.isCorrect).map((item) => ({ ...item.question, userAnswer: item.userAnswer }))
    const now = new Date().toISOString()
    setState((current) => {
      let knowledge = current.knowledgePoints
      let mistakes = [...current.mistakes]
      let questions = [...current.questions]
      let reviews = [...current.reviewTasks]
      items.forEach((item) => {
        knowledge = updateKnowledge(knowledge, { id: item.question.knowledgePointId, name: item.question.knowledgePointName, subject: item.question.subject, grade: current.profile.grade, correct: item.isCorrect, cause: item.cause })
        if (!item.isCorrect) {
          const questionId = `simulation-${item.question.id}`
          const mistakeId = crypto.randomUUID()
          questions.unshift({ id: questionId, subject: item.question.subject, chapter: '模拟训练', knowledgePointId: item.question.knowledgePointId, knowledgePointName: item.question.knowledgePointName, content: item.question.content, studentAnswer: item.userAnswer, correctAnswer: item.question.correctAnswer, questionFormat: item.question.format, sourceType: 'ai_generated', createdAt: now })
          mistakes.unshift({ id: mistakeId, questionId, subject: item.question.subject, chapter: '模拟训练', knowledgePointId: item.question.knowledgePointId, knowledgePointName: item.question.knowledgePointName, originalQuestion: item.question.content, studentAnswer: item.userAnswer, correctAnswer: item.question.correctAnswer, wrongAt: now, wrongCount: 1, primaryCause: item.cause || '知识点不会', mastery: 35, masteryLevel: '薄弱', nextReviewAt: addDays(now, 1), sourceType: 'ai_generated', correction: { status: '待订正', triedMethodIds: [], attempts: [], finalAnswerRevealed: false, transferPassed: false } })
          reviews.unshift({ id: crypto.randomUUID(), sourceId: mistakeId, sourceKind: 'mistake', subject: item.question.subject, title: `模拟训练订正：${item.question.knowledgePointName}`, knowledgePointId: item.question.knowledgePointId, scheduledDate: toDateKey(addDays(now, 1)), status: 'pending', priority: 3, createdAt: now })
        }
      })
      return { ...current, questions, mistakes, knowledgePoints: knowledge, reviewTasks: reviews, activityLogs: [makeLog('quiz', title, `正确率 ${correctRate}%，已同步学习画像`), ...current.activityLogs].slice(0, 60) }
    })
    notify(correctRate >= 80 ? 'success' : 'info', '模拟训练已完成', `正确率 ${correctRate}%，错题已自动整理。`)
    return { correct, total, correctRate, wrongQuestions }
  }

  const exportData = () => JSON.stringify({ exportedAt: new Date().toISOString(), app: 'AI 高中学习助手', data: state }, null, 2)

  const importData = (json: string) => {
    try {
      const parsed = JSON.parse(json)
      const data = (parsed.data ?? parsed) as AppState
      if (!data.profile || !Array.isArray(data.mistakes) || !Array.isArray(data.knowledgePoints)) throw new Error('数据结构无效')
      const normalized = normalizeState(data)
      setState(userId ? applyAccountIdentity(normalized, userId, user?.displayName) : normalized)
      notify('success', '数据导入成功')
    } catch (error) {
      notify('error', '数据导入失败', error instanceof Error ? error.message : '无法解析文件')
      throw error
    }
  }

  const resetData = () => {
    clearWorkspaceData(false)
    const emptyState = createSeedState()
    setState(userId ? applyAccountIdentity(emptyState, userId, user?.displayName) : emptyState)
    notify('success', '本机学习数据已清空')
  }

  const value: AppStoreValue = {
    state, toasts, syncStatus, lastSyncedAt, syncError, syncNow, updateProfile, updateSettings, saveMistake, updateMistakeDetails, setCorrectionMethod, recordCorrectionAttempt, completeCorrection, removeMistake, archiveMistake, reviewMistake, reviewCard, toggleTask, addDailyTask, completeQuiz, addPaper, applySimulation, exportData, importData, resetData, notify, dismissToast,
  }

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}
