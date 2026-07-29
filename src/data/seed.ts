import type { AppState, Subject } from '../types'
import { FIXED_SUBJECTS, FIXED_TEXTBOOK_VERSIONS } from '../config/curriculum'

export function createSeedState(): AppState {
  const now = new Date().toISOString()
  return {
    version: 6,
    profile: {
      id: '',
      name: '',
      grade: '',
      selectedSubjects: [...FIXED_SUBJECTS] as Subject[],
      textbookVersions: { ...FIXED_TEXTBOOK_VERSIONS },
      currentChapters: {},
      currentScoreRange: '',
      dailyMinutes: 90,
      learningGoal: '',
      onboarded: false,
      createdAt: now,
      updatedAt: now,
    },
    questions: [],
    mistakes: [],
    papers: [],
    knowledgePoints: [],
    reviewTasks: [],
    dailyPlans: [],
    quizzes: [],
    cards: [],
    knowledgeItems: [],
    activityLogs: [],
    strategyPreferences: [],
    settings: {
      theme: 'system',
      aiMode: 'guided',
      dailyReminder: false,
      reminderTime: '20:00',
      autoAddMistakes: true,
      dataVersion: 6,
      answerRevealAttempts: 2,
      adaptiveExplanation: true,
      saveEffectiveMethods: true,
      strictCorrectionMode: true,
    },
  }
}
