import type { QuestionFormat, QuizQuestion, Subject } from '../types'

export type StudyCycleMode = 'preview' | 'review'
export type StudyDepth = '快速' | '标准' | '深入'
export type SimulationMode = 'mini' | 'paper' | 'sprint'
export type SimulationDifficulty = '基础' | '中等' | '提高' | '混合'

export interface StudyCycleResult {
  title: string
  summary: string
  objectives: string[]
  keyPoints: Array<{ title: string; content: string }>
  steps: Array<{ title: string; content: string; minutes: number }>
  selfCheck: QuizQuestion[]
  nextAction: string
}

export interface StudySession {
  id: string
  mode: StudyCycleMode
  subject: Subject
  bookId: string
  bookTitle: string
  chapter: string
  knowledgePoint: string
  duration: number
  depth: StudyDepth
  createdAt: string
  result: StudyCycleResult
}

export interface ProfileAssessmentResult {
  completedAt: string
  focusScore: number
  planningScore: number
  confidenceScore: number
  persistenceScore: number
  learningPreference: '图像理解型' | '文字归纳型' | '练习驱动型' | '均衡型'
  rhythm: '短时高频' | '稳定持续' | '集中突破'
  tags: string[]
  recommendations: string[]
}

export interface SimulationDraft {
  mode: SimulationMode
  subject: Subject
  bookId: string
  chapter: string
  sourceScopes: string[]
  pointIds: string[]
  customPoint: string
  count: number
  formats: QuestionFormat[]
  difficulty: SimulationDifficulty
  durationMinutes: number
  questions: QuizQuestion[]
  answers: Record<string, string>
  submitted: boolean
  generatedAt?: string
}

const SESSION_KEY = 'aixuexi:study-sessions:v1'
const ASSESSMENT_KEY = 'aixuexi:profile-assessment:v1'
const SIMULATION_KEY = 'aixuexi:simulation-draft:v3'
const COMPLETION_KEY = 'aixuexi:daily-completions:v1'

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function loadStudySessions(): StudySession[] {
  return safeParse<StudySession[]>(localStorage.getItem(SESSION_KEY), [])
}

export function saveStudySession(session: StudySession) {
  const current = loadStudySessions().filter((item) => item.id !== session.id)
  const next = [session, ...current].slice(0, 40)
  localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('aixuexi:workspace-changed'))
  return next
}

export function deleteStudySession(id: string) {
  const next = loadStudySessions().filter((item) => item.id !== id)
  localStorage.setItem(SESSION_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('aixuexi:workspace-changed'))
  return next
}

export function loadProfileAssessment() {
  return safeParse<ProfileAssessmentResult | null>(localStorage.getItem(ASSESSMENT_KEY), null)
}

export function saveProfileAssessment(result: ProfileAssessmentResult) {
  localStorage.setItem(ASSESSMENT_KEY, JSON.stringify(result))
  window.dispatchEvent(new CustomEvent('aixuexi:workspace-changed'))
}

export function clearProfileAssessment() {
  localStorage.removeItem(ASSESSMENT_KEY)
  window.dispatchEvent(new CustomEvent('aixuexi:workspace-changed'))
}

export function loadSimulationDraft(): SimulationDraft | null {
  return safeParse<SimulationDraft | null>(localStorage.getItem(SIMULATION_KEY), null)
}

export function saveSimulationDraft(draft: SimulationDraft) {
  localStorage.setItem(SIMULATION_KEY, JSON.stringify(draft))
}

export function clearSimulationDraft() {
  localStorage.removeItem(SIMULATION_KEY)
}

export function loadDailyCompletions(): Record<string, boolean> {
  return safeParse<Record<string, boolean>>(localStorage.getItem(COMPLETION_KEY), {})
}

export function toggleDailyCompletion(id: string) {
  const current = loadDailyCompletions()
  const next = { ...current, [id]: !current[id] }
  localStorage.setItem(COMPLETION_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('aixuexi:workspace-changed'))
  return next
}
