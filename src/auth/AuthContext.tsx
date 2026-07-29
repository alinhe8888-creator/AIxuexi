import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser, UserRole } from '../types'
import { AuthContext, type AuthContextValue } from './AuthContextObject'
import { authApi } from '../services/authApi'

export function AuthProvider({ children, expectedRole }: { children: ReactNode; expectedRole: UserRole }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const cacheKey = `aixuexi:${expectedRole}:auth-user`

  const logout = useCallback(() => {
    authApi.clearSession()
    localStorage.removeItem(cacheKey)
    setUser(null)
    setStatus('anonymous')
  }, [cacheKey])

  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      if (!authApi.hasToken()) {
        if (!cancelled) logout()
        return
      }
      try {
        const result = await authApi.me()
        if (!result.user || result.user.role !== expectedRole) {
          if (!cancelled) logout()
          return
        }
        if (cancelled) return
        localStorage.setItem(cacheKey, JSON.stringify(result.user))
        setUser(result.user)
        setStatus('authenticated')
      } catch {
        if (!cancelled) logout()
      }
    }
    void restore()
    window.addEventListener('aixuexi:auth-expired', logout)
    return () => {
      cancelled = true
      window.removeEventListener('aixuexi:auth-expired', logout)
    }
  }, [cacheKey, expectedRole, logout])

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    if (result.user.role !== expectedRole) throw new Error('账号入口不正确')
    authApi.saveSession(result)
    localStorage.setItem(cacheKey, JSON.stringify(result.user))
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }


  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
}
