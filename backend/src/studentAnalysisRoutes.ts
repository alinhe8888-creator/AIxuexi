import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole, type AuthenticatedRequest } from './auth.js'
import { config } from './config.js'
import { curriculumPrompt } from './curriculum.js'
import { store } from './store.js'

const router = Router()
const studentOnly = [requireAuth, requireRole('student')] as const
const timeoutMs = config.aiTimeoutMs

const analysisSchema = z.object({
  summary: z.string().min(1),
  currentFocus: z.string().min(1),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.object({
    subject: z.string(),
    chapter: z.string(),
    knowledgePoint: z.string(),
    reason: z.string(),
    priority: z.enum(['高', '中', '低']),
  })).default([]),
  rootCauses: z.array(z.string()).default([]),
  todayTasks: z.array(z.object({
    title: z.string(),
    reason: z.string(),
    minutes: z.number().int().min(5).max(180),
  })).default([]),
  sevenDayPlan: z.array(z.object({
    day: z.string(),
    focus: z.string(),
    tasks: z.array(z.string()),
  })).default([]),
  parentNote: z.string().default(''),
})

type AnalysisBody = z.infer<typeof analysisSchema> & {
  generatedAt: string
  provider: 'qwen' | 'deepseek'
}

const asyncRoute = (
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>,
) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  if (start < 0) throw new Error('模型没有返回 JSON')
  return JSON.parse(cleaned.slice(start)) as unknown
}

async function callAnalysisModel(messages: unknown[]) {
  const deepseekKey = (process.env.DEEPSEEK_API_KEY || '').trim()
  const qwenKey = (process.env.QWEN_API_KEY || process.env.AI_API_KEY || '').trim()
  const provider = deepseekKey ? 'deepseek' : 'qwen'
  const apiKey = deepseekKey || qwenKey
  if (!apiKey) throw new Error('Render 尚未配置 QWEN_API_KEY 或 DEEPSEEK_API_KEY')
  const baseUrl = (
    provider === 'deepseek'
      ? process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com'
      : process.env.QWEN_API_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '')
  const model = provider === 'deepseek'
    ? process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
    : process.env.QWEN_TEXT_MODEL || 'qwen3.7-plus'

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: 0.15,
    max_tokens: 12_000,
    response_format: { type: 'json_object' },
  }
  if (provider === 'qwen') body.enable_thinking = false
  if (provider === 'deepseek') {
    body.thinking = { type: process.env.DEEPSEEK_THINKING === 'disabled' ? 'disabled' : 'enabled' }
    body.reasoning_effort = process.env.DEEPSEEK_REASONING_EFFORT || 'high'
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`${provider === 'qwen' ? 'Qwen' : 'DeepSeek'} 返回 ${response.status}: ${(await response.text()).slice(0, 800)}`)
  }
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('分析模型返回空内容')
  return { provider, value: extractJson(text) } as const
}

router.get('/ai/student-analysis', ...studentOnly, asyncRoute(async (req, res) => {
  const record = await store.getRecord(req.user!.id, 'ai-student-analysis', 'latest')
  res.json({ analysis: record?.payload ?? null })
}))

router.post('/ai/student-analysis', ...studentOnly, asyncRoute(async (req, res) => {
  const snapshot = await store.getSnapshot(req.user!.id)
  if (!snapshot?.snapshot) {
    res.status(409).json({ message: '学习数据尚未同步，请先完成一次拍题、试卷或训练' })
    return
  }
  const knowledge = (await store.listRecords(req.user!.id, 'knowledge-items'))
    .slice(0, 120)
    .map((record) => record.payload)
  const compactSnapshot = JSON.stringify(snapshot.snapshot).slice(0, 180_000)
  const compactKnowledge = JSON.stringify(knowledge).slice(0, 100_000)
  const result = await callAnalysisModel([
    {
      role: 'system',
      content: [
        '你是只服务一个家庭的高中学习分析模型。',
        curriculumPrompt,
        '根据真实学习快照、错题、试卷、训练、复习和用户上传教材知识分析。',
        '不得虚构成绩或学习记录。数据不足时明确说明。',
        '输出 JSON：summary,currentFocus,strengths,weaknesses,rootCauses,todayTasks,sevenDayPlan,parentNote。',
        'weaknesses 每项含 subject,chapter,knowledgePoint,reason,priority（高/中/低）。',
        'todayTasks 每项含 title,reason,minutes。sevenDayPlan 恰好 7 项，每项含 day,focus,tasks。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `学习快照：\n${compactSnapshot}\n\n教材知识摘要：\n${compactKnowledge}`,
    },
  ])
  const parsed = analysisSchema.parse(result.value)
  const analysis: AnalysisBody = {
    ...parsed,
    provider: result.provider,
    generatedAt: new Date().toISOString(),
  }
  await store.upsertRecord(req.user!.id, 'ai-student-analysis', 'latest', analysis)
  res.json({ analysis })
}))

export const studentAnalysisRouter = router
