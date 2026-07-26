import { inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  path: string
  buffer: Buffer
  compressedSize: number
  uncompressedSize: number
}

const readUInt16 = (buffer: Buffer, offset: number) => buffer.readUInt16LE(offset)
const readUInt32 = (buffer: Buffer, offset: number) => buffer.readUInt32LE(offset)
const decoderUtf8 = new TextDecoder('utf-8')
let decoderGb: TextDecoder | null = null
try { decoderGb = new TextDecoder('gb18030') } catch { decoderGb = null }

const decodeName = (bytes: Buffer, utf8: boolean) => {
  if (utf8) return decoderUtf8.decode(bytes)
  const gb = decoderGb?.decode(bytes) || ''
  return gb.includes('�') ? decoderUtf8.decode(bytes) : gb
}

const cleanPath = (value: string) => {
  const normalized = value.replaceAll('\\', '/').normalize('NFKC')
  const parts = normalized.split('/').filter((part) => part && part !== '.')
  if (!parts.length || parts.some((part) => part === '..')) throw new Error(`ZIP 内包含不安全路径：${value}`)
  return parts.join('/').slice(0, 500)
}

function locateEocd(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 65_557)
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset
  }
  throw new Error('ZIP 文件结构无效：找不到目录结束标记')
}

export function extractZipEntries(buffer: Buffer, options: { maxEntries?: number; maxTotalBytes?: number; maxFileBytes?: number } = {}): ZipEntry[] {
  const maxEntries = options.maxEntries ?? 600
  const maxTotalBytes = options.maxTotalBytes ?? 500 * 1024 * 1024
  const maxFileBytes = options.maxFileBytes ?? 80 * 1024 * 1024
  const eocd = locateEocd(buffer)
  const entryCount = readUInt16(buffer, eocd + 10)
  const centralOffset = readUInt32(buffer, eocd + 16)
  if (entryCount > maxEntries) throw new Error(`ZIP 内文件过多，最多支持 ${maxEntries} 个文件`)
  if (centralOffset >= buffer.length) throw new Error('ZIP 中央目录位置无效')

  const entries: ZipEntry[] = []
  let offset = centralOffset
  let totalBytes = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > buffer.length || readUInt32(buffer, offset) !== 0x02014b50) throw new Error('ZIP 中央目录损坏')
    const flags = readUInt16(buffer, offset + 8)
    const method = readUInt16(buffer, offset + 10)
    const compressedSize = readUInt32(buffer, offset + 20)
    const uncompressedSize = readUInt32(buffer, offset + 24)
    const nameLength = readUInt16(buffer, offset + 28)
    const extraLength = readUInt16(buffer, offset + 30)
    const commentLength = readUInt16(buffer, offset + 32)
    const localOffset = readUInt32(buffer, offset + 42)
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error('暂不支持 ZIP64 压缩包')
    const nameStart = offset + 46
    const rawName = buffer.subarray(nameStart, nameStart + nameLength)
    const originalPath = decodeName(rawName, Boolean(flags & 0x0800))
    offset = nameStart + nameLength + extraLength + commentLength

    if (!originalPath || originalPath.endsWith('/') || originalPath.startsWith('__MACOSX/') || originalPath.endsWith('.DS_Store')) continue
    if (flags & 0x0001) throw new Error(`不支持加密文件：${originalPath}`)
    if (![0, 8].includes(method)) continue
    if (uncompressedSize > maxFileBytes) throw new Error(`文件过大：${originalPath}`)
    totalBytes += uncompressedSize
    if (totalBytes > maxTotalBytes) throw new Error('ZIP 解压后总体积过大')
    if (compressedSize > 0 && uncompressedSize / compressedSize > 250) throw new Error(`检测到异常压缩比：${originalPath}`)

    if (localOffset + 30 > buffer.length || readUInt32(buffer, localOffset) !== 0x04034b50) throw new Error(`ZIP 本地文件头损坏：${originalPath}`)
    const localNameLength = readUInt16(buffer, localOffset + 26)
    const localExtraLength = readUInt16(buffer, localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) throw new Error(`ZIP 文件数据不完整：${originalPath}`)
    const compressed = buffer.subarray(dataStart, dataEnd)
    const output = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: maxFileBytes })
    if (output.length !== uncompressedSize && uncompressedSize !== 0) throw new Error(`ZIP 文件大小校验失败：${originalPath}`)
    entries.push({ path: cleanPath(originalPath), buffer: output, compressedSize, uncompressedSize: output.length })
  }
  return entries
}

const entityMap: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function stripMarkup(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<w:tab\s*\/>/gi, '\t')
    .replace(/<w:br\s*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/p>|<br\s*\/?>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_all, token: string) => {
      if (token.startsWith('#x')) return String.fromCodePoint(Number.parseInt(token.slice(2), 16))
      if (token.startsWith('#')) return String.fromCodePoint(Number.parseInt(token.slice(1), 10))
      return entityMap[token.toLowerCase()] ?? ' '
    })
    .replace(/[\t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

export function decodeText(buffer: Buffer) {
  if (!buffer.length) return ''
  const utf8 = decoderUtf8.decode(buffer)
  if (!utf8.includes('�')) return utf8
  return decoderGb?.decode(buffer) || utf8
}

function officeXmlText(buffer: Buffer, matcher: (path: string) => boolean) {
  const parts = extractZipEntries(buffer, { maxEntries: 3000, maxTotalBytes: 350 * 1024 * 1024, maxFileBytes: 20 * 1024 * 1024 })
    .filter((entry) => matcher(entry.path.toLowerCase()))
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-CN', { numeric: true }))
    .map((entry) => stripMarkup(decodeText(entry.buffer)))
    .filter(Boolean)
  return parts.join('\n\n')
}

export function extractLocalText(filePath: string, buffer: Buffer): string | null {
  const lower = filePath.toLowerCase()
  if (/\.(txt|md|markdown|csv|tsv|json|yaml|yml|xml|html?|xhtml)$/i.test(lower)) {
    const decoded = decodeText(buffer)
    return /\.(html?|xhtml|xml)$/i.test(lower) ? stripMarkup(decoded) : decoded.trim()
  }
  if (lower.endsWith('.docx')) return officeXmlText(buffer, (path) => path === 'word/document.xml' || path.startsWith('word/header') || path.startsWith('word/footer'))
  if (lower.endsWith('.pptx')) return officeXmlText(buffer, (path) => path.startsWith('ppt/slides/slide') && path.endsWith('.xml'))
  if (lower.endsWith('.xlsx')) return officeXmlText(buffer, (path) => path === 'xl/sharedstrings.xml' || path.startsWith('xl/worksheets/sheet'))
  if (lower.endsWith('.epub')) return officeXmlText(buffer, (path) => /\.(xhtml|html|htm)$/i.test(path))
  return null
}

export function isRemoteDocument(filePath: string) {
  return /\.(pdf|png|jpe?g|webp|gif|bmp)$/i.test(filePath)
}

export function contentTypeForPath(filePath: string) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'application/octet-stream'
}
