export type SupportedSubject = '语文' | '数学' | '英语' | '历史' | '地理' | '政治'

export interface TextbookCatalogItem {
  subject: SupportedSubject
  displayName: string
  version: string
  publisher: string
  requiredBooks: string[]
}

export const TEXTBOOK_CATALOG: readonly TextbookCatalogItem[] = [
  {
    subject: '语文',
    displayName: '语文',
    version: '人教版（人民教育出版社）',
    publisher: '人民教育出版社',
    requiredBooks: [],
  },
  {
    subject: '数学',
    displayName: '数学',
    version: '人教版（A版）（人民教育出版社）',
    publisher: '人民教育出版社',
    requiredBooks: [],
  },
  {
    subject: '英语',
    displayName: '英语',
    version: '外研版（外语教学与研究出版社）',
    publisher: '外语教学与研究出版社',
    requiredBooks: [],
  },
  {
    subject: '历史',
    displayName: '历史',
    version: '人教版（部编版）',
    publisher: '人民教育出版社',
    requiredBooks: ['《中外历史纲要（上）》', '《中外历史纲要（下）》'],
  },
  {
    subject: '地理',
    displayName: '地理',
    version: '人教版（人民教育出版社）',
    publisher: '人民教育出版社',
    requiredBooks: [],
  },
  {
    subject: '政治',
    displayName: '思想政治',
    version: '人教版（部编版）',
    publisher: '人民教育出版社',
    requiredBooks: [],
  },
] as const

export const FIXED_SUBJECTS = TEXTBOOK_CATALOG.map(
  (item) => item.subject,
) as SupportedSubject[]

export const SUBJECT_DISPLAY_NAMES = Object.fromEntries(
  TEXTBOOK_CATALOG.map((item) => [item.subject, item.displayName]),
) as Record<SupportedSubject, string>

export const FIXED_TEXTBOOK_VERSIONS = Object.fromEntries(
  TEXTBOOK_CATALOG.map((item) => [item.subject, item.version]),
) as Record<SupportedSubject, string>

export const TEXTBOOK_OPTIONS = Object.fromEntries(
  TEXTBOOK_CATALOG.map((item) => [item.subject, [item.version]]),
) as Record<SupportedSubject, string[]>

export function isSupportedSubject(value: string): value is SupportedSubject {
  return FIXED_SUBJECTS.includes(value as SupportedSubject)
}

export function getCatalogItem(subject: SupportedSubject): TextbookCatalogItem {
  const item = TEXTBOOK_CATALOG.find((entry) => entry.subject === subject)
  if (!item) {
    throw new Error(`不支持的科目：${subject}`)
  }
  return item
}
