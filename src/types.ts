export type Subject = '语文' | '数学' | '英语' | '物理' | '化学' | '生物' | '历史' | '地理' | '政治'
export type MasteryLevel = '未掌握' | '薄弱' | '一般' | '良好' | '熟练'
export type RiskLevel = '低' | '中' | '高'
export type ErrorCause =
  | '知识点不会'
  | '概念理解错误'
  | '公式记忆错误'
  | '审题错误'
  | '计算错误'
  | '解题思路错误'
  | '步骤遗漏'
  | '粗心'
  | '时间不足'

export type SourceType = 'user_upload' | 'real_exam' | 'ai_generated' | 'demo'
export type TaskType = 'study' | 'review' | 'quiz'
export type TaskStatus = 'pending' | 'completed'
export type QuestionFormat = '选择题' | '填空题' | '判断题' | '解答题' | '默写题'

export interface StudentProfile {
  id: string
  name: string
  grade: '高一' | '高二' | '高三'
  selectedSubjects: Subject[]
  textbookVersions: Partial<Record<Subject, string>>
  currentChapters: Partial<Record<Subject, string>>
  currentScoreRange: string
  dailyMinutes: number
  learningGoal: string
  onboarded: boolean
  createdAt: string
  updatedAt: string
}

export interface QuestionRecord {
  id: string
  subject: Subject
  chapter: string
  knowledgePointId: string
  knowledgePointName: string
  content: string
  imageDataUrl?: string
  studentAnswer?: string
  correctAnswer: string
  questionFormat: QuestionFormat
  sourceType: SourceType
  sourceDetail?: {
    year?: number
    region?: string
    paperName?: string
    questionType?: string
    note?: string
  }
  explanation?: AiExplanation
  createdAt: string
}

export interface AiExplanation {
  knowledgePoints: string[]
  thinking: string
  steps: Array<{ title: string; content: string }>
  finalAnswer: string
  commonMistakes: string[]
  lifeExample: string
  instantCheck: {
    question: string
    answer: string
    explanation: string
  }
}

export interface MistakeRecord {
  id: string
  questionId: string
  subject: Subject
  chapter: string
  knowledgePointId: string
  knowledgePointName: string
  originalQuestion: string
  imageDataUrl?: string
  studentAnswer: string
  correctAnswer: string
  wrongAt: string
  wrongCount: number
  primaryCause: ErrorCause
  secondaryCause?: ErrorCause
  mastery: number
  masteryLevel: MasteryLevel
  nextReviewAt: string
  lastReviewedAt?: string
  note?: string
  sourceType: SourceType
  archived?: boolean
}

export interface PaperQuestionAnalysis {
  id: string
  questionNo: string
  subject: Subject
  knowledgePointName: string
  knowledgePointId: string
  fullScore: number
  score: number
  isCorrect: boolean
  errorCause?: ErrorCause
  content: string
  correctAnswer: string
  studentAnswer: string
}

export interface PaperRecord {
  id: string
  title: string
  subject: Subject
  date: string
  fullScore: number
  score: number
  imageDataUrls: string[]
  questions: PaperQuestionAnalysis[]
  summary: {
    scoreRate: number
    mainCauses: ErrorCause[]
    weakKnowledgePoints: string[]
    weakChapters: string[]
    suggestions: string[]
  }
  createdAt: string
}

export interface KnowledgePoint {
  id: string
  subject: Subject
  grade: '高一' | '高二' | '高三'
  chapter: string
  name: string
  mastery: number
  accuracy: number
  errorCount: number
  reviewCount: number
  mainCause?: ErrorCause
  lastReviewedAt?: string
  nextReviewAt?: string
  forgettingRisk: RiskLevel
  trend: number[]
}

export interface ReviewTask {
  id: string
  sourceId: string
  sourceKind: 'mistake' | 'knowledge' | 'card'
  subject: Subject
  title: string
  knowledgePointId?: string
  scheduledDate: string
  status: TaskStatus
  priority: 1 | 2 | 3
  createdAt: string
  completedAt?: string
}

export interface DailyTask {
  id: string
  title: string
  description: string
  subject?: Subject
  type: TaskType
  estimatedMinutes: number
  status: TaskStatus
  linkedId?: string
}

export interface DailyPlan {
  id: string
  date: string
  tasks: DailyTask[]
  generatedAt: string
}

export interface QuizQuestion {
  id: string
  subject: Subject
  knowledgePointId: string
  knowledgePointName: string
  content: string
  format: QuestionFormat
  options?: string[]
  correctAnswer: string
  userAnswer?: string
  explanation: string
  sourceType: SourceType
}

export interface QuizRecord {
  id: string
  title: string
  date: string
  questions: QuizQuestion[]
  score: number
  correctRate: number
  completedAt?: string
  status: 'pending' | 'completed'
  weakPoints: string[]
}

export interface StudyCard {
  id: string
  category: '英文单词' | '英文短语' | '英文语法' | '古诗词' | '文言文' | '数学公式' | '物理规律' | '化学方程式' | '生物概念'
  subject: Subject
  front: string
  back: string
  hint: string
  format: QuestionFormat
  options?: string[]
  answer: string
  familiarity: 0 | 1 | 2 | 3 | 4 | 5
  reviewCount: number
  correctStreak: number
  nextReviewAt: string
  lastReviewedAt?: string
}

export interface KnowledgeItem {
  id: string
  subject: Subject
  grade: '高一' | '高二' | '高三'
  chapter: string
  knowledgePoint: string
  year?: number
  region?: string
  questionType: QuestionFormat
  sourceType: SourceType
  title: string
  content: string
  answer: string
  explanation: string
  tags: string[]
}

export interface ActivityLog {
  id: string
  type: 'upload' | 'explain' | 'mistake' | 'review' | 'quiz' | 'card' | 'paper' | 'plan'
  title: string
  description: string
  createdAt: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  aiMode: 'guided' | 'balanced' | 'direct'
  dailyReminder: boolean
  reminderTime: string
  autoAddMistakes: boolean
  dataVersion: number
}

export interface AppState {
  version: number
  profile: StudentProfile
  questions: QuestionRecord[]
  mistakes: MistakeRecord[]
  papers: PaperRecord[]
  knowledgePoints: KnowledgePoint[]
  reviewTasks: ReviewTask[]
  dailyPlans: DailyPlan[]
  quizzes: QuizRecord[]
  cards: StudyCard[]
  knowledgeItems: KnowledgeItem[]
  activityLogs: ActivityLog[]
  settings: AppSettings
}

export interface SaveMistakeInput {
  question: QuestionRecord
  studentAnswer: string
  primaryCause: ErrorCause
  secondaryCause?: ErrorCause
  note?: string
}

export interface SimulationResultItem {
  question: QuizQuestion
  isCorrect: boolean
  userAnswer: string
  cause?: ErrorCause
}
