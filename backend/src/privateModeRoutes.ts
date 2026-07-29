import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireAuth, requireRole, type AuthenticatedRequest } from './auth.js'
import { store } from './store.js'
import { buildParentDashboard } from './summary.js'

const router = Router()
const parentOnly = [requireAuth, requireRole('parent')] as const

const asyncRoute = (
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>,
) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

function familyConfigurationError(message: string) {
  const error = new Error(message) as Error & { status: number; expose: boolean }
  error.status = 503
  error.expose = true
  return error
}

async function ensureFamilyStudent(parentId: string) {
  const email = (process.env.FAMILY_STUDENT_EMAIL || process.env.PRIVATE_STUDENT_EMAIL || '').trim().toLowerCase()
  if (!email) throw familyConfigurationError('家庭学生账号尚未配置')
  const student = await store.findUserByEmail(email)
  if (!student || student.role !== 'student') {
    throw familyConfigurationError('家庭学生账号配置无效')
  }
  await store.linkParentToStudent(parentId, student.id)
  return student.id
}

router.post('/parent/link', ...parentOnly, asyncRoute(async (req, res) => {
  const studentId = await ensureFamilyStudent(req.user!.id)
  res.json({ ok: true, studentId, automatic: true })
}))

router.get('/parent/children', ...parentOnly, asyncRoute(async (req, res) => {
  await ensureFamilyStudent(req.user!.id)
  res.json({ children: await store.listChildren(req.user!.id) })
}))

router.get(
  '/parent/children/:studentId/dashboard',
  ...parentOnly,
  asyncRoute(async (req, res) => {
    const fixedStudentId = await ensureFamilyStudent(req.user!.id)
    if (String(req.params.studentId) !== fixedStudentId) {
      res.status(403).json({ message: '只能查看固定学习账号' })
      return
    }
    const row = await store.getLinkedStudent(req.user!.id, fixedStudentId)
    if (!row) {
      res.status(404).json({ message: '未找到学习账号' })
      return
    }
    if (!row.snapshot) {
      res.status(409).json({ message: '学习数据尚未同步' })
      return
    }
    res.json({
      dashboard: buildParentDashboard(
        row.snapshot as Record<string, unknown>,
        {
          id: row.id,
          email: row.email,
          displayName: row.displayName,
          lastSyncedAt: row.snapshotUpdatedAt,
        },
      ),
    })
  }),
)

router.delete('/parent/children/:studentId', ...parentOnly, (_req, res) => {
  res.status(403).json({ message: '固定关联不能解除' })
})

export const privateModeRouter = router
