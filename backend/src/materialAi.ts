import { randomUUID } from 'node:crypto'
import { curriculumPrompt, isSupportedSubject, type SupportedSubject } from './curriculum.js'

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const normalizeBase = (value: string) => value.replace(/\/+$/, '')
const timeoutMs = Math.max(30_000, Number(env('AI_TIMEOUT_MS', '180000')))

export type KnowledgeItemPayload = {
  id: string
  subject: SupportedSubject
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
const supportedGrades = new Set(['高一', '高二', '高三'])
const supportedFormats = new Set(['选择题', '填空题', '判断题', '解答题', '默写题'])

function extractJson(value: string): unknown {
  const cleaned = value.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const indexes = ['{', '[']
    .map((char) => cleaned.indexOf(char))
    .filter((index) => index >= 0)
  if (!indexes.length) throw new Error('Qwen 未返回 JSON')
  return JSON.parse(cleaned.slice(Math.min(...indexes))) as unknown
}

async function qwenJson(messages: ChatMessage[]) {
  const apiKey = env('QWEN_API_KEY', env('AI_API_KEY'))
  if (!apiKey) throw new Error('未配置 QWEN_API_KEY，不能建立知识库')
  const baseUrl = normalizeBase(
    env('QWEN_API_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
  )
  const model = env('QWEN_TEXT_MODEL', 'qwen3.7-plus')

  const call = async (withFormat: boolean) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      temperature: 0.1,
      max_tokens: 16000,
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
        new Error(`Qwen 返回 ${response.status}: ${(await response.text()).slice(0, 500)}`),
        { status: response.status },
      )
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const text = payload.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('Qwen 返回空内容')
    return extractJson(text)
  }

  try {
    return await call(true)
  } catch (error) {
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
  const direct = ['ocr_result', 'text', 'output_text'].flatMap((key) =>
    typeof record[key] === 'string' ? [String(record[key])] : [],
  )
  return [...direct, ...Object.values(record).flatMap(collectOutputText)]
}

export function modelStatus() {
  return { qwen: Boolean(env('QWEN_API_KEY', env('AI_API_KEY'))) }
}

export async function extractRemoteDocumentText(
  fileUrl: string,
  contentType: string,
  fileName: string,
) {
  const apiKey = env('QWEN_API_KEY', env('AI_API_KEY'))
  if (!apiKey) throw new Error('未配置 QWEN_API_KEY，无法解析 PDF 或图片')
  const baseUrl = normalizeBase(
    env('QWEN_API_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
  )
  const prompt = [
    `完整理解高中教材资料“${fileName}”。`,
    curriculumPrompt,
    '提取正文、标题、章节、公式、表格、例题、答案与注释。',
    '保持原顺序；看不清的内容不要编造。',
  ].join('\n')

  if (contentType === 'application/pdf') {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env('QWEN_OCR_MODEL', 'qwen3.5-ocr'),
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_file', file_url: fileUrl },
          ],
        }],
        ocr_options: { task: 'document_parsing' },
      }),
      signal: AbortSignal.timeout(Math.max(timeoutMs, 240_000)),
    })
    if (!response.ok) {
      throw new Error(
        `Qwen PDF 解析失败（${response.status}）: ${(await response.text()).slice(0, 500)}`,
      )
    }
    const payload = await response.json() as unknown
    const text = [...new Set(
      collectOutputText(payload).map((item) => item.trim()).filter(Boolean),
    )].join('\n')
    if (!text) throw new Error('Qwen 没有提取到 PDF 内容')
    return text.slice(0, 500_000)
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env('QWEN_VISION_MODEL', 'qwen3.7-plus'),
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: fileUrl } },
        ],
      }],
      stream: false,
      enable_thinking: true,
      max_tokens: 16000,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    throw new Error(
      `Qwen 图片解析失败（${response.status}）: ${(await response.text()).slice(0, 500)}`,
    )
  }
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const text = collectOutputText(payload.choices?.[0]?.message?.content).join('\n').trim()
  if (!text) throw new Error('Qwen 没有提取到图片内容')
  return text.slice(0, 180_000)
}

const normalizeList = (value: unknown, limit = 10) =>
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit)
    : []

function normalizeKnowledgeRows(
  value: unknown,
  context: {
    materialId: string
    fileName: string
    sourcePath: string
    subjectHint?: string
    gradeHint?: string
  },
): KnowledgeItemPayload[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).items)
      ? (value as Record<string, unknown>).items as unknown[]
      : []
  const createdAt = new Date().toISOString()

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const candidate = String(row.subject || context.subjectHint || '').trim()
    if (!isSupportedSubject(candidate)) return []
    const gradeCandidate = String(row.grade || context.gradeHint || '高二').trim()
    const title = String(row.title || row.knowledgePoint || '').trim()
    const content = String(row.content || row.definition || row.summary || '').trim()
    if (!title || !content) return []

    return [{
      id: randomUUID(),
      subject: candidate,
      grade: (supportedGrades.has(gradeCandidate) ? gradeCandidate : '高二') as KnowledgeItemPayload['grade'],
      chapter: String(row.chapter || '未分类章节').trim().slice(0, 120),
      knowledgePoint: String(row.knowledgePoint || title).trim().slice(0, 120),
      questionType: (
        supportedFormats.has(String(row.questionType))
          ? String(row.questionType)
          : '解答题'
      ) as KnowledgeItemPayload['questionType'],
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

export async function buildKnowledgeFromText(
  text: string,
  context: {
    materialId: string
    fileName: string
    sourcePath: string
    subjectHint?: string
    gradeHint?: string
  },
) {
  const cleanText = text.replace(/\u0000/g, '').trim()
  if (cleanText.length < 20) return []

  const chunks: string[] = []
  const maxChunk = 55_000
  for (
    let offset = 0;
    offset < Math.min(cleanText.length, 330_000);
    offset += maxChunk
  ) {
    chunks.push(cleanText.slice(offset, offset + maxChunk))
  }

  const result: KnowledgeItemPayload[] = []
  for (let index = 0; index < chunks.length; index += 1) {
    const payload = await qwenJson([
      {
        role: 'system',
        content: [
          '你是家庭高中学习系统的教材知识库构建模型，不是简单 OCR。',
          curriculumPrompt,
          '只能依据用户上传资料，不得补写资料中没有的事实。',
          '需要理解章节层级、概念之间的关系、公式/规则、典型题型、易错点和生活化解释。',
          '输出 JSON：{"items":[{"subject":"数学","grade":"高一","chapter":"章节","knowledgePoint":"知识点","questionType":"解答题","title":"标题","content":"准确知识内容","answer":"核心结论","explanation":"容易理解的解释","tags":["标签"]}]}。',
          '每个分块提取 3—15 个高价值条目，避免重复和空泛。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `文件：${context.fileName}`,
          `内部路径：${context.sourcePath}`,
          `科目提示：${context.subjectHint || '自动判断'}`,
          `年级提示：${context.gradeHint || '自动判断'}`,
          `分块：${index + 1}/${chunks.length}`,
          '',
          chunks[index] ?? '',
        ].join('\n'),
      },
    ])
    result.push(...normalizeKnowledgeRows(payload, context))
  }

  const unique = new Map<string, KnowledgeItemPayload>()
  for (const item of result) {
    unique.set(
      `${item.subject}|${item.chapter}|${item.knowledgePoint}|${item.title}`,
      item,
    )
  }
  return [...unique.values()].slice(0, 160)
}
