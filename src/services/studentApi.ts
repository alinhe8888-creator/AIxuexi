import type { AppState } from '../types'
import type { WorkspaceSnapshot } from '../utils/familyLearningWorkspace'
import { apiRequest } from './apiClient'

export type StudentCloudSnapshot = AppState & { workspace?: WorkspaceSnapshot }

export const studentApi = {
  async getSnapshot(): Promise<{ snapshot: StudentCloudSnapshot | null; updatedAt: string | null }> {
    return apiRequest('/api/student/snapshot')
  },
  async pushSnapshot(snapshot: StudentCloudSnapshot) {
    return apiRequest<{ ok: boolean; updatedAt: string }>('/api/student/snapshot', {
      method: 'PUT',
      body: JSON.stringify({ snapshot }),
      retry: 1,
    })
  },
}
