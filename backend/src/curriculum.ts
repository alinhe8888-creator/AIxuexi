export const supportedSubjectValues = ['语文', '数学', '英语', '历史', '地理', '政治'] as const

export type SupportedSubject = (typeof supportedSubjectValues)[number]

export const fixedTextbookVersions: Record<SupportedSubject, string> = {
  语文: '人教版（人民教育出版社）',
  数学: '人教版（A版）（人民教育出版社）',
  英语: '外研版（外语教学与研究出版社）',
  历史: '人教版（部编版）',
  地理: '人教版（人民教育出版社）',
  政治: '人教版（部编版）',
}

export const curriculumPrompt = [
  '只允许识别和建立以下六个科目的知识库：',
  '语文：人教版（人民教育出版社）',
  '数学：人教版（A版）（人民教育出版社）',
  '英语：外研版（外语教学与研究出版社）',
  '历史：人教版（部编版），必修仅包括《中外历史纲要（上）》和《中外历史纲要（下）》',
  '地理：人教版（人民教育出版社）',
  '政治：思想政治，人教版（部编版）',
  '不得自动创建物理、化学、生物或其他出版社版本。',
].join('\\n')

export function validateTextbookVersion(subject: SupportedSubject, version?: string) {
  if (!version) return fixedTextbookVersions[subject]
  const expected = fixedTextbookVersions[subject]
  if (version !== expected) {
    throw new Error(`${subject}只允许使用：${expected}`)
  }
  return expected
}
