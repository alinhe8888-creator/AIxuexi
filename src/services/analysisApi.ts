import { apiRequest } from './apiClient'

export interface StudentAiAnalysis {
  generatedAt: string
  provider: 'qwen' | 'deepseek'
  summary: string
  currentFocus: string
  strengths: string[]
  weaknesses: Array<{
    subject: string
    chapter: string
    knowledgePoint: string
    reason: string
    priority: '高' | '中' | '低'
  }>
  rootCauses: string[]
  todayTasks: Array<{ title: string; reason: string; minutes: number }>
  sevenDayPlan: Array<{ day: string; focus: string; tasks: string[] }>
  parentNote: string
}

export const analysisApi = {
  async getLatest(): Promise<StudentAiAnalysis | null> {
    const result = await apiRequest<{ analysis: StudentAiAnalysis | null }>(
      '/api/ai/student-analysis',
    )
    return result.analysis
  },

  async generate(): Promise<StudentAiAnalysis> {
    const result = await apiRequest<{ analysis: StudentAiAnalysis }>(
      '/api/ai/student-analysis',
      { method: 'POST', timeoutMs: 240_000 },
    )
    return result.analysis
  },
}
