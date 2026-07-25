import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser, UserRole } from '../types'
import { AuthContext, type AuthContextValue } from './AuthContextObject'
import { authApi } from '../services/authApi'

export function AuthProvider({ children, expectedRole }: { children: ReactNode; expectedRole: UserRole }) {
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
        if (!result.user || result.user.role !== expectedRole) return logout()
        setUser(result.user)
        setStatus('authenticated')
      } catch {
        logout()
      }
    }
    void restore()
    window.addEventListener('aixuexi:auth-expired', logout)
    return () => window.removeEventListener('aixuexi:auth-expired', logout)
  }, [expectedRole, logout])

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    if (result.user.role !== expectedRole) throw new Error('该账号不属于当前登录入口')
    authApi.saveSession(result)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }

  const register = async (input: { email: string; password: string; displayName: string }) => {
    const result = await authApi.register(input)
    if (result.user.role !== expectedRole) throw new Error('账号角色创建异常')
    authApi.saveSession(result)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }

  return <AuthContext.Provider value={{ user, status, login, register, logout }}>{children}</AuthContext.Provider>
}
