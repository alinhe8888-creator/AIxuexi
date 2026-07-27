export type Subject = '语文' | '数学' | '英语' | '历史' | '地理' | '政治'
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

export type SourceType = 'user_upload' | 'real_exam' | 'ai_generated' | 'open_resource' | 'demo'
export type TaskType = 'study' | 'review' | 'quiz'
export type TaskStatus = 'pending' | 'completed'
export type QuestionFormat = '选择题' | '填空题' | '判断题' | '解答题' | '默写题'
export type ExplanationStyle = '启发提问' | '生活类比' | '图像框架' | '公式推导' | '步骤拆解' | '反例辨析'
export type CorrectionStatus = '待订正' | '订正中' | '待验证' | '已验证'

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
  imageKey?: string
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

export interface ExplanationMethod {
  id: string
  name: string
  style: ExplanationStyle
  bestFor: string
  openingQuestion: string
  hints: string[]
  steps: Array<{ title: string; content: string }>
  checkpointQuestion: string
  checkpointAnswer: string
  checkpointExplanation: string
  memoryTip: string
}

export interface AiExplanation {
  knowledgePoints: string[]
  diagnosis: {
    likelyCause: ErrorCause
    confidence: number
    evidence: string
    firstQuestion: string
  }
  recommendedMethodId: string
  methods: ExplanationMethod[]
  answerRevealAfterAttempts: number
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

export interface AnswerAssessment {
  correct: boolean
  score: number
  feedback: string
  misconception: string
  errorCause: ErrorCause
  nextAction: 'retry' | 'switch_method' | 'reveal' | 'complete'
  targetedHint: string
  suggestedMethodId?: string
  revealAnswer?: string
}

export interface CorrectionAttempt {
  id: string
  attemptNumber: number
  answer: string
  methodId: string
  correct: boolean
  score: number
  feedback: string
  errorCause: ErrorCause
  createdAt: string
}

export interface CorrectionJourney {
  status: CorrectionStatus
  currentMethodId?: string
  triedMethodIds: string[]
  preferredMethodId?: string
  preferredStyle?: ExplanationStyle
  attempts: CorrectionAttempt[]
  finalAnswerRevealed: boolean
  transferPassed: boolean
  selfExplanation?: string
  startedAt?: string
  verifiedAt?: string
}

export interface LearningStrategyPreference {
  style: ExplanationStyle
  methodName: string
  subject?: Subject
  usedCount: number
  successCount: number
  totalScore: number
  lastUsedAt: string
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
  imageKey?: string
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
  correction?: CorrectionJourney
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
  sourceImageKeys?: string[]
}

export interface PaperRecord {
  id: string
  title: string
  subject: Subject
  date: string
  fullScore: number
  score: number
  imageDataUrls: string[]
  sourceImageKeys?: string[]
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
  category: '英文单词' | '英文短语' | '英文语法' | '古诗词' | '文言文' | '数学公式' | '历史要点' | '地理规律' | '政治概念'
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
  bookId?: string
  bookTitle?: string
  resourceKind?: 'textbook' | 'workbook' | 'exam' | 'question-bank' | 'notes' | 'custom'
  sourceName?: string
  sourceFile?: string
  sourcePath?: string
  materialId?: string
  createdAt?: string
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
  answerRevealAttempts?: number
  adaptiveExplanation?: boolean
  saveEffectiveMethods?: boolean
  strictCorrectionMode?: boolean
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
  strategyPreferences: LearningStrategyPreference[]
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

export type UserRole = 'student' | 'parent'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: UserRole
}

export interface ParentChildSummary {
  id: string
  email: string
  displayName: string
  linkedAt: string
  lastSyncedAt: string | null
}

export interface ParentDashboard {
  student: {
    userId: string
    displayName: string
    email: string
    grade: string
    lastSyncedAt: string
  }
  today: {
    completed: number
    total: number
    completionRate: number
    plannedMinutes: number
    completedMinutes: number
  }
  overview: {
    mastery: number
    weakPointCount: number
    highRiskCount: number
    activeMistakeCount: number
    latestQuizRate: number
  }
  subjects: Array<{ subject: string; mastery: number; accuracy: number; weakCount: number; riskCount: number }>
  weakPoints: Array<{ id: string; subject: string; chapter: string; name: string; mastery: number; accuracy: number; errorCount: number; mainCause?: string; forgettingRisk?: string; trend?: number[] }>
  causes: Array<{ label: string; value: number }>
  recentMistakes: Array<{ id: string; subject: string; chapter: string; knowledgePointName: string; primaryCause: string; wrongAt: string; wrongCount: number; mastery: number }>
  recentQuizzes: Array<{ id: string; title: string; date: string; correctRate: number; status: string; weakPoints?: string[] }>
  trend: number[]
  alerts: Array<{ level: 'high' | 'medium'; title: string; description: string }>
  activity: Array<{ id: string; type: string; title: string; description: string; createdAt: string }>
  recommendations: Array<{ priority: number; title: string; description: string }>
  dailyActivity: Array<{ date: string; completionRate: number; plannedMinutes: number; completedMinutes: number }>
  mistakeTrend: Array<{ date: string; count: number }>
  masteryDistribution: Array<{ label: string; value: number }>
  reviewStatus: Array<{ label: string; value: number }>
  learningMix: Array<{ label: string; value: number }>
  subjectRadar: Array<{ label: string; mastery: number; accuracy: number; stability: number }>
  strategyMethods: Array<{ label: string; value: number; usedCount: number; subject?: string }>
}
