import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createSeedState } from '../data/seed'
import { AppStoreContext, type AppStoreValue, type ToastMessage } from './AppStoreContext'
import type {
  AppSettings,
  AppState,
  KnowledgePoint,
  PaperRecord,
  StudentProfile,
} from '../types'
import { addDays, toDateKey } from '../utils/date'
import { useAuth } from '../auth/useAuth'
import { studentApi } from '../services/studentApi'
import { clamp, getMasteryLevel, getRiskLevel, ratingMasteryDelta, reviewIntervalDays } from '../utils/learning'

const STORAGE_KEY_PREFIX = 'ai-high-school-assistant:v2'
const storageKey = (userId?: string) => `${STORAGE_KEY_PREFIX}:${userId || 'anonymous'}`

const loadState = (userId?: string): AppState => {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return createSeedState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.version || !parsed.profile || !Array.isArray(parsed.mistakes)) return createSeedState()
    return parsed
  } catch {
    return createSeedState()
  }
}

const persistState = (userId: string | undefined, state: AppState) => {
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

const makeLog = (type: AppState['activityLogs'][number]['type'], title: string, description: string) => ({
  id: crypto.randomUUID(), type, title, description, createdAt: new Date().toISOString(),
})

const updateKnowledge = (
  points: KnowledgePoint[],
  input: { id: string; name: string; subject: KnowledgePoint['subject']; chapter?: string; correct: boolean; cause?: KnowledgePoint['mainCause']; delta?: number },
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
        grade: '高二',
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
  const [state, setState] = useState<AppState>(() => loadState(userId))
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [cloudReady, setCloudReady] = useState(false)
  const skipNextCloudPush = useRef(true)
  const hydratedUser = useRef<string | undefined>(undefined)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
    persistState(userId, state)
    document.documentElement.dataset.theme = state.settings.theme
  }, [state, userId])

  useEffect(() => {
    if (!userId || userRole !== 'student' || hydratedUser.current === userId) return
    hydratedUser.current = userId
    stateRef.current = loadState(userId)
    setState(stateRef.current)
  }, [userId, userRole])

  useEffect(() => {
    let cancelled = false
    if (!userId || userRole !== 'student') {
      setCloudReady(false)
      return () => { cancelled = true }
    }
    setCloudReady(false)
    skipNextCloudPush.current = true
    studentApi.getSnapshot()
      .then(({ snapshot }) => {
        if (cancelled) return
        if (snapshot?.profile && Array.isArray(snapshot.mistakes)) setState(snapshot)
        else void studentApi.pushSnapshot(stateRef.current)
        setCloudReady(true)
      })
      .catch((error) => {
        console.warn('Cloud snapshot load failed; keeping local data.', error)
        if (!cancelled) setCloudReady(true)
      })
    return () => { cancelled = true }
  }, [userId, userRole])

  useEffect(() => {
    if (!cloudReady || !userId || userRole !== 'student') return
    if (skipNextCloudPush.current) {
      skipNextCloudPush.current = false
      return
    }
    const timer = window.setTimeout(() => {
      studentApi.pushSnapshot(state).catch((error) => console.warn('Cloud snapshot sync failed.', error))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [state, cloudReady, userId, userRole])

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
    const mistakeId = crypto.randomUUID()
    const now = new Date().toISOString()
    setState((current) => {
      const existing = current.mistakes.find((item) => item.questionId === question.id && !item.archived)
      const questions = current.questions.some((item) => item.id === question.id) ? current.questions : [question, ...current.questions]
      const mastery = existing ? clamp(existing.mastery - 8) : 35
      const mistake = existing ? {
        ...existing,
        studentAnswer,
        primaryCause,
        secondaryCause,
        note,
        wrongAt: now,
        wrongCount: existing.wrongCount + 1,
        mastery,
        masteryLevel: getMasteryLevel(mastery),
        nextReviewAt: addDays(now, 1),
      } : {
        id: mistakeId,
        questionId: question.id,
        subject: question.subject,
        chapter: question.chapter,
        knowledgePointId: question.knowledgePointId,
        knowledgePointName: question.knowledgePointName,
        originalQuestion: question.content,
        imageDataUrl: question.imageDataUrl,
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
      }
      const mistakes = existing ? current.mistakes.map((item) => item.id === existing.id ? mistake : item) : [mistake, ...current.mistakes]
      const actualId = existing?.id ?? mistakeId
      const reviewExists = current.reviewTasks.some((task) => task.sourceId === actualId && task.status === 'pending')
      return {
        ...current,
        questions,
        mistakes,
        knowledgePoints: updateKnowledge(current.knowledgePoints, { id: question.knowledgePointId, name: question.knowledgePointName, subject: question.subject, chapter: question.chapter, correct: false, cause: primaryCause }),
        reviewTasks: reviewExists ? current.reviewTasks : [{ id: crypto.randomUUID(), sourceId: actualId, sourceKind: 'mistake', subject: question.subject, title: `复习：${question.knowledgePointName}`, knowledgePointId: question.knowledgePointId, scheduledDate: toDateKey(addDays(now, 1)), status: 'pending', priority: 3, createdAt: now }, ...current.reviewTasks],
        activityLogs: [makeLog('mistake', `新增${question.subject}错题`, `${question.knowledgePointName}已进入复习计划`), ...current.activityLogs].slice(0, 60),
      }
    })
    notify('success', '已保存到错题本', '知识点画像和复习计划已同步更新。')
    return mistakeId
  }

  const removeMistake = (id: string) => {
    setState((current) => ({ ...current, mistakes: current.mistakes.filter((item) => item.id !== id), reviewTasks: current.reviewTasks.filter((item) => item.sourceId !== id) }))
    notify('info', '错题已删除')
  }

  const archiveMistake = (id: string) => {
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
        knowledgePoints: updateKnowledge(current.knowledgePoints, { id: mistake.knowledgePointId, name: mistake.knowledgePointName, subject: mistake.subject, chapter: mistake.chapter, correct: rating === 'good' || rating === 'easy', cause: mistake.primaryCause, delta }),
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
        knowledge = updateKnowledge(knowledge, { id: item.knowledgePointId, name: item.knowledgePointName, subject: item.subject, correct: isCorrect, cause: isCorrect ? undefined : '知识点不会' })
        if (!isCorrect && current.settings.autoAddMistakes) {
          const questionId = `quiz-question-${item.id}`
          const existingMistake = mistakes.find((mistake) => mistake.questionId === questionId && !mistake.archived)
          if (existingMistake) {
            mistakes = mistakes.map((mistake) => mistake.id === existingMistake.id ? { ...mistake, wrongCount: mistake.wrongCount + 1, wrongAt: now, studentAnswer: item.userAnswer || '', nextReviewAt: addDays(now, 1), mastery: clamp(mistake.mastery - 8), masteryLevel: getMasteryLevel(clamp(mistake.mastery - 8)) } : mistake)
          } else {
            const mistakeId = crypto.randomUUID()
            questions.unshift({ id: questionId, subject: item.subject, chapter: '每日小测', knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, content: item.content, studentAnswer: item.userAnswer, correctAnswer: item.correctAnswer, questionFormat: item.format, sourceType: item.sourceType, createdAt: now })
            mistakes.unshift({ id: mistakeId, questionId, subject: item.subject, chapter: '每日小测', knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, originalQuestion: item.content, studentAnswer: item.userAnswer || '', correctAnswer: item.correctAnswer, wrongAt: now, wrongCount: 1, primaryCause: '知识点不会', mastery: 35, masteryLevel: '薄弱', nextReviewAt: addDays(now, 1), sourceType: item.sourceType })
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
        knowledge = updateKnowledge(knowledge, { id: item.knowledgePointId, name: item.knowledgePointName, subject: item.subject, chapter: paper.title, correct, cause: item.errorCause })
        if (!correct) {
          const questionId = `paper-${paper.id}-${item.id}`
          const mistakeId = crypto.randomUUID()
          questions.unshift({ id: questionId, subject: item.subject, chapter: paper.title, knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, content: item.content, studentAnswer: item.studentAnswer, correctAnswer: item.correctAnswer, questionFormat: item.fullScore > 5 ? '解答题' : '选择题', sourceType: 'user_upload', createdAt: paper.createdAt })
          mistakes.unshift({ id: mistakeId, questionId, subject: item.subject, chapter: paper.title, knowledgePointId: item.knowledgePointId, knowledgePointName: item.knowledgePointName, originalQuestion: item.content, studentAnswer: item.studentAnswer, correctAnswer: item.correctAnswer, wrongAt: paper.date, wrongCount: 1, primaryCause: item.errorCause || '知识点不会', mastery: 35, masteryLevel: '薄弱', nextReviewAt: addDays(paper.createdAt, 1), sourceType: 'user_upload' })
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
        knowledge = updateKnowledge(knowledge, { id: item.question.knowledgePointId, name: item.question.knowledgePointName, subject: item.question.subject, correct: item.isCorrect, cause: item.cause })
        if (!item.isCorrect) {
          const questionId = `simulation-${item.question.id}`
          const mistakeId = crypto.randomUUID()
          questions.unshift({ id: questionId, subject: item.question.subject, chapter: '模拟训练', knowledgePointId: item.question.knowledgePointId, knowledgePointName: item.question.knowledgePointName, content: item.question.content, studentAnswer: item.userAnswer, correctAnswer: item.question.correctAnswer, questionFormat: item.question.format, sourceType: 'ai_generated', createdAt: now })
          mistakes.unshift({ id: mistakeId, questionId, subject: item.question.subject, chapter: '模拟训练', knowledgePointId: item.question.knowledgePointId, knowledgePointName: item.question.knowledgePointName, originalQuestion: item.question.content, studentAnswer: item.userAnswer, correctAnswer: item.question.correctAnswer, wrongAt: now, wrongCount: 1, primaryCause: item.cause || '知识点不会', mastery: 35, masteryLevel: '薄弱', nextReviewAt: addDays(now, 1), sourceType: 'ai_generated' })
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
      setState(data)
      notify('success', '数据导入成功')
    } catch (error) {
      notify('error', '数据导入失败', error instanceof Error ? error.message : '无法解析文件')
      throw error
    }
  }

  const resetData = () => {
    setState(createSeedState())
    notify('success', '演示数据已重置')
  }

  const value: AppStoreValue = {
    state, toasts, updateProfile, updateSettings, saveMistake, removeMistake, archiveMistake, reviewMistake, reviewCard, toggleTask, addDailyTask, completeQuiz, addPaper, applySimulation, exportData, importData, resetData, notify, dismissToast,
  }

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}
