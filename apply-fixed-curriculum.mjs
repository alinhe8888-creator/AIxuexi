#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const repo = path.resolve(process.argv[2] || '.')
const bundle = path.dirname(new URL(import.meta.url).pathname)

function target(relative) {
  return path.join(repo, relative)
}

function read(relative) {
  return fs.readFileSync(target(relative), 'utf8')
}

function write(relative, content) {
  const file = target(relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
  console.log(`updated ${relative}`)
}

function copy(relative) {
  const source = path.join(bundle, relative)
  if (!fs.existsSync(source)) throw new Error(`补丁文件缺失：${relative}`)
  const destination = target(relative)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
  console.log(`added ${relative}`)
}

function replaceOnce(content, pattern, replacement, label, optional = false) {
  if (typeof pattern === 'string') {
    if (content.includes(replacement)) return content
    if (!content.includes(pattern)) {
      if (optional) return content
      throw new Error(`无法修改 ${label}：未找到预期文本`)
    }
    return content.replace(pattern, replacement)
  }
  if (pattern.test(content)) return content.replace(pattern, replacement)
  if (optional) return content
  throw new Error(`无法修改 ${label}：未找到预期结构`)
}

copy('src/config/curriculum.ts')
copy('backend/src/curriculum.ts')

// Settings: only six subjects and one fixed version for each.
{
  const file = 'src/pages/SettingsPage.tsx'
  if (!fs.existsSync(target(file))) throw new Error(`缺少 ${file}`)
  let content = read(file)

  if (!content.includes("from '../config/curriculum'")) {
    content = replaceOnce(
      content,
      "import type { AppSettings, StudentProfile, Subject } from '../types'",
      "import type { AppSettings, StudentProfile, Subject } from '../types'\nimport { FIXED_SUBJECTS, FIXED_TEXTBOOK_VERSIONS, SUBJECT_DISPLAY_NAMES, TEXTBOOK_OPTIONS } from '../config/curriculum'",
      file,
    )
  }

  content = replaceOnce(
    content,
    /const allSubjects:[\s\S]*?const textbookOptions:[\s\S]*?\n}\n/,
    "const allSubjects: Subject[] = [...FIXED_SUBJECTS]\nconst textbookOptions: Partial<Record<Subject, string[]>> = TEXTBOOK_OPTIONS\n",
    `${file} subject catalog`,
  )

  content = replaceOnce(
    content,
    "const [profile, setProfile] = useState<StudentProfile>({ ...state.profile })",
    "const [profile, setProfile] = useState<StudentProfile>({\n    ...state.profile,\n    selectedSubjects: [...FIXED_SUBJECTS],\n    textbookVersions: { ...FIXED_TEXTBOOK_VERSIONS },\n  })",
    `${file} profile initialization`,
  )

  content = replaceOnce(
    content,
    "const saveProfile = () => updateProfile(profile)",
    "const saveProfile = () => updateProfile({\n    ...profile,\n    selectedSubjects: [...FIXED_SUBJECTS],\n    textbookVersions: { ...FIXED_TEXTBOOK_VERSIONS },\n  })",
    `${file} profile save`,
  )

  content = content.replace(
    /\{subject\}<\/button>/g,
    "{SUBJECT_DISPLAY_NAMES[subject as keyof typeof SUBJECT_DISPLAY_NAMES] || subject}</button>",
  )

  content = content.replace(
    '教材版本按科目分别设置，不使用统一版本',
    '教材版本已按家庭实际使用版本固定，不再提供其他出版社选项',
  )

  write(file, content)
}

// ZIP material page: only six subjects; version is automatically fixed by subject.
{
  const file = 'src/pages/KnowledgeBasePage.tsx'
  if (fs.existsSync(target(file))) {
    let content = read(file)

    if (content.includes("const subjects: Array<Subject | '自动判断'>")) {
      if (!content.includes("from '../config/curriculum'")) {
        content = replaceOnce(
          content,
          "import type { KnowledgeItem, Subject } from '../types'",
          "import type { KnowledgeItem, Subject } from '../types'\nimport { FIXED_SUBJECTS, FIXED_TEXTBOOK_VERSIONS, SUBJECT_DISPLAY_NAMES } from '../config/curriculum'",
          file,
        )
      }

      content = replaceOnce(
        content,
        /const subjects: Array<Subject \| '自动判断'> = \[[^\]]+\]/,
        "const subjects: Array<Subject | '自动判断'> = ['自动判断', ...FIXED_SUBJECTS]",
        `${file} subject list`,
      )

      content = content.replace(
        "const [textbookVersion, setTextbookVersion] = useState('')\n",
        '',
      )
      content = content.replace(
        "textbookVersion: textbookVersion.trim() || undefined,",
        "textbookVersion: subjectHint === '自动判断' ? undefined : FIXED_TEXTBOOK_VERSIONS[subjectHint],",
      )
      content = content.replace("      setTextbookVersion('')\n", '')

      content = content.replace(
        /<label className="wide">教材版本<input value=\{textbookVersion\} onChange=\{\(event\) => setTextbookVersion\(event\.target\.value\)\} placeholder="[^"]*" \/><\/label>/,
        "<label className=\"wide\">教材版本<select disabled value={subjectHint === '自动判断' ? '自动判断' : FIXED_TEXTBOOK_VERSIONS[subjectHint]}><option>{subjectHint === '自动判断' ? '上传后由 AI 判断' : FIXED_TEXTBOOK_VERSIONS[subjectHint]}</option></select></label>",
      )

      content = content.replace(
        "{subjects.map((item) => <option key={item}>{item}</option>)}",
        "{subjects.map((item) => <option key={item} value={item}>{item === '自动判断' ? item : SUBJECT_DISPLAY_NAMES[item as keyof typeof SUBJECT_DISPLAY_NAMES] || item}</option>)}",
      )

      write(file, content)
    } else {
      console.log(`skipped ${file}: 当前仍是旧知识库页面，应用 ZIP 资料升级后再运行本补丁也可以`)
    }
  }
}

// Backend material validation and AI prompt, when ZIP material modules are present.
{
  const file = 'backend/src/materialRoutes.ts'
  if (fs.existsSync(target(file))) {
    let content = read(file)

    if (!content.includes("from './curriculum.js'")) {
      content = replaceOnce(
        content,
        "import { store, type StoredRecord } from './store.js'",
        "import { store, type StoredRecord } from './store.js'\nimport { fixedTextbookVersions, supportedSubjectValues, validateTextbookVersion } from './curriculum.js'",
        file,
      )
    }

    content = content.replace(
      "const subjectValues = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'] as const\n",
      '',
    )

    content = content.replace(
      "subject: z.enum(subjectValues).optional(),",
      "subject: z.enum(supportedSubjectValues).optional(),",
    )

    content = content.replace(
      "const input = importSchema.parse(req.body)\n  const studentId = req.user!.id",
      "const input = importSchema.parse(req.body)\n  if (input.subject) input.textbookVersion = validateTextbookVersion(input.subject, input.textbookVersion)\n  const studentId = req.user!.id",
    )

    write(file, content)
  }
}

{
  const file = 'backend/src/materialAi.ts'
  if (fs.existsSync(target(file))) {
    let content = read(file)

    if (!content.includes("from './curriculum.js'")) {
      content = "import { curriculumPrompt } from './curriculum.js'\n" + content
    }

    content = content.replace(
      "content: '你是高中课本知识库整理器。只能依据用户提供的资料，不得补写资料中没有的事实。输出 JSON：",
      "content: `你是高中课本知识库整理器。只能依据用户提供的资料，不得补写资料中没有的事实。\\n${curriculumPrompt}\\n输出 JSON：",
    )

    content = content.replace(
      "每个分块提取 3—15 个最有价值条目，避免重复和空泛。',",
      "每个分块提取 3—15 个最有价值条目，避免重复和空泛。`,",
    )

    write(file, content)
  }
}

console.log('')
console.log('✅ 教材目录已锁定为 6 科 6 个指定版本。')
console.log('已移除物理、化学、生物和其他出版社版本的选择入口。')
console.log('历史必修仅保留《中外历史纲要（上）》和《中外历史纲要（下）》。')
