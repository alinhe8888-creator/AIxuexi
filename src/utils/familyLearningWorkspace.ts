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

export interface WorkspaceSnapshot {
  timeZone?: string
  studySessions: StudySession[]
  profileAssessment: ProfileAssessmentResult | null
  simulationDraft: SimulationDraft | null
  dailyCompletions: Record<string, boolean>
}

const STORAGE_PREFIX = 'aixuexi:student-workspace:v6'
const LEGACY_KEYS = [
  'aixuexi:study-sessions:v1',
  'aixuexi:profile-assessment:v1',
  'aixuexi:simulation-draft:v3',
  'aixuexi:daily-completions:v1',
]

for (const key of LEGACY_KEYS) localStorage.removeItem(key)

function currentStudentId() {
  try {
    const raw = localStorage.getItem('aixuexi:student:auth-user')
    const user = raw ? JSON.parse(raw) as { id?: string; role?: string } : null
    return user?.role === 'student' && user.id ? user.id : 'anonymous'
  } catch {
    return 'anonymous'
  }
}

function storageKey(name: string) {
  return `${STORAGE_PREFIX}:${currentStudentId()}:${name}`
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function notifyWorkspaceChanged() {
  window.dispatchEvent(new CustomEvent('aixuexi:workspace-changed'))
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function loadStudySessions(): StudySession[] {
  return safeParse<StudySession[]>(localStorage.getItem(storageKey('study-sessions')), [])
}

export function saveStudySession(session: StudySession) {
  const current = loadStudySessions().filter((item) => item.id !== session.id)
  const next = [session, ...current].slice(0, 40)
  localStorage.setItem(storageKey('study-sessions'), JSON.stringify(next))
  notifyWorkspaceChanged()
  return next
}

export function deleteStudySession(id: string) {
  const next = loadStudySessions().filter((item) => item.id !== id)
  localStorage.setItem(storageKey('study-sessions'), JSON.stringify(next))
  notifyWorkspaceChanged()
  return next
}

export function loadProfileAssessment() {
  return safeParse<ProfileAssessmentResult | null>(localStorage.getItem(storageKey('profile-assessment')), null)
}

export function saveProfileAssessment(result: ProfileAssessmentResult) {
  localStorage.setItem(storageKey('profile-assessment'), JSON.stringify(result))
  notifyWorkspaceChanged()
}

export function clearProfileAssessment() {
  localStorage.removeItem(storageKey('profile-assessment'))
  notifyWorkspaceChanged()
}

export function loadSimulationDraft(): SimulationDraft | null {
  return safeParse<SimulationDraft | null>(localStorage.getItem(storageKey('simulation-draft')), null)
}

export function saveSimulationDraft(draft: SimulationDraft) {
  localStorage.setItem(storageKey('simulation-draft'), JSON.stringify(draft))
  notifyWorkspaceChanged()
}

export function clearSimulationDraft() {
  localStorage.removeItem(storageKey('simulation-draft'))
  notifyWorkspaceChanged()
}

export function loadDailyCompletions(): Record<string, boolean> {
  return safeParse<Record<string, boolean>>(localStorage.getItem(storageKey('daily-completions')), {})
}

export function toggleDailyCompletion(id: string) {
  const current = loadDailyCompletions()
  const next = { ...current, [id]: !current[id] }
  localStorage.setItem(storageKey('daily-completions'), JSON.stringify(next))
  notifyWorkspaceChanged()
  return next
}

export function getWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    studySessions: loadStudySessions(),
    profileAssessment: loadProfileAssessment(),
    simulationDraft: loadSimulationDraft(),
    dailyCompletions: loadDailyCompletions(),
  }
}

export function hydrateWorkspaceSnapshot(snapshot?: Partial<WorkspaceSnapshot> | null, emitChange = true) {
  const write = (name: string, value: unknown) => {
    const key = storageKey(name)
    if (value === undefined || value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  }
  write('study-sessions', Array.isArray(snapshot?.studySessions) ? snapshot.studySessions : [])
  write('profile-assessment', snapshot?.profileAssessment ?? null)
  write('simulation-draft', snapshot?.simulationDraft ?? null)
  write('daily-completions', snapshot?.dailyCompletions && typeof snapshot.dailyCompletions === 'object' ? snapshot.dailyCompletions : {})
  if (emitChange) notifyWorkspaceChanged()
}

export function clearWorkspaceData(emitChange = true) {
  for (const name of ['study-sessions', 'profile-assessment', 'simulation-draft', 'daily-completions']) {
    localStorage.removeItem(storageKey(name))
  }
  if (emitChange) notifyWorkspaceChanged()
}
