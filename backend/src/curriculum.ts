export const subjectValues = ['语文', '数学', '英语', '历史', '地理', '政治'] as const
export type SupportedSubject = (typeof subjectValues)[number]

export const fixedTextbookVersions: Record<SupportedSubject, string> = {
  语文: '人教版（人民教育出版社）',
  数学: '人教版（A版）（人民教育出版社）',
  英语: '外研版（外语教学与研究出版社）',
  历史: '人教版（部编版）',
  地理: '人教版（人民教育出版社）',
  政治: '人教版（部编版）',
}

export const curriculumPrompt = [
  '仅允许识别和建立以下六科知识库：',
  '语文：人教版（人民教育出版社）',
  '数学：人教版（A版）（人民教育出版社）',
  '英语：外研版（外语教学与研究出版社）',
  '历史：人教版（部编版），必修只包含《中外历史纲要（上）》与《中外历史纲要（下）》',
  '地理：人教版（人民教育出版社）',
  '政治：思想政治，人教版（部编版）',
  '不得创建物理、化学、生物或其他出版社版本。',
].join('\n')

export function isSupportedSubject(value: string): value is SupportedSubject {
  return subjectValues.includes(value as SupportedSubject)
}
