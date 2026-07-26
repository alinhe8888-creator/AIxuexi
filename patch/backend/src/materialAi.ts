import { randomUUID } from 'node:crypto'

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const normalizeBase = (value: string) => value.replace(/\/+$/, '')
const timeoutMs = Math.max(30_000, Number(env('AI_TIMEOUT_MS', '120000')))

export type KnowledgeItemPayload = {
  id: string
  subject: '语文' | '数学' | '英语' | '物理' | '化学' | '生物' | '历史' | '地理' | '政治'
  grade: '高一' | '高二' | '高三'
  chapter: string
  knowledgePoint: string
  questionType: '选择题' | '填空题' | '判断题' | '解答题' | '默写题'
  sourceType: 'user_upload'
  title: string
  content: string
  answer: string
  explanation: string
  tags: string[]
  materialId: string
  sourceFile: string
  sourcePath: string
  createdAt: string
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
const supportedSubjects = new Set(['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'])
const supportedGrades = new Set(['高一', '高二', '高三'])
const supportedFormats = new Set(['选择题', '填空题', '判断题', '解答题', '默写题'])

function extractJson(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = Math.min(...['{', '['].map((char) => cleaned.indexOf(char)).filter((index) => index >= 0))
  if (!Number.isFinite(start)) throw new Error('模型未返回 JSON')
  return JSON.parse(cleaned.slice(start)) as unknown
}

async function openAiCompatibleJson(input: { baseUrl: string; apiKey: string; model: string; provider: string; messages: ChatMessage[] }) {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: false,
    temperature: 0.1,
    max_tokens: 12000,
    response_format: { type: 'json_object' },
  }
  if (input.provider === 'DeepSeek') {
    body.thinking = { type: env('DEEPSEEK_THINKING', 'disabled') === 'enabled' ? 'enabled' : 'disabled' }
    body.reasoning_effort = env('DEEPSEEK_REASONING_EFFORT', 'high')
  }
  if (input.provider === 'Qwen') body.enable_thinking = false

  const call = async (withFormat: boolean) => {
    const nextBody = withFormat ? body : Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'response_format'))
    const response = await fetch(`${normalizeBase(input.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify(nextBody),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw Object.assign(new Error(`${input.provider} 返回 ${response.status}: ${(await response.text()).slice(0, 500)}`), { status: response.status })
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> }
    const text = payload.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error(`${input.provider} 返回空内容`)
    return extractJson(text)
  }
  try { return await call(true) } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 400 && status !== 422) throw error
    return call(false)
  }
}

function collectOutputText(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectOutputText)
  if (!value || typeof value !== 'object') return []
  const record = value as Record<string, unknown>
  const direct = ['ocr_result', 'text', 'output_text'].flatMap((key) => typeof record[key] === 'string' ? [String(record[key])] : [])
  return [...direct, ...Object.values(record).flatMap(collectOutputText)]
}

export function modelStatus() {
  return {
    qwen: Boolean(env('QWEN_API_KEY', env('AI_API_KEY'))),
    deepseek: Boolean(env('DEEPSEEK_API_KEY', env('AI_API_KEY'))),
  }
}

export async function extractRemoteDocumentText(fileUrl: string, contentType: string, fileName: string) {
  const apiKey = env('QWEN_API_KEY', env('AI_API_KEY'))
  if (!apiKey) throw new Error('未配置 QWEN_API_KEY，无法解析 PDF 或图片')
  const baseUrl = normalizeBase(env('QWEN_API_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'))
  const prompt = `完整提取高中课本资料“${fileName}”中的正文、标题、章节、公式、表格、例题、答案与注释。保持原顺序；看不清的内容不要编造。`

  if (contentType === 'application/pdf') {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: env('QWEN_OCR_MODEL', 'qwen3.5-ocr'),
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_file', file_url: fileUrl }] }],
        ocr_options: { task: 'document_parsing' },
      }),
      signal: AbortSignal.timeout(Math.max(timeoutMs, 240_000)),
    })
    if (!response.ok) throw new Error(`Qwen PDF 解析失败（${response.status}）: ${(await response.text()).slice(0, 500)}`)
    const payload = await response.json() as unknown
    const text = [...new Set(collectOutputText(payload).map((item) => item.trim()).filter(Boolean))].join('\n')
    if (!text) throw new Error('Qwen 没有提取到 PDF 内容')
    return text.slice(0, 400_000)
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: env('QWEN_VISION_MODEL', 'qwen3-vl-flash'),
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: fileUrl } }] }],
      stream: false,
      enable_thinking: false,
      max_tokens: 16000,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Qwen 图片解析失败（${response.status}）: ${(await response.text()).slice(0, 500)}`)
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> }
  const text = collectOutputText(payload.choices?.[0]?.message?.content).join('\n').trim()
  if (!text) throw new Error('Qwen 没有提取到图片内容')
  return text.slice(0, 160_000)
}

const normalizeList = (value: unknown, limit = 10) => Array.isArray(value)
  ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit)
  : []

function normalizeKnowledgeRows(value: unknown, context: { materialId: string; fileName: string; sourcePath: string; subjectHint?: string; gradeHint?: string }): KnowledgeItemPayload[] {
  const raw = Array.isArray(value) ? value : value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).items) ? (value as Record<string, unknown>).items as unknown[] : []
  const createdAt = new Date().toISOString()
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const subjectCandidate = String(row.subject || context.subjectHint || '语文').trim()
    const gradeCandidate = String(row.grade || context.gradeHint || '高二').trim()
    const title = String(row.title || row.knowledgePoint || '').trim()
    const content = String(row.content || row.definition || row.summary || '').trim()
    if (!title || !content) return []
    return [{
      id: randomUUID(),
      subject: (supportedSubjects.has(subjectCandidate) ? subjectCandidate : '语文') as KnowledgeItemPayload['subject'],
      grade: (supportedGrades.has(gradeCandidate) ? gradeCandidate : '高二') as KnowledgeItemPayload['grade'],
      chapter: String(row.chapter || '未分类章节').trim().slice(0, 120),
      knowledgePoint: String(row.knowledgePoint || title).trim().slice(0, 120),
      questionType: (supportedFormats.has(String(row.questionType)) ? String(row.questionType) : '解答题') as KnowledgeItemPayload['questionType'],
      sourceType: 'user_upload' as const,
      title: title.slice(0, 160),
      content: content.slice(0, 8000),
      answer: String(row.answer || row.keyPoints || '').trim().slice(0, 6000),
      explanation: String(row.explanation || row.easyExplanation || '').trim().slice(0, 8000),
      tags: normalizeList(row.tags, 12),
      materialId: context.materialId,
      sourceFile: context.fileName,
      sourcePath: context.sourcePath,
      createdAt,
    }]
  }).slice(0, 80)
}

function fallbackKnowledge(text: string, context: { materialId: string; fileName: string; sourcePath: string; subjectHint?: string; gradeHint?: string }) {
  const paragraphs = text.split(/\n{2,}|(?<=[。！？])\s+/).map((item) => item.trim()).filter((item) => item.length >= 30)
  const selected = paragraphs.slice(0, 12)
  return selected.map((paragraph, index) => normalizeKnowledgeRows([{
    subject: context.subjectHint || '语文',
    grade: context.gradeHint || '高二',
    chapter: context.fileName.replace(/\.[^.]+$/, ''),
    knowledgePoint: `资料要点 ${index + 1}`,
    title: paragraph.slice(0, 32),
    content: paragraph.slice(0, 1200),
    answer: paragraph.slice(0, 500),
    explanation: '该条目由本地规则整理，配置 DeepSeek 后可获得更准确的章节、知识点和讲解。',
    tags: ['课本资料', '待AI精炼'],
  }], context)[0]!).filter(Boolean)
}

export async function buildKnowledgeFromText(text: string, context: { materialId: string; fileName: string; sourcePath: string; subjectHint?: string; gradeHint?: string }) {
  const cleanText = text.replace(/\u0000/g, '').trim()
  if (cleanText.length < 20) return []
  const apiKey = env('DEEPSEEK_API_KEY', env('AI_API_KEY'))
  if (!apiKey) return fallbackKnowledge(cleanText, context)

  const chunks: string[] = []
  const maxChunk = 55_000
  for (let offset = 0; offset < Math.min(cleanText.length, 220_000); offset += maxChunk) chunks.push(cleanText.slice(offset, offset + maxChunk))
  const result: KnowledgeItemPayload[] = []
  for (let index = 0; index < chunks.length; index += 1) {
    const payload = await openAiCompatibleJson({
      provider: 'DeepSeek',
      baseUrl: env('DEEPSEEK_API_BASE_URL', 'https://api.deepseek.com'),
      apiKey,
      model: env('DEEPSEEK_MODEL', 'deepseek-v4-pro'),
      messages: [
        {
          role: 'system',
          content: '你是高中课本知识库整理器。只能依据用户提供的资料，不得补写资料中没有的事实。输出 JSON：{"items":[{"subject":"数学","grade":"高一","chapter":"章节","knowledgePoint":"知识点","questionType":"解答题","title":"标题","content":"准确知识内容","answer":"核心结论或答案","explanation":"用学生容易理解的话解释","tags":["标签"]}]}。每个分块提取 3—15 个最有价值条目，避免重复和空泛。',
        },
        {
          role: 'user',
          content: `文件：${context.fileName}\n内部路径：${context.sourcePath}\n科目提示：${context.subjectHint || '自动判断'}\n年级提示：${context.gradeHint || '自动判断'}\n分块：${index + 1}/${chunks.length}\n\n${chunks[index]}`,
        },
      ],
    })
    result.push(...normalizeKnowledgeRows(payload, context))
  }
  const unique = new Map<string, KnowledgeItemPayload>()
  for (const item of result) unique.set(`${item.subject}|${item.chapter}|${item.knowledgePoint}|${item.title}`, item)
  return [...unique.values()].slice(0, 120)
}
