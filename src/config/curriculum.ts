export type SupportedSubject = '语文' | '数学' | '英语' | '历史' | '地理' | '政治'
export type HighSchoolGrade = '高一' | '高二' | '高三' | '跨年级'
export type BookCategory = '必修' | '选择性必修' | '选修' | '练习册' | '真题' | '自定义'
export type ResourceKind = 'textbook' | 'workbook' | 'exam' | 'question-bank' | 'notes' | 'custom'

export interface TextbookBook {
  id: string
  subject: SupportedSubject
  title: string
  shortTitle: string
  grade: HighSchoolGrade
  category: BookCategory
  version: string
  publisher: string
  required: boolean
  chapters: string[]
  aliases: string[]
  sourcePath?: string
  repositoryUrl?: string
  officialUrl?: string
}

export interface TextbookCatalogItem {
  subject: SupportedSubject
  displayName: string
  version: string
  publisher: string
  requiredBooks: string[]
}

export interface LearningResourceSource {
  id: string
  name: string
  kind: ResourceKind
  coverage: SupportedSubject[] | '全部'
  description: string
  url?: string
  supportsRemoteImport: boolean
  enabledByDefault: boolean
  usage: string
}

const genericUnits = (count: number, prefix = '第') => Array.from({ length: count }, (_, index) => `${prefix}${'一二三四五六七八九十十一十二'[index] || index + 1}单元`)
const englishUnits = Array.from({ length: 6 }, (_, index) => `Unit ${index + 1}`)

export const TEXTBOOK_BOOKS: readonly TextbookBook[] = [
  {
    id: 'chinese-required-1', subject: '语文', title: '普通高中教科书·语文 必修上册', shortTitle: '必修上册', grade: '高一', category: '必修',
    version: '人教版（统编版）', publisher: '人民教育出版社', required: true,
    chapters: [...genericUnits(8), '整本书阅读《乡土中国》', '古诗词诵读'], aliases: ['语文必修上', '必修上册', '乡土中国'],
    sourcePath: '高中/语文/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/语文/统编版-人民教育出版社',
  },
  {
    id: 'chinese-required-2', subject: '语文', title: '普通高中教科书·语文 必修下册', shortTitle: '必修下册', grade: '高一', category: '必修',
    version: '人教版（统编版）', publisher: '人民教育出版社', required: true,
    chapters: [...genericUnits(8), '整本书阅读《红楼梦》', '古诗词诵读'], aliases: ['语文必修下', '必修下册', '红楼梦'],
    sourcePath: '高中/语文/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/语文/统编版-人民教育出版社',
  },
  ...(['上册', '中册', '下册'] as const).map((volume, index): TextbookBook => ({
    id: `chinese-selective-${index + 1}`, subject: '语文', title: `普通高中教科书·语文 选择性必修${volume}`, shortTitle: `选择性必修${volume}`, grade: index === 2 ? '高三' : '高二', category: '选择性必修',
    version: '人教版（统编版）', publisher: '人民教育出版社', required: false,
    chapters: [...genericUnits(4), '古诗词诵读', '复习整合'], aliases: [`语文选择性必修${volume}`, `选择性必修${volume}`],
    sourcePath: '高中/语文/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/语文/统编版-人民教育出版社',
  })),
  {
    id: 'math-required-1', subject: '数学', title: '普通高中教科书·数学A版 必修第一册', shortTitle: '必修第一册', grade: '高一', category: '必修',
    version: '人教版（A版）', publisher: '人民教育出版社', required: true,
    chapters: ['第一章 集合与常用逻辑用语', '第二章 一元二次函数、方程和不等式', '第三章 函数的概念与性质', '第四章 指数函数与对数函数', '第五章 三角函数'],
    aliases: ['数学必修一', '数学必修第一册', 'A版必修一'], sourcePath: '高中/数学/人教版（A版）（主编：章建跃&李增沪）-人民教育出版社',
    repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/数学/人教版（A版）（主编：章建跃%26李增沪）-人民教育出版社',
  },
  {
    id: 'math-required-2', subject: '数学', title: '普通高中教科书·数学A版 必修第二册', shortTitle: '必修第二册', grade: '高一', category: '必修',
    version: '人教版（A版）', publisher: '人民教育出版社', required: true,
    chapters: ['第六章 平面向量及其应用', '第七章 复数', '第八章 立体几何初步', '第九章 统计', '第十章 概率'],
    aliases: ['数学必修二', '数学必修第二册', 'A版必修二'], sourcePath: '高中/数学/人教版（A版）（主编：章建跃&李增沪）-人民教育出版社',
    repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/数学/人教版（A版）（主编：章建跃%26李增沪）-人民教育出版社',
  },
  {
    id: 'math-selective-1', subject: '数学', title: '普通高中教科书·数学A版 选择性必修第一册', shortTitle: '选择性必修第一册', grade: '高二', category: '选择性必修',
    version: '人教版（A版）', publisher: '人民教育出版社', required: false,
    chapters: ['第一章 空间向量与立体几何', '第二章 直线和圆的方程', '第三章 圆锥曲线的方程'], aliases: ['数学选必一', '选择性必修第一册'],
    sourcePath: '高中/数学/人教版（A版）（主编：章建跃&李增沪）-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/数学/人教版（A版）（主编：章建跃%26李增沪）-人民教育出版社',
  },
  {
    id: 'math-selective-2', subject: '数学', title: '普通高中教科书·数学A版 选择性必修第二册', shortTitle: '选择性必修第二册', grade: '高二', category: '选择性必修',
    version: '人教版（A版）', publisher: '人民教育出版社', required: false,
    chapters: ['第四章 数列', '第五章 一元函数的导数及其应用'], aliases: ['数学选必二', '选择性必修第二册'],
    sourcePath: '高中/数学/人教版（A版）（主编：章建跃&李增沪）-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/数学/人教版（A版）（主编：章建跃%26李增沪）-人民教育出版社',
  },
  {
    id: 'math-selective-3', subject: '数学', title: '普通高中教科书·数学A版 选择性必修第三册', shortTitle: '选择性必修第三册', grade: '高三', category: '选择性必修',
    version: '人教版（A版）', publisher: '人民教育出版社', required: false,
    chapters: ['第六章 计数原理', '第七章 随机变量及其分布', '第八章 成对数据的统计分析'], aliases: ['数学选必三', '选择性必修第三册'],
    sourcePath: '高中/数学/人教版（A版）（主编：章建跃&李增沪）-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/数学/人教版（A版）（主编：章建跃%26李增沪）-人民教育出版社',
  },
  ...([1, 2, 3] as const).map((volume): TextbookBook => ({
    id: `english-required-${volume}`, subject: '英语', title: `普通高中教科书·英语 必修第${'一二三'[volume - 1]}册`, shortTitle: `必修第${'一二三'[volume - 1]}册`, grade: volume === 3 ? '高二' : '高一', category: '必修',
    version: '外研版（新标准）', publisher: '外语教学与研究出版社', required: true, chapters: englishUnits,
    aliases: [`英语必修${volume}`, `外研版必修${volume}`, `必修第${'一二三'[volume - 1]}册`], sourcePath: '高中/英语/外研社版-外语教学与研究出版社',
    repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/英语/外研社版-外语教学与研究出版社',
  })),
  ...([1, 2, 3, 4] as const).map((volume): TextbookBook => ({
    id: `english-selective-${volume}`, subject: '英语', title: `普通高中教科书·英语 选择性必修第${'一二三四'[volume - 1]}册`, shortTitle: `选择性必修第${'一二三四'[volume - 1]}册`, grade: volume <= 2 ? '高二' : '高三', category: '选择性必修',
    version: '外研版（新标准）', publisher: '外语教学与研究出版社', required: false, chapters: englishUnits,
    aliases: [`英语选必${volume}`, `外研版选择性必修${volume}`], sourcePath: '高中/英语/外研社版-外语教学与研究出版社',
    repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/英语/外研社版-外语教学与研究出版社',
  })),
  {
    id: 'history-required-up', subject: '历史', title: '普通高中教科书·历史 必修 中外历史纲要（上）', shortTitle: '中外历史纲要（上）', grade: '高一', category: '必修', version: '人教版（统编版）', publisher: '人民教育出版社', required: true,
    chapters: ['第一单元 从中华文明起源到秦汉统一多民族封建国家的建立与巩固', '第二单元 三国两晋南北朝的民族交融与隋唐统一多民族封建国家的发展', '第三单元 辽宋夏金多民族政权的并立与元朝的统一', '第四单元 明清中国版图的奠定与面临的挑战', '第五单元 晚清时期的内忧外患与救亡图存', '第六单元 辛亥革命与中华民国的建立', '第七单元 中国共产党成立与新民主主义革命兴起', '第八单元 中华民族的抗日战争和人民解放战争', '第九单元 中华人民共和国成立和社会主义革命与建设', '第十单元 改革开放与社会主义现代化建设新时期'],
    aliases: ['中外历史纲要上', '历史必修上'], sourcePath: '高中/历史/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/历史/统编版-人民教育出版社',
  },
  {
    id: 'history-required-down', subject: '历史', title: '普通高中教科书·历史 必修 中外历史纲要（下）', shortTitle: '中外历史纲要（下）', grade: '高一', category: '必修', version: '人教版（统编版）', publisher: '人民教育出版社', required: true,
    chapters: ['第一单元 古代文明的产生与发展', '第二单元 中古时期的世界', '第三单元 走向整体的世界', '第四单元 资本主义制度的确立', '第五单元 工业革命与马克思主义的诞生', '第六单元 世界殖民体系与亚非拉民族独立运动', '第七单元 两次世界大战、十月革命与国际秩序的演变', '第八单元 20世纪下半叶世界的新变化', '第九单元 当代世界发展的特点与主要趋势'],
    aliases: ['中外历史纲要下', '历史必修下'], sourcePath: '高中/历史/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/历史/统编版-人民教育出版社',
  },
  ...([
    ['国家制度与社会治理', '高二'], ['经济与社会生活', '高二'], ['文化交流与传播', '高三'],
  ] as const).map(([name, grade], index): TextbookBook => ({
    id: `history-selective-${index + 1}`, subject: '历史', title: `普通高中教科书·历史 选择性必修${index + 1} ${name}`, shortTitle: `选择性必修${index + 1}·${name}`, grade, category: '选择性必修', version: '人教版（统编版）', publisher: '人民教育出版社', required: false,
    chapters: genericUnits(6), aliases: [`历史选必${index + 1}`, name], sourcePath: '高中/历史/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/历史/统编版-人民教育出版社',
  })),
  {
    id: 'geography-required-1', subject: '地理', title: '普通高中教科书·地理 必修第一册', shortTitle: '必修第一册', grade: '高一', category: '必修', version: '人教版', publisher: '人民教育出版社', required: true,
    chapters: ['第一章 宇宙中的地球', '第二章 地球上的大气', '第三章 地球上的水', '第四章 地貌', '第五章 植被与土壤', '第六章 自然灾害'], aliases: ['地理必修一', '地理必修第一册'],
    sourcePath: '高中/地理', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/地理',
  },
  {
    id: 'geography-required-2', subject: '地理', title: '普通高中教科书·地理 必修第二册', shortTitle: '必修第二册', grade: '高一', category: '必修', version: '人教版', publisher: '人民教育出版社', required: true,
    chapters: ['第一章 人口', '第二章 乡村和城镇', '第三章 产业区位因素', '第四章 交通运输布局与区域发展', '第五章 环境与发展'], aliases: ['地理必修二', '地理必修第二册'],
    sourcePath: '高中/地理', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/地理',
  },
  ...([
    ['自然地理基础', ['第一章 地球的运动', '第二章 地表形态的塑造', '第三章 大气的运动', '第四章 水的运动', '第五章 自然环境的整体性与差异性']],
    ['区域发展', ['第一章 区域与区域发展', '第二章 资源、环境与区域发展', '第三章 城市、产业与区域发展', '第四章 区际联系与区域协调发展']],
    ['资源、环境与国家安全', ['第一章 自然环境与人类社会', '第二章 自然资源与国家安全', '第三章 环境安全与国家安全', '第四章 保障国家安全的资源、环境战略与行动']],
  ] as const).map(([name, chapters], index): TextbookBook => ({
    id: `geography-selective-${index + 1}`, subject: '地理', title: `普通高中教科书·地理 选择性必修${index + 1} ${name}`, shortTitle: `选择性必修${index + 1}·${name}`, grade: index === 2 ? '高三' : '高二', category: '选择性必修', version: '人教版', publisher: '人民教育出版社', required: false,
    chapters: [...chapters], aliases: [`地理选必${index + 1}`, name], sourcePath: '高中/地理', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/地理',
  })),
  ...([
    ['中国特色社会主义', '高一', ['第一课 社会主义从空想到科学、从理论到实践的发展', '第二课 只有社会主义才能救中国', '第三课 只有中国特色社会主义才能发展中国', '第四课 只有坚持和发展中国特色社会主义才能实现中华民族伟大复兴']],
    ['经济与社会', '高一', ['第一单元 生产资料所有制与经济体制', '第二单元 经济发展与社会进步']],
    ['政治与法治', '高二', ['第一单元 中国共产党的领导', '第二单元 人民当家作主', '第三单元 全面依法治国']],
    ['哲学与文化', '高二', ['第一单元 探索世界与把握规律', '第二单元 认识社会与价值选择', '第三单元 文化传承与文化创新']],
  ] as const).map(([name, grade, chapters], index): TextbookBook => ({
    id: `politics-required-${index + 1}`, subject: '政治', title: `普通高中教科书·思想政治 必修${index + 1} ${name}`, shortTitle: `必修${index + 1}·${name}`, grade, category: '必修', version: '人教版（统编版）', publisher: '人民教育出版社', required: true,
    chapters: [...chapters], aliases: [`政治必修${index + 1}`, name], sourcePath: '高中/思想政治/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/思想政治/统编版-人民教育出版社',
  })),
  ...([
    ['当代国际政治与经济', '高二'], ['法律与生活', '高二'], ['逻辑与思维', '高三'],
  ] as const).map(([name, grade], index): TextbookBook => ({
    id: `politics-selective-${index + 1}`, subject: '政治', title: `普通高中教科书·思想政治 选择性必修${index + 1} ${name}`, shortTitle: `选择性必修${index + 1}·${name}`, grade, category: '选择性必修', version: '人教版（统编版）', publisher: '人民教育出版社', required: false,
    chapters: genericUnits(4), aliases: [`政治选必${index + 1}`, name], sourcePath: '高中/思想政治/统编版-人民教育出版社', repositoryUrl: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中/思想政治/统编版-人民教育出版社',
  })),
] as const

export const TEXTBOOK_CATALOG: readonly TextbookCatalogItem[] = [
  { subject: '语文', displayName: '语文', version: '人教版（统编版）', publisher: '人民教育出版社', requiredBooks: TEXTBOOK_BOOKS.filter((book) => book.subject === '语文' && book.required).map((book) => book.title) },
  { subject: '数学', displayName: '数学', version: '人教版（A版）', publisher: '人民教育出版社', requiredBooks: TEXTBOOK_BOOKS.filter((book) => book.subject === '数学' && book.required).map((book) => book.title) },
  { subject: '英语', displayName: '英语', version: '外研版（新标准）', publisher: '外语教学与研究出版社', requiredBooks: TEXTBOOK_BOOKS.filter((book) => book.subject === '英语' && book.required).map((book) => book.title) },
  { subject: '历史', displayName: '历史', version: '人教版（统编版）', publisher: '人民教育出版社', requiredBooks: TEXTBOOK_BOOKS.filter((book) => book.subject === '历史' && book.required).map((book) => book.title) },
  { subject: '地理', displayName: '地理', version: '人教版', publisher: '人民教育出版社', requiredBooks: TEXTBOOK_BOOKS.filter((book) => book.subject === '地理' && book.required).map((book) => book.title) },
  { subject: '政治', displayName: '思想政治', version: '人教版（统编版）', publisher: '人民教育出版社', requiredBooks: TEXTBOOK_BOOKS.filter((book) => book.subject === '政治' && book.required).map((book) => book.title) },
] as const

export const LEARNING_RESOURCE_SOURCES: readonly LearningResourceSource[] = [
  {
    id: 'family-upload', name: '家庭已上传资料', kind: 'custom', coverage: '全部', supportsRemoteImport: false, enabledByDefault: true,
    description: '课本、校内讲义、练习册、试卷和错题图片，内容进入家庭私有 R2。', usage: '拍题、预习、复习和训练时优先使用。',
  },
  {
    id: 'china-textbook', name: 'ChinaTextbook 高中教材目录', kind: 'textbook', coverage: '全部', supportsRemoteImport: true, enabledByDefault: true,
    description: '用于核对高中教材书目和补齐缺失书册，不把 PDF 本体打进代码仓库。', usage: '在资料页打开对应目录，下载后以 ZIP 上传或粘贴可直接下载的文件地址。',
    url: 'https://github.com/TapXWorld/ChinaTextbook/tree/master/高中',
  },
  {
    id: 'smartedu', name: '国家中小学智慧教育平台', kind: 'textbook', coverage: '全部', supportsRemoteImport: true, enabledByDefault: true,
    description: '官方教材目录与学习资源入口。', usage: '用于核对版本和补充缺失教材，需遵守平台使用要求。',
    url: 'https://basic.smartedu.cn/tchMaterial',
  },
  {
    id: 'school-workbook', name: '同步练习册与校本作业', kind: 'workbook', coverage: '全部', supportsRemoteImport: false, enabledByDefault: true,
    description: '按书册和章节归档家庭已有练习册、课堂练习、周测和作业。', usage: '训练时作为同章节题型和错因参考。',
  },
  {
    id: 'real-exam', name: '历年真题与地区模拟题', kind: 'exam', coverage: '全部', supportsRemoteImport: false, enabledByDefault: true,
    description: '支持上传高考真题、期中期末卷和学校模拟卷。', usage: '整卷和考前冲刺优先使用，保留年份、地区、试卷名称。',
  },
  {
    id: 'race-reading', name: 'RACE 高中英语阅读题源', kind: 'question-bank', coverage: ['英语'], supportsRemoteImport: false, enabledByDefault: false,
    description: '公开研究用英语阅读理解数据集，适合作为额外阅读训练来源。', usage: '仅在用户自行准备并上传合规数据后启用。',
  },
] as const

export const FIXED_SUBJECTS = TEXTBOOK_CATALOG.map((item) => item.subject) as SupportedSubject[]
export const SUBJECT_DISPLAY_NAMES = Object.fromEntries(TEXTBOOK_CATALOG.map((item) => [item.subject, item.displayName])) as Record<SupportedSubject, string>
export const FIXED_TEXTBOOK_VERSIONS = Object.fromEntries(TEXTBOOK_CATALOG.map((item) => [item.subject, item.version])) as Record<SupportedSubject, string>

export function isSupportedSubject(value: string): value is SupportedSubject {
  return FIXED_SUBJECTS.includes(value as SupportedSubject)
}

export function getBooksBySubject(subject: SupportedSubject, grade?: string) {
  return TEXTBOOK_BOOKS.filter((book) => book.subject === subject && (!grade || book.grade === grade || book.grade === '跨年级'))
}

export function getBookById(id: string) {
  return TEXTBOOK_BOOKS.find((book) => book.id === id)
}

const normalizeBookText = (value: string) => value
  .replace(/[\s·（）()【】\[\]_-]+/g, '')
  .replace(/第一/g, '1').replace(/第二/g, '2').replace(/第三/g, '3').replace(/第四/g, '4')
  .replace(/一/g, '1').replace(/二/g, '2').replace(/三/g, '3').replace(/四/g, '4')
  .replace(/第/g, '')
  .toLowerCase()

const bookVolume = (value: string) => /(?:选择性必修|选必|必修)([1-4])/.exec(normalizeBookText(value))?.[1] || ''
const bookMarker = (value: string) => {
  const normalized = normalizeBookText(value)
  if (normalized.includes('上册') || normalized.includes('纲要上')) return 'up'
  if (normalized.includes('中册')) return 'middle'
  if (normalized.includes('下册') || normalized.includes('纲要下')) return 'down'
  return ''
}

export function matchBookFromText(subject: SupportedSubject, text: string) {
  const normalized = normalizeBookText(text)
  const asksSelective = normalized.includes('选择性必修') || normalized.includes('选必')
  const asksRequired = !asksSelective && normalized.includes('必修')
  const requestedVolume = bookVolume(text)
  const requestedMarker = bookMarker(text)
  const ranked = getBooksBySubject(subject).map((book) => {
    if (asksSelective && book.category !== '选择性必修') return { book, score: Number.NEGATIVE_INFINITY }
    if (asksRequired && book.category !== '必修') return { book, score: Number.NEGATIVE_INFINITY }
    const candidateVolume = bookVolume(book.title)
    const candidateMarker = bookMarker(book.title)
    if (requestedVolume && requestedVolume !== candidateVolume) return { book, score: Number.NEGATIVE_INFINITY }
    if (requestedMarker && requestedMarker !== candidateMarker) return { book, score: Number.NEGATIVE_INFINITY }

    const aliases = [book.title, book.shortTitle, ...book.aliases].map(normalizeBookText)
    let aliasScore = 0
    for (const alias of aliases) {
      if (normalized === alias) aliasScore = Math.max(aliasScore, 120)
      else if (alias.length >= 3 && normalized.includes(alias)) aliasScore = Math.max(aliasScore, 55 + Math.min(20, alias.length / 2))
      else if (normalized.length >= 4 && alias.includes(normalized)) aliasScore = Math.max(aliasScore, 38 + Math.min(16, normalized.length / 3))
    }
    return {
      book,
      score: aliasScore
        + (asksSelective || asksRequired ? 12 : 0)
        + (requestedVolume && requestedVolume === candidateVolume ? 28 : 0)
        + (requestedMarker && requestedMarker === candidateMarker ? 28 : 0),
    }
  }).filter((item) => Number.isFinite(item.score)).sort((left, right) => right.score - left.score)
  const best = ranked[0]
  if (!best || best.score < 12 || (ranked[1] && ranked[1].score === best.score)) return undefined
  return best.book
}

export function chapterOptionsForBook(bookId: string, importedChapters: string[] = []) {
  const book = getBookById(bookId)
  const merged = [...importedChapters, ...(book?.chapters || [])].map((item) => item.trim()).filter(Boolean)
  return [...new Set(merged)]
}
