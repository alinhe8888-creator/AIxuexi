import type { ErrorCause, MasteryLevel, RiskLevel } from '../types'

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

export const getMasteryLevel = (mastery: number): MasteryLevel => {
  if (mastery < 25) return '未掌握'
  if (mastery < 45) return '薄弱'
  if (mastery < 65) return '一般'
  if (mastery < 85) return '良好'
  return '熟练'
}

export const getRiskLevel = (mastery: number, daysSinceReview: number, errorCount: number): RiskLevel => {
  const score = (100 - mastery) * 0.55 + Math.min(daysSinceReview, 30) * 1.4 + Math.min(errorCount, 12) * 2.4
  if (score >= 65) return '高'
  if (score >= 35) return '中'
  return '低'
}

export const reviewIntervalDays = (rating: 'again' | 'hard' | 'good' | 'easy', correctStreak = 0): number => {
  if (rating === 'again') return 1
  if (rating === 'hard') return 2
  if (rating === 'good') return correctStreak >= 2 ? 7 : 3
  return correctStreak >= 3 ? 14 : 7
}

export const ratingMasteryDelta = (rating: 'again' | 'hard' | 'good' | 'easy'): number => {
  if (rating === 'again') return -15
  if (rating === 'hard') return -5
  if (rating === 'good') return 8
  return 14
}

export const causeLabels: ErrorCause[] = [
  '知识点不会',
  '概念理解错误',
  '公式记忆错误',
  '审题错误',
  '计算错误',
  '解题思路错误',
  '步骤遗漏',
  '粗心',
  '时间不足',
]

export const sourceLabels = {
  user_upload: '用户上传',
  real_exam: '公开真题',
  ai_generated: 'AI 生成',
  demo: '演示题',
} as const
