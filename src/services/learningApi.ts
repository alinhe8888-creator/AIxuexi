import type { AiExplanation, KnowledgeItem, PaperQuestionAnalysis, QuizQuestion, Subject } from '../types'
import { apiRequest, USE_MOCK_API } from './apiClient'
import { mockAiExplain, mockGenerateSimulation, mockOcrRecognize, mockPaperRecognition } from './mockApi'

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
  year?: number
  region?: string
  sourceType?: string
  keyword?: string
}

export const learningApi = {
  ocr: {
    async recognizeQuestion(input: OcrQuestionInput) {
      if (USE_MOCK_API) return mockOcrRecognize(input.subject, input.fileName)
      return apiRequest<Awaited<ReturnType<typeof mockOcrRecognize>>>('/api/ocr/question', { method: 'POST', body: JSON.stringify(input) })
    },
    async recognizePaper(input: PaperRecognitionInput): Promise<PaperQuestionAnalysis[]> {
      if (USE_MOCK_API) return mockPaperRecognition(input.subject)
      return apiRequest<PaperQuestionAnalysis[]>('/api/ocr/paper', { method: 'POST', body: JSON.stringify(input) })
    },
  },
  ai: {
    async explainQuestion(input: AiExplainInput): Promise<AiExplanation> {
      if (USE_MOCK_API) return mockAiExplain(input.subject, input.content, input.correctAnswer)
      return apiRequest<AiExplanation>('/api/ai/explain', { method: 'POST', body: JSON.stringify(input) })
    },
    async generateSimulation(input: SimulationInput): Promise<QuizQuestion[]> {
      if (USE_MOCK_API) return mockGenerateSimulation(input.subject, input.points, input.count)
      return apiRequest<QuizQuestion[]>('/api/ai/simulation', { method: 'POST', body: JSON.stringify(input) })
    },
  },
  knowledge: {
    async search(filters: KnowledgeSearchFilters): Promise<KnowledgeItem[]> {
      if (USE_MOCK_API) return []
      const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '').map(([key, value]) => [key, String(value)]))
      return apiRequest<KnowledgeItem[]>(`/api/knowledge?${query}`)
    },
  },
  sync: {
    async pushLocalSnapshot(snapshot: unknown) {
      if (USE_MOCK_API) return { ok: true, mode: 'mock' }
      return apiRequest<{ ok: boolean }>('/api/sync/snapshot', { method: 'POST', body: JSON.stringify(snapshot) })
    },
  },
}
