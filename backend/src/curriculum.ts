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

const normalizeBookText = (value: string) => value
  .replace(/[\s·（）()【】\[\]_-]+/g, '')
  .replace(/第一/g, '1')
  .replace(/第二/g, '2')
  .replace(/第三/g, '3')
  .replace(/第四/g, '4')
  .replace(/一/g, '1')
  .replace(/二/g, '2')
  .replace(/三/g, '3')
  .replace(/四/g, '4')
  .replace(/第/g, '')
  .toLowerCase()

const subjectTerms: Record<SupportedSubject, string[]> = {
  语文: ['语文'],
  数学: ['数学'],
  英语: ['英语', '外研'],
  历史: ['历史'],
  地理: ['地理'],
  政治: ['思想政治', '政治'],
}

function subjectFromBookText(text: string): SupportedSubject | undefined {
  const normalized = normalizeBookText(text)
  const matched = subjectValues.filter((subject) => subjectTerms[subject].some((term) => normalized.includes(normalizeBookText(term))))
  return matched.length === 1 ? matched[0] : undefined
}

function volumeFromBookText(text: string) {
  const normalized = normalizeBookText(text)
  const match = /(?:选择性必修|选必|必修)([1-4])/.exec(normalized)
  return match?.[1] || ''
}

function volumeMarker(text: string) {
  const normalized = normalizeBookText(text)
  if (normalized.includes('上册') || normalized.includes('纲要上')) return 'up'
  if (normalized.includes('中册')) return 'middle'
  if (normalized.includes('下册') || normalized.includes('纲要下')) return 'down'
  return ''
}

function bookMatchScore(book: BackendBookCatalogItem, text: string) {
  const normalized = normalizeBookText(text)
  const aliases = [book.title, ...book.aliases].map(normalizeBookText)
  let aliasScore = 0
  for (const alias of aliases) {
    if (normalized === alias) aliasScore = Math.max(aliasScore, 120)
    else if (alias.length >= 3 && normalized.includes(alias)) aliasScore = Math.max(aliasScore, 55 + Math.min(20, alias.length / 2))
    else if (normalized.length >= 4 && alias.includes(normalized)) aliasScore = Math.max(aliasScore, 38 + Math.min(16, normalized.length / 3))
  }

  const asksSelective = normalized.includes('选择性必修') || normalized.includes('选必')
  const asksRequired = !asksSelective && normalized.includes('必修')
  if (asksSelective && book.category !== '选择性必修') return Number.NEGATIVE_INFINITY
  if (asksRequired && book.category !== '必修') return Number.NEGATIVE_INFINITY

  const requestedVolume = volumeFromBookText(text)
  const candidateVolume = volumeFromBookText(book.title)
  if (requestedVolume && candidateVolume && requestedVolume !== candidateVolume) return Number.NEGATIVE_INFINITY
  if (requestedVolume && !candidateVolume) return Number.NEGATIVE_INFINITY

  const requestedMarker = volumeMarker(text)
  const candidateMarker = volumeMarker(book.title)
  if (requestedMarker && candidateMarker && requestedMarker !== candidateMarker) return Number.NEGATIVE_INFINITY
  if (requestedMarker && !candidateMarker) return Number.NEGATIVE_INFINITY

  const subjectScore = subjectTerms[book.subject].some((term) => normalized.includes(normalizeBookText(term))) ? 16 : 0
  const categoryScore = asksSelective || asksRequired ? 12 : 0
  const volumeScore = requestedVolume && requestedVolume === candidateVolume ? 28 : 0
  const markerScore = requestedMarker && requestedMarker === candidateMarker ? 28 : 0
  return aliasScore + subjectScore + categoryScore + volumeScore + markerScore
}

function uniqueBest(candidates: Array<{ book: BackendBookCatalogItem; score: number }>, minimum: number) {
  const ranked = candidates.filter((item) => Number.isFinite(item.score)).sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const second = ranked[1]
  if (!best || best.score < minimum) return undefined
  if (second && best.score === second.score) return undefined
  return best.book
}

export function matchBook(subject: SupportedSubject, text: string) {
  return uniqueBest(
    textbookBooks.filter((book) => book.subject === subject).map((book) => ({ book, score: bookMatchScore(book, text) })),
    12,
  )
}

export function matchAnyBook(text: string) {
  const explicitSubject = subjectFromBookText(text)
  if (explicitSubject) return matchBook(explicitSubject, text)
  const normalized = normalizeBookText(text)
  if (normalized.includes('必修') || normalized.includes('选必')) return undefined
  return uniqueBest(textbookBooks.map((book) => ({ book, score: bookMatchScore(book, text) })), 20)
}
