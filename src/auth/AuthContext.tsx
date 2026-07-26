import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser, UserRole } from '../types'
import { AuthContext, type AuthContextValue } from './AuthContextObject'
import { authApi } from '../services/authApi'

function readCachedUser(expectedRole: UserRole): AuthUser | null {
  try {
    const raw = localStorage.getItem(`aixuexi:${expectedRole}:auth-user`)
    if (!raw) return null
    const user = JSON.parse(raw) as AuthUser
    return user?.role === expectedRole ? user : null
  } catch {
    return null
  }
}

export function AuthProvider({ children, expectedRole }: { children: ReactNode; expectedRole: UserRole }) {
  const initialUser = readCachedUser(expectedRole)
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [status, setStatus] = useState<AuthContextValue['status']>(initialUser ? 'authenticated' : 'loading')
  const cacheKey = `aixuexi:${expectedRole}:auth-user`

  const logout = useCallback(() => {
    authApi.clearSession()
    localStorage.removeItem(cacheKey)
    setUser(null)
    setStatus('anonymous')
  }, [cacheKey])

  useEffect(() => {
    const restore = async () => {
      if (!authApi.hasToken()) {
        localStorage.removeItem(cacheKey)
        setUser(null)
        setStatus('anonymous')
        return
      }
      try {
        const result = await authApi.me()
        if (!result.user || result.user.role !== expectedRole) return logout()
        localStorage.setItem(cacheKey, JSON.stringify(result.user))
        setUser(result.user)
        setStatus('authenticated')
      } catch {
        // Render 冷启动或短暂断网时保留已缓存登录，不再清空成白页。
        if (readCachedUser(expectedRole)) setStatus('authenticated')
        else logout()
      }
    }
    void restore()
    window.addEventListener('aixuexi:auth-expired', logout)
    return () => window.removeEventListener('aixuexi:auth-expired', logout)
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

  const register = async (input: { email: string; password: string; displayName: string }) => {
    const result = await authApi.register(input)
    if (result.user.role !== expectedRole) throw new Error('账号创建异常')
    authApi.saveSession(result)
    localStorage.setItem(cacheKey, JSON.stringify(result.user))
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }

  return <AuthContext.Provider value={{ user, status, login, register, logout }}>{children}</AuthContext.Provider>
}
