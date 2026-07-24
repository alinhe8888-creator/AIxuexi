import type { AuthUser } from '../types'
import { apiRequest, AUTH_TOKEN_KEY, PORTAL_ROLE, USE_MOCK_API } from './apiClient'

const AUTH_USER_KEY = `aixuexi:${PORTAL_ROLE}:auth-user`

export interface AuthResponse { token: string; user: AuthUser }

const mockResponse = (input: { email: string; displayName?: string }): AuthResponse => ({
  token: `mock-${PORTAL_ROLE}-token`,
  user: {
    id: `mock-${PORTAL_ROLE}-1`,
    email: input.email,
    displayName: input.displayName || (PORTAL_ROLE === 'parent' ? '家长用户' : '学生用户'),
    role: PORTAL_ROLE,
  },
})

const readCachedUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) as AuthUser : null
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export const authApi = {
  async login(email: string, password: string) {
    if (USE_MOCK_API) return mockResponse({ email })
    return apiRequest<AuthResponse>(`/api/auth/${PORTAL_ROLE}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      retry: 0,
    })
  },

  async register(_input: { email: string; password: string; displayName: string }): Promise<AuthResponse> {
    throw new Error('本系统为家庭自用，已关闭公开注册')
  },

  async me() {
    if (USE_MOCK_API) return { user: readCachedUser() }
    return apiRequest<{ user: AuthUser }>('/api/auth/me')
  },

  saveSession(response: AuthResponse) {
    localStorage.setItem(AUTH_TOKEN_KEY, response.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(response.user))
  },

  clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  },

  hasToken() {
    return Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
  },

  getCachedUser() {
    return readCachedUser()
  },

  cacheUser(user: AuthUser) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  },
}
