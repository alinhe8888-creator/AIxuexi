import { apiRequest } from './apiClient'

export interface MaterialAnalysis {
  summary: string
  topics: string[]
  keyPoints: string[]
  questions: string[]
  suggestions: string[]
}

export interface LearningMaterial {
  id: string
  title: string
  subject: string
  fileName: string
  mimeType: string
  sizeBytes: number
  analysisStatus: 'pending' | 'running' | 'done' | 'failed'
  analysis: MaterialAnalysis | null
  createdAt: string
  updatedAt: string
}

interface UploadTicket {
  key: string
  uploadUrl: string
  headers: Record<string, string>
}

export const materialApi = {
  async list() {
    const result = await apiRequest<{ materials: LearningMaterial[] }>('/api/materials')
    return result.materials
  },

  async upload(input: { file: File; title: string; subject: string; textContent?: string }) {
    const ticket = await apiRequest<UploadTicket>('/api/materials/upload-url', {
      method: 'POST',
      retry: 0,
      body: JSON.stringify({ fileName: input.file.name, mimeType: input.file.type || 'application/octet-stream', sizeBytes: input.file.size }),
    })
    const uploadResponse = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: input.file })
    if (!uploadResponse.ok) throw new Error(`资料上传失败（${uploadResponse.status}）`)
    const result = await apiRequest<{ material: LearningMaterial }>('/api/materials', {
      method: 'POST',
      retry: 0,
      body: JSON.stringify({
        key: ticket.key,
        fileName: input.file.name,
        mimeType: input.file.type || 'application/octet-stream',
        sizeBytes: input.file.size,
        title: input.title,
        subject: input.subject,
        textContent: input.textContent || '',
      }),
    })
    return result.material
  },

  async replace(id: string, input: { file: File; title: string; subject: string; textContent?: string }) {
    const ticket = await apiRequest<UploadTicket>('/api/materials/upload-url', {
      method: 'POST',
      retry: 0,
      body: JSON.stringify({ fileName: input.file.name, mimeType: input.file.type || 'application/octet-stream', sizeBytes: input.file.size }),
    })
    const uploadResponse = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: input.file })
    if (!uploadResponse.ok) throw new Error(`资料更新失败（${uploadResponse.status}）`)
    const result = await apiRequest<{ material: LearningMaterial }>(`/api/materials/${id}`, {
      method: 'PATCH',
      retry: 0,
      body: JSON.stringify({
        key: ticket.key,
        fileName: input.file.name,
        mimeType: input.file.type || 'application/octet-stream',
        sizeBytes: input.file.size,
        title: input.title,
        subject: input.subject,
        textContent: input.textContent || '',
      }),
    })
    return result.material
  },

  async analyze(id: string) {
    const result = await apiRequest<{ material: LearningMaterial }>(`/api/materials/${id}/analyze`, { method: 'POST', retry: 0, timeoutMs: 120_000 })
    return result.material
  },

  async open(id: string) {
    const tab = window.open('about:blank', '_blank')
    try {
      const result = await apiRequest<{ url: string }>(`/api/materials/${id}/download-url`)
      if (tab) tab.location.replace(result.url)
      else window.location.assign(result.url)
    } catch (error) {
      tab?.close()
      throw error
    }
  },

  async remove(id: string) {
    await apiRequest(`/api/materials/${id}`, { method: 'DELETE', retry: 0 })
  },
}
