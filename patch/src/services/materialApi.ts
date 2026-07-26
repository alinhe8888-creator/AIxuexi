import type { KnowledgeItem, Subject } from '../types'
import { apiRequest } from './apiClient'

export type MaterialImportStatus = 'queued' | 'extracting' | 'analyzing' | 'ready' | 'failed'

export interface MaterialImportJob {
  id: string
  key: string
  fileName: string
  subject?: Subject
  grade?: '高一' | '高二' | '高三'
  textbookVersion?: string
  status: MaterialImportStatus
  stage: string
  progress: number
  totalFiles: number
  processedFiles: number
  knowledgeCount: number
  skippedFiles: string[]
  errors: string[]
  createdAt: string
  updatedAt: string
}

export interface MaterialServiceStatus {
  r2Configured: boolean
  maxZipMb: number
  models: { qwen: boolean; deepseek: boolean }
  supported: string[]
}

function uploadWithProgress(url: string, file: File, headers: Record<string, string>, onProgress?: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 上传失败（${xhr.status}）`))
    xhr.onerror = () => reject(new Error('R2 上传网络错误'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.send(file)
  })
}

export const materialApi = {
  status: () => apiRequest<MaterialServiceStatus>('/api/materials/status'),
  listImports: async () => (await apiRequest<{ imports: MaterialImportJob[] }>('/api/materials/imports')).imports,
  getImport: async (id: string) => (await apiRequest<{ import: MaterialImportJob }>(`/api/materials/imports/${id}`)).import,
  searchKnowledge: (filters: { subject?: Subject; grade?: string; keyword?: string }) => {
    const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])))
    return apiRequest<KnowledgeItem[]>(`/api/knowledge?${query.toString()}`)
  },
  async uploadZip(
    file: File,
    metadata: { subject?: Subject; grade?: '高一' | '高二' | '高三'; textbookVersion?: string },
    onProgress?: (value: number) => void,
  ) {
    const contentType = file.type || 'application/zip'
    const presigned = await apiRequest<{ key: string; uploadUrl: string; headers: Record<string, string> }>('/api/materials/presign', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, size: file.size, contentType }),
      timeoutMs: 30_000,
    })
    await uploadWithProgress(presigned.uploadUrl, file, presigned.headers, onProgress)
    const result = await apiRequest<{ import: MaterialImportJob }>('/api/materials/imports', {
      method: 'POST',
      body: JSON.stringify({ key: presigned.key, fileName: file.name, ...metadata }),
      timeoutMs: 30_000,
    })
    return result.import
  },
  retry: async (id: string) => (await apiRequest<{ import: MaterialImportJob }>(`/api/materials/imports/${id}/retry`, { method: 'POST' })).import,
  remove: (id: string) => apiRequest<{ ok: boolean }>(`/api/materials/imports/${id}`, { method: 'DELETE' }),
  clearAll: () => apiRequest<{ ok: boolean; removedImports: number; removedKnowledge: number }>('/api/materials', { method: 'DELETE' }),
}
