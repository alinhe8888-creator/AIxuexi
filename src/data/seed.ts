import type { AppState, ErrorCause, KnowledgePoint, QuestionRecord, StudyCard, Subject } from '../types'
import { addDays, toDateKey } from '../utils/date'

const now = new Date()
const iso = now.toISOString()
const today = toDateKey(now)

const kp = (
  id: string,
  subject: Subject,
  chapter: string,
  name: string,
  mastery: number,
  accuracy: number,
  errorCount: number,
  mainCause: ErrorCause,
  trend: number[],
): KnowledgePoint => ({
  id,
  subject,
  grade: '高二',
  chapter,
  name,
  mastery,
  accuracy,
  errorCount,
  reviewCount: Math.max(1, trend.length - 1),
  mainCause,
  lastReviewedAt: addDays(now, -2),
  nextReviewAt: addDays(now, mastery < 50 ? 0 : 3),
  forgettingRisk: mastery < 45 ? '高' : mastery < 70 ? '中' : '低',
  trend,
})

const question1: QuestionRecord = {
  id: 'q-demo-1',
  subject: '数学',
  chapter: '函数与导数',
  knowledgePointId: 'kp-math-derivative',
  knowledgePointName: '导数的几何意义',
  content: '已知函数 f(x)=x²-2x+3，求曲线 y=f(x) 在 x=1 处的切线方程。',
  studentAnswer: 'y=2x+2',
  correctAnswer: 'y=2',
  questionFormat: '解答题',
  sourceType: 'demo',
  explanation: {
    knowledgePoints: ['导数的几何意义', '切线方程'],
    thinking: '先用导数求切线斜率，再用点斜式写出切线方程。',
    steps: [
      { title: '求导', content: "f′(x)=2x-2。" },
      { title: '求斜率', content: "当 x=1 时，f′(1)=0，所以切线斜率 k=0。" },
      { title: '求切点', content: 'f(1)=1-2+3=2，切点为 (1,2)。' },
      { title: '写方程', content: '由点斜式 y-2=0(x-1)，得到 y=2。' },
    ],
    finalAnswer: '切线方程为 y=2。',
    commonMistakes: ['把函数值当成斜率', '求导后忘记代入 x=1', '点斜式代入符号出错'],
    lifeExample: '把曲线看成山路，切线斜率就是你站在某一点时脚下路面的瞬时坡度。此处坡度为 0，所以切线水平。',
    instantCheck: {
      question: '函数 g(x)=x²+1 在 x=0 处的切线方程是什么？',
      answer: 'y=1',
      explanation: "g′(x)=2x，g′(0)=0，且 g(0)=1，所以切线为 y=1。",
    },
  },
  createdAt: addDays(now, -4),
}

const question2: QuestionRecord = {
  id: 'q-demo-2',
  subject: '物理',
  chapter: '机械能守恒',
  knowledgePointId: 'kp-physics-energy',
  knowledgePointName: '机械能守恒条件',
  content: '一个小球从光滑斜面顶端由静止滑下，不计空气阻力。判断小球下滑过程中机械能是否守恒，并说明理由。',
  studentAnswer: '不守恒，因为重力势能减少了。',
  correctAnswer: '守恒。只有重力做功，动能与重力势能相互转化，总机械能不变。',
  questionFormat: '解答题',
  sourceType: 'demo',
  createdAt: addDays(now, -3),
}

const cards: StudyCard[] = [
  {
    id: 'card-1', category: '英文单词', subject: '英语', front: 'significant', back: '重要的；显著的', hint: '常用于 significant difference', format: '选择题', options: ['重要的', '临时的', '模糊的', '普通的'], answer: '重要的', familiarity: 2, reviewCount: 3, correctStreak: 1, nextReviewAt: addDays(now, 0), lastReviewedAt: addDays(now, -2),
  },
  {
    id: 'card-2', category: '数学公式', subject: '数学', front: '等差数列前 n 项和公式', back: 'Sₙ=n(a₁+aₙ)/2 = na₁+n(n-1)d/2', hint: '首尾相加法', format: '填空题', answer: 'Sₙ=n(a₁+aₙ)/2', familiarity: 1, reviewCount: 2, correctStreak: 0, nextReviewAt: addDays(now, 0), lastReviewedAt: addDays(now, -1),
  },
  {
    id: 'card-3', category: '古诗词', subject: '语文', front: '补写：长风破浪会有时，________。', back: '直挂云帆济沧海', hint: '李白《行路难》', format: '默写题', answer: '直挂云帆济沧海', familiarity: 3, reviewCount: 4, correctStreak: 2, nextReviewAt: addDays(now, 1), lastReviewedAt: addDays(now, -3),
  },
  {
    id: 'card-4', category: '物理规律', subject: '物理', front: '机械能守恒的常用判断条件', back: '只有重力或弹力做功；或除重力、弹力外其他力做功代数和为零。', hint: '先看功，再看能量转化', format: '判断题', options: ['正确', '错误'], answer: '正确', familiarity: 2, reviewCount: 2, correctStreak: 1, nextReviewAt: addDays(now, 0), lastReviewedAt: addDays(now, -2),
  },
  {
    id: 'card-5', category: '化学方程式', subject: '化学', front: '实验室制取氯气的反应方程式', back: 'MnO₂ + 4HCl(浓) △ → MnCl₂ + Cl₂↑ + 2H₂O', hint: '二氧化锰与浓盐酸加热', format: '默写题', answer: 'MnO₂ + 4HCl → MnCl₂ + Cl₂ + 2H₂O', familiarity: 1, reviewCount: 1, correctStreak: 0, nextReviewAt: addDays(now, 0),
  },
  {
    id: 'card-6', category: '生物概念', subject: '生物', front: '主动运输的三个关键特征', back: '逆浓度梯度、需要载体蛋白、消耗能量。', hint: '方向、载体、能量', format: '填空题', answer: '逆浓度梯度、载体蛋白、能量', familiarity: 2, reviewCount: 2, correctStreak: 1, nextReviewAt: addDays(now, 2), lastReviewedAt: addDays(now, -1),
  },
]

export function createSeedState(): AppState {
  return {
    version: 1,
    profile: {
      id: 'student-1',
      name: '同学',
      grade: '高二',
      selectedSubjects: ['语文', '数学', '英语', '物理', '化学', '生物'],
      textbookVersions: { 语文: '人教版', 数学: '人教 A 版', 英语: '外研版', 物理: '人教版', 化学: '人教版', 生物: '人教版' },
      currentChapters: { 数学: '函数与导数', 英语: '选择性必修二 Unit 3', 物理: '机械能守恒', 化学: '化学反应原理', 生物: '细胞的物质输入和输出' },
      currentScoreRange: '450–520 分',
      dailyMinutes: 90,
      learningGoal: '先补齐数学、物理薄弱点，保持英语词汇与语文古诗词的稳定复习。',
      onboarded: true,
      createdAt: addDays(now, -20),
      updatedAt: iso,
    },
    questions: [question1, question2],
    mistakes: [
      {
        id: 'mistake-1', questionId: question1.id, subject: '数学', chapter: '函数与导数', knowledgePointId: 'kp-math-derivative', knowledgePointName: '导数的几何意义', originalQuestion: question1.content, studentAnswer: question1.studentAnswer ?? '', correctAnswer: question1.correctAnswer, wrongAt: addDays(now, -4), wrongCount: 2, primaryCause: '概念理解错误', secondaryCause: '计算错误', mastery: 38, masteryLevel: '薄弱', nextReviewAt: addDays(now, 0), lastReviewedAt: addDays(now, -2), note: '注意区分函数值和导数值。', sourceType: 'demo',
      },
      {
        id: 'mistake-2', questionId: question2.id, subject: '物理', chapter: '机械能守恒', knowledgePointId: 'kp-physics-energy', knowledgePointName: '机械能守恒条件', originalQuestion: question2.content, studentAnswer: question2.studentAnswer ?? '', correctAnswer: question2.correctAnswer, wrongAt: addDays(now, -3), wrongCount: 1, primaryCause: '概念理解错误', mastery: 46, masteryLevel: '一般', nextReviewAt: addDays(now, 0), note: '势能减少不代表机械能减少，要看动能是否增加。', sourceType: 'demo',
      },
      {
        id: 'mistake-3', questionId: 'q-demo-3', subject: '英语', chapter: '非谓语动词', knowledgePointId: 'kp-english-participle', knowledgePointName: '现在分词作状语', originalQuestion: '____ from the top of the hill, the city looks beautiful.', studentAnswer: 'Seeing', correctAnswer: 'Seen', wrongAt: addDays(now, -6), wrongCount: 3, primaryCause: '概念理解错误', secondaryCause: '审题错误', mastery: 42, masteryLevel: '薄弱', nextReviewAt: addDays(now, 1), lastReviewedAt: addDays(now, -1), sourceType: 'demo',
      },
    ],
    papers: [],
    knowledgePoints: [
      kp('kp-math-derivative', '数学', '函数与导数', '导数的几何意义', 38, 46, 4, '概念理解错误', [31, 35, 33, 38]),
      kp('kp-math-sequence', '数学', '数列', '等差数列求和', 64, 71, 2, '公式记忆错误', [49, 54, 59, 64]),
      kp('kp-physics-energy', '物理', '机械能守恒', '机械能守恒条件', 46, 52, 3, '概念理解错误', [35, 42, 40, 46]),
      kp('kp-english-participle', '英语', '非谓语动词', '分词作状语', 42, 50, 5, '审题错误', [40, 45, 39, 42]),
      kp('kp-chem-equilibrium', '化学', '化学平衡', '平衡移动判断', 58, 67, 2, '解题思路错误', [45, 49, 54, 58]),
      kp('kp-bio-transport', '生物', '细胞膜', '物质跨膜运输', 76, 82, 1, '粗心', [61, 68, 72, 76]),
      kp('kp-chinese-poetry', '语文', '古诗词', '名篇名句默写', 81, 86, 1, '步骤遗漏', [70, 75, 78, 81]),
    ],
    reviewTasks: [
      { id: 'review-1', sourceId: 'mistake-1', sourceKind: 'mistake', subject: '数学', title: '复习：导数的几何意义', knowledgePointId: 'kp-math-derivative', scheduledDate: today, status: 'pending', priority: 3, createdAt: addDays(now, -2) },
      { id: 'review-2', sourceId: 'mistake-2', sourceKind: 'mistake', subject: '物理', title: '复习：机械能守恒条件', knowledgePointId: 'kp-physics-energy', scheduledDate: today, status: 'pending', priority: 3, createdAt: addDays(now, -2) },
      { id: 'review-3', sourceId: 'card-1', sourceKind: 'card', subject: '英语', title: '卡片复习：significant', scheduledDate: today, status: 'pending', priority: 2, createdAt: addDays(now, -1) },
    ],
    dailyPlans: [
      {
        id: `plan-${today}`,
        date: today,
        generatedAt: iso,
        tasks: [
          { id: 'task-1', title: '导数切线专项', description: '完成 2 道导数几何意义同类题', subject: '数学', type: 'study', estimatedMinutes: 20, status: 'pending', linkedId: 'kp-math-derivative' },
          { id: 'task-2', title: '机械能守恒复盘', description: '复习判断条件并完成即时检测', subject: '物理', type: 'review', estimatedMinutes: 15, status: 'pending', linkedId: 'mistake-2' },
          { id: 'task-3', title: '英语卡片闯关', description: '完成今天到期的 8 张卡片', subject: '英语', type: 'review', estimatedMinutes: 12, status: 'pending' },
          { id: 'task-4', title: '每日小测', description: '5 题混合小测，重点覆盖近期薄弱点', type: 'quiz', estimatedMinutes: 15, status: 'pending', linkedId: `quiz-${today}` },
        ],
      },
    ],
    quizzes: [
      {
        id: `quiz-${today}`,
        title: '今日薄弱点小测',
        date: today,
        score: 0,
        correctRate: 0,
        completedAt: undefined,
        status: 'pending',
        weakPoints: [],
        questions: [
          { id: 'quiz-q1', subject: '数学', knowledgePointId: 'kp-math-derivative', knowledgePointName: '导数的几何意义', content: '函数 f(x)=x² 在 x=1 处的切线斜率是？', format: '选择题', options: ['0', '1', '2', '3'], correctAnswer: '2', explanation: "f′(x)=2x，所以 f′(1)=2。", sourceType: 'ai_generated' },
          { id: 'quiz-q2', subject: '物理', knowledgePointId: 'kp-physics-energy', knowledgePointName: '机械能守恒条件', content: '物体只受重力作用时，机械能一定守恒。', format: '判断题', options: ['正确', '错误'], correctAnswer: '正确', explanation: '只有重力做功时，动能和重力势能相互转化，机械能守恒。', sourceType: 'ai_generated' },
          { id: 'quiz-q3', subject: '英语', knowledgePointId: 'kp-english-participle', knowledgePointName: '分词作状语', content: '____ from space, the earth looks blue.', format: '选择题', options: ['Seeing', 'Seen', 'To see', 'Saw'], correctAnswer: 'Seen', explanation: 'the earth 与 see 是被动关系，应使用过去分词 Seen。', sourceType: 'ai_generated' },
          { id: 'quiz-q4', subject: '化学', knowledgePointId: 'kp-chem-equilibrium', knowledgePointName: '平衡移动判断', content: '升高温度，化学平衡一定向吸热反应方向移动。', format: '判断题', options: ['正确', '错误'], correctAnswer: '正确', explanation: '根据勒夏特列原理，升温使平衡向吸热方向移动。', sourceType: 'ai_generated' },
          { id: 'quiz-q5', subject: '生物', knowledgePointId: 'kp-bio-transport', knowledgePointName: '物质跨膜运输', content: '主动运输一定需要消耗细胞代谢产生的能量。', format: '判断题', options: ['正确', '错误'], correctAnswer: '正确', explanation: '主动运输依赖载体并消耗能量。', sourceType: 'ai_generated' },
        ],
      },
    ],
    cards,
    knowledgeItems: [
      { id: 'ki-1', subject: '数学', grade: '高二', chapter: '函数与导数', knowledgePoint: '导数的几何意义', year: 2024, region: '全国甲卷', questionType: '解答题', sourceType: 'real_exam', title: '导数与切线综合题（公开真题示例结构）', content: '本条为知识库数据结构示例，不包含受版权限制的完整试题正文。', answer: '标准答案字段预留', explanation: '解析字段预留，可接入合法公开内容。', tags: ['导数', '切线', '真题结构'] },
      { id: 'ki-2', subject: '物理', grade: '高二', chapter: '机械能守恒', knowledgePoint: '机械能守恒条件', questionType: '选择题', sourceType: 'ai_generated', title: '机械能守恒条件判断训练', content: '下列过程中，物体机械能一定守恒的是……', answer: '仅受重力作用的过程', explanation: '判断是否存在重力、弹力之外的力做功。', tags: ['机械能', 'AI生成'] },
      { id: 'ki-3', subject: '英语', grade: '高二', chapter: '非谓语动词', knowledgePoint: '分词作状语', questionType: '选择题', sourceType: 'demo', title: '分词作状语基础辨析', content: '____ from the hill, the city looks beautiful.', answer: 'Seen', explanation: '逻辑主语 city 与 see 为被动关系。', tags: ['非谓语', '分词'] },
      { id: 'ki-4', subject: '语文', grade: '高二', chapter: '古诗词', knowledgePoint: '名篇名句默写', questionType: '默写题', sourceType: 'demo', title: '《蜀道难》理解性默写', content: '根据语境补写相关名句。', answer: '答案字段随具体题目提供', explanation: '结合语境和篇章结构记忆。', tags: ['古诗词', '默写'] },
    ],
    activityLogs: [
      { id: 'log-1', type: 'review', title: '完成英语词汇复习', description: '复习 6 张卡片，正确率 83%', createdAt: addDays(now, -1) },
      { id: 'log-2', type: 'mistake', title: '新增物理错题', description: '已加入机械能守恒复习计划', createdAt: addDays(now, -2) },
      { id: 'log-3', type: 'quiz', title: '完成昨日小测', description: '正确率 60%，导数知识点需要继续加强', createdAt: addDays(now, -3) },
    ],
    settings: {
      theme: 'light',
      aiMode: 'guided',
      dailyReminder: true,
      reminderTime: '20:00',
      autoAddMistakes: true,
      dataVersion: 1,
    },
  }
}
