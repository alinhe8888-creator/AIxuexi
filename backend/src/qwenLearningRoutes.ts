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
const timeoutMs = Math.max(60_000, Number(process.env.AI_TIMEOUT_MS || 300_000))


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
  studentAnswer: z.string().max(20_000).optional(),
  preferredStyles: z.array(z.string().max(40)).max(6).default([]),
})
const checkAnswerSchema = z.object({
  subject: subjectSchema,
  content: z.string().min(1).max(40_000),
  correctAnswer: z.string().min(1).max(20_000),
  studentAnswer: z.string().min(1).max(20_000),
  attemptNumber: z.number().int().min(1).max(6),
  methodId: z.string().max(120).default(''),
  methodName: z.string().max(120).default(''),
  methodStyle: z.string().max(40).default('步骤拆解'),
  revealAllowed: z.boolean().default(false),
  transfer: z.boolean().default(false),
})
const gradeSimulationSchema = z.object({
  subject: subjectSchema,
  questions: z.array(z.object({
    id: z.string().min(1).max(200),
    content: z.string().min(1).max(20_000),
    format: z.string().max(40),
    correctAnswer: z.string().min(1).max(20_000),
    studentAnswer: z.string().max(20_000).default(''),
    knowledgePointId: z.string().max(200).default(''),
    knowledgePointName: z.string().max(240).default(''),
  })).min(1).max(30),
})
const questionFormatSchema = z.enum(['选择题', '填空题', '判断题', '解答题', '默写题'])
const simulationSchema = z.object({
  subject: subjectSchema,
  points: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  bookId: z.string().max(120).optional(),
  bookTitle: z.string().max(240).optional(),
  chapter: z.string().max(240).optional(),
  count: z.number().int().min(1).max(30).default(5),
  mode: z.enum(['mini', 'paper', 'sprint']).default('mini'),
  formats: z.array(questionFormatSchema).min(1).max(5).default(['选择题', '填空题', '解答题']),
  difficulty: z.enum(['基础', '中等', '提高', '混合']).default('混合'),
  durationMinutes: z.number().int().min(5).max(180).default(25),
  sourceScopes: z.array(z.string().max(60)).max(8).default(['textbook']),
  examDate: z.string().max(40).optional(),
  sprintFocus: z.string().max(500).optional(),
})
const studyCycleSchema = z.object({
  mode: z.enum(['preview', 'review']),
  subject: subjectSchema,
  bookId: z.string().min(1).max(120),
  bookTitle: z.string().min(1).max(240),
  chapter: z.string().max(240).default(''),
  knowledgePoint: z.string().max(240).default(''),
  customGoal: z.string().max(800).optional(),
  sourceScopes: z.array(z.string().max(60)).max(8).default(['textbook']),
  duration: z.number().int().min(10).max(60).default(25),
  depth: z.enum(['快速', '标准', '深入']).default('标准'),
}).refine((value) => Boolean(value.chapter.trim() || value.knowledgePoint.trim()), {
  message: '章节和知识点至少填写一项',
})

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const indexes = ['{', '[']
    .map((character) => cleaned.indexOf(character))
    .filter((index) => index >= 0)
  if (!indexes.length) throw new Error('Qwen 未返回 JSON')
  return JSON.parse(cleaned.slice(Math.min(...indexes))) as unknown
}

const errorCauses = ['知识点不会', '概念理解错误', '公式记忆错误', '审题错误', '计算错误', '解题思路错误', '步骤遗漏', '粗心', '时间不足'] as const
const explanationStyles = ['启发提问', '生活类比', '图像框架', '公式推导', '步骤拆解', '反例辨析'] as const

function asStringArray(value: unknown, max = 8) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, max) : []
}

function normalizeExplanationResult(raw: unknown, fallbackAnswer: string) {
  const result = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const legacySteps = Array.isArray(result.steps) ? result.steps as Array<Record<string, unknown>> : []
  const rawMethods = Array.isArray(result.methods) ? result.methods as Array<Record<string, unknown>> : []
  const methods = rawMethods.slice(0, 4).map((method, index) => {
    const fallbackStyle = explanationStyles[index % explanationStyles.length] ?? '步骤拆解'
    const styleCandidate = String(method.style || fallbackStyle)
    const style = (explanationStyles as readonly string[]).includes(styleCandidate) ? styleCandidate : fallbackStyle
    const steps = Array.isArray(method.steps)
      ? (method.steps as Array<Record<string, unknown>>).slice(0, 6).map((step, stepIndex) => ({
        title: String(step.title || `第 ${stepIndex + 1} 步`),
        content: String(step.content || ''),
      }))
      : legacySteps.slice(0, 6).map((step, stepIndex) => ({ title: String(step.title || `第 ${stepIndex + 1} 步`), content: String(step.content || '') }))
    return {
      id: String(method.id || `method-${index + 1}`),
      name: String(method.name || `${style}讲法`),
      style,
      bestFor: String(method.bestFor || '适合当前知识点的另一种理解路径'),
      openingQuestion: String(method.openingQuestion || result.thinking || '先说说你卡在哪一步。'),
      hints: asStringArray(method.hints, 5),
      steps,
      checkpointQuestion: String(method.checkpointQuestion || (result.instantCheck as Record<string, unknown> | undefined)?.question || '请用自己的话复述关键步骤。'),
      checkpointAnswer: String(method.checkpointAnswer || (result.instantCheck as Record<string, unknown> | undefined)?.answer || fallbackAnswer),
      checkpointExplanation: String(method.checkpointExplanation || (result.instantCheck as Record<string, unknown> | undefined)?.explanation || ''),
      memoryTip: String(method.memoryTip || '先判断条件，再选择方法，最后回看题目要求。'),
    }
  })
  if (!methods.length) {
    methods.push({
      id: 'method-guided',
      name: '启发式分步讲法',
      style: '启发提问',
      bestFor: '先找到卡点，再逐步补齐思路',
      openingQuestion: String(result.thinking || '题目最先要求你判断什么？'),
      hints: ['圈出已知条件和问题', '写出最直接相关的概念或公式'],
      steps: legacySteps.slice(0, 6).map((step, index) => ({ title: String(step.title || `第 ${index + 1} 步`), content: String(step.content || '') })),
      checkpointQuestion: String((result.instantCheck as Record<string, unknown> | undefined)?.question || '请用自己的话复述解题关键。'),
      checkpointAnswer: String((result.instantCheck as Record<string, unknown> | undefined)?.answer || fallbackAnswer),
      checkpointExplanation: String((result.instantCheck as Record<string, unknown> | undefined)?.explanation || ''),
      memoryTip: '先审题，再定位知识点，再列步骤，最后检查。',
    })
  }
  const diagnosisRaw = (result.diagnosis && typeof result.diagnosis === 'object' ? result.diagnosis : {}) as Record<string, unknown>
  const causeCandidate = String(diagnosisRaw.likelyCause || '知识点不会')
  const likelyCause = (errorCauses as readonly string[]).includes(causeCandidate) ? causeCandidate : '知识点不会'
  const instantRaw = (result.instantCheck && typeof result.instantCheck === 'object' ? result.instantCheck : {}) as Record<string, unknown>
  const recommended = String(result.recommendedMethodId || methods[0]?.id || '')
  return {
    knowledgePoints: asStringArray(result.knowledgePoints, 8),
    diagnosis: {
      likelyCause,
      confidence: Math.max(0, Math.min(1, Number(diagnosisRaw.confidence || 0.7))),
      evidence: String(diagnosisRaw.evidence || '根据题目、原答案和知识点进行初步判断。'),
      firstQuestion: String(diagnosisRaw.firstQuestion || methods[0]?.openingQuestion || '你认为这道题第一步应该做什么？'),
    },
    recommendedMethodId: methods.some((method) => method.id === recommended) ? recommended : (methods[0]?.id || ''),
    methods,
    answerRevealAfterAttempts: 2,
    thinking: String(result.thinking || methods[0]?.openingQuestion || ''),
    steps: legacySteps.slice(0, 8).map((step, index) => ({ title: String(step.title || `第 ${index + 1} 步`), content: String(step.content || '') })),
    finalAnswer: String(result.finalAnswer || fallbackAnswer),
    commonMistakes: asStringArray(result.commonMistakes, 8),
    lifeExample: String(result.lifeExample || ''),
    instantCheck: {
      question: String(instantRaw.question || methods[0]?.checkpointQuestion || '请完成一道迁移题。'),
      answer: String(instantRaw.answer || methods[0]?.checkpointAnswer || fallbackAnswer),
      explanation: String(instantRaw.explanation || methods[0]?.checkpointExplanation || ''),
    },
  }
}

async function aiJson(input: {
  provider: 'vision' | 'text'
  model?: string
  messages: unknown[]
  maxTokens?: number
  enableThinking?: boolean
  requestTimeoutMs?: number
}) {
  const useDeepSeek = input.provider === 'text' && Boolean((process.env.DEEPSEEK_API_KEY || '').trim())
  const apiKey = ((
    useDeepSeek
      ? process.env.DEEPSEEK_API_KEY
      : process.env.QWEN_API_KEY || process.env.AI_API_KEY
  ) ?? '').trim()
  if (!apiKey) {
    throw new Error(useDeepSeek ? 'Render 尚未配置 DEEPSEEK_API_KEY' : 'Render 尚未配置 QWEN_API_KEY')
  }

  const baseUrl = (
    useDeepSeek
      ? process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com'
      : process.env.QWEN_API_BASE_URL || process.env.AI_API_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  ).replace(/\/+$/, '')
  const model = input.model || (
    useDeepSeek
      ? process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
      : input.provider === 'vision'
        ? process.env.QWEN_VISION_MODEL || process.env.AI_VISION_MODEL || 'qwen3.7-plus'
        : process.env.QWEN_TEXT_MODEL || process.env.QWEN_MODEL || process.env.AI_MODEL || 'qwen3.7-plus'
  )

  const run = async (withFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages: input.messages,
      stream: false,
      temperature: 0.15,
      max_tokens: input.maxTokens || 12_000,
    }
    if (useDeepSeek) {
      body.thinking = { type: (input.enableThinking ?? false) ? 'enabled' : 'disabled' }
    } else {
      body.enable_thinking = input.enableThinking ?? false
    }
    if (withFormat) body.response_format = { type: 'json_object' }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.requestTimeoutMs || timeoutMs),
    })

    if (!response.ok) {
      const providerName = useDeepSeek ? 'DeepSeek' : 'Qwen'
      throw Object.assign(
        new Error(`${providerName} 返回 ${response.status}: ${(await response.text()).slice(0, 800)}`),
        { status: response.status },
      )
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error(`${useDeepSeek ? 'DeepSeek' : 'Qwen'} 返回空内容`)
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
  filters: { bookId?: string; chapter?: string; sourceScopes?: string[] } = {},
) {
  const records = await store.listRecords(studentId, 'knowledge-items')
  const normalizedKeywords = keywords.map((item) => item.trim()).filter(Boolean)
  const items = records
    .map((record) => record.payload as Record<string, unknown>)
    .filter((item) => item.subject === subject)
    .filter((item) => !filters.bookId || !item.bookId || item.bookId === filters.bookId)
    .filter((item) => !filters.chapter || !item.chapter || String(item.chapter).includes(filters.chapter) || filters.chapter.includes(String(item.chapter)))
    .filter((item) => {
      if (!filters.sourceScopes?.length) return true
      const kind = String(item.resourceKind || 'textbook')
      if (filters.sourceScopes.includes(kind)) return true
      if (filters.sourceScopes.includes('mistakes') && kind === 'notes') return true
      return false
    })
    .map((item) => ({
      title: String(item.title || ''),
      bookTitle: String(item.bookTitle || ''),
      sourceName: String(item.sourceName || ''),
      resourceKind: String(item.resourceKind || 'textbook'),
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
    `【知识库 ${index + 1}】${item.bookTitle || '家庭资料'} · ${item.chapter} / ${item.knowledgePoint}`,
    `来源：${item.sourceName || item.resourceKind}`,
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
  const result = await aiJson({
    provider: 'vision',
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
  const result = await aiJson({
    provider: 'vision',
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
  if (!Array.isArray(result.questions)) throw new Error('视觉模型未返回 questions')
  res.json(result.questions.map((question) => ({ ...(question as Record<string, unknown>), sourceImageKeys: savedImages.map((item) => item.key) })))
}))

router.post('/ai/explain', ...studentOnly, asyncRoute(async (req, res) => {
  const input = explainSchema.parse(req.body)
  const context = await knowledgeContext(
    req.user!.id,
    input.subject,
    [input.content.slice(0, 120)],
  )
  const raw = await aiJson({
    provider: 'text',
    maxTokens: 14_000,
    messages: [
      {
        role: 'system',
        content: [
          '你是家庭高中 AI 订正教练，不是答案展示器。',
          curriculumPrompt,
          '优先引用用户上传教材知识，不得脱离固定教材版本。',
          '核心规则：学生答错后先诊断卡点，至少提供 3 种彼此不同的讲法；前两次作答都不能直接给最终答案。',
          '讲法必须根据学科和题目灵活变化，可从启发提问、生活类比、图像框架、公式推导、步骤拆解、反例辨析中选择。',
          '每种讲法都要有开场问题、渐进提示、分步过程、检查问题和记忆提示。',
          '只返回 JSON 对象，字段：',
          'knowledgePoints:string[]；',
          'diagnosis:{likelyCause,confidence,evidence,firstQuestion}；',
          'recommendedMethodId:string；',
          'methods:{id,name,style,bestFor,openingQuestion,hints:string[],steps:{title,content}[],checkpointQuestion,checkpointAnswer,checkpointExplanation,memoryTip}[]；',
          'answerRevealAfterAttempts:2；',
          'thinking:string；steps:{title,content}[]；finalAnswer:string；commonMistakes:string[]；lifeExample:string；',
          'instantCheck:{question,answer,explanation}。',
          'likelyCause 只能为：知识点不会、概念理解错误、公式记忆错误、审题错误、计算错误、解题思路错误、步骤遗漏、粗心、时间不足。',
          'style 只能为：启发提问、生活类比、图像框架、公式推导、步骤拆解、反例辨析。',
          '不要在 openingQuestion、hints、thinking 或 methods.steps 中泄露最终答案；steps 只讲判断路径和关键操作，最后数值或结论只放 finalAnswer。',
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
          `学生原答案：${input.studentAnswer || '未填写'}`,
          `内部参考答案：${input.correctAnswer || '请自行判断'}`,
          `学生历史偏好讲法：${input.preferredStyles.join('、') || '暂无，需多样化尝试'}`,
        ].join('\n'),
      },
    ],
  })
  res.json(normalizeExplanationResult(raw, input.correctAnswer || ''))
}))

router.post('/ai/check-answer', ...studentOnly, asyncRoute(async (req, res) => {
  const input = checkAnswerSchema.parse(req.body)
  const context = await knowledgeContext(req.user!.id, input.subject, [input.content.slice(0, 120)])
  const raw = await aiJson({
    provider: 'text',
    maxTokens: 3_500,
    messages: [
      {
        role: 'system',
        content: [
          '你是高中订正流程的答案评估器。',
          curriculumPrompt,
          '需要按语义和关键步骤判断，不能只做字符串匹配。',
          input.transfer ? '当前是迁移检测：判断学生是否真正会用方法解决新题。' : '当前是原题订正：判断学生是否修正了原先错误。',
          input.revealAllowed
            ? '如果仍错误，可以在 revealAnswer 字段给出最终答案；同时指出关键误区。'
            : '严禁泄露最终答案、完整算式或能直接推出答案的句子；只能给针对性提示，并建议重试或换一种讲法。',
          '只返回 JSON：correct:boolean,score:0-100,feedback:string,misconception:string,errorCause:string,nextAction:string,targetedHint:string,suggestedMethodId?:string,revealAnswer?:string。',
          'nextAction 只能为 retry、switch_method、reveal、complete。',
          'errorCause 只能为：知识点不会、概念理解错误、公式记忆错误、审题错误、计算错误、解题思路错误、步骤遗漏、粗心、时间不足。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `科目：${input.subject}`,
          `题目：${input.content}`,
          `内部参考答案：${input.correctAnswer}`,
          `学生答案：${input.studentAnswer}`,
          `第几次作答：${input.attemptNumber}`,
          `当前讲法：${input.methodName || input.methodId || '未指定'}（${input.methodStyle}）`,
          `是否允许揭示答案：${input.revealAllowed ? '允许' : '不允许'}`,
        ].join('\n'),
      },
    ],
  }) as Record<string, unknown>

  const causeCandidate = String(raw.errorCause || '知识点不会')
  const errorCause = (errorCauses as readonly string[]).includes(causeCandidate) ? causeCandidate : '知识点不会'
  const correct = Boolean(raw.correct)
  let nextAction = String(raw.nextAction || (correct ? 'complete' : input.revealAllowed ? 'reveal' : input.attemptNumber === 1 ? 'switch_method' : 'retry'))
  if (!['retry', 'switch_method', 'reveal', 'complete'].includes(nextAction)) nextAction = correct ? 'complete' : input.revealAllowed ? 'reveal' : 'retry'
  if (!input.revealAllowed && nextAction === 'reveal') nextAction = input.attemptNumber === 1 ? 'switch_method' : 'retry'
  const response: Record<string, unknown> = {
    correct,
    score: Math.max(0, Math.min(100, Number(raw.score || (correct ? 100 : 0)))),
    feedback: String(raw.feedback || (correct ? '思路正确，继续做迁移检测。' : '还没有完全解决关键卡点。')),
    misconception: String(raw.misconception || ''),
    errorCause,
    nextAction,
    targetedHint: String(raw.targetedHint || (correct ? '请继续完成一道新题验证。' : '重新检查题目条件与所用概念是否对应。')),
    suggestedMethodId: raw.suggestedMethodId ? String(raw.suggestedMethodId) : undefined,
  }
  if (input.revealAllowed && !correct) response.revealAnswer = String(raw.revealAnswer || input.correctAnswer)
  res.json(response)
}))

router.post('/ai/grade-simulation', ...studentOnly, asyncRoute(async (req, res) => {
  const input = gradeSimulationSchema.parse(req.body)
  const raw = await aiJson({
    provider: 'text',
    maxTokens: Math.max(4_000, Math.min(14_000, input.questions.length * 520)),
    messages: [
      {
        role: 'system',
        content: [
          '你是高中训练批改器。',
          curriculumPrompt,
          '按语义、关键步骤和题型批改，选择题/判断题严格，解答题可按关键步骤给分。',
          '不要返回正确答案和完整解析，避免学生提交后立刻看到答案。',
          '只返回 JSON：{"items":[...]}。',
          '每项字段：id,correct:boolean,score:0-100,feedback:string,errorCause:string。',
          'errorCause 只能为：知识点不会、概念理解错误、公式记忆错误、审题错误、计算错误、解题思路错误、步骤遗漏、粗心、时间不足。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({ subject: input.subject, questions: input.questions }),
      },
    ],
  }) as { items?: Array<Record<string, unknown>> }
  const byId = new Map((raw.items || []).map((item) => [String(item.id || ''), item]))
  const items = input.questions.map((question) => {
    const item = byId.get(question.id) || {}
    const causeCandidate = String(item.errorCause || '知识点不会')
    return {
      id: question.id,
      correct: Boolean(item.correct),
      score: Math.max(0, Math.min(100, Number(item.score || 0))),
      feedback: String(item.feedback || (question.studentAnswer ? '需要进入错题订正流程。' : '未作答。')),
      errorCause: (errorCauses as readonly string[]).includes(causeCandidate) ? causeCandidate : '知识点不会',
    }
  })
  res.json({ items })
}))

router.post('/ai/simulation', ...studentOnly, asyncRoute(async (req, res) => {
  const input = simulationSchema.parse(req.body)
  const names = input.points.map((point) => point.name).filter(Boolean)
  const context = await knowledgeContext(req.user!.id, input.subject, [input.chapter || '', ...names], {
    bookId: input.bookId,
    chapter: input.chapter,
    sourceScopes: input.sourceScopes,
  })
  const modeLabel = input.mode === 'paper' ? '整套模拟卷' : input.mode === 'sprint' ? '考前冲刺卷' : '专项小练'
  const formatText = input.formats.join('、')
  const result = await aiJson({
    provider: 'text',
    maxTokens: input.mode === 'mini'
      ? Math.max(3_000, Math.min(9_000, input.count * 680))
      : Math.max(7_000, Math.min(20_000, input.count * 760)),
    enableThinking: false,
    requestTimeoutMs: 360_000,
    messages: [
      {
        role: 'system',
        content: [
          '你是高中针对性训练题生成器。',
          '直接生成紧凑 JSON，不输出思考过程，不写额外说明。',
          curriculumPrompt,
          '题目必须来自固定教材范围，并优先依据用户上传教材知识。',
          '必须严格按照用户选择的题量、题型和难度生成。',
          input.mode === 'paper'
            ? '当前为整套模拟卷：题目要有合理顺序，先基础后综合，题型分布尽量均衡。'
            : input.mode === 'sprint'
              ? '当前为考前冲刺卷：优先高频考点、基础得分、个人错题和易错点；控制题目篇幅，模拟限时压力，并在解析中给出时间分配、检查顺序和舍题策略。'
              : '当前为专项小练：围绕所选知识点集中出题，避免无关内容。',
          '只返回 JSON：{"questions":[...]}。',
          '每题字段：id,subject,knowledgePointId,knowledgePointName,content,format,options,correctAnswer,explanation,sourceType。',
          'format 只能使用用户指定题型；选择题必须返回 options，其他题型 options 可省略。',
          'sourceType 固定 ai_generated。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `模式：${modeLabel}`,
          `科目：${input.subject}`,
          `教材版本：${fixedTextbookVersions[input.subject]}`,
          `指定书册：${input.bookTitle || '未指定'}`,
          `指定章节：${input.chapter || '全册综合'}`,
          `知识点：${names.join('、') || '所选章节综合内容'}`,
          `题源范围：${input.sourceScopes.join('、') || '已上传教材'}`,
          input.mode === 'sprint' ? `考试日期：${input.examDate || '近期考试'}` : '',
          input.mode === 'sprint' ? `冲刺重点：${input.sprintFocus || '高频易错、基础得分和个人薄弱点'}` : '',
          `题量：必须正好 ${input.count} 道`,
          `允许题型：${formatText}`,
          `难度：${input.difficulty}`,
          `建议完成时间：${input.durationMinutes} 分钟`,
        ].join('\n'),
      },
    ],
  }) as { questions?: Array<Record<string, unknown>> }
  if (!Array.isArray(result.questions)) throw new Error('文本模型未返回训练题')
  const allowedFormats = new Set<string>(input.formats)
  const questions = result.questions.slice(0, input.count).map((question, index) => {
    const fallbackFormat = input.formats[index % input.formats.length] ?? '解答题'
    const rawFormat = String(question.format || fallbackFormat)
    const format = allowedFormats.has(rawFormat) ? rawFormat : fallbackFormat
    const options = format === '选择题' && !Array.isArray(question.options)
      ? ['A. 待模型补充', 'B. 待模型补充', 'C. 待模型补充', 'D. 待模型补充']
      : question.options
    return {
      ...question,
      id: String(question.id || randomUUID()),
      subject: input.subject,
      format,
      options,
      sourceType: 'ai_generated',
    }
  })
  if (questions.length !== input.count) {
    throw new Error(`文本模型只返回 ${questions.length} 道题，未达到要求的 ${input.count} 道`)
  }
  res.json(questions)
}))

router.post('/ai/study-cycle', ...studentOnly, asyncRoute(async (req, res) => {
  const input = studyCycleSchema.parse(req.body)
  const keywords = [input.bookTitle, input.chapter, input.knowledgePoint, input.customGoal || ''].filter(Boolean)
  const context = await knowledgeContext(req.user!.id, input.subject, keywords, {
    bookId: input.bookId,
    chapter: input.chapter,
    sourceScopes: input.sourceScopes,
  })
  const modeLabel = input.mode === 'preview' ? '预习' : '复习'
  const result = await aiJson({
    provider: 'text',
    maxTokens: input.depth === '深入' ? 10_000 : input.depth === '标准' ? 7_500 : 5_000,
    enableThinking: false,
    requestTimeoutMs: 300_000,
    messages: [
      {
        role: 'system',
        content: [
          `你是家庭高中学习系统的${modeLabel}教练。`,
          curriculumPrompt,
          '优先依据家庭上传教材知识，内容必须适合学生在给定时间内完成。',
          input.mode === 'preview'
            ? '预习必须帮助学生建立章节框架、识别新概念、带着问题听课，不要提前堆砌难题。'
            : '复习必须先回忆、再订正、最后用小测验证，优先处理错题和遗忘风险。',
          '只返回 JSON 对象，字段：title,summary,objectives,keyPoints,steps,selfCheck,nextAction。',
          'objectives 是 2—4 个字符串。',
          'keyPoints 是 2—5 个 {title,content}。',
          'steps 是 3—6 个 {title,content,minutes}，minutes 总和尽量等于用户给定时间。',
          'selfCheck 是 2—4 道题，每题字段 id,subject,knowledgePointId,knowledgePointName,content,format,options,correctAnswer,explanation,sourceType。',
          'selfCheck 的 sourceType 固定 ai_generated。',
          '',
          '可用教材知识：',
          context,
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `模式：${modeLabel}`,
          `科目：${input.subject}`,
          `教材版本：${fixedTextbookVersions[input.subject]}`,
          `指定书册：${input.bookTitle}`,
          `章节：${input.chapter || '未指定'}`,
          `知识点：${input.knowledgePoint || '未指定'}`,
          `自己的要求：${input.customGoal || '无'}`,
          `参考资料范围：${input.sourceScopes.join('、') || '已上传教材'}`,
          `可用时间：${input.duration} 分钟`,
          `深度：${input.depth}`,
        ].join('\n'),
      },
    ],
  }) as Record<string, unknown>

  const selfCheck = Array.isArray(result.selfCheck)
    ? result.selfCheck.slice(0, 4).map((question, index) => {
      const item = question as Record<string, unknown>
      return {
        ...item,
        id: String(item.id || randomUUID()),
        subject: input.subject,
        knowledgePointId: String(item.knowledgePointId || `study-${index + 1}`),
        knowledgePointName: String(item.knowledgePointName || input.knowledgePoint || input.chapter || '本次学习重点'),
        format: String(item.format || '解答题'),
        sourceType: 'ai_generated',
      }
    })
    : []

  res.json({
    title: String(result.title || `${input.subject}${modeLabel}单`),
    summary: String(result.summary || ''),
    objectives: Array.isArray(result.objectives) ? result.objectives.map(String).slice(0, 4) : [],
    keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints.slice(0, 5) : [],
    steps: Array.isArray(result.steps) ? result.steps.slice(0, 6) : [],
    selfCheck,
    nextAction: String(result.nextAction || '完成后进入模拟训练，用一组小题验证掌握情况。'),
  })
}))

export const qwenLearningRouter = router
