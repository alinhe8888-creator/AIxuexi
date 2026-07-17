import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../types'
import { LoadingState } from '../components/ui'
import { useAuth } from './useAuth'

export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className="full-screen-state"><LoadingState text="正在确认登录状态…" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) return <Navigate to={user.role === 'parent' ? '/parent' : '/'} replace />
  return children
}
