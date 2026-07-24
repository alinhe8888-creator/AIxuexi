type ChatMessage = { role: string; content: unknown }

type Provider = {
  name: 'Qwen' | 'DeepSeek'
  baseUrl: string
  apiKey: string
  model: string
  vision: boolean
}

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim()
const timeoutMs = Math.max(15_000, Number(env('AI_TIMEOUT_MS', '90000')))

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const getProvider = (vision: boolean): Provider | null => {
  if (vision) {
    const apiKey = env('QWEN_API_KEY', env('AI_API_KEY'))
    if (!apiKey) return null
    return {
      name: 'Qwen',
      baseUrl: normalizeBaseUrl(env('QWEN_API_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1')),
      apiKey,
      model: env('QWEN_VISION_MODEL', 'qwen3-vl-flash'),
      vision: true,
    }
  }

  const apiKey = env('DEEPSEEK_API_KEY', env('AI_API_KEY'))
  if (!apiKey) return null
  return {
    name: 'DeepSeek',
    baseUrl: normalizeBaseUrl(env('DEEPSEEK_API_BASE_URL', 'https://api.deepseek.com')),
    apiKey,
    model: env('DEEPSEEK_MODEL', 'deepseek-v4-flash'),
    vision: false,
  }
}

const extractJson = (text: string): unknown => {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const starts = ['{', '[']
    .map((char) => cleaned.indexOf(char))
    .filter((index) => index >= 0)
  if (!starts.length) throw new Error('模型没有返回 JSON')
  return JSON.parse(cleaned.slice(Math.min(...starts))) as unknown
}

const contentToText = (content: unknown) => {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
        return ''
      })
      .join('')
  }
  return ''
}

async function requestProvider(provider: Provider, messages: ChatMessage[], structured: boolean) {
  const requestBody: Record<string, unknown> = {
    model: provider.model,
    messages,
    stream: false,
  }

  if (structured) requestBody.response_format = { type: 'json_object' }
  if (provider.name === 'Qwen') requestBody.enable_thinking = false
  if (provider.name === 'DeepSeek') {
    const thinkingEnabled = env('DEEPSEEK_THINKING', 'false').toLowerCase() === 'true'
    requestBody.thinking = { type: thinkingEnabled ? 'enabled' : 'disabled' }
    if (thinkingEnabled) requestBody.reasoning_effort = env('DEEPSEEK_REASONING_EFFORT', 'high')
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500)
    const error = new Error(`${provider.name} 返回 ${response.status}: ${details}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = contentToText(payload.choices?.[0]?.message?.content)
  if (!content) throw new Error(`${provider.name} 返回空内容`)
  return content
}

export async function callStructuredModel(messages: unknown[], vision = false): Promise<unknown | null> {
  const provider = getProvider(vision)
  if (!provider) return null

  try {
    return extractJson(await requestProvider(provider, messages as ChatMessage[], true))
  } catch (error) {
    const status = (error as Error & { status?: number }).status
    if (status !== 400 && status !== 422) throw error
    // 某些兼容网关暂不接受 response_format，自动降级一次，但仍要求模型返回 JSON。
    return extractJson(await requestProvider(provider, messages as ChatMessage[], false))
  }
}
