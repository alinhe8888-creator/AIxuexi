import { createContext } from 'react'
import type {
  AppSettings,
  AppState,
  DailyTask,
  PaperRecord,
  QuizQuestion,
  SaveMistakeInput,
  SimulationResultItem,
  StudentProfile,
} from '../types'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message?: string
}

export interface CompleteQuizResult {
  correct: number
  total: number
  correctRate: number
  wrongQuestions: QuizQuestion[]
}

export interface AppStoreValue {
  state: AppState
  toasts: ToastMessage[]
  updateProfile: (profile: Partial<StudentProfile>) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  saveMistake: (input: SaveMistakeInput) => string
  removeMistake: (id: string) => void
  archiveMistake: (id: string) => void
  reviewMistake: (id: string, rating: 'again' | 'hard' | 'good' | 'easy') => void
  reviewCard: (id: string, rating: 'again' | 'hard' | 'good' | 'easy') => void
  toggleTask: (planId: string, taskId: string) => void
  addDailyTask: (task: Omit<DailyTask, 'id' | 'status'>) => void
  completeQuiz: (quizId: string, answers: Record<string, string>) => CompleteQuizResult
  addPaper: (paper: PaperRecord) => void
  applySimulation: (title: string, items: SimulationResultItem[]) => CompleteQuizResult
  exportData: () => string
  importData: (json: string) => void
  resetData: () => void
  notify: (type: ToastMessage['type'], title: string, message?: string) => void
  dismissToast: (id: string) => void
}

export const AppStoreContext = createContext<AppStoreValue | null>(null)
