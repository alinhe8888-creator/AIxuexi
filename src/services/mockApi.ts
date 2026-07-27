import type { AiExplanation, PaperQuestionAnalysis, QuestionFormat, QuizQuestion, Subject } from '../types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const subjectTemplates: Record<Subject, { chapter: string; point: string; content: string; answer: string; format: QuestionFormat }> = {
  语文: { chapter: '古诗词鉴赏', point: '诗歌情感与表现手法', content: '阅读诗句，结合意象分析作者表达的思想感情。', answer: '先概括意象营造的氛围，再结合关键词说明情感。', format: '解答题' },
  数学: { chapter: '函数与导数', point: '导数的几何意义', content: '已知函数 f(x)=x²-4x+5，求曲线在 x=1 处的切线方程。', answer: 'y=-2x+4', format: '解答题' },
  英语: { chapter: '非谓语动词', point: '分词作状语', content: '____ by the teacher, the student corrected the mistake at once. (encourage)', answer: 'Encouraged', format: '填空题' },历史: { chapter: '中国近现代史', point: '史料实证', content: '阅读材料，概括材料反映的历史现象并分析其背景。', answer: '先从材料提取现象，再结合时代、经济、政治和社会因素分析。', format: '解答题' },
  地理: { chapter: '自然地理', point: '气候成因分析', content: '分析某地夏季高温多雨的主要原因。', answer: '从纬度位置、海陆位置、大气环流和地形等方面分析。', format: '解答题' },
  政治: { chapter: '经济与社会', point: '材料分析题', content: '结合材料，说明企业应如何实现高质量发展。', answer: '从创新、质量、品牌、人才、绿色发展和社会责任等角度作答。', format: '解答题' },
}

export async function mockOcrRecognize(subject: Subject, fileName?: string) {
  await delay(900)
  if (fileName?.toLowerCase().includes('fail')) throw new Error('模拟 OCR 未能识别清晰文字，请重试或手动输入。')
  const template = subjectTemplates[subject]
  return {
    content: template.content,
    chapter: template.chapter,
    knowledgePointName: template.point,
    correctAnswer: template.answer,
    questionFormat: template.format,
    confidence: 0.91,
  }
}

export async function mockAiExplain(subject: Subject, content: string, correctAnswer?: string): Promise<AiExplanation> {
  await delay(950)
  const template = subjectTemplates[subject]
  const finalAnswer = correctAnswer || template.answer
  const isMath = subject === '数学'
  const isEnglish = subject === '英语'
  const point = template.point
  const commonSteps = isMath
    ? [
        { title: '定位条件', content: '把题目给出的量、关系和所求对象分别写出来。' },
        { title: '选择工具', content: '判断最直接对应的定义、公式或图像关系。' },
        { title: '分步推理', content: '每一步只完成一个变化，并写出依据。' },
        { title: '回代检查', content: '检查符号、范围、单位和题目要求是否全部满足。' },
      ]
    : isEnglish
      ? [
          { title: '找句子主干', content: '先确定主语、谓语和关键修饰关系。' },
          { title: '判断逻辑关系', content: '分析主动被动、时间先后和语法位置。' },
          { title: '代回语境', content: '把候选形式放回句子，检查语义和结构。' },
        ]
      : [
          { title: '识别设问', content: '圈出任务词、限定词和需要回答的层次。' },
          { title: '提取材料', content: '只保留能支撑结论的关键词和事实。' },
          { title: '组织答案', content: '按照结论、依据、说明的顺序完整表达。' },
          { title: '检查覆盖', content: '确认没有漏答限定条件或分问。' },
        ]
  const methods = [
    {
      id: 'guided-questioning',
      name: '启发提问法',
      style: '启发提问' as const,
      bestFor: '知道部分条件，但不知道第一步怎么开始',
      openingQuestion: `这道题关于“${point}”，题目最先要求你判断或求出什么？`,
      hints: ['圈出已知条件和所求对象', '写出与所求对象最直接相关的概念或公式', '把大问题拆成一个可以立即完成的小步骤'],
      steps: commonSteps,
      checkpointQuestion: `请用一句话说出解决“${point}”题的第一步。`,
      checkpointAnswer: '先识别题目条件和设问，再选择直接对应的知识工具。',
      checkpointExplanation: '能说出第一步和依据，说明已经建立了解题入口。',
      memoryTip: '先问“题目要什么”，再问“哪个条件能直接帮助我”。',
    },
    {
      id: 'analogy-visual',
      name: '生活类比与图像法',
      style: '生活类比' as const,
      bestFor: '抽象概念记得住，但无法形成直观理解',
      openingQuestion: '把这个概念放进一个生活场景，它更像“方向”“规则”还是“因果链”？',
      hints: ['先画一个最简单的关系图', '用箭头标出条件如何影响结果', '再把图中的每一步换回学科术语'],
      steps: [
        { title: '建立类比', content: `把“${point}”想成一个由条件推动结果的过程。` },
        { title: '画出关系', content: '用框和箭头表示已知、变化和结论之间的联系。' },
        { title: '回到题目', content: '把图上的关系逐一换回题目中的量或材料。' },
        { title: '形成答案', content: '按照图中的顺序完成推理或表达。' },
      ],
      checkpointQuestion: '请画出或口述这道题的“条件 → 方法 → 结论”关系。',
      checkpointAnswer: '先列条件，再连接到对应方法，最后得到结论。',
      checkpointExplanation: '关系链完整，才说明不是只记住最终答案。',
      memoryTip: '抽象题先变成图，图看懂后再变回公式或文字。',
    },
    {
      id: 'counterexample-steps',
      name: '反例辨析与步骤法',
      style: '反例辨析' as const,
      bestFor: '容易混淆相近概念或反复犯同一种错误',
      openingQuestion: '哪一种看似合理的做法其实会违反题目条件？',
      hints: ['列出一个常见错误做法', '指出它具体违反了哪个条件', '再写出正确步骤与错误步骤的差别'],
      steps: [
        { title: '暴露错误路径', content: '先写出最容易误用的概念、公式或材料。' },
        { title: '找到冲突', content: '用题目中的限定条件说明这条路径为什么不成立。' },
        { title: '替换方法', content: '选择能够同时满足全部条件的正确路径。' },
        { title: '对照检查', content: '把正确与错误步骤并排比较，记住分界点。' },
      ],
      checkpointQuestion: '本题最容易犯的错误是什么？你如何用题目条件排除它？',
      checkpointAnswer: '指出错误方法及其违反的具体条件。',
      checkpointExplanation: '能排除错误路径，说明概念边界已经更清楚。',
      memoryTip: '不仅记“怎么做”，还要记“为什么不能那样做”。',
    },
  ]
  return {
    knowledgePoints: [point],
    diagnosis: {
      likelyCause: '解题思路错误',
      confidence: 0.78,
      evidence: `根据题目“${content.slice(0, 36)}”和学生作答，优先检查第一步定位与条件使用。`,
      firstQuestion: methods[0].openingQuestion,
    },
    recommendedMethodId: methods[0].id,
    methods,
    answerRevealAfterAttempts: 2,
    thinking: methods[0].openingQuestion,
    steps: commonSteps,
    finalAnswer,
    commonMistakes: ['跳过审题直接套模板', '只写结果没有依据', '忽略限定条件或检查步骤'],
    lifeExample: '像规划一条路线：先确认终点，再看手里有哪些路标，最后逐段检查有没有走偏。',
    instantCheck: {
      question: `请用同样方法完成一道关于“${point}”的简短迁移题，并写出第一步依据。`,
      answer: '答案应包含正确结论以及对应的第一步依据。',
      explanation: '迁移题用于验证是否真正掌握方法，而不是记住原题结果。',
    },
  }
}

export async function mockPaperRecognition(subject: Subject): Promise<PaperQuestionAnalysis[]> {
  await delay(1100)
  const templates: Partial<Record<Subject, PaperQuestionAnalysis[]>> = {
    数学: [
      { id: crypto.randomUUID(), questionNo: '1', subject: '数学', knowledgePointId: 'kp-math-sequence', knowledgePointName: '等差数列求和', fullScore: 5, score: 5, isCorrect: true, content: '等差数列基础选择题', correctAnswer: 'B', studentAnswer: 'B' },
      { id: crypto.randomUUID(), questionNo: '2', subject: '数学', knowledgePointId: 'kp-math-derivative', knowledgePointName: '导数的几何意义', fullScore: 5, score: 0, isCorrect: false, errorCause: '概念理解错误', content: '函数切线斜率选择题', correctAnswer: 'C', studentAnswer: 'A' },
      { id: crypto.randomUUID(), questionNo: '15', subject: '数学', knowledgePointId: 'kp-math-probability', knowledgePointName: '条件概率', fullScore: 5, score: 2, isCorrect: false, errorCause: '计算错误', content: '条件概率填空题', correctAnswer: '3/5', studentAnswer: '2/5' },
      { id: crypto.randomUUID(), questionNo: '19', subject: '数学', knowledgePointId: 'kp-math-derivative', knowledgePointName: '导数综合应用', fullScore: 12, score: 7, isCorrect: false, errorCause: '步骤遗漏', content: '利用导数研究函数单调性', correctAnswer: '完整解答见解析', studentAnswer: '缺少分类讨论' },
    ],
  }
  return templates[subject] ?? [
    { id: crypto.randomUUID(), questionNo: '1', subject, knowledgePointId: `kp-${subject}-basic`, knowledgePointName: '基础概念', fullScore: 10, score: 10, isCorrect: true, content: '基础知识题', correctAnswer: '正确答案', studentAnswer: '正确答案' },
    { id: crypto.randomUUID(), questionNo: '2', subject, knowledgePointId: `kp-${subject}-core`, knowledgePointName: '核心知识点', fullScore: 10, score: 4, isCorrect: false, errorCause: '审题错误', content: '核心能力题', correctAnswer: '标准答案', studentAnswer: '答案不完整' },
    { id: crypto.randomUUID(), questionNo: '3', subject, knowledgePointId: `kp-${subject}-apply`, knowledgePointName: '综合应用', fullScore: 20, score: 12, isCorrect: false, errorCause: '解题思路错误', content: '综合应用题', correctAnswer: '标准解题过程', studentAnswer: '思路中断' },
  ]
}

export async function mockGenerateSimulation(subject: Subject, points: Array<{ id: string; name: string }>, count: number): Promise<QuizQuestion[]> {
  await delay(750)
  const fallback = [{ id: `kp-${subject}-basic`, name: `${subject}基础知识` }]
  const pool = points.length ? points : fallback
  return Array.from({ length: count }, (_, index) => {
    const point = pool[index % pool.length]
    const base = subjectTemplates[subject]
    if (index % 2 === 0) {
      return {
        id: crypto.randomUUID(), subject, knowledgePointId: point.id, knowledgePointName: point.name,
        content: `${point.name}训练 ${index + 1}：${base.content}`,
        format: '选择题', options: [base.answer, '条件不足，无法判断', '与题意相反的结论', '以上都不对'], correctAnswer: base.answer,
        explanation: `本题围绕“${point.name}”展开。先识别条件，再使用对应规则判断。`, sourceType: 'ai_generated',
      }
    }
    return {
      id: crypto.randomUUID(), subject, knowledgePointId: point.id, knowledgePointName: point.name,
      content: `${point.name}判断 ${index + 1}：解决此类题时，应先识别条件和考查知识点，再开始计算或组织答案。`,
      format: '判断题', options: ['正确', '错误'], correctAnswer: '正确',
      explanation: '先定位知识点和条件能够减少无效计算与审题错误。', sourceType: 'ai_generated',
    }
  })
}
