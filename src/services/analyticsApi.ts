import { apiRequest } from './apiClient'

export interface StudentAnalytics {
  generatedAt: string
  overview: {
    activeMistakes: number
    averageMastery: number
    latestAccuracy: number
    completedTasks: number
    totalTasks: number
    materialCount: number
    studyDays: number
  }
  weakSubjects: Array<{ subject: string; mastery: number; mistakeCount: number }>
  weakPoints: Array<{ subject: string; name: string; mastery: number; cause: string }>
  trend: Array<{ date: string; accuracy: number }>
  recommendations: string[]
  recentMaterials: Array<{ id: string; title: string; subject: string; updatedAt: string }>
}

export const analyticsApi = {
  async getStudent() {
    const result = await apiRequest<{ analytics: StudentAnalytics }>('/api/analytics/student')
    return result.analytics
  },
}
