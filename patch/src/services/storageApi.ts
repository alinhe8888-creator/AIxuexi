import { apiRequest } from './apiClient'

export type StoragePurpose = 'question' | 'paper' | 'material' | 'avatar' | 'report'

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

interface PresignResponse {
  key: string
  uploadUrl: string
  expiresIn: number
  headers: Record<string, string>
}

interface CompleteResponse {
  ok: boolean
  key: string
  size: number
  contentType: string
  etag: string
}

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('无法读取待上传文件')
  return response.blob()
}

const inferFileName = (blob: Blob, fileName?: string) => {
  if (fileName?.trim()) return fileName.trim()
  const extension = blob.type === 'image/png'
    ? 'png'
    : blob.type === 'image/webp'
      ? 'webp'
      : blob.type === 'application/pdf'
        ? 'pdf'
        : 'jpg'
  return `upload-${Date.now()}.${extension}`
}

const putWithProgress = (
  uploadUrl: string,
  blob: Blob,
  headers: Record<string, string>,
  onProgress?: (progress: UploadProgress) => void,
) => new Promise<void>((resolve, reject) => {
  const request = new XMLHttpRequest()
  request.open('PUT', uploadUrl)
  Object.entries(headers).forEach(([key, value]) => request.setRequestHeader(key, value))
  request.upload.onprogress = (event) => {
    if (!event.lengthComputable) return
    onProgress?.({
      loaded: event.loaded,
      total: event.total,
      percent: Math.round((event.loaded / event.total) * 100),
    })
  }
  request.onerror = () => reject(new Error('上传到 R2 失败，请检查网络或 R2 CORS 设置'))
  request.onabort = () => reject(new Error('上传已取消'))
  request.onload = () => {
    if (request.status >= 200 && request.status < 300) resolve()
    else reject(new Error(`R2 上传失败（HTTP ${request.status}）`))
  }
  request.send(blob)
})

export const storageApi = {
  async status() {
    return apiRequest<{ configured: boolean; maxUploadMb: number }>('/api/storage/status')
  },

  async uploadBlob(input: {
    blob: Blob
    fileName?: string
    purpose: StoragePurpose
    onProgress?: (progress: UploadProgress) => void
  }) {
    const fileName = inferFileName(input.blob, input.fileName)
    const contentType = input.blob.type || 'application/octet-stream'
    const ticket = await apiRequest<PresignResponse>('/api/storage/presign', {
      method: 'POST',
      body: JSON.stringify({
        fileName,
        contentType,
        size: input.blob.size,
        purpose: input.purpose,
      }),
      retry: 0,
    })

    await putWithProgress(ticket.uploadUrl, input.blob, ticket.headers, input.onProgress)
    const completed = await apiRequest<CompleteResponse>('/api/storage/complete', {
      method: 'POST',
      body: JSON.stringify({ key: ticket.key }),
      retry: 1,
    })
    return completed
  },

  async uploadDataUrl(input: {
    dataUrl: string
    fileName?: string
    purpose: StoragePurpose
    onProgress?: (progress: UploadProgress) => void
  }) {
    const blob = await dataUrlToBlob(input.dataUrl)
    return this.uploadBlob({
      blob,
      fileName: input.fileName,
      purpose: input.purpose,
      onProgress: input.onProgress,
    })
  },

  async getSignedUrl(key: string) {
    const query = new URLSearchParams({ key })
    return apiRequest<{ url: string; expiresIn: number }>(`/api/storage/url?${query}`)
  },

  async remove(key: string) {
    return apiRequest<{ ok: boolean }>('/api/storage/object', {
      method: 'DELETE',
      body: JSON.stringify({ key }),
      retry: 0,
    })
  },
}
