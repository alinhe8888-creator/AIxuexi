import type { ParentChildSummary, ParentDashboard } from '../types'
import { apiRequest } from './apiClient'

export const parentApi = {
  async listChildren(): Promise<ParentChildSummary[]> {
    const result = await apiRequest<{ children: ParentChildSummary[] }>('/api/parent/children')
    return result.children
  },

  async linkChild(_code?: string) {
    return apiRequest<{ ok: boolean; studentId: string; automatic: true }>('/api/parent/link', {
      method: 'POST',
      body: JSON.stringify({ automatic: true }),
      retry: 0,
    })
  },

  async getDashboard(studentId: string): Promise<ParentDashboard> {
    const result = await apiRequest<{ dashboard: ParentDashboard }>(
      `/api/parent/children/${studentId}/dashboard`,
    )
    return result.dashboard
  },

  async unlinkChild(_studentId?: string) {
    throw new Error('家庭学习账号为固定连接，不能解除')
  },
}
