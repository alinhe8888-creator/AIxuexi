import { createSeedState } from '../data/seed'
import type { AppState, ParentChildSummary, ParentDashboard } from '../types'
import type { StudentAnalytics } from './analyticsApi'
import { apiRequest, USE_MOCK_API } from './apiClient'

function mockDashboard(state: AppState): ParentDashboard {
  const today = new Date().toISOString().slice(0, 10)
  const tasks = state.dailyPlans.find((plan) => plan.date === today)?.tasks ?? []
  const complete = tasks.filter((task) => task.status === 'completed')
  const groups = new Map<string, typeof state.knowledgePoints>()
  state.knowledgePoints.forEach((point) => groups.set(point.subject, [...(groups.get(point.subject) ?? []), point]))
  const weakPoints = [...state.knowledgePoints].sort((a, b) => a.mastery - b.mastery).slice(0, 8)
  const causes = new Map<string, number>()
  state.mistakes.filter((item) => !item.archived).forEach((item) => causes.set(item.primaryCause, (causes.get(item.primaryCause) ?? 0) + 1))
  const quizzes = state.quizzes.filter((quiz) => quiz.status === 'completed').sort((a, b) => b.date.localeCompare(a.date))
  return {
    student: { userId: 'mock-student-1', displayName: state.profile.name, email: 'student@example.com', grade: state.profile.grade, lastSyncedAt: new Date().toISOString() },
    today: { completed: complete.length, total: tasks.length, completionRate: tasks.length ? Math.round(complete.length / tasks.length * 100) : 0, plannedMinutes: tasks.reduce((sum, item) => sum + item.estimatedMinutes, 0), completedMinutes: complete.reduce((sum, item) => sum + item.estimatedMinutes, 0) },
    overview: { mastery: Math.round(state.knowledgePoints.reduce((sum, item) => sum + item.mastery, 0) / Math.max(state.knowledgePoints.length, 1)), weakPointCount: state.knowledgePoints.filter((item) => item.mastery < 60).length, highRiskCount: state.knowledgePoints.filter((item) => item.forgettingRisk === '高').length, activeMistakeCount: state.mistakes.filter((item) => !item.archived).length, latestQuizRate: quizzes[0]?.correctRate ?? 60 },
    subjects: [...groups.entries()].map(([subject, points]) => ({ subject, mastery: Math.round(points.reduce((sum, item) => sum + item.mastery, 0) / points.length), accuracy: Math.round(points.reduce((sum, item) => sum + item.accuracy, 0) / points.length), weakCount: points.filter((item) => item.mastery < 60).length, riskCount: points.filter((item) => item.forgettingRisk === '高').length })).sort((a, b) => a.mastery - b.mastery),
    weakPoints,
    causes: [...causes.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    recentMistakes: state.mistakes.filter((item) => !item.archived).slice(0, 12).map((item) => ({ id: item.id, subject: item.subject, chapter: item.chapter, knowledgePointName: item.knowledgePointName, primaryCause: item.primaryCause, wrongAt: item.wrongAt, wrongCount: item.wrongCount, mastery: item.mastery })),
    recentQuizzes: quizzes,
    trend: [52, 60, 66, 72, 78],
    alerts: weakPoints.slice(0, 3).map((item) => ({ level: item.mastery < 45 ? 'high' as const : 'medium' as const, title: `${item.subject} · ${item.name}`, description: `掌握度 ${item.mastery}%` })),
    activity: state.activityLogs.slice(0, 12),
    recommendations: weakPoints.slice(0, 3).map((item, index) => ({ priority: index + 1, title: `先补 ${item.name}`, description: `${item.subject}掌握度 ${item.mastery}%` })),
  }
}

export const parentApi = {
  async listChildren(): Promise<ParentChildSummary[]> {
    if (USE_MOCK_API) return [{ id: 'mock-student-1', email: 'student@example.com', displayName: '同学', linkedAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString() }]
    const result = await apiRequest<{ children: ParentChildSummary[] }>('/api/parent/children')
    return result.children
  },
  async linkChild(code: string) {
    if (USE_MOCK_API) return { ok: true }
    return apiRequest<{ ok: boolean }>('/api/parent/link', { method: 'POST', body: JSON.stringify({ code }), retry: 0 })
  },
  async linkChildByEmail(email: string) {
    if (USE_MOCK_API) return { ok: true }
    return apiRequest<{ ok: boolean }>('/api/parent/link-direct', { method: 'POST', body: JSON.stringify({ email }), retry: 0 })
  },
  async getDashboard(studentId: string): Promise<ParentDashboard> {
    if (USE_MOCK_API) return mockDashboard(createSeedState())
    const result = await apiRequest<{ dashboard: ParentDashboard }>(`/api/parent/children/${studentId}/dashboard`)
    return result.dashboard
  },
  async getAnalytics(studentId: string): Promise<StudentAnalytics> {
    if (USE_MOCK_API) {
      return { generatedAt: new Date().toISOString(), overview: { activeMistakes: 0, averageMastery: 0, latestAccuracy: 0, completedTasks: 0, totalTasks: 0, materialCount: 0, studyDays: 0 }, weakSubjects: [], weakPoints: [], trend: [], recommendations: ['先完成几次学习记录。'], recentMaterials: [] }
    }
    const result = await apiRequest<{ analytics: StudentAnalytics }>(`/api/parent/children/${studentId}/analytics`)
    return result.analytics
  },
  async unlinkChild(studentId: string) {
    if (USE_MOCK_API) return { ok: true }
    return apiRequest<{ ok: boolean }>(`/api/parent/children/${studentId}`, { method: 'DELETE', retry: 0 })
  },
}
