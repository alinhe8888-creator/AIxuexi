import type { UserRole } from '../types'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
export const API_BASE_URL = rawBaseUrl?.replace(/\/$/, '') || ''
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false'
export const ALLOW_API_FALLBACK = import.meta.env.VITE_ALLOW_API_FALLBACK !== 'false'
export const PORTAL_ROLE: UserRole = import.meta.env.VITE_PORTAL_ROLE === 'parent' ? 'parent' : 'student'
export const AUTH_TOKEN_KEY = `aixuexi:${PORTAL_ROLE}:auth-token`

export class ApiError extends Error {
  status: number
  details?: unknown
  requestId?: string

  constructor(message: string, status: number, details?: unknown, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.requestId = requestId
  }
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))
const isIdempotent = (method?: string) => !method || ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())

export async function apiRequest<T>(path: string, options: RequestInit & { timeoutMs?: number; retry?: number } = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError('尚未配置 VITE_API_BASE_URL', 0)
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const { timeoutMs = 60_000, retry = isIdempotent(options.method) ? 2 : 0, ...requestOptions } = options

  for (let attempt = 0; attempt <= retry; attempt += 1) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    const requestId = crypto.randomUUID()
    try {
      const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
        ...requestOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...requestOptions.headers,
        },
      })
      const contentType = response.headers.get('content-type') || ''
      const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => '')
      const responseRequestId = response.headers.get('x-request-id') || requestId
      if (response.status === 401) window.dispatchEvent(new CustomEvent('aixuexi:auth-expired'))
      if (!response.ok) {
        const retryable = [429, 502, 503, 504].includes(response.status) && attempt < retry
        if (retryable) {
          await sleep(Math.min(3000, 700 * (attempt + 1)))
          continue
        }
        const message = typeof payload === 'object' && payload && 'message' in payload ? String(payload.message) : `请求失败（${response.status}）`
        throw new ApiError(message, response.status, payload, responseRequestId)
      }
      return payload as T
    } catch (error) {
      const networkError = error instanceof TypeError || (error instanceof DOMException && error.name === 'AbortError')
      if (networkError && attempt < retry) {
        await sleep(Math.min(3000, 700 * (attempt + 1)))
        continue
      }
      if (error instanceof ApiError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('后端响应超时，请稍后重试', 0, undefined, requestId)
      throw new ApiError(error instanceof Error ? error.message : '网络连接失败', 0, undefined, requestId)
    } finally {
      window.clearTimeout(timer)
    }
  }
  throw new ApiError('请求失败', 0)
}
