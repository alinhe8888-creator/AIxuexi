import type {
  AiExplanation,
  KnowledgeItem,
  PaperQuestionAnalysis,
  QuizQuestion,
  Subject,
} from '../types'
import { apiRequest, USE_MOCK_API } from './apiClient'

export interface OcrQuestionInput {
  subject: Subject
  imageDataUrl: string
  fileName?: string
}
export interface AiExplainInput {
  subject: Subject
  content: string
  correctAnswer?: string
}
export interface PaperRecognitionInput {
  subject: Subject
  imageDataUrls: string[]
}
export interface SimulationInput {
  subject: Subject
  points: Array<{ id: string; name: string }>
  count: number
}
export interface KnowledgeSearchFilters {
  subject?: Subject
  grade?: string
  chapter?: string
  knowledgePoint?: string
  keyword?: string
}

function requireRealApi() {
  if (USE_MOCK_API) {
    throw new Error('当前构建仍启用了模拟接口，请把 VITE_USE_MOCK_API 设置为 false')
  }
}

export const learningApi = {
  ocr: {
    async recognizeQuestion(input: OcrQuestionInput) {
      requireRealApi()
      return apiRequest<{
        content: string
        chapter: string
        knowledgePointName: string
        correctAnswer: string
        questionFormat: '选择题' | '填空题' | '判断题' | '解答题' | '默写题'
        confidence: number
        imageKey: string
      }>('/api/ocr/question', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 180_000,
      })
    },

    async recognizePaper(input: PaperRecognitionInput): Promise<PaperQuestionAnalysis[]> {
      requireRealApi()
      return apiRequest<PaperQuestionAnalysis[]>('/api/ocr/paper', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 300_000,
      })
    },
  },

  ai: {
    async explainQuestion(input: AiExplainInput): Promise<AiExplanation> {
      requireRealApi()
      return apiRequest<AiExplanation>('/api/ai/explain', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 180_000,
      })
    },

    async generateSimulation(input: SimulationInput): Promise<QuizQuestion[]> {
      requireRealApi()
      return apiRequest<QuizQuestion[]>('/api/ai/simulation', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 180_000,
      })
    },
  },

  knowledge: {
    async search(filters: KnowledgeSearchFilters): Promise<KnowledgeItem[]> {
      const query = new URLSearchParams(
        Object.entries(filters)
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      )
      return apiRequest<KnowledgeItem[]>(`/api/knowledge?${query}`)
    },
  },

  sync: {
    async pushLocalSnapshot(snapshot: unknown) {
      return apiRequest<{ ok: boolean }>('/api/sync/snapshot', {
        method: 'POST',
        body: JSON.stringify({ snapshot }),
        retry: 1,
      })
    },
  },
}
