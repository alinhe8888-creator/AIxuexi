import type { AuthUser } from '../types'
import { apiRequest, AUTH_TOKEN_KEY, PORTAL_ROLE } from './apiClient'

const LEGACY_MOCK_USER_KEY = `aixuexi:${PORTAL_ROLE}:mock-user`

export interface AuthResponse { token: string; user: AuthUser }

export const authApi = {
  async login(email: string, password: string) {
    return apiRequest<AuthResponse>(`/api/auth/${PORTAL_ROLE}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      retry: 0,
    })
  },
  async me() {
    return apiRequest<{ user: AuthUser }>('/api/auth/me')
  },
  saveSession(response: AuthResponse) {
    localStorage.removeItem(LEGACY_MOCK_USER_KEY)
    localStorage.setItem(AUTH_TOKEN_KEY, response.token)
  },
  clearSession() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(LEGACY_MOCK_USER_KEY)
  },
  hasToken() {
    return Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
  },
}
