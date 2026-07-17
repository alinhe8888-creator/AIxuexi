import type { AppState } from '../types'
import { apiRequest, USE_MOCK_API } from './apiClient'

export const studentApi = {
  async getSnapshot(): Promise<{ snapshot: AppState | null; updatedAt: string | null }> {
    if (USE_MOCK_API) return { snapshot: null, updatedAt: null }
    return apiRequest('/api/student/snapshot')
  },
  async pushSnapshot(snapshot: AppState) {
    if (USE_MOCK_API) return { ok: true, updatedAt: new Date().toISOString() }
    return apiRequest<{ ok: boolean; updatedAt: string }>('/api/student/snapshot', { method: 'PUT', body: JSON.stringify({ snapshot }), retry: 1 })
  },
  async createPairCode() {
    if (USE_MOCK_API) return { code: '246810', expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() }
    return apiRequest<{ code: string; expiresAt: string }>('/api/student/pair-code', { method: 'POST', body: '{}' })
  },
}
