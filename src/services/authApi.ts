import type { AuthUser } from '../types'
import { apiRequest, AUTH_TOKEN_KEY, PORTAL_ROLE, USE_MOCK_API } from './apiClient'

const MOCK_USER_KEY = `aixuexi:${PORTAL_ROLE}:mock-user`

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

export const authApi = {
  async login(email: string, password: string) {
    if (USE_MOCK_API) return mockResponse({ email })
    return apiRequest<AuthResponse>(`/api/auth/${PORTAL_ROLE}/login`, { method: 'POST', body: JSON.stringify({ email, password }), retry: 0 })
  },
  async register(input: { email: string; password: string; displayName: string }) {
    if (USE_MOCK_API) return mockResponse(input)
    return apiRequest<AuthResponse>(`/api/auth/${PORTAL_ROLE}/register`, { method: 'POST', body: JSON.stringify(input), retry: 0 })
  },
  async me() {
    if (USE_MOCK_API) {
      const raw = localStorage.getItem(MOCK_USER_KEY)
      return { user: raw ? JSON.parse(raw) as AuthUser : null }
    }
    return apiRequest<{ user: AuthUser }>('/api/auth/me')
  },
  saveSession(response: AuthResponse) {
    localStorage.setItem(AUTH_TOKEN_KEY, response.token)
    if (USE_MOCK_API) localStorage.setItem(MOCK_USER_KEY, JSON.stringify(response.user))
  },
  clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(MOCK_USER_KEY)
  },
  hasToken() {
    return Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
  },
}
