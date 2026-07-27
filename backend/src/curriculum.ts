export const subjectValues = ['语文', '数学', '英语', '历史', '地理', '政治'] as const
export type SupportedSubject = (typeof subjectValues)[number]

export const fixedTextbookVersions: Record<SupportedSubject, string> = {
  语文: '人教版（统编版）',
  数学: '人教版（A版）',
  英语: '外研版（新标准）',
  历史: '人教版（统编版）',
  地理: '人教版',
  政治: '人教版（统编版）',
}

export interface BackendBookCatalogItem {
  id: string
  subject: SupportedSubject
  title: string
  grade: '高一' | '高二' | '高三' | '跨年级'
  category: '必修' | '选择性必修' | '选修'
  required: boolean
  aliases: string[]
}

export const textbookBooks: readonly BackendBookCatalogItem[] = [
  { id: 'chinese-required-1', subject: '语文', title: '普通高中教科书·语文 必修上册', grade: '高一', category: '必修', required: true, aliases: ['必修上册', '语文必修上'] },
  { id: 'chinese-required-2', subject: '语文', title: '普通高中教科书·语文 必修下册', grade: '高一', category: '必修', required: true, aliases: ['必修下册', '语文必修下'] },
  { id: 'chinese-selective-1', subject: '语文', title: '普通高中教科书·语文 选择性必修上册', grade: '高二', category: '选择性必修', required: false, aliases: ['选择性必修上册'] },
  { id: 'chinese-selective-2', subject: '语文', title: '普通高中教科书·语文 选择性必修中册', grade: '高二', category: '选择性必修', required: false, aliases: ['选择性必修中册'] },
  { id: 'chinese-selective-3', subject: '语文', title: '普通高中教科书·语文 选择性必修下册', grade: '高三', category: '选择性必修', required: false, aliases: ['选择性必修下册'] },
  { id: 'math-required-1', subject: '数学', title: '普通高中教科书·数学A版 必修第一册', grade: '高一', category: '必修', required: true, aliases: ['数学必修一', '必修第一册'] },
  { id: 'math-required-2', subject: '数学', title: '普通高中教科书·数学A版 必修第二册', grade: '高一', category: '必修', required: true, aliases: ['数学必修二', '必修第二册'] },
  { id: 'math-selective-1', subject: '数学', title: '普通高中教科书·数学A版 选择性必修第一册', grade: '高二', category: '选择性必修', required: false, aliases: ['数学选必一', '选择性必修第一册'] },
  { id: 'math-selective-2', subject: '数学', title: '普通高中教科书·数学A版 选择性必修第二册', grade: '高二', category: '选择性必修', required: false, aliases: ['数学选必二', '选择性必修第二册'] },
  { id: 'math-selective-3', subject: '数学', title: '普通高中教科书·数学A版 选择性必修第三册', grade: '高三', category: '选择性必修', required: false, aliases: ['数学选必三', '选择性必修第三册'] },
  ...[1, 2, 3].map((volume) => ({ id: `english-required-${volume}`, subject: '英语' as const, title: `普通高中教科书·英语 必修第${'一二三'[volume - 1]}册`, grade: volume === 3 ? '高二' as const : '高一' as const, category: '必修' as const, required: true, aliases: [`英语必修${volume}`, `外研版必修${volume}`] })),
  ...[1, 2, 3, 4].map((volume) => ({ id: `english-selective-${volume}`, subject: '英语' as const, title: `普通高中教科书·英语 选择性必修第${'一二三四'[volume - 1]}册`, grade: volume <= 2 ? '高二' as const : '高三' as const, category: '选择性必修' as const, required: false, aliases: [`英语选必${volume}`] })),
  { id: 'history-required-up', subject: '历史', title: '普通高中教科书·历史 必修 中外历史纲要（上）', grade: '高一', category: '必修', required: true, aliases: ['中外历史纲要上', '历史必修上'] },
  { id: 'history-required-down', subject: '历史', title: '普通高中教科书·历史 必修 中外历史纲要（下）', grade: '高一', category: '必修', required: true, aliases: ['中外历史纲要下', '历史必修下'] },
  { id: 'history-selective-1', subject: '历史', title: '普通高中教科书·历史 选择性必修1 国家制度与社会治理', grade: '高二', category: '选择性必修', required: false, aliases: ['国家制度与社会治理'] },
  { id: 'history-selective-2', subject: '历史', title: '普通高中教科书·历史 选择性必修2 经济与社会生活', grade: '高二', category: '选择性必修', required: false, aliases: ['经济与社会生活'] },
  { id: 'history-selective-3', subject: '历史', title: '普通高中教科书·历史 选择性必修3 文化交流与传播', grade: '高三', category: '选择性必修', required: false, aliases: ['文化交流与传播'] },
  { id: 'geography-required-1', subject: '地理', title: '普通高中教科书·地理 必修第一册', grade: '高一', category: '必修', required: true, aliases: ['地理必修一'] },
  { id: 'geography-required-2', subject: '地理', title: '普通高中教科书·地理 必修第二册', grade: '高一', category: '必修', required: true, aliases: ['地理必修二'] },
  ...['自然地理基础', '区域发展', '资源、环境与国家安全'].map((name, index) => ({ id: `geography-selective-${index + 1}`, subject: '地理' as const, title: `普通高中教科书·地理 选择性必修${index + 1} ${name}`, grade: index === 2 ? '高三' as const : '高二' as const, category: '选择性必修' as const, required: false, aliases: [name] })),
  ...['中国特色社会主义', '经济与社会', '政治与法治', '哲学与文化'].map((name, index) => ({ id: `politics-required-${index + 1}`, subject: '政治' as const, title: `普通高中教科书·思想政治 必修${index + 1} ${name}`, grade: index < 2 ? '高一' as const : '高二' as const, category: '必修' as const, required: true, aliases: [name, `政治必修${index + 1}`] })),
  ...['当代国际政治与经济', '法律与生活', '逻辑与思维'].map((name, index) => ({ id: `politics-selective-${index + 1}`, subject: '政治' as const, title: `普通高中教科书·思想政治 选择性必修${index + 1} ${name}`, grade: index === 2 ? '高三' as const : '高二' as const, category: '选择性必修' as const, required: false, aliases: [name] })),
] as const

export const curriculumPrompt = [
  '仅允许识别和建立以下六科高中知识库：',
  '语文：人教版（统编版），必修上/下册与选择性必修上/中/下册。',
  '数学：人教版A版，必修第一/第二册与选择性必修第一/第二/第三册。',
  '英语：外研版新标准，必修第一至第三册与选择性必修第一至第四册。',
  '历史：人教版统编版，中外历史纲要上/下及选择性必修1—3。',
  '地理：人教版，必修第一/第二册及选择性必修1—3。',
  '政治：思想政治人教版统编版，必修1—4及选择性必修1—3。',
  '不得创建物理、化学、生物或其他出版社版本。',
].join('\n')

export function isSupportedSubject(value: string): value is SupportedSubject {
  return subjectValues.includes(value as SupportedSubject)
}

export function getBookById(id: string) {
  return textbookBooks.find((book) => book.id === id)
}

export function matchBook(subject: SupportedSubject, text: string) {
  const normalized = text.replace(/\s+/g, '').toLowerCase()
  const candidates = textbookBooks.filter((book) => book.subject === subject).map((book) => ({
    book,
    score: [book.title, ...book.aliases].filter((alias) => normalized.includes(alias.replace(/\s+/g, '').toLowerCase())).length,
  })).sort((left, right) => right.score - left.score)
  return candidates[0]?.score ? candidates[0].book : undefined
}
