import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthUser, UserRole } from '../types'

import { AuthContext, type AuthContextValue } from './AuthContextObject'
import { ApiError } from '../services/apiClient'
import { authApi } from '../services/authApi'

export function AuthProvider({ children, expectedRole }: { children: ReactNode; expectedRole: UserRole }) {
  const cachedUser = authApi.hasToken() ? authApi.getCachedUser() : null
  const validCachedUser = cachedUser?.role === expectedRole ? cachedUser : null
  const [user, setUser] = useState<AuthUser | null>(validCachedUser)
  const [status, setStatus] = useState<AuthContextValue['status']>(validCachedUser ? 'authenticated' : 'loading')
  const verifyingRef = useRef(false)
  const lastVerifiedAtRef = useRef(0)

  const logout = useCallback(() => {
    authApi.clearSession()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const verifySession = useCallback(async (force = false) => {
    if (!authApi.hasToken()) {
      setUser(null)
      setStatus('anonymous')
      return
    }
    if (verifyingRef.current) return
    if (!force && Date.now() - lastVerifiedAtRef.current < 30_000) return

    verifyingRef.current = true
    try {
      const result = await authApi.me()
      if (!result.user || result.user.role !== expectedRole) {
        logout()
        return
      }
      authApi.cacheUser(result.user)
      setUser(result.user)
      setStatus('authenticated')
      lastVerifiedAtRef.current = Date.now()
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        logout()
        return
      }
      // Render 冷启动或短暂断网时保留本地已验证身份，避免家长端首次进入出现空白。
      const cached = authApi.getCachedUser()
      if (cached?.role === expectedRole) {
        setUser(cached)
        setStatus('authenticated')
      } else {
        setStatus('anonymous')
      }
    } finally {
      verifyingRef.current = false
    }
  }, [expectedRole, logout])

  useEffect(() => {
    void verifySession(true)

    const onFocus = () => void verifySession()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void verifySession()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('aixuexi:auth-expired', logout)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('aixuexi:auth-expired', logout)
    }
  }, [logout, verifySession])

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    if (result.user.role !== expectedRole) throw new Error('该账号不属于当前登录入口')
    authApi.saveSession(result)
    setUser(result.user)
    setStatus('authenticated')
    lastVerifiedAtRef.current = Date.now()
    return result.user
  }

  const register = async (_input: { email: string; password: string; displayName: string }) => {
    throw new Error('本系统为家庭自用，已关闭公开注册')
  }

  return <AuthContext.Provider value={{ user, status, login, register, logout }}>{children}</AuthContext.Provider>
}
