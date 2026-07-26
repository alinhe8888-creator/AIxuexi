import { randomUUID } from 'node:crypto'
import { config } from './config.js'

export const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'] as const
export type Subject = typeof subjects[number]
export type QuestionFormat = '选择题' | '填空题' | '判断题' | '解答题' | '默写题'

interface Template {
  chapter: string
  point: string
  content: string
  answer: string
  format: QuestionFormat
  thinking: string
  steps: Array<{ title: string; content: string }>
  mistakes: string[]
  lifeExample: string
  check: { question: string; answer: string; explanation: string }
}

const templates: Record<Subject, Template> = {
  语文: {
    chapter: '古诗词鉴赏', point: '诗歌情感与表现手法', format: '解答题',
    content: '阅读诗句，结合意象和关键词分析作者表达的思想感情。',
    answer: '先概括意象营造的氛围，再结合关键词说明作者的思想感情。',
    thinking: '先找意象与情感词，再结合写作背景和表现手法组织答案。',
    steps: [{ title: '提取意象', content: '圈出具有画面感或情绪色彩的景物。' }, { title: '判断氛围', content: '概括画面的冷暖、明暗、动静和疏密。' }, { title: '联系情感', content: '把氛围与诗人的处境、动作和语气联系起来。' }],
    mistakes: ['只翻译诗句，没有概括情感', '情感判断缺少文本依据', '把表现手法和情感混为一谈'],
    lifeExample: '同一场雨，在送别场景中可能显得凄清，在久旱之后则可能带来喜悦。',
    check: { question: '“孤帆远影碧空尽”主要通过什么画面表达惜别之情？', answer: '目送孤帆渐远直至消失的画面', explanation: '动作持续且视线追随，表现留恋和不舍。' },
  },
  数学: {
    chapter: '函数与导数', point: '导数的几何意义', format: '解答题',
    content: '已知函数 f(x)=x²-4x+5，求曲线在 x=1 处的切线方程。',
    answer: 'y=-2x+4',
    thinking: '切线问题分三步：求导得到斜率、代入原函数得到切点、使用点斜式。',
    steps: [{ title: '求导数', content: "f′(x)=2x-4。" }, { title: '求斜率与切点', content: "f′(1)=-2，f(1)=2，切点为 (1,2)。" }, { title: '写切线方程', content: 'y-2=-2(x-1)，整理得 y=-2x+4。' }],
    mistakes: ['把函数值当成斜率', '求导后忘记代入指定横坐标', '点斜式移项时符号错误'],
    lifeExample: '曲线像山路，导数表示站在某一点时脚下的即时坡度。',
    check: { question: 'g(x)=x²+2x 在 x=0 处的切线斜率是多少？', answer: '2', explanation: "g′(x)=2x+2，所以 g′(0)=2。" },
  },
  英语: {
    chapter: '非谓语动词', point: '分词作状语', format: '填空题',
    content: '____ by the teacher, the student corrected the mistake at once. (encourage)',
    answer: 'Encouraged',
    thinking: '先找逻辑主语，再判断主语与动作是主动还是被动。',
    steps: [{ title: '找逻辑主语', content: '分词短语的逻辑主语与主句主语 student 一致。' }, { title: '判断语态', content: 'student 是被老师鼓励，因此为被动关系。' }, { title: '确定形式', content: '被动关系使用过去分词 Encouraged。' }],
    mistakes: ['只按中文选词', '忽略逻辑主语', '把非谓语动词当成谓语'],
    lifeExample: '“看到风景的人”用 seeing，“被别人看到的城市”用 seen。',
    check: { question: '____ in 1911, the university has a long history. (found)', answer: 'Founded', explanation: 'university 与 found 是被动关系。' },
  },
  物理: {
    chapter: '机械能守恒', point: '机械能守恒条件', format: '解答题',
    content: '小球沿光滑轨道下滑，不计空气阻力。判断机械能是否守恒并说明理由。',
    answer: '机械能守恒，因为只有重力做功。',
    thinking: '先分析力是否做功，再判断是否只有重力或弹力做功。',
    steps: [{ title: '确定研究对象', content: '以小球为研究对象。' }, { title: '分析做功', content: '支持力与瞬时位移垂直，不做功；只有重力做功。' }, { title: '得出结论', content: '动能与重力势能相互转化，机械能守恒。' }],
    mistakes: ['看到势能减少就判断机械能减少', '把受力等同于做功', '忽略摩擦条件'],
    lifeExample: '理想过山车下滑时，势能转化为动能，总机械能保持不变。',
    check: { question: '物体沿粗糙斜面下滑时机械能一定守恒吗？', answer: '不一定', explanation: '摩擦力可能把部分机械能转化为内能。' },
  },
  化学: {
    chapter: '化学平衡', point: '勒夏特列原理', format: '解答题',
    content: '对于正反应为放热反应的平衡体系，升高温度后平衡向哪个方向移动？',
    answer: '向吸热方向移动，即逆反应方向。',
    thinking: '把升高温度看成增加“热量”，体系会向消耗热量的方向移动。',
    steps: [{ title: '识别热效应', content: '正反应放热，逆反应吸热。' }, { title: '判断外界变化', content: '升温相当于增加热量。' }, { title: '应用原理', content: '平衡向吸热的逆反应方向移动。' }],
    mistakes: ['把反应速率变化当成平衡移动方向', '没有先判断正反应热效应', '认为升温总向正反应移动'],
    lifeExample: '系统会尽量抵消外界变化，就像房间变热后制冷设备开始工作。',
    check: { question: '放热反应降温时平衡向哪个方向移动？', answer: '正反应方向', explanation: '降温后体系向放热方向移动。' },
  },
  生物: {
    chapter: '细胞膜', point: '物质跨膜运输', format: '解答题',
    content: '比较自由扩散、协助扩散和主动运输在方向、载体和能量方面的差异。',
    answer: '自由扩散顺浓度、不需载体和能量；协助扩散顺浓度、需载体、不耗能；主动运输可逆浓度、需载体和能量。',
    thinking: '用方向、载体、能量三个维度建立对照表。',
    steps: [{ title: '比较方向', content: '自由扩散和协助扩散顺浓度梯度，主动运输可逆浓度梯度。' }, { title: '比较载体', content: '自由扩散不需要载体，另外两种通常需要。' }, { title: '比较能量', content: '主动运输需要能量，前两种不需要。' }],
    mistakes: ['把协助扩散误认为耗能', '忽略主动运输可逆浓度梯度', '只背结论不按维度比较'],
    lifeExample: '顺坡下行像被动运输，逆坡搬运则需要额外能量。',
    check: { question: '葡萄糖进入红细胞通常属于哪种运输？', answer: '协助扩散', explanation: '顺浓度梯度并需要载体，不直接消耗能量。' },
  },
  历史: {
    chapter: '中国近现代史', point: '史料实证', format: '解答题',
    content: '阅读材料，概括材料反映的历史现象并分析其背景。',
    answer: '先从材料提取历史现象，再从政治、经济、社会和思想等角度分析背景。',
    thinking: '材料题先做“材料内概括”，再做“教材外解释”。',
    steps: [{ title: '标注时间与主体', content: '确定材料发生的时代和主要参与者。' }, { title: '概括现象', content: '用材料中的变化、数量和行为概括现象。' }, { title: '分析背景', content: '结合时代条件从多角度解释原因。' }],
    mistakes: ['照抄材料不概括', '脱离时间背景套模板', '原因与影响混写'],
    lifeExample: '分析一家公司转型，也要先看发生了什么，再看市场、政策和技术背景。',
    check: { question: '史料题概括现象时是否应大段照抄原文？', answer: '不应', explanation: '应提炼信息并用历史学科语言概括。' },
  },
  地理: {
    chapter: '自然地理', point: '气候成因分析', format: '解答题',
    content: '分析某地夏季高温多雨的主要原因。',
    answer: '从纬度位置、海陆位置、大气环流和地形等方面分析。',
    thinking: '气候成因按纬度、环流、海陆和地形建立固定分析框架。',
    steps: [{ title: '判断热量条件', content: '结合纬度和太阳高度判断高温原因。' }, { title: '判断水汽来源', content: '结合海陆位置和盛行风判断水汽输送。' }, { title: '判断抬升条件', content: '结合锋面、地形或对流判断降水形成。' }],
    mistakes: ['只说“受季风影响”而缺少过程', '忽略地形抬升', '把天气现象直接当成气候成因'],
    lifeExample: '降水像把水汽送到空中冷却，既要有水汽来源，也要有抬升条件。',
    check: { question: '迎风坡通常比背风坡降水多的主要原因是什么？', answer: '气流受地形抬升冷却凝结', explanation: '迎风坡产生地形雨，背风坡下沉增温。' },
  },
  政治: {
    chapter: '经济与社会', point: '材料分析题', format: '解答题',
    content: '结合材料，说明企业应如何实现高质量发展。',
    answer: '可从创新、质量、品牌、人才、绿色发展、开放合作和社会责任等角度作答。',
    thinking: '先从材料提取企业面临的问题，再匹配教材中的经营发展措施。',
    steps: [{ title: '提取材料问题', content: '标出成本、技术、品牌、市场或环保等关键词。' }, { title: '匹配原理', content: '把材料问题对应到创新、质量、管理、人才等措施。' }, { title: '材料化表达', content: '每一点都要回扣材料，避免只写空泛模板。' }],
    mistakes: ['只背模板不结合材料', '措施和问题不对应', '多个要点表达重复'],
    lifeExample: '像给企业做诊断，先找到具体问题，再开对应的“药方”。',
    check: { question: '材料强调核心技术受制于人，企业最优先的措施是什么？', answer: '加强自主创新和关键核心技术攻关', explanation: '措施要直接对应材料中的技术短板。' },
  },
}

const extractJson = (text: string) => {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = Math.min(...['{', '['].map((char) => { const i = cleaned.indexOf(char); return i < 0 ? Number.POSITIVE_INFINITY : i }))
  if (!Number.isFinite(start)) throw new Error('模型没有返回 JSON')
  return JSON.parse(cleaned.slice(start)) as unknown
}

async function callModel(messages: unknown[], vision = false): Promise<unknown | null> {
  if (!config.aiApiKey || !config.aiApiBaseUrl) return null
  const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.aiApiKey}` },
    body: JSON.stringify({
      model: vision ? config.aiVisionModel : config.aiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`)
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('AI provider returned empty content')
  return extractJson(content)
}

export function fallbackQuestion(subject: Subject) {
  const item = templates[subject]
  return { content: item.content, chapter: item.chapter, knowledgePointName: item.point, correctAnswer: item.answer, questionFormat: item.format, confidence: 0.86 }
}

export async function recognizeQuestion(input: { subject: Subject; imageDataUrl: string; fileName?: string }) {
  try {
    const result = await callModel([
      { role: 'system', content: '你是高中题目OCR结构化服务。仅返回JSON对象，字段为content、chapter、knowledgePointName、correctAnswer、questionFormat、confidence。无法确定答案时给出合理待确认文本。' },
      { role: 'user', content: [{ type: 'text', text: `科目：${input.subject}。识别图片中的一道题并结构化。` }, { type: 'image_url', image_url: { url: input.imageDataUrl } }] },
    ], true)
    if (result && typeof result === 'object' && !Array.isArray(result)) return result
  } catch (error) {
    console.warn('Vision OCR provider failed, using structured fallback.', error)
  }
  return fallbackQuestion(input.subject)
}

export async function recognizePaper(input: { subject: Subject; imageDataUrls: string[] }) {
  try {
    const imageParts = input.imageDataUrls.slice(0, 6).map((url) => ({ type: 'image_url', image_url: { url } }))
    const result = await callModel([
      { role: 'system', content: '你是高中试卷OCR与初步分析服务。仅返回JSON对象 {questions:[...]}。每题字段：id,questionNo,subject,knowledgePointName,knowledgePointId,fullScore,score,isCorrect,errorCause,content,correctAnswer,studentAnswer。errorCause只能为：知识点不会、概念理解错误、公式记忆错误、审题错误、计算错误、解题思路错误、步骤遗漏、粗心、时间不足。' },
      { role: 'user', content: [{ type: 'text', text: `科目：${input.subject}。按页序识别试卷，无法确认得分时使用0并允许用户后续修改。` }, ...imageParts] },
    ], true) as { questions?: unknown[] } | null
    if (result?.questions && Array.isArray(result.questions)) return result.questions
  } catch (error) {
    console.warn('Paper OCR provider failed, using structured fallback.', error)
  }
  const item = templates[input.subject]
  return Array.from({ length: Math.max(3, Math.min(6, input.imageDataUrls.length * 2 || 3)) }, (_, index) => ({
    id: randomUUID(), questionNo: String(index + 1), subject: input.subject,
    knowledgePointName: index % 2 ? `${item.point}应用` : item.point,
    knowledgePointId: `${input.subject}-${item.point}-${index % 2}`,
    fullScore: index < 2 ? 5 : 10,
    score: index === 0 ? 5 : index === 1 ? 2 : 0,
    isCorrect: index === 0,
    errorCause: index === 0 ? undefined : index % 2 ? '计算错误' : '知识点不会',
    content: index === 0 ? item.content : `${item.content}（第 ${index + 1} 题，识别结果请人工核对）`,
    correctAnswer: item.answer,
    studentAnswer: index === 0 ? item.answer : '待补充学生答案',
  }))
}

export async function explainQuestion(input: { subject: Subject; content: string; correctAnswer?: string }) {
  try {
    const result = await callModel([
      { role: 'system', content: '你是高中AI家教。仅返回JSON对象，字段：knowledgePoints:string[]、thinking:string、steps:{title,content}[]、finalAnswer:string、commonMistakes:string[]、lifeExample:string、instantCheck:{question,answer,explanation}。讲解要分步，不省略关键推理。' },
      { role: 'user', content: `科目：${input.subject}\n题目：${input.content}\n参考答案：${input.correctAnswer || '未知'}` },
    ])
    if (result && typeof result === 'object' && !Array.isArray(result)) return result
  } catch (error) {
    console.warn('AI explanation provider failed, using structured fallback.', error)
  }
  const item = templates[input.subject]
  return { knowledgePoints: [item.point], thinking: item.thinking, steps: item.steps, finalAnswer: input.correctAnswer || item.answer, commonMistakes: item.mistakes, lifeExample: item.lifeExample, instantCheck: item.check }
}

export async function generateSimulation(input: { subject: Subject; points: Array<{ id: string; name: string }>; count: number }) {
  const count = Math.max(1, Math.min(20, input.count || 5))
  try {
    const result = await callModel([
      { role: 'system', content: '你是高中练习题生成服务。仅返回JSON对象 {questions:[...]}。每题字段：id、subject、knowledgePointId、knowledgePointName、content、format、options、correctAnswer、explanation、sourceType。sourceType固定ai_generated。' },
      { role: 'user', content: `科目：${input.subject}\n知识点：${input.points.map((p) => p.name).join('、')}\n题量：${count}` },
    ]) as { questions?: unknown[] } | null
    if (result?.questions && Array.isArray(result.questions)) return result.questions
  } catch (error) {
    console.warn('AI simulation provider failed, using structured fallback.', error)
  }
  const item = templates[input.subject]
  const points = input.points.length ? input.points : [{ id: `${input.subject}-${item.point}`, name: item.point }]
  return Array.from({ length: count }, (_, index) => {
    const point = points[index % points.length]!
    return {
      id: randomUUID(), subject: input.subject, knowledgePointId: point.id, knowledgePointName: point.name,
      content: `${item.content}${index ? `（变式 ${index + 1}）` : ''}`,
      format: item.format, options: item.format === '选择题' ? ['A', 'B', 'C', 'D'] : undefined,
      correctAnswer: item.answer, explanation: item.thinking, sourceType: 'ai_generated',
    }
  })
}

const knowledgeSeed = subjects.flatMap((subject, index) => {
  const item = templates[subject]
  return [
    { id: `kb-${index}-concept`, subject, grade: '高二', chapter: item.chapter, knowledgePoint: item.point, questionType: item.format, sourceType: 'demo', title: `${item.point}核心方法`, content: item.content, answer: item.answer, explanation: item.thinking, tags: [item.chapter, item.point] },
    { id: `kb-${index}-practice`, subject, grade: '高二', chapter: item.chapter, knowledgePoint: item.point, questionType: item.format, sourceType: 'ai_generated', title: `${item.point}基础练习`, content: item.check.question, answer: item.check.answer, explanation: item.check.explanation, tags: ['基础', '即时检测'] },
  ]
})

export function searchKnowledge(filters: Record<string, string | undefined>) {
  return knowledgeSeed.filter((item) => {
    if (filters.subject && item.subject !== filters.subject) return false
    if (filters.grade && item.grade !== filters.grade) return false
    if (filters.chapter && !item.chapter.includes(filters.chapter)) return false
    if (filters.knowledgePoint && !item.knowledgePoint.includes(filters.knowledgePoint)) return false
    if (filters.sourceType && item.sourceType !== filters.sourceType) return false
    const keyword = filters.keyword?.toLowerCase()
    if (keyword && !`${item.title}${item.content}${item.chapter}${item.knowledgePoint}${item.tags.join('')}`.toLowerCase().includes(keyword)) return false
    return true
  })
}
