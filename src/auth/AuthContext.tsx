import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser, UserRole } from '../types'
import { AuthContext, type AuthContextValue } from './AuthContextObject'
import { authApi } from '../services/authApi'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  const logout = useCallback(() => {
    authApi.clearSession()
    setUser(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    const restore = async () => {
      if (!authApi.hasToken()) {
        setStatus('anonymous')
        return
      }
      try {
        const result = await authApi.me()
        if (!result.user) return logout()
        setUser(result.user)
        setStatus('authenticated')
      } catch {
        logout()
      }
    }
    void restore()
    window.addEventListener('aixuexi:auth-expired', logout)
    return () => window.removeEventListener('aixuexi:auth-expired', logout)
  }, [logout])

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    authApi.saveSession(result)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }

  const register = async (input: { email: string; password: string; displayName: string; role: UserRole }) => {
    const result = await authApi.register(input)
    authApi.saveSession(result)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }

  const value = useMemo(() => ({ user, status, login, register, logout }), [user, status, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
