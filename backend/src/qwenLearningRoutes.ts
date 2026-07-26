import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole, type AuthenticatedRequest } from './auth.js'
import {
  curriculumPrompt,
  fixedTextbookVersions,
  subjectValues,
  type SupportedSubject,
} from './curriculum.js'
import { store } from './store.js'
import { createLearningAssetKey, createReadUrl, isR2Ready, putObjectBuffer } from './r2Native.js'

const router = Router()
const studentOnly = [requireAuth, requireRole('student')] as const
const timeoutMs = Math.max(30_000, Number(process.env.AI_TIMEOUT_MS || 180_000))


type SavedImage = { key: string; url: string; contentType: string }

function parseImageDataUrl(value: string) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(value)
  if (!match) throw new Error('图片格式无效，只支持 PNG、JPG、JPEG 或 WEBP')
  const rawContentType = match[1]!
  const contentType = rawContentType === 'image/jpg' ? 'image/jpeg' : rawContentType
  const buffer = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64')
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) {
    throw new Error('单张图片必须小于 20 MB')
  }
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  return { buffer, contentType, extension }
}

async function saveLearningImage(
  studentId: string,
  value: string,
  kind: 'question' | 'paper',
): Promise<SavedImage> {
  if (!isR2Ready()) throw new Error('Render 中的 R2 环境变量尚未配置完整')
  const parsed = parseImageDataUrl(value)
  const key = createLearningAssetKey(studentId, kind, parsed.extension)
  await putObjectBuffer(key, parsed.buffer, parsed.contentType)
  return { key, contentType: parsed.contentType, url: createReadUrl(key, 1800) }
}

const asyncRoute = (
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>,
) => (req: Request, res: Response, next: NextFunction) => {
  void handler(req as AuthenticatedRequest, res).catch(next)
}

const subjectSchema = z.enum(subjectValues)
const questionSchema = z.object({
  subject: subjectSchema,
  imageDataUrl: z.string().min(30),
  fileName: z.string().optional(),
})
const paperSchema = z.object({
  subject: subjectSchema,
  imageDataUrls: z.array(z.string().min(30)).min(1).max(12),
})
const explainSchema = z.object({
  subject: subjectSchema,
  content: z.string().min(1).max(40_000),
  correctAnswer: z.string().optional(),
})
const simulationSchema = z.object({
  subject: subjectSchema,
  points: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  count: z.number().int().min(1).max(20).default(5),
})

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const indexes = ['{', '[']
    .map((character) => cleaned.indexOf(character))
    .filter((index) => index >= 0)
  if (!indexes.length) throw new Error('Qwen 未返回 JSON')
  return JSON.parse(cleaned.slice(Math.min(...indexes))) as unknown
}

async function qwenJson(input: {
  model: string
  messages: unknown[]
  maxTokens?: number
}) {
  const apiKey = (process.env.QWEN_API_KEY || process.env.AI_API_KEY || '').trim()
  if (!apiKey) throw new Error('Render 尚未配置 QWEN_API_KEY')
  const baseUrl = (
    process.env.QWEN_API_BASE_URL ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '')

  const run = async (withFormat: boolean) => {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: input.messages,
      stream: false,
      temperature: 0.15,
      max_tokens: input.maxTokens || 12_000,
      enable_thinking: true,
    }
    if (withFormat) body.response_format = { type: 'json_object' }

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
      throw Object.assign(
        new Error(`Qwen 返回 ${response.status}: ${(await response.text()).slice(0, 800)}`),
        { status: response.status },
      )
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('Qwen 返回空内容')
    return extractJson(content)
  }

  try {
    return await run(true)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 400 && status !== 422) throw error
    return run(false)
  }
}

async function knowledgeContext(
  studentId: string,
  subject: SupportedSubject,
  keywords: string[],
) {
  const records = await store.listRecords(studentId, 'knowledge-items')
  const normalizedKeywords = keywords.map((item) => item.trim()).filter(Boolean)
  const items = records
    .map((record) => record.payload as Record<string, unknown>)
    .filter((item) => item.subject === subject)
    .map((item) => ({
      title: String(item.title || ''),
      chapter: String(item.chapter || ''),
      knowledgePoint: String(item.knowledgePoint || ''),
      content: String(item.content || ''),
      answer: String(item.answer || ''),
      explanation: String(item.explanation || ''),
    }))
    .sort((left, right) => {
      const leftText = `${left.title}${left.chapter}${left.knowledgePoint}${left.content}`
      const rightText = `${right.title}${right.chapter}${right.knowledgePoint}${right.content}`
      const leftScore = normalizedKeywords.filter((keyword) => leftText.includes(keyword)).length
      const rightScore = normalizedKeywords.filter((keyword) => rightText.includes(keyword)).length
      return rightScore - leftScore
    })
    .slice(0, 10)

  if (!items.length) return '当前没有已上传教材知识，请严格按固定教材版本分析。'
  return items.map((item, index) => [
    `【教材知识 ${index + 1}】${item.chapter} / ${item.knowledgePoint}`,
    item.title,
    item.content,
    item.answer,
    item.explanation,
  ].filter(Boolean).join('\n')).join('\n\n')
}

router.post('/ocr/question', ...studentOnly, asyncRoute(async (req, res) => {
  const input = questionSchema.parse(req.body)
  const savedImage = await saveLearningImage(req.user!.id, input.imageDataUrl, 'question')
  const context = await knowledgeContext(req.user!.id, input.subject, [])
  const result = await qwenJson({
    model: process.env.QWEN_VISION_MODEL || 'qwen3.7-plus',
    messages: [
      {
        role: 'system',
        content: [
          '你是家庭高中学习系统的拍题核心模型，不是单纯 OCR。',
          curriculumPrompt,
          '需要理解题干、公式、图形、表格、题目条件和考查目的。',
          '结合用户上传教材知识判断章节与知识点。',
          '只返回 JSON：content,chapter,knowledgePointName,correctAnswer,questionFormat,confidence。',
          'questionFormat 只能为选择题、填空题、判断题、解答题、默写题。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `科目：${input.subject}\n教材：${fixedTextbookVersions[input.subject]}\n请完整理解图片后输出结构化结果。`,
          },
          { type: 'image_url', image_url: { url: savedImage.url } },
        ],
      },
    ],
  })
  res.json({ ...(result as Record<string, unknown>), imageKey: savedImage.key })
}))

router.post('/ocr/paper', ...studentOnly, asyncRoute(async (req, res) => {
  const input = paperSchema.parse(req.body)
  const savedImages = await Promise.all(
    input.imageDataUrls.map((value) => saveLearningImage(req.user!.id, value, 'paper')),
  )
  const context = await knowledgeContext(req.user!.id, input.subject, [])
  const result = await qwenJson({
    model: process.env.QWEN_VISION_MODEL || 'qwen3.7-plus',
    maxTokens: 20_000,
    messages: [
      {
        role: 'system',
        content: [
          '你是高中整张试卷深度分析模型。',
          curriculumPrompt,
          '按图片顺序识别试卷，结合教材知识分析每题。',
          '只返回 JSON：{"questions":[...]}。',
          '每题字段：id,questionNo,subject,knowledgePointName,knowledgePointId,fullScore,score,isCorrect,errorCause,content,correctAnswer,studentAnswer。',
          'errorCause 只能为：知识点不会、概念理解错误、公式记忆错误、审题错误、计算错误、解题思路错误、步骤遗漏、粗心、时间不足。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `科目：${input.subject}\n教材：${fixedTextbookVersions[input.subject]}\n请完成整卷识别、判分和错因分析。`,
          },
          ...savedImages.map(({ url }) => ({
            type: 'image_url',
            image_url: { url },
          })),
        ],
      },
    ],
  }) as { questions?: unknown[] }
  if (!Array.isArray(result.questions)) throw new Error('Qwen 未返回 questions')
  res.json(result.questions.map((question) => ({ ...(question as Record<string, unknown>), sourceImageKeys: savedImages.map((item) => item.key) })))
}))

router.post('/ai/explain', ...studentOnly, asyncRoute(async (req, res) => {
  const input = explainSchema.parse(req.body)
  const context = await knowledgeContext(
    req.user!.id,
    input.subject,
    [input.content.slice(0, 80)],
  )
  const result = await qwenJson({
    model: process.env.QWEN_TEXT_MODEL || 'qwen3.7-plus',
    messages: [
      {
        role: 'system',
        content: [
          '你是家庭高中 AI 家教。',
          curriculumPrompt,
          '优先引用用户上传教材知识，不得脱离固定教材版本。',
          '先判断学生可能卡住的原因，再用生活化例子和分步提示讲解。',
          '只返回 JSON：knowledgePoints:string[]、thinking:string、steps:{title,content}[]、finalAnswer:string、commonMistakes:string[]、lifeExample:string、instantCheck:{question,answer,explanation}。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `科目：${input.subject}`,
          `教材：${fixedTextbookVersions[input.subject]}`,
          `题目：${input.content}`,
          `参考答案：${input.correctAnswer || '请自行判断'}`,
        ].join('\n'),
      },
    ],
  })
  res.json(result)
}))

router.post('/ai/simulation', ...studentOnly, asyncRoute(async (req, res) => {
  const input = simulationSchema.parse(req.body)
  const names = input.points.map((point) => point.name)
  const context = await knowledgeContext(req.user!.id, input.subject, names)
  const result = await qwenJson({
    model: process.env.QWEN_TEXT_MODEL || 'qwen3.7-plus',
    messages: [
      {
        role: 'system',
        content: [
          '你是高中针对性训练题生成器。',
          curriculumPrompt,
          '题目必须来自固定教材范围，并优先依据用户上传教材知识。',
          '只返回 JSON：{"questions":[...]}。',
          '每题字段：id,subject,knowledgePointId,knowledgePointName,content,format,options,correctAnswer,explanation,sourceType。',
          'sourceType 固定 ai_generated。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: `科目：${input.subject}\n教材：${fixedTextbookVersions[input.subject]}\n知识点：${names.join('、') || '基础知识'}\n题量：${input.count}`,
      },
    ],
  }) as { questions?: Array<Record<string, unknown>> }
  if (!Array.isArray(result.questions)) throw new Error('Qwen 未返回训练题')
  res.json(result.questions.map((question) => ({
    ...question,
    id: String(question.id || randomUUID()),
    subject: input.subject,
    sourceType: 'ai_generated',
  })))
}))

export const qwenLearningRouter = router
