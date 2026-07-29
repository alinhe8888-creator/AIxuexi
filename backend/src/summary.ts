interface SnapshotLike {
  profile?: { id?: string; name?: string; grade?: string }
  dailyPlans?: Array<{ date: string; tasks: Array<{ id?: string; status: string; estimatedMinutes?: number; type?: string }> }>
  knowledgePoints?: Array<{ id: string; subject: string; chapter: string; name: string; mastery: number; accuracy: number; errorCount: number; mainCause?: string; forgettingRisk?: string; trend?: number[] }>
  mistakes?: Array<{ id: string; subject: string; chapter: string; knowledgePointName: string; primaryCause: string; wrongAt: string; wrongCount: number; mastery: number; archived?: boolean; correction?: { status?: string; transferPassed?: boolean; triedMethodIds?: string[]; attempts?: unknown[] } }>
  quizzes?: Array<{ id: string; title: string; date: string; correctRate: number; status: string; weakPoints?: string[] }>
  activityLogs?: Array<{ id: string; type: string; title: string; description: string; createdAt: string }>
  reviewTasks?: Array<{ id: string; status?: string; dueDate?: string; completedAt?: string }>
  strategyPreferences?: Array<{ style?: string; methodName?: string; subject?: string; usedCount?: number; successCount?: number; totalScore?: number }>
  workspace?: {
    timeZone?: string
    studySessions?: Array<{ id: string; mode?: string; duration?: number; createdAt?: string }>
    dailyCompletions?: Record<string, boolean>
  }
}

function safeTimeZone(value?: string) {
  if (!value) return 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date())
    return value
  } catch {
    return 'UTC'
  }
}

function dateKey(value = new Date(), timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function shiftDateKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const recentDates = (days: number, timeZone: string) => {
  const today = dateKey(new Date(), timeZone)
  return Array.from({ length: days }, (_, index) => shiftDateKey(today, -(days - index - 1)))
}

function eventDateKey(value: string | undefined, timeZone: string) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateKey(date, timeZone) : value.slice(0, 10)
}

export function buildParentDashboard(snapshot: SnapshotLike, account: { id: string; displayName: string; email: string; lastSyncedAt?: string | null }) {
  const knowledge = Array.isArray(snapshot.knowledgePoints) ? snapshot.knowledgePoints : []
  const mistakes = Array.isArray(snapshot.mistakes) ? snapshot.mistakes.filter((item) => !item.archived) : []
  const plans = Array.isArray(snapshot.dailyPlans) ? snapshot.dailyPlans : []
  const quizzes = Array.isArray(snapshot.quizzes) ? snapshot.quizzes : []
  const activity = Array.isArray(snapshot.activityLogs) ? snapshot.activityLogs : []
  const reviewTasks = Array.isArray(snapshot.reviewTasks) ? snapshot.reviewTasks : []
  const strategyPreferences = Array.isArray(snapshot.strategyPreferences) ? snapshot.strategyPreferences : []
  const timeZone = safeTimeZone(snapshot.workspace?.timeZone)
  const studySessions = Array.isArray(snapshot.workspace?.studySessions) ? snapshot.workspace.studySessions : []
  const dailyCompletions = snapshot.workspace?.dailyCompletions && typeof snapshot.workspace.dailyCompletions === 'object'
    ? snapshot.workspace.dailyCompletions
    : {}
  const isTaskCompleted = (task: { id?: string; status: string }) => task.status === 'completed' || Boolean(task.id && dailyCompletions[`existing:${task.id}`])
  const isSessionCompleted = (session: { id: string }) => Boolean(dailyCompletions[`session:${session.id}`])
  const today = dateKey(new Date(), timeZone)
  const todayPlan = plans.find((plan) => plan.date.slice(0, 10) === today)
  const tasks = todayPlan?.tasks ?? []
  const todaySessions = studySessions.filter((session) => eventDateKey(session.createdAt, timeZone) === today)
  const completedTasks = tasks.filter(isTaskCompleted)
  const completedSessions = todaySessions.filter(isSessionCompleted)
  const plannedMinutes = tasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)
    + todaySessions.reduce((sum, session) => sum + Number(session.duration || 0), 0)
  const completedMinutes = completedTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)
    + completedSessions.reduce((sum, session) => sum + Number(session.duration || 0), 0)
  const todayTotal = tasks.length + todaySessions.length
  const todayCompleted = completedTasks.length + completedSessions.length

  const subjectGroups = new Map<string, typeof knowledge>()
  knowledge.forEach((point) => {
    const list = subjectGroups.get(point.subject) ?? []
    list.push(point)
    subjectGroups.set(point.subject, list)
  })

  const subjects = [...subjectGroups.entries()].map(([subject, points]) => ({
    subject,
    mastery: Math.round(points.reduce((sum, point) => sum + point.mastery, 0) / Math.max(points.length, 1)),
    accuracy: Math.round(points.reduce((sum, point) => sum + point.accuracy, 0) / Math.max(points.length, 1)),
    weakCount: points.filter((point) => point.mastery < 60).length,
    riskCount: points.filter((point) => point.forgettingRisk === '高').length,
  })).sort((a, b) => a.mastery - b.mastery)

  const weakPoints = knowledge
    .filter((point) => point.mastery < 60 || point.forgettingRisk === '高')
    .sort((a, b) => a.mastery - b.mastery || b.errorCount - a.errorCount)
    .slice(0, 12)
  const causeMap = new Map<string, number>()
  mistakes.forEach((mistake) => causeMap.set(mistake.primaryCause || '待确认', (causeMap.get(mistake.primaryCause || '待确认') ?? 0) + 1))
  const causes = [...causeMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  const recentQuizzes = [...quizzes].filter((quiz) => quiz.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  const trend = recentQuizzes.slice().reverse().map((quiz) => quiz.correctRate)
  const currentMastery = knowledge.length ? Math.round(knowledge.reduce((sum, point) => sum + point.mastery, 0) / knowledge.length) : 0

  const alerts = weakPoints.slice(0, 3).map((point) => ({
    level: point.mastery < 45 || point.forgettingRisk === '高' ? 'high' as const : 'medium' as const,
    title: `${point.subject} · ${point.name}`,
    description: `掌握度 ${point.mastery}%｜错误 ${point.errorCount} 次${point.mainCause ? `｜主要错因：${point.mainCause}` : ''}`,
  }))

  const days14 = recentDates(14, timeZone)
  const dailyActivity = days14.map((date) => {
    const plan = plans.find((item) => item.date.slice(0, 10) === date)
    const dayTasks = plan?.tasks || []
    const daySessions = studySessions.filter((session) => eventDateKey(session.createdAt, timeZone) === date)
    const done = dayTasks.filter(isTaskCompleted)
    const doneSessions = daySessions.filter(isSessionCompleted)
    const dayPlanned = dayTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)
      + daySessions.reduce((sum, session) => sum + Number(session.duration || 0), 0)
    const dayCompleted = done.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)
      + doneSessions.reduce((sum, session) => sum + Number(session.duration || 0), 0)
    const total = dayTasks.length + daySessions.length
    return { date, completionRate: total ? Math.round(((done.length + doneSessions.length) / total) * 100) : 0, plannedMinutes: dayPlanned, completedMinutes: dayCompleted }
  })

  const days7 = recentDates(7, timeZone)
  const mistakeTrend = days7.map((date) => ({ date, count: mistakes.filter((item) => eventDateKey(item.wrongAt, timeZone) === date).length }))
  const masteryDistribution = [
    { label: '熟练 80+', value: knowledge.filter((item) => item.mastery >= 80).length },
    { label: '基本掌握 60-79', value: knowledge.filter((item) => item.mastery >= 60 && item.mastery < 80).length },
    { label: '薄弱 40-59', value: knowledge.filter((item) => item.mastery >= 40 && item.mastery < 60).length },
    { label: '需重学 <40', value: knowledge.filter((item) => item.mastery < 40).length },
  ]
  const correctionCount = mistakes.filter((item) => item.correction?.status).length
  const reviewStatus = correctionCount ? [
    { label: '待订正', value: mistakes.filter((item) => !item.correction || item.correction.status === '待订正').length },
    { label: '订正中', value: mistakes.filter((item) => item.correction?.status === '订正中').length },
    { label: '待验证', value: mistakes.filter((item) => item.correction?.status === '待验证').length },
    { label: '已验证', value: mistakes.filter((item) => item.correction?.status === '已验证' || item.correction?.transferPassed).length },
  ] : [
    { label: '已完成', value: reviewTasks.filter((item) => item.status === 'completed').length },
    { label: '待复习', value: reviewTasks.filter((item) => item.status !== 'completed' && (!item.dueDate || item.dueDate.slice(0, 10) >= today)).length },
    { label: '已逾期', value: reviewTasks.filter((item) => item.status !== 'completed' && Boolean(item.dueDate && item.dueDate.slice(0, 10) < today)).length },
  ]
  const typeCounts = new Map<string, number>()
  plans.flatMap((plan) => plan.tasks || []).forEach((task) => {
    const type = task.type === 'review' ? '复习' : task.type === 'quiz' ? '训练' : '其他'
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  })
  studySessions.forEach((session) => {
    const type = session.mode === 'preview' ? '预习' : session.mode === 'review' ? '复习' : '其他'
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1)
  })
  const learningMix = ['预习', '复习', '训练', '其他'].map((label) => ({ label, value: typeCounts.get(label) || 0 }))
  const subjectRadar = subjects.map((item) => ({
    label: item.subject,
    mastery: item.mastery,
    accuracy: item.accuracy,
    stability: Math.max(0, Math.min(100, 100 - item.riskCount * 12 - item.weakCount * 5)),
  }))
  const strategyMethods = strategyPreferences
    .map((item) => {
      const usedCount = Math.max(0, Number(item.usedCount || 0))
      const successCount = Math.max(0, Number(item.successCount || 0))
      return {
        label: `${item.subject || '跨学科'} · ${item.style || item.methodName || '讲解方法'}`,
        value: usedCount ? Math.round((successCount / usedCount) * 100) : 0,
        usedCount,
        subject: item.subject,
      }
    })
    .sort((left, right) => right.value - left.value || right.usedCount - left.usedCount)
    .slice(0, 8)

  return {
    student: { userId: account.id, displayName: snapshot.profile?.name || account.displayName, email: account.email, grade: snapshot.profile?.grade || '未设置', lastSyncedAt: account.lastSyncedAt || new Date(0).toISOString() },
    today: { completed: todayCompleted, total: todayTotal, completionRate: todayTotal ? Math.round((todayCompleted / todayTotal) * 100) : 0, plannedMinutes, completedMinutes },
    overview: { mastery: currentMastery, weakPointCount: knowledge.filter((point) => point.mastery < 60).length, highRiskCount: knowledge.filter((point) => point.forgettingRisk === '高').length, activeMistakeCount: mistakes.length, latestQuizRate: recentQuizzes[0]?.correctRate ?? 0 },
    subjects,
    weakPoints,
    causes,
    recentMistakes: [...mistakes].sort((a, b) => b.wrongAt.localeCompare(a.wrongAt)).slice(0, 12),
    recentQuizzes,
    trend,
    alerts,
    activity: [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
    recommendations: weakPoints.slice(0, 3).map((point, index) => ({ priority: index + 1, title: `优先巩固 ${point.name}`, description: `${point.subject}「${point.chapter}」当前掌握度 ${point.mastery}%，建议连续 3 天安排短时复习和同类题。` })),
    dailyActivity,
    mistakeTrend,
    masteryDistribution,
    reviewStatus,
    learningMix,
    subjectRadar,
    strategyMethods,
  }
}
