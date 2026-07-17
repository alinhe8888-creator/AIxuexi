import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { config } from './config.js'

export type UserRole = 'student' | 'parent'
export interface AuthUser { id: string; email: string; displayName: string; role: UserRole }
export interface AuthenticatedRequest extends Request { user?: AuthUser }

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '7d', issuer: 'aixuexi-api' })
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) return res.status(401).json({ message: '请先登录' })
  try {
    req.user = jwt.verify(token, config.jwtSecret, { issuer: 'aixuexi-api' }) as AuthUser
    return next()
  } catch {
    return res.status(401).json({ message: '登录状态已失效，请重新登录' })
  }
}

export function requireRole(role: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: '请先登录' })
    if (req.user.role !== role) return res.status(403).json({ message: '无权访问该功能' })
    return next()
  }
}
