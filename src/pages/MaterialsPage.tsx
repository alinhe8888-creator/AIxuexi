import { FileSearch, FolderOpen, RefreshCw, Trash2, Upload, WandSparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { materialApi, type LearningMaterial } from '../services/materialApi'

const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '其他']
const dynamicImport = (url: string): Promise<unknown> => import(/* @vite-ignore */ url)

type PdfPage = { getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }
type PdfDocument = { numPages: number; getPage: (pageNumber: number) => Promise<PdfPage> }
type PdfModule = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (input: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> }
}

async function extractText(file: File) {
  if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) return (await file.text()).slice(0, 160_000)
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return ''
  const module = await dynamicImport('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs') as PdfModule
  module.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs'
  const document = await module.getDocument({ data: await file.arrayBuffer() }).promise
  const chunks: string[] = []
  const pageCount = Math.min(document.numPages, 120)
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const text = await page.getTextContent()
    chunks.push(text.items.map((item) => item.str || '').join(' '))
    if (chunks.join('\n').length > 160_000) break
  }
  return chunks.join('\n').slice(0, 160_000)
}

const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function MaterialsPage() {
  const [materials, setMaterials] = useState<LearningMaterial[]>([])
  const [subject, setSubject] = useState('数学')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const replaceInput = useRef<HTMLInputElement>(null)
  const [replaceTarget, setReplaceTarget] = useState<LearningMaterial | null>(null)

  const load = async () => {
    setError('')
    try { setMaterials(await materialApi.list()) }
    catch (err) { setError(err instanceof Error ? err.message : '资料加载失败') }
  }

  useEffect(() => { void load() }, [])

  const upload = async (file: File) => {
    setBusy('upload')
    setError('')
    setMessage('')
    try {
      const textContent = await extractText(file).catch(() => '')
      const material = await materialApi.upload({ file, title: title.trim() || file.name.replace(/\.[^.]+$/, ''), subject, textContent })
      setMaterials((items) => [material, ...items])
      setTitle('')
      setMessage('上传完成，正在分析。')
      setBusy(material.id)
      try {
        const analyzed = await materialApi.analyze(material.id)
        setMaterials((items) => items.map((item) => item.id === analyzed.id ? analyzed : item))
        setMessage('上传和分析都完成了。')
      } catch (analysisError) {
        setMessage('资料已经上传，分析暂时失败，可以稍后点“分析”重试。')
        setError(analysisError instanceof Error ? analysisError.message : '分析失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setBusy('')
    }
  }

  const replace = async (file: File) => {
    if (!replaceTarget) return
    setBusy(replaceTarget.id)
    setError('')
    try {
      const textContent = await extractText(file).catch(() => '')
      const next = await materialApi.replace(replaceTarget.id, { file, title: replaceTarget.title, subject: replaceTarget.subject, textContent })
      setMaterials((items) => items.map((item) => item.id === next.id ? next : item))
      try {
        const analyzed = await materialApi.analyze(next.id)
        setMaterials((items) => items.map((item) => item.id === analyzed.id ? analyzed : item))
        setMessage('资料已更新并重新分析。')
      } catch (analysisError) {
        setMessage('资料已经更新，分析暂时失败，可以稍后点“分析”重试。')
        setError(analysisError instanceof Error ? analysisError.message : '分析失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setBusy('')
      setReplaceTarget(null)
      if (replaceInput.current) replaceInput.current.value = ''
    }
  }

  const analyze = async (id: string) => {
    setBusy(id)
    setError('')
    try {
      const next = await materialApi.analyze(id)
      setMaterials((items) => items.map((item) => item.id === next.id ? next : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally { setBusy('') }
  }

  const remove = async (id: string) => {
    if (!window.confirm('删除这份资料？')) return
    setBusy(id)
    try {
      await materialApi.remove(id)
      setMaterials((items) => items.filter((item) => item.id !== id))
    } catch (err) { setError(err instanceof Error ? err.message : '删除失败') }
    finally { setBusy('') }
  }

  return (
    <main className="family-page materials-page">
      <section className="family-panel material-upload-panel">
        <div className="family-panel__title"><strong>资料</strong><button type="button" onClick={() => void load()}><RefreshCw size={16} />刷新</button></div>
        <div className="material-upload-fields">
          <label>科目<select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="不填就使用文件名" /></label>
          <label className="material-file-button"><Upload size={18} />{busy === 'upload' ? '上传中…' : '选择资料'}<input type="file" accept=".pdf,.txt,.md,.csv,image/*" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = '' }} /></label>
        </div>
        {message && <p className="family-message">{message}</p>}
        {error && <p className="family-error">{error}</p>}
      </section>

      <input ref={replaceInput} hidden type="file" accept=".pdf,.txt,.md,.csv,image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replace(file) }} />

      <section className="material-list">
        {materials.length === 0 && <div className="family-empty"><FolderOpen size={34} /><span>还没有资料</span></div>}
        {materials.map((material) => (
          <article key={material.id} className="family-panel material-card">
            <div className="material-card__head">
              <div><span className="material-subject">{material.subject}</span><strong>{material.title}</strong><small>{material.fileName} · {formatSize(material.sizeBytes)} · {busy === material.id ? '分析中' : material.analysis ? '已分析' : material.analysisStatus === 'running' ? '分析中' : '待分析'}</small></div>
              <div className="material-actions">
                <button type="button" onClick={() => void materialApi.open(material.id)}><FileSearch size={16} />打开</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => { setReplaceTarget(material); replaceInput.current?.click() }}><RefreshCw size={16} />更新</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void analyze(material.id)}><WandSparkles size={16} />{busy === material.id ? '处理中…' : '分析'}</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void remove(material.id)}><Trash2 size={16} />删除</button>
              </div>
            </div>
            {material.analysis && (
              <div className="material-analysis">
                <p>{material.analysis.summary}</p>
                {material.analysis.keyPoints.length > 0 && <div><strong>重点</strong><ul>{material.analysis.keyPoints.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {material.analysis.questions.length > 0 && <div><strong>可以练习</strong><ul>{material.analysis.questions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                {material.analysis.suggestions.length > 0 && <div><strong>下一步</strong><ul>{material.analysis.suggestions.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  )
}
