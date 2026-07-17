const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
export const API_BASE_URL = rawBaseUrl?.replace(/\/$/, '') || ''
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'
export const AUTH_TOKEN_KEY = 'aixuexi:auth-token'

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

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export async function apiRequest<T>(path: string, options: RequestInit & { timeoutMs?: number; retry?: number } = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('尚未配置 VITE_API_BASE_URL', 0)
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const { timeoutMs = 25_000, retry = options.method && options.method !== 'GET' ? 0 : 2, ...requestOptions } = options

  for (let attempt = 0; attempt <= retry; attempt += 1) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
        ...requestOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...requestOptions.headers,
        },
      })
      const payload = await response.json().catch(() => null)
      if (response.status === 401) window.dispatchEvent(new CustomEvent('aixuexi:auth-expired'))
      if (!response.ok) {
        const retryable = [502, 503, 504].includes(response.status) && attempt < retry
        if (retryable) {
          await sleep(700 * (attempt + 1))
          continue
        }
        throw new ApiError(payload?.message || `请求失败（${response.status}）`, response.status, payload)
      }
      return payload as T
    } catch (error) {
      const retryable = (error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')) && attempt < retry
      if (retryable) {
        await sleep(700 * (attempt + 1))
        continue
      }
      if (error instanceof ApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('后端响应超时，请稍后重试', 0)
      throw new ApiError(error instanceof Error ? error.message : '网络连接失败', 0)
    } finally {
      window.clearTimeout(timer)
    }
  }
  throw new ApiError('请求失败', 0)
}
