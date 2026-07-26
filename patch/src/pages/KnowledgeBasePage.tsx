import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  CheckCircle2,
  Database,
  FileArchive,
  FileText,
  LoaderCircle,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, SectionTitle } from '../components/ui'
import { materialApi, type MaterialImportJob, type MaterialServiceStatus } from '../services/materialApi'
import type { KnowledgeItem, Subject } from '../types'
import '../styles/material-import.css'

const subjects: Array<Subject | '自动判断'> = ['自动判断', '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const grades = ['自动判断', '高一', '高二', '高三'] as const
const activeStatuses = new Set<MaterialImportJob['status']>(['queued', 'extracting', 'analyzing'])

function statusBadge(status: MaterialImportJob['status']) {
  if (status === 'ready') return <Badge tone="success"><CheckCircle2 size={13} />完成</Badge>
  if (status === 'failed') return <Badge tone="danger"><XCircle size={13} />失败</Badge>
  return <Badge tone="primary"><LoaderCircle className="spin" size={13} />处理中</Badge>
}

export function KnowledgeBasePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [serviceStatus, setServiceStatus] = useState<MaterialServiceStatus | null>(null)
  const [imports, setImports] = useState<MaterialImportJob[]>([])
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [selected, setSelected] = useState<KnowledgeItem | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [subjectHint, setSubjectHint] = useState<Subject | '自动判断'>('自动判断')
  const [gradeHint, setGradeHint] = useState<(typeof grades)[number]>('自动判断')
  const [textbookVersion, setTextbookVersion] = useState('')
  const [keyword, setKeyword] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<Subject | '全部'>('全部')
  const [gradeFilter, setGradeFilter] = useState<'全部' | '高一' | '高二' | '高三'>('全部')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [status, nextImports, nextItems] = await Promise.all([
        materialApi.status(),
        materialApi.listImports(),
        materialApi.searchKnowledge({}),
      ])
      setServiceStatus(status)
      setImports(nextImports)
      setItems(nextItems)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '资料接口暂不可用')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!imports.some((job) => activeStatuses.has(job.status))) return undefined
    const timer = window.setInterval(() => { void refresh(true) }, 3000)
    return () => window.clearInterval(timer)
  }, [imports, refresh])

  const filtered = useMemo(() => items.filter((item) => {
    if (subjectFilter !== '全部' && item.subject !== subjectFilter) return false
    if (gradeFilter !== '全部' && item.grade !== gradeFilter) return false
    if (keyword && !`${item.title}${item.chapter}${item.knowledgePoint}${item.content}${item.tags.join('')}`.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  }), [gradeFilter, items, keyword, subjectFilter])

  const sourceSubjects = useMemo(() => [...new Set(items.map((item) => item.subject))], [items])

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('请选择 ZIP 压缩包')
      return
    }
    setSelectedFile(file)
    setError('')
  }

  const handleUpload = async () => {
    if (!selectedFile) { setError('请先选择 ZIP 压缩包'); return }
    setBusy(true)
    setUploadProgress(0)
    setError('')
    try {
      await materialApi.uploadZip(selectedFile, {
        subject: subjectHint === '自动判断' ? undefined : subjectHint,
        grade: gradeHint === '自动判断' ? undefined : gradeHint,
        textbookVersion: textbookVersion.trim() || undefined,
      }, setUploadProgress)
      setSelectedFile(null)
      setTextbookVersion('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '上传失败')
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async () => {
    if (!window.confirm('确定清空全部课本资料、导入记录和已生成知识库吗？此操作无法撤销。')) return
    setBusy(true)
    try {
      await materialApi.clearAll()
      setItems([])
      setImports([])
      setSelected(null)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '清空失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (job: MaterialImportJob) => {
    if (!window.confirm(`删除“${job.fileName}”及其生成的 ${job.knowledgeCount} 条知识吗？`)) return
    setBusy(true)
    try {
      await materialApi.remove(job.id)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const handleRetry = async (job: MaterialImportJob) => {
    setBusy(true)
    try {
      await materialApi.retry(job.id)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重试失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="课本资料"
        title="资料"
        description="上传 ZIP 后自动解压，识别其中的课本、讲义和图片，再生成可搜索的知识库。"
        actions={<div className="material-header-actions"><Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={15} />刷新</Button><Button variant="danger" size="sm" onClick={() => void handleClear()} disabled={busy || (!items.length && !imports.length)}><Trash2 size={15} />全部清空</Button></div>}
      />

      {error && <div className="material-error"><AlertTriangle size={18} /><span>{error}</span></div>}

      <div className="material-status-grid">
        <Card><Database size={23} /><div><strong>{items.length}</strong><span>知识条目</span></div></Card>
        <Card><BookOpenCheck size={23} /><div><strong>{new Set(items.map((item) => item.knowledgePoint)).size}</strong><span>知识点</span></div></Card>
        <Card><Archive size={23} /><div><strong>{imports.filter((item) => item.status === 'ready').length}</strong><span>资料包</span></div></Card>
      </div>

      <div className="material-main-grid">
        <Card className="material-upload-card">
          <SectionTitle title="上传课本资料" description={`仅上传 ZIP；最大 ${serviceStatus?.maxZipMb || 100} MB。ZIP 内可包含 PDF、DOCX、PPTX、XLSX、EPUB、TXT、MD、HTML、CSV、JSON 和图片。`} />
          <input ref={fileInputRef} className="material-file-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => acceptFile(event.target.files?.[0])} />
          <button
            type="button"
            className={`material-dropzone ${dragging ? 'dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]) }}
          >
            <UploadCloud size={32} />
            <strong>{selectedFile ? selectedFile.name : '选择或拖入 ZIP'}</strong>
            <span>{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : '文件先上传到 R2，后端再自动解压和分析'}</span>
          </button>
          <div className="material-meta-grid">
            <label>科目<select value={subjectHint} onChange={(event) => setSubjectHint(event.target.value as typeof subjectHint)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>年级<select value={gradeHint} onChange={(event) => setGradeHint(event.target.value as typeof gradeHint)}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="wide">教材版本<input value={textbookVersion} onChange={(event) => setTextbookVersion(event.target.value)} placeholder="可不填，例如：人教版 A 版" /></label>
          </div>
          {busy && uploadProgress > 0 && uploadProgress < 100 && <ProgressBar value={uploadProgress} label="正在上传到 R2" />}
          <Button className="full-width" size="lg" onClick={() => void handleUpload()} disabled={busy || !selectedFile || !serviceStatus?.r2Configured}>
            {busy ? <LoaderCircle className="spin" size={18} /> : <FileArchive size={18} />}
            {busy ? '正在提交…' : '上传并生成知识库'}
          </Button>
          {serviceStatus && (!serviceStatus.r2Configured || !serviceStatus.models.qwen || !serviceStatus.models.deepseek) && (
            <div className="material-config-warning">
              {!serviceStatus.r2Configured && <span>R2 未配置</span>}
              {!serviceStatus.models.qwen && <span>Qwen 未配置：PDF 和图片无法识别</span>}
              {!serviceStatus.models.deepseek && <span>DeepSeek 未配置：将使用基础规则整理</span>}
            </div>
          )}
        </Card>

        <Card className="material-jobs-card">
          <SectionTitle title="导入记录" description="分析任务会自动更新进度，失败后可直接重试。" />
          {imports.length ? <div className="material-job-list">{imports.map((job) => (
            <div className="material-job" key={job.id}>
              <div className="material-job-icon"><FileArchive size={20} /></div>
              <div className="material-job-main">
                <div className="material-job-title"><strong>{job.fileName}</strong>{statusBadge(job.status)}</div>
                <span>{job.stage} · {job.processedFiles}/{job.totalFiles || '—'} 个文件 · {job.knowledgeCount} 条知识</span>
                <ProgressBar value={job.progress} compact />
                {job.errors.length > 0 && <small title={job.errors.join('\n')}>{job.errors[job.errors.length - 1]}</small>}
              </div>
              <div className="material-job-actions">
                {job.status === 'failed' && <button onClick={() => void handleRetry(job)} aria-label="重试"><RefreshCw size={16} /></button>}
                <button onClick={() => void handleDelete(job)} aria-label="删除"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}</div> : <EmptyState title="还没有资料" description="上传一个 ZIP，系统会自动解压、分析并生成知识库。" />}
        </Card>
      </div>

      <Card className="material-filter-card">
        <div className="search-box wide"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、章节、知识点或正文" /></div>
        <label>科目<select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value as typeof subjectFilter)}><option>全部</option>{sourceSubjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>年级<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value as typeof gradeFilter)}><option>全部</option><option>高一</option><option>高二</option><option>高三</option></select></label>
      </Card>

      <div className="material-results-head"><span>共 {filtered.length} 条</span>{loading && <small><LoaderCircle className="spin" size={13} />正在加载</small>}</div>
      {filtered.length ? <div className="material-knowledge-grid">{filtered.map((item) => (
        <Card key={item.id} className="material-knowledge-card" interactive>
          <button onClick={() => setSelected(item)}>
            <div className="badge-row"><Badge tone="primary">{item.subject}</Badge><Badge>{item.grade}</Badge><Badge tone="success">课本资料</Badge></div>
            <h3>{item.title}</h3>
            <p>{item.content}</p>
            <div className="material-path">{item.chapter} / {item.knowledgePoint}</div>
            <div className="tag-row">{item.tags.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}</div>
          </button>
        </Card>
      ))}</div> : !loading && <Card><EmptyState title="知识库为空" description="上传课本 ZIP 后，生成的知识条目会显示在这里。" /></Card>}

      <Modal open={Boolean(selected)} title={selected?.title || '知识条目'} onClose={() => setSelected(null)} size="lg">
        {selected && <div className="knowledge-detail">
          <div className="badge-row"><Badge tone="primary">{selected.subject}</Badge><Badge>{selected.grade}</Badge><Badge>{selected.chapter}</Badge></div>
          <div className="detail-block"><span>知识点</span><p>{selected.knowledgePoint}</p></div>
          <div className="detail-block"><span>内容</span><p>{selected.content}</p></div>
          <div className="answer-compare"><div><span>核心结论</span><p>{selected.answer || '—'}</p></div><div><span>理解说明</span><p>{selected.explanation || '—'}</p></div></div>
          <div className="detail-block"><span>来源</span><p><FileText size={15} /> 用户上传资料</p></div>
        </div>}
      </Modal>
    </div>
  )
}
