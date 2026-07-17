interface SnapshotLike {
  profile?: { id?: string; name?: string; grade?: string }
  dailyPlans?: Array<{ date: string; tasks: Array<{ status: string; estimatedMinutes?: number }> }>
  knowledgePoints?: Array<{ id: string; subject: string; chapter: string; name: string; mastery: number; accuracy: number; errorCount: number; mainCause?: string; forgettingRisk?: string; trend?: number[] }>
  mistakes?: Array<{ id: string; subject: string; chapter: string; knowledgePointName: string; primaryCause: string; wrongAt: string; wrongCount: number; mastery: number; archived?: boolean }>
  quizzes?: Array<{ id: string; title: string; date: string; correctRate: number; status: string; weakPoints?: string[] }>
  activityLogs?: Array<{ id: string; type: string; title: string; description: string; createdAt: string }>
}

const dateKey = (value = new Date()) => value.toISOString().slice(0, 10)

export function buildParentDashboard(snapshot: SnapshotLike, account: { id: string; displayName: string; email: string }) {
  const knowledge = Array.isArray(snapshot.knowledgePoints) ? snapshot.knowledgePoints : []
  const mistakes = Array.isArray(snapshot.mistakes) ? snapshot.mistakes.filter((item) => !item.archived) : []
  const plans = Array.isArray(snapshot.dailyPlans) ? snapshot.dailyPlans : []
  const quizzes = Array.isArray(snapshot.quizzes) ? snapshot.quizzes : []
  const activity = Array.isArray(snapshot.activityLogs) ? snapshot.activityLogs : []
  const todayPlan = plans.find((plan) => plan.date === dateKey())
  const tasks = todayPlan?.tasks ?? []
  const completedTasks = tasks.filter((task) => task.status === 'completed')
  const plannedMinutes = tasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)
  const completedMinutes = completedTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)

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

  const weakPoints = [...knowledge]
    .sort((a, b) => a.mastery - b.mastery || b.errorCount - a.errorCount)
    .slice(0, 8)

  const causeMap = new Map<string, number>()
  mistakes.forEach((mistake) => causeMap.set(mistake.primaryCause, (causeMap.get(mistake.primaryCause) ?? 0) + 1))
  const causes = [...causeMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)

  const recentQuizzes = [...quizzes]
    .filter((quiz) => quiz.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  const trend = recentQuizzes.slice().reverse().map((quiz) => quiz.correctRate)
  const currentMastery = knowledge.length ? Math.round(knowledge.reduce((sum, point) => sum + point.mastery, 0) / knowledge.length) : 0

  const alerts = weakPoints.slice(0, 3).map((point) => ({
    level: point.mastery < 45 || point.forgettingRisk === '高' ? 'high' : 'medium',
    title: `${point.subject} · ${point.name}`,
    description: `掌握度 ${point.mastery}%｜错误 ${point.errorCount} 次${point.mainCause ? `｜主要错因：${point.mainCause}` : ''}`,
  }))

  return {
    student: {
      userId: account.id,
      displayName: snapshot.profile?.name || account.displayName,
      email: account.email,
      grade: snapshot.profile?.grade || '未设置',
      lastSyncedAt: new Date().toISOString(),
    },
    today: {
      completed: completedTasks.length,
      total: tasks.length,
      completionRate: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      plannedMinutes,
      completedMinutes,
    },
    overview: {
      mastery: currentMastery,
      weakPointCount: knowledge.filter((point) => point.mastery < 60).length,
      highRiskCount: knowledge.filter((point) => point.forgettingRisk === '高').length,
      activeMistakeCount: mistakes.length,
      latestQuizRate: recentQuizzes[0]?.correctRate ?? 0,
    },
    subjects,
    weakPoints,
    causes,
    recentMistakes: [...mistakes].sort((a, b) => b.wrongAt.localeCompare(a.wrongAt)).slice(0, 12),
    recentQuizzes,
    trend,
    alerts,
    activity: [...activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
    recommendations: weakPoints.slice(0, 3).map((point, index) => ({
      priority: index + 1,
      title: `优先巩固 ${point.name}`,
      description: `${point.subject}「${point.chapter}」当前掌握度 ${point.mastery}%，建议连续 3 天安排短时复习和同类题。`,
    })),
  }
}
