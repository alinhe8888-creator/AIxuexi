import type { KnowledgeItem } from '../types'
import {
  FIXED_TEXTBOOK_VERSIONS,
  type ResourceKind,
  type SupportedSubject,
} from '../config/curriculum'
import { ApiError, apiRequest } from './apiClient'

export type MaterialImportStatus = 'queued' | 'extracting' | 'analyzing' | 'ready' | 'failed'

export interface MaterialImportJob {
  id: string
  key: string
  fileName: string
  subject?: SupportedSubject
  grade?: '高一' | '高二' | '高三'
  textbookVersion?: string
  bookId?: string
  bookTitle?: string
  resourceKind: ResourceKind
  sourceName: string
  sourceUrl?: string
  sourceType: 'user_upload' | 'open_resource'
  containerType: 'zip' | 'document'
  contentType: string
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
  models: { qwen: boolean }
  remoteImport: boolean
  supported: string[]
}

export interface MaterialMetadata {
  subject?: SupportedSubject
  grade?: '高一' | '高二' | '高三'
  bookId?: string
  bookTitle?: string
  resourceKind?: ResourceKind
  sourceName?: string
}

function uploadToR2(
  uploadUrl: string,
  headers: Record<string, string>,
  file: File,
  onProgress?: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.timeout = 20 * 60_000
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }
      reject(new ApiError(`R2 上传失败（${xhr.status}）`, xhr.status))
    }
    xhr.onerror = () => reject(new ApiError('R2 上传失败，请检查储存桶 CORS', 0))
    xhr.ontimeout = () => reject(new ApiError('R2 上传超时', 0))
    xhr.onabort = () => reject(new ApiError('上传已取消', 0))
    xhr.send(file)
  })
}

async function uploadZip(file: File, metadata: MaterialMetadata, onProgress?: (value: number) => void): Promise<MaterialImportJob> {
  if (!file.name.toLowerCase().endsWith('.zip')) throw new ApiError('只支持 ZIP 压缩包', 400)

  const presigned = await apiRequest<{ key: string; uploadUrl: string; headers: Record<string, string> }>('/api/materials/presign', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, size: file.size, contentType: file.type || 'application/zip' }),
  })

  await uploadToR2(presigned.uploadUrl, presigned.headers, file, onProgress)

  const result = await apiRequest<{ import: MaterialImportJob }>('/api/materials/imports', {
    method: 'POST',
    timeoutMs: 60_000,
    body: JSON.stringify({
      key: presigned.key,
      fileName: file.name,
      subject: metadata.subject,
      grade: metadata.grade,
      textbookVersion: metadata.subject ? FIXED_TEXTBOOK_VERSIONS[metadata.subject] : undefined,
      bookId: metadata.bookId,
      bookTitle: metadata.bookTitle,
      resourceKind: metadata.resourceKind || 'textbook',
      sourceName: metadata.sourceName || '家庭上传资料',
    }),
  })
  return result.import
}

export const materialApi = {
  status: () => apiRequest<MaterialServiceStatus>('/api/materials/status'),

  listImports: async () => (await apiRequest<{ imports: MaterialImportJob[] }>('/api/materials/imports')).imports,

  getImport: async (id: string) => (await apiRequest<{ import: MaterialImportJob }>(`/api/materials/imports/${id}`)).import,

  searchKnowledge: (filters: {
    subject?: SupportedSubject
    grade?: string
    chapter?: string
    bookId?: string
    resourceKind?: ResourceKind
    keyword?: string
  }) => {
    const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])))
    return apiRequest<KnowledgeItem[]>(`/api/knowledge?${query.toString()}`)
  },

  uploadZip,

  importRemote: async (input: MaterialMetadata & { url: string; fileName?: string }) =>
    (await apiRequest<{ import: MaterialImportJob }>('/api/materials/remote-imports', {
      method: 'POST',
      timeoutMs: 300_000,
      body: JSON.stringify({ ...input, resourceKind: input.resourceKind || 'textbook' }),
    })).import,

  retry: async (id: string) => (await apiRequest<{ import: MaterialImportJob }>(`/api/materials/imports/${id}/retry`, { method: 'POST' })).import,

  remove: (id: string) => apiRequest<{ ok: boolean }>(`/api/materials/imports/${id}`, { method: 'DELETE' }),

  clearAll: () => apiRequest<{ ok: boolean; removedImports: number; removedKnowledge: number }>('/api/materials', { method: 'DELETE' }),
}
