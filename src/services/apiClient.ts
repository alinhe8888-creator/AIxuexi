const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
export const API_BASE_URL = rawBaseUrl?.replace(/\/$/, '') || ''
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('尚未配置 VITE_API_BASE_URL', 0)
  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(payload?.message || `请求失败（${response.status}）`, response.status, payload)
  }
  return payload as T
}
