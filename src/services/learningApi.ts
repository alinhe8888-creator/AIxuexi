import type {
  AiExplanation,
  KnowledgeItem,
  PaperQuestionAnalysis,
  QuizQuestion,
  Subject,
  QuestionFormat,
} from '../types'
import type {
  StudyCycleResult,
  StudyCycleMode,
  StudyDepth,
  SimulationDifficulty,
  SimulationMode,
} from '../utils/familyLearningWorkspace'
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
  bookId?: string
  bookTitle?: string
  chapter?: string
  points: Array<{ id: string; name: string }>
  count: number
  mode?: SimulationMode
  formats?: QuestionFormat[]
  difficulty?: SimulationDifficulty
  durationMinutes?: number
  sourceScopes?: string[]
  examDate?: string
  sprintFocus?: string
}
export interface StudyCycleInput {
  mode: StudyCycleMode
  subject: Subject
  bookId: string
  bookTitle: string
  chapter: string
  knowledgePoint: string
  customGoal?: string
  sourceScopes?: string[]
  duration: number
  depth: StudyDepth
}
export interface KnowledgeSearchFilters {
  subject?: Subject
  grade?: string
  chapter?: string
  knowledgePoint?: string
  bookId?: string
  resourceKind?: string
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
        timeoutMs: 240_000,
      })
    },

    async recognizePaper(input: PaperRecognitionInput): Promise<PaperQuestionAnalysis[]> {
      requireRealApi()
      return apiRequest<PaperQuestionAnalysis[]>('/api/ocr/paper', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 360_000,
      })
    },
  },

  ai: {
    async explainQuestion(input: AiExplainInput): Promise<AiExplanation> {
      requireRealApi()
      return apiRequest<AiExplanation>('/api/ai/explain', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 240_000,
      })
    },

    async generateSimulation(input: SimulationInput): Promise<QuizQuestion[]> {
      requireRealApi()
      return apiRequest<QuizQuestion[]>('/api/ai/simulation', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: input.mode === 'sprint' ? 480_000 : 360_000,
        retry: 1,
      })
    },

    async generateStudyCycle(input: StudyCycleInput): Promise<StudyCycleResult> {
      requireRealApi()
      return apiRequest<StudyCycleResult>('/api/ai/study-cycle', {
        method: 'POST',
        body: JSON.stringify(input),
        timeoutMs: 300_000,
        retry: 1,
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
        timeoutMs: 120_000,
      })
    },
  },
}
