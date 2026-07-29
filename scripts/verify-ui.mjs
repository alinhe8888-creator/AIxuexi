import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const files = []
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (entry.name.endsWith('.tsx')) files.push(file)
  }
}
walk('src')

const failures = []
let rawButtons = 0
let sharedButtons = 0

for (const file of files) {
  const sourceText = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const location = (node) => `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
      const names = new Set(attributes.map((attribute) => attribute.name.getText(source)))

      if (tag === 'button') {
        rawButtons += 1
        if (!names.has('type')) failures.push(`${location(node)} 原生 button 缺少 type`)
        if (![...names].some((name) => ['onClick', 'onSubmit', 'form', 'type'].includes(name))) {
          failures.push(`${location(node)} 原生 button 缺少动作`)
        }
      }

      if (tag === 'Button') {
        sharedButtons += 1
        if (![...names].some((name) => ['onClick', 'onSubmit', 'form', 'type', 'asChild'].includes(name))) {
          failures.push(`${location(node)} Button 缺少动作`)
        }
      }

      if (tag === 'a' && names.has('target')) {
        const target = attributes.find((attribute) => attribute.name.getText(source) === 'target')
        const targetText = target?.initializer?.getText(source) || ''
        if (targetText.includes('_blank')) {
          const rel = attributes.find((attribute) => attribute.name.getText(source) === 'rel')
          const relText = rel?.initializer?.getText(source) || ''
          if (!relText.includes('noopener') || !relText.includes('noreferrer')) {
            failures.push(`${location(node)} 新窗口链接缺少 noopener noreferrer`)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`✅ UI 交互检查通过：${files.length} 个 TSX、${rawButtons} 个原生按钮、${sharedButtons} 个公共按钮。`)
