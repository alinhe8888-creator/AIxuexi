import type {
  AppState,
  ErrorCause,
  KnowledgePoint,
  Subject,
} from '../types'

export type EvidenceLevel = '低' | '中' | '高'

export interface ProfilePointInsight extends KnowledgePoint {
  score: number
  confidence: number
  confidenceLevel: EvidenceLevel
  evidenceCount: number
  trendDelta: number
  due: boolean
}

export interface SubjectInsight {
  subject: Subject
  score: number
  mastery: number
  accuracy: number
  evidenceCount: number
  confidence: number
  weakCount: number
  dueCount: number
}

export interface StudentProfileInsight {
  overallScore: number
  academicScore: number
  habitScore: number
  averageMastery: number
  averageAccuracy: number
  confidence: number
  confidenceLevel: EvidenceLevel
  totalEvidence: number
  dueReviewCount: number
  activeDays14: number
  planCompletion14: number
  quizAverage: number | null
  paperAverage: number | null
  mistakeReviewRate: number
  points: ProfilePointInsight[]
  subjects: SubjectInsight[]
  causes: Array<{ label: string; value: number }>
  trend: number[]
  strengths: ProfilePointInsight[]
  weaknesses: ProfilePointInsight[]
  recommendations: string[]
}

const DAY_MS = 86_400_000
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0
const safeTime = (value?: string) => {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}
const dateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  if (!Number.isFinite(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const evidenceLevel = (confidence: number): EvidenceLevel => (
  confidence >= 72 ? '高' : confidence >= 42 ? '中' : '低'
)

function recentScore(lastReviewedAt?: string) {
  if (!lastReviewedAt) return 45
  const days = Math.max(0, (Date.now() - safeTime(lastReviewedAt)) / DAY_MS)
  if (days <= 2) return 100
  if (days <= 7) return 85
  if (days <= 14) return 68
  if (days <= 30) return 52
  return 35
}

function relatedEvidence(state: AppState, point: KnowledgePoint) {
  const mistakeCount = state.mistakes.filter((item) => (
    item.knowledgePointId === point.id || item.knowledgePointName === point.name
  )).reduce((sum, item) => sum + Math.max(1, item.wrongCount), 0)
  const quizCount = state.quizzes
    .filter((quiz) => quiz.status === 'completed')
    .flatMap((quiz) => quiz.questions)
    .filter((question) => (
      question.knowledgePointId === point.id || question.knowledgePointName === point.name
    )).length
  const paperCount = state.papers
    .flatMap((paper) => paper.questions)
    .filter((question) => (
      question.knowledgePointId === point.id || question.knowledgePointName === point.name
    )).length
  return Math.max(
    1,
    point.reviewCount + point.errorCount + point.trend.length + mistakeCount + quizCount + paperCount,
  )
}

function pointInsight(state: AppState, point: KnowledgePoint): ProfilePointInsight {
  const trendDelta = point.trend.length > 1
    ? (point.trend.at(-1) || 0) - (point.trend[0] || 0)
    : 0
  const trendScore = clamp(55 + trendDelta * 2.5)
  const retentionScore = point.forgettingRisk === '高' ? 30 : point.forgettingRisk === '中' ? 62 : 90
  const reviewStability = clamp(50 + point.reviewCount * 6 - point.errorCount * 4)
  const rawScore = (
    point.mastery * 0.34
    + point.accuracy * 0.25
    + trendScore * 0.13
    + retentionScore * 0.13
    + reviewStability * 0.08
    + recentScore(point.lastReviewedAt) * 0.07
  )
  const evidenceCount = relatedEvidence(state, point)
  const confidenceRatio = 1 - Math.exp(-evidenceCount / 9)
  const confidence = Math.round(clamp(confidenceRatio * 100))
  // 数据少时向中性值收缩，避免一两道题就给孩子贴上“强/弱”标签。
  const score = Math.round(clamp(rawScore * confidenceRatio + 60 * (1 - confidenceRatio)))
  const due = Boolean(
    point.forgettingRisk === '高'
    || (point.nextReviewAt && safeTime(point.nextReviewAt) <= Date.now()),
  )

  return {
    ...point,
    score,
    confidence,
    confidenceLevel: evidenceLevel(confidence),
    evidenceCount,
    trendDelta,
    due,
  }
}

function weightedAverage<T>(items: T[], value: (item: T) => number, weight: (item: T) => number) {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0.1, weight(item)), 0)
  if (!items.length || !totalWeight) return 0
  return items.reduce((sum, item) => sum + value(item) * Math.max(0.1, weight(item)), 0) / totalWeight
}

function buildCauseStats(state: AppState, points: ProfilePointInsight[]) {
  const pointIds = new Set(points.map((point) => point.id))
  const pointNames = new Set(points.map((point) => point.name))
  const map = new Map<ErrorCause, number>()
  state.mistakes.forEach((mistake) => {
    if (!pointIds.has(mistake.knowledgePointId) && !pointNames.has(mistake.knowledgePointName)) return
    map.set(mistake.primaryCause, (map.get(mistake.primaryCause) || 0) + Math.max(1, mistake.wrongCount))
  })
  points.forEach((point) => {
    if (!point.mainCause || map.has(point.mainCause)) return
    map.set(point.mainCause, Math.max(1, point.errorCount))
  })
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

function buildTrend(points: ProfilePointInsight[]) {
  const maxLength = Math.max(0, ...points.map((point) => point.trend.length))
  if (!maxLength) return []
  return Array.from({ length: maxLength }, (_, index) => Math.round(weightedAverage(
    points,
    (point) => point.trend[index] ?? point.trend.at(-1) ?? point.mastery,
    (point) => Math.max(1, point.evidenceCount),
  )))
}

export function buildStudentProfile(state: AppState): StudentProfileInsight {
  const points = state.knowledgePoints.map((point) => pointInsight(state, point))
  const totalEvidence = points.reduce((sum, point) => sum + point.evidenceCount, 0)
  const confidence = Math.round(clamp((1 - Math.exp(-totalEvidence / 40)) * 100))
  const academicScore = points.length
    ? Math.round(weightedAverage(points, (point) => point.score, (point) => point.evidenceCount))
    : 0
  const averageMastery = points.length
    ? Math.round(weightedAverage(points, (point) => point.mastery, (point) => point.evidenceCount))
    : 0
  const averageAccuracy = points.length
    ? Math.round(weightedAverage(points, (point) => point.accuracy, (point) => point.evidenceCount))
    : 0

  const cutoff14 = Date.now() - 13 * DAY_MS
  const recentPlans = state.dailyPlans.filter((plan) => safeTime(plan.date) >= cutoff14)
  const recentTasks = recentPlans.flatMap((plan) => plan.tasks)
  const planCompletion14 = recentTasks.length
    ? Math.round(recentTasks.filter((task) => task.status === 'completed').length / recentTasks.length * 100)
    : 0
  const activeDays = new Set(
    state.activityLogs
      .filter((item) => safeTime(item.createdAt) >= cutoff14)
      .map((item) => dateKey(item.createdAt))
      .filter(Boolean),
  ).size
  const reviewedMistakes = state.mistakes.filter((mistake) => mistake.lastReviewedAt || mistake.archived).length
  const mistakeReviewRate = state.mistakes.length
    ? Math.round(reviewedMistakes / state.mistakes.length * 100)
    : 0
  const habitScore = Math.round(clamp(
    planCompletion14 * 0.45
    + (activeDays / 14 * 100) * 0.30
    + mistakeReviewRate * 0.25,
  ))
  const overallScore = points.length
    ? Math.round(academicScore * 0.78 + habitScore * 0.22)
    : habitScore

  const completedQuizzes = state.quizzes.filter((quiz) => quiz.status === 'completed')
  const quizAverage = completedQuizzes.length
    ? Math.round(average(completedQuizzes.slice(-10).map((quiz) => quiz.correctRate)))
    : null
  const paperAverage = state.papers.length
    ? Math.round(average(state.papers.slice(-5).map((paper) => paper.summary.scoreRate)))
    : null
  const pendingReviewIds = new Set(
    state.reviewTasks
      .filter((task) => task.status === 'pending' && safeTime(task.scheduledDate) <= Date.now())
      .map((task) => task.knowledgePointId || task.sourceId),
  )
  const dueReviewCount = new Set([
    ...points.filter((point) => point.due).map((point) => point.id),
    ...pendingReviewIds,
  ]).size

  const subjectNames = [...new Set(points.map((point) => point.subject))]
  const subjects = subjectNames.map((subject): SubjectInsight => {
    const items = points.filter((point) => point.subject === subject)
    const evidenceCount = items.reduce((sum, point) => sum + point.evidenceCount, 0)
    const subjectConfidence = Math.round(clamp((1 - Math.exp(-evidenceCount / 18)) * 100))
    return {
      subject,
      score: Math.round(weightedAverage(items, (point) => point.score, (point) => point.evidenceCount)),
      mastery: Math.round(weightedAverage(items, (point) => point.mastery, (point) => point.evidenceCount)),
      accuracy: Math.round(weightedAverage(items, (point) => point.accuracy, (point) => point.evidenceCount)),
      evidenceCount,
      confidence: subjectConfidence,
      weakCount: items.filter((point) => point.score < 60).length,
      dueCount: items.filter((point) => point.due).length,
    }
  }).sort((a, b) => a.score - b.score)

  const reliablePoints = points.filter((point) => point.confidence >= 35)
  const weaknesses = [...reliablePoints].sort((a, b) => a.score - b.score).slice(0, 5)
  const strengths = [...reliablePoints].sort((a, b) => b.score - a.score).slice(0, 3)
  const causes = buildCauseStats(state, points)
  const recommendations: string[] = []

  if (totalEvidence < 12) {
    recommendations.push('当前证据量较少：先完成一次小测、一次错题复习和一份今日计划，再判断稳定强弱项。')
  }
  if (dueReviewCount > 0) {
    recommendations.push(`今天先处理 ${dueReviewCount} 个到期或高遗忘风险知识点，避免“会过但没留住”。`)
  }
  if (weaknesses[0]) {
    recommendations.push(`优先复习“${weaknesses[0].name}”：先回忆概念，再独立完成 2 道同类题，用结果更新画像。`)
  }
  if (causes[0]) {
    recommendations.push(`近期最常见错因是“${causes[0].label}”，复盘时要记录触发步骤，而不是只抄正确答案。`)
  }
  if (recentTasks.length > 0 && planCompletion14 < 60) {
    recommendations.push('近 14 天计划完成率偏低，下一份计划应减少任务数量，保留最关键的 2—3 项。')
  }
  if (!recommendations.length) {
    recommendations.push('保持当前节奏：完成今日计划后做一次短测，用新证据确认掌握是否稳定。')
  }

  return {
    overallScore,
    academicScore,
    habitScore,
    averageMastery,
    averageAccuracy,
    confidence,
    confidenceLevel: evidenceLevel(confidence),
    totalEvidence,
    dueReviewCount,
    activeDays14: activeDays,
    planCompletion14,
    quizAverage,
    paperAverage,
    mistakeReviewRate,
    points: [...points].sort((a, b) => a.score - b.score),
    subjects,
    causes,
    trend: buildTrend(points),
    strengths,
    weaknesses,
    recommendations,
  }
}
