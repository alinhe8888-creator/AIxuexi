import type { AiExplanation, KnowledgeItem, PaperQuestionAnalysis, QuizQuestion, Subject } from '../types'
import { ALLOW_API_FALLBACK, ApiError, apiRequest, USE_MOCK_API } from './apiClient'
import { mockAiExplain, mockGenerateSimulation, mockOcrRecognize, mockPaperRecognition } from './mockApi'

export interface OcrQuestionInput { subject: Subject; imageDataUrl: string; fileName?: string }
export interface AiExplainInput { subject: Subject; content: string; correctAnswer?: string }
export interface PaperRecognitionInput { subject: Subject; imageDataUrls: string[] }
export interface SimulationInput { subject: Subject; points: Array<{ id: string; name: string }>; count: number }
export interface KnowledgeSearchFilters { subject?: Subject; grade?: string; chapter?: string; knowledgePoint?: string; year?: number; region?: string; sourceType?: string; keyword?: string }

const shouldFallback = (error: unknown) => ALLOW_API_FALLBACK && error instanceof ApiError && (error.status === 0 || error.status === 404 || error.status === 501 || error.status >= 502)
const fallbackWarning = (feature: string, error: unknown) => console.warn(`[${feature}] Backend unavailable; switched to safe local fallback.`, error)

export const learningApi = {
  ocr: {
    async recognizeQuestion(input: OcrQuestionInput) {
      if (USE_MOCK_API) return mockOcrRecognize(input.subject, input.fileName)
      try {
        return await apiRequest<Awaited<ReturnType<typeof mockOcrRecognize>>>('/api/ocr/question', { method: 'POST', body: JSON.stringify(input), timeoutMs: 75_000 })
      } catch (error) {
        if (!shouldFallback(error)) throw error
        fallbackWarning('OCR question', error)
        return mockOcrRecognize(input.subject, input.fileName)
      }
    },
    async recognizePaper(input: PaperRecognitionInput): Promise<PaperQuestionAnalysis[]> {
      if (USE_MOCK_API) return mockPaperRecognition(input.subject)
      try {
        return await apiRequest<PaperQuestionAnalysis[]>('/api/ocr/paper', { method: 'POST', body: JSON.stringify(input), timeoutMs: 90_000 })
      } catch (error) {
        if (!shouldFallback(error)) throw error
        fallbackWarning('OCR paper', error)
        return mockPaperRecognition(input.subject)
      }
    },
  },
  ai: {
    async explainQuestion(input: AiExplainInput): Promise<AiExplanation> {
      if (USE_MOCK_API) return mockAiExplain(input.subject, input.content, input.correctAnswer)
      try {
        return await apiRequest<AiExplanation>('/api/ai/explain', { method: 'POST', body: JSON.stringify(input), timeoutMs: 75_000 })
      } catch (error) {
        if (!shouldFallback(error)) throw error
        fallbackWarning('AI explanation', error)
        return mockAiExplain(input.subject, input.content, input.correctAnswer)
      }
    },
    async generateSimulation(input: SimulationInput): Promise<QuizQuestion[]> {
      if (USE_MOCK_API) return mockGenerateSimulation(input.subject, input.points, input.count)
      try {
        return await apiRequest<QuizQuestion[]>('/api/ai/simulation', { method: 'POST', body: JSON.stringify(input), timeoutMs: 75_000 })
      } catch (error) {
        if (!shouldFallback(error)) throw error
        fallbackWarning('AI simulation', error)
        return mockGenerateSimulation(input.subject, input.points, input.count)
      }
    },
  },
  knowledge: {
    async search(filters: KnowledgeSearchFilters): Promise<KnowledgeItem[]> {
      if (USE_MOCK_API) return []
      const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '').map(([key, value]) => [key, String(value)]))
      try {
        return await apiRequest<KnowledgeItem[]>(`/api/knowledge?${query}`)
      } catch (error) {
        if (!shouldFallback(error)) throw error
        fallbackWarning('Knowledge search', error)
        return []
      }
    },
  },
  sync: {
    async pushLocalSnapshot(snapshot: unknown) {
      if (USE_MOCK_API) return { ok: true, mode: 'mock' }
      return apiRequest<{ ok: boolean }>('/api/sync/snapshot', { method: 'POST', body: JSON.stringify({ snapshot }), retry: 1 })
    },
  },
}
