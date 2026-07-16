import type { AiExplanation, PaperQuestionAnalysis, QuestionFormat, QuizQuestion, Subject } from '../types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const subjectTemplates: Record<Subject, { chapter: string; point: string; content: string; answer: string; format: QuestionFormat }> = {
  语文: { chapter: '古诗词鉴赏', point: '诗歌情感与表现手法', content: '阅读诗句，结合意象分析作者表达的思想感情。', answer: '先概括意象营造的氛围，再结合关键词说明情感。', format: '解答题' },
  数学: { chapter: '函数与导数', point: '导数的几何意义', content: '已知函数 f(x)=x²-4x+5，求曲线在 x=1 处的切线方程。', answer: 'y=-2x+3', format: '解答题' },
  英语: { chapter: '非谓语动词', point: '分词作状语', content: '____ by the teacher, the student corrected the mistake at once. (encourage)', answer: 'Encouraged', format: '填空题' },
  物理: { chapter: '机械能守恒', point: '机械能守恒条件', content: '小球沿光滑轨道下滑，不计空气阻力。判断机械能是否守恒并说明理由。', answer: '守恒；只有重力做功。', format: '解答题' },
  化学: { chapter: '化学平衡', point: '平衡移动判断', content: '对于放热反应，升高温度后平衡向哪个方向移动？说明理由。', answer: '向吸热方向移动，即逆反应方向。', format: '解答题' },
  生物: { chapter: '细胞膜', point: '物质跨膜运输', content: '比较自由扩散、协助扩散和主动运输在方向、载体和能量方面的差异。', answer: '自由扩散顺浓度、不需载体和能量；协助扩散顺浓度、需载体、不耗能；主动运输可逆浓度、需载体和能量。', format: '解答题' },
  历史: { chapter: '中国近现代史', point: '史料实证', content: '阅读材料，概括材料反映的历史现象并分析其背景。', answer: '先从材料提取现象，再结合时代、经济、政治和社会因素分析。', format: '解答题' },
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
  const subjectSpecific: Partial<Record<Subject, AiExplanation>> = {
    数学: {
      knowledgePoints: ['导数的几何意义', '点斜式直线方程'],
      thinking: '切线问题固定分为三步：求导数得到斜率、代入求切点、用点斜式写方程。先不要急着展开计算。',
      steps: [
        { title: '第一步：确定工具', content: '题目出现“某点处的切线”，说明需要用该点的导数值作为切线斜率。' },
        { title: '第二步：求斜率', content: "对函数求导，再把给定的 x 值代入 f′(x)，得到 k。" },
        { title: '第三步：求切点', content: '把给定 x 代入原函数 f(x)，得到切点坐标 (x₀, y₀)。' },
        { title: '第四步：写切线', content: '使用 y-y₀=k(x-x₀)，最后整理为标准形式。' },
      ],
      finalAnswer: correctAnswer || template.answer,
      commonMistakes: ['把 f(x₀) 当成斜率', '求导后忘记代入指定点', '使用点斜式时符号出错'],
      lifeExample: '曲线像一条山路，导数表示站在某一点时脚下的即时坡度；切线就是那一小段路面的延伸。',
      instantCheck: { question: '函数 g(x)=x²+2x 在 x=0 处的切线斜率是多少？', answer: '2', explanation: "g′(x)=2x+2，因此 g′(0)=2。" },
    },
    物理: {
      knowledgePoints: ['机械能守恒条件', '功能关系'],
      thinking: '不要只看动能或势能是否变化，要先判断有哪些力做功，再判断机械能总量。',
      steps: [
        { title: '第一步：选研究对象', content: '明确研究对象是小球，分析运动过程中受到哪些力。' },
        { title: '第二步：分析做功', content: '支持力与速度方向垂直，不做功；只有重力做功。' },
        { title: '第三步：判断守恒', content: '只有重力做功时，动能与重力势能相互转化，机械能守恒。' },
      ],
      finalAnswer: correctAnswer || template.answer,
      commonMistakes: ['看到势能减少就判断机械能减少', '没有区分“受力”和“做功”', '忽略摩擦或空气阻力条件'],
      lifeExample: '过山车从高处下滑时，速度越来越快，是势能转成动能；若摩擦很小，总机械能近似不变。',
      instantCheck: { question: '物体沿粗糙斜面下滑时，机械能是否一定守恒？', answer: '不一定守恒', explanation: '摩擦力通常做负功，使部分机械能转化为内能。' },
    },
    英语: {
      knowledgePoints: ['非谓语动词', '逻辑主语与主被动关系'],
      thinking: '先找到句子逻辑主语，再判断它与动作之间是主动还是被动，最后选择现在分词或过去分词。',
      steps: [
        { title: '第一步：找逻辑主语', content: '分词短语的逻辑主语通常与主句主语一致。' },
        { title: '第二步：判断关系', content: '主语主动执行动作时用 doing；主语承受动作时用 done。' },
        { title: '第三步：检查语义', content: '把答案放回句子，检查时间和逻辑是否通顺。' },
      ],
      finalAnswer: correctAnswer || template.answer,
      commonMistakes: ['只根据中文意思选词', '忽略主语与动作的主动/被动关系', '把谓语动词和非谓语动词混淆'],
      lifeExample: '“看到风景的人”用 seeing；“被别人看到的城市”用 seen。关键看谁执行动作。',
      instantCheck: { question: '____ in 1911, the university has a long history. (found)', answer: 'Founded', explanation: 'university 与 found 是被动关系，使用过去分词 Founded。' },
    },
  }
  return subjectSpecific[subject] ?? {
    knowledgePoints: [template.point],
    thinking: '先识别题型和设问，再提取已知条件，按知识点组织答案，最后检查是否回应了全部问题。',
    steps: [
      { title: '识别设问', content: `本题考查“${template.point}”，先圈出题目中的限定词和任务词。` },
      { title: '提取条件', content: `从题目中整理与“${content.slice(0, 18)}…”有关的关键信息。` },
      { title: '组织答案', content: '按“结论—依据—说明”的顺序作答，避免只写结论。' },
      { title: '检查', content: '检查是否漏答、术语是否准确、表达是否完整。' },
    ],
    finalAnswer: correctAnswer || template.answer,
    commonMistakes: ['没有回应设问中的限定条件', '只写结论不写依据', '知识术语表达不准确'],
    lifeExample: '像向同学解释一件事：先说结论，再说明为什么，最后用题目条件证明。',
    instantCheck: { question: `请用一句话概括“${template.point}”的核心判断方法。`, answer: '围绕设问，使用对应知识点和材料条件形成完整结论。', explanation: '能说清判断依据，才说明真正掌握。' },
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
