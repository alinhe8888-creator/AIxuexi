import {
  AlertTriangle,
  Archive,
  BookCopy,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Database,
  ExternalLink,
  FileArchive,
  FileText,
  Globe2,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, SectionTitle, Segmented } from '../components/ui'
import { materialApi, type MaterialImportJob, type MaterialServiceStatus } from '../services/materialApi'
import type { KnowledgeItem } from '../types'
import {
  FIXED_SUBJECTS,
  LEARNING_RESOURCE_SOURCES,
  SUBJECT_DISPLAY_NAMES,
  TEXTBOOK_BOOKS,
  getBookById,
  getBooksBySubject,
  matchBookFromText,
  type ResourceKind,
  type SupportedSubject,
} from '../config/curriculum'
import '../styles/material-import.css'

const subjects: Array<SupportedSubject | '自动判断'> = ['自动判断', ...FIXED_SUBJECTS]
const grades = ['自动判断', '高一', '高二', '高三'] as const
const resourceKinds: Array<{ value: ResourceKind; label: string }> = [
  { value: 'textbook', label: '教材' },
  { value: 'workbook', label: '练习册' },
  { value: 'exam', label: '真题/试卷' },
  { value: 'question-bank', label: '题库' },
  { value: 'notes', label: '讲义/笔记' },
  { value: 'custom', label: '其他资料' },
]
const activeStatuses = new Set<MaterialImportJob['status']>(['queued', 'extracting', 'analyzing'])
type Tab = 'catalog' | 'import' | 'knowledge' | 'sources'

function statusBadge(status: MaterialImportJob['status']) {
  if (status === 'ready') return <Badge tone="success"><CheckCircle2 size={13} />完成</Badge>
  if (status === 'failed') return <Badge tone="danger"><XCircle size={13} />失败</Badge>
  return <Badge tone="primary"><LoaderCircle className="spin" size={13} />处理中</Badge>
}

function bookCovered(bookId: string, items: KnowledgeItem[], imports: MaterialImportJob[]) {
  if (items.some((item) => item.bookId === bookId)) return true
  if (imports.some((job) => job.status === 'ready' && job.bookId === bookId)) return true
  const book = getBookById(bookId)
  if (!book) return false
  return imports.some((job) => {
    if (job.status !== 'ready' || job.subject !== book.subject) return false
    const inferred = matchBookFromText(book.subject, `${job.fileName} ${job.bookTitle || ''}`)
    return inferred?.id === bookId
  })
}

export function KnowledgeBasePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [tab, setTab] = useState<Tab>('catalog')
  const [serviceStatus, setServiceStatus] = useState<MaterialServiceStatus | null>(null)
  const [imports, setImports] = useState<MaterialImportJob[]>([])
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [selected, setSelected] = useState<KnowledgeItem | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [subjectHint, setSubjectHint] = useState<SupportedSubject | '自动判断'>('自动判断')
  const [gradeHint, setGradeHint] = useState<(typeof grades)[number]>('自动判断')
  const [bookId, setBookId] = useState('')
  const [resourceKind, setResourceKind] = useState<ResourceKind>('textbook')
  const [sourceName, setSourceName] = useState('家庭上传资料')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteFileName, setRemoteFileName] = useState('')
  const [keyword, setKeyword] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<SupportedSubject | '全部'>('全部')
  const [gradeFilter, setGradeFilter] = useState<'全部' | '高一' | '高二' | '高三'>('全部')
  const [bookFilter, setBookFilter] = useState('')
  const [kindFilter, setKindFilter] = useState<ResourceKind | ''>('')
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

  const selectableBooks = useMemo(() => subjectHint === '自动判断' ? [] : getBooksBySubject(subjectHint), [subjectHint])
  useEffect(() => {
    if (!bookId || selectableBooks.some((book) => book.id === bookId)) return
    setBookId('')
  }, [bookId, selectableBooks])

  const coveredBooks = useMemo(() => TEXTBOOK_BOOKS.filter((book) => bookCovered(book.id, items, imports)), [imports, items])
  const requiredBooks = useMemo(() => TEXTBOOK_BOOKS.filter((book) => book.required), [])
  const missingRequired = useMemo(() => requiredBooks.filter((book) => !bookCovered(book.id, items, imports)), [imports, items, requiredBooks])
  const coveredChapterCount = useMemo(() => new Set(items.map((item) => `${item.bookId || item.subject}:${item.chapter}`)).size, [items])

  const filtered = useMemo(() => items.filter((item) => {
    if (subjectFilter !== '全部' && item.subject !== subjectFilter) return false
    if (gradeFilter !== '全部' && item.grade !== gradeFilter) return false
    if (bookFilter && item.bookId !== bookFilter) return false
    if (kindFilter && item.resourceKind !== kindFilter) return false
    if (keyword && !`${item.title}${item.bookTitle || ''}${item.chapter}${item.knowledgePoint}${item.content}${item.tags.join('')}`.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  }), [bookFilter, gradeFilter, items, keyword, kindFilter, subjectFilter])

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) { setError('请选择 ZIP 压缩包'); return }
    setSelectedFile(file)
    setError('')
  }

  const metadata = () => {
    const selectedBook = getBookById(bookId)
    return {
      subject: subjectHint === '自动判断' ? selectedBook?.subject : subjectHint,
      grade: gradeHint === '自动判断' ? (selectedBook?.grade === '跨年级' ? undefined : selectedBook?.grade) : gradeHint,
      bookId: selectedBook?.id,
      bookTitle: selectedBook?.title,
      resourceKind,
      sourceName: sourceName.trim() || '家庭上传资料',
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) { setError('请先选择 ZIP 压缩包'); return }
    setBusy(true); setUploadProgress(0); setError('')
    try {
      await materialApi.uploadZip(selectedFile, metadata(), setUploadProgress)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '上传失败')
    } finally { setBusy(false) }
  }

  const handleRemoteImport = async () => {
    if (!remoteUrl.trim()) { setError('请粘贴可直接下载的 ZIP、PDF 或图片地址'); return }
    setBusy(true); setError('')
    try {
      await materialApi.importRemote({ ...metadata(), url: remoteUrl.trim(), fileName: remoteFileName.trim() || undefined })
      setRemoteUrl(''); setRemoteFileName('')
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '在线资料导入失败')
    } finally { setBusy(false) }
  }

  const handleClear = async () => {
    if (!window.confirm('确定清空全部资料、导入记录和已生成知识库吗？此操作无法撤销。')) return
    setBusy(true)
    try { await materialApi.clearAll(); setItems([]); setImports([]); setSelected(null); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '清空失败') }
    finally { setBusy(false) }
  }

  const handleDelete = async (job: MaterialImportJob) => {
    if (!window.confirm(`删除“${job.fileName}”及其生成的 ${job.knowledgeCount} 条知识吗？`)) return
    setBusy(true)
    try { await materialApi.remove(job.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败') }
    finally { setBusy(false) }
  }

  const handleRetry = async (job: MaterialImportJob) => {
    setBusy(true)
    try { await materialApi.retry(job.id); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '重试失败') }
    finally { setBusy(false) }
  }

  return (
    <div className="knowledge-final-page">
      <PageHeader
        eyebrow="家庭知识库"
        title="教材与题源"
        description="先核对书册是否齐全，再上传教材、练习册、真题和讲义。预习、复习、拍题与训练都会优先检索这里。"
        actions={<div className="material-header-actions"><Button variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw size={15} />刷新</Button><Button variant="danger" size="sm" onClick={() => void handleClear()} disabled={busy || (!items.length && !imports.length)}><Trash2 size={15} />全部清空</Button></div>}
      />

      {error && <div className="material-error"><AlertTriangle size={18} /><span>{error}</span></div>}

      <div className="material-status-grid material-status-grid--four">
        <Card><LibraryBig size={23} /><div><strong>{coveredBooks.length}/{TEXTBOOK_BOOKS.length}</strong><span>已识别书册</span></div></Card>
        <Card><BookOpenCheck size={23} /><div><strong>{requiredBooks.length - missingRequired.length}/{requiredBooks.length}</strong><span>必修书册覆盖</span></div></Card>
        <Card><Database size={23} /><div><strong>{items.length}</strong><span>知识条目</span></div></Card>
        <Card><Archive size={23} /><div><strong>{coveredChapterCount}</strong><span>章节覆盖</span></div></Card>
      </div>

      <Segmented<Tab> value={tab} onChange={setTab} options={[
        { value: 'catalog', label: '书目总览' },
        { value: 'import', label: '补充资料' },
        { value: 'knowledge', label: '知识条目' },
        { value: 'sources', label: '题源扩展' },
      ]} />

      {tab === 'catalog' && (
        <div className="catalog-subject-list">
          {FIXED_SUBJECTS.map((subject) => {
            const books = getBooksBySubject(subject)
            const subjectCovered = books.filter((book) => bookCovered(book.id, items, imports)).length
            return (
              <Card key={subject} className="catalog-subject-card">
                <SectionTitle title={`${SUBJECT_DISPLAY_NAMES[subject]} · ${books[0]?.version || ''}`} description={`已识别 ${subjectCovered}/${books.length} 册；必修缺失会优先提示。`} />
                <div className="catalog-book-grid">
                  {books.map((book) => {
                    const covered = bookCovered(book.id, items, imports)
                    const chapterCount = new Set(items.filter((item) => item.bookId === book.id).map((item) => item.chapter)).size
                    return (
                      <article key={book.id} className={`catalog-book ${covered ? 'is-covered' : ''}`}>
                        <div className="catalog-book-icon">{covered ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}</div>
                        <div><div className="badge-row"><Badge tone={book.required ? 'primary' : 'neutral'}>{book.category}</Badge><Badge>{book.grade}</Badge></div><strong>{book.shortTitle}</strong><small>{book.publisher}</small><span>{covered ? `${chapterCount || '已'}个章节已入库` : book.required ? '必修书册尚未识别' : '可按当前进度补充'}</span></div>
                        <div className="catalog-book-actions">
                          <button onClick={() => { setSubjectHint(book.subject); setBookId(book.id); setResourceKind('textbook'); setTab('import') }}>补充</button>
                          {book.repositoryUrl && <button onClick={() => window.open(book.repositoryUrl, '_blank', 'noopener,noreferrer')} aria-label="打开来源"><ExternalLink size={15} /></button>}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'import' && (
        <>
          <div className="material-main-grid">
            <Card className="material-upload-card">
              <SectionTitle title="上传本地资料" description={`上传 ZIP，最大 ${serviceStatus?.maxZipMb || 100} MB；可放教材 PDF、练习册、真题、讲义和图片。`} />
              <input ref={fileInputRef} className="material-file-input" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => acceptFile(event.target.files?.[0])} />
              <button type="button" className={`material-dropzone ${dragging ? 'dragging' : ''}`} onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]) }}>
                <UploadCloud size={32} /><strong>{selectedFile ? selectedFile.name : '选择或拖入 ZIP'}</strong><span>{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB` : '上传到家庭私有 R2，后台自动解压、识别书册与章节'}</span>
              </button>
              <ImportMetadataFields subjectHint={subjectHint} setSubjectHint={setSubjectHint} gradeHint={gradeHint} setGradeHint={setGradeHint} bookId={bookId} setBookId={setBookId} resourceKind={resourceKind} setResourceKind={setResourceKind} sourceName={sourceName} setSourceName={setSourceName} />
              {busy && uploadProgress > 0 && uploadProgress < 100 && <ProgressBar value={uploadProgress} label="正在上传到 R2" />}
              <Button className="full-width" size="lg" onClick={() => void handleUpload()} disabled={busy || !selectedFile || !serviceStatus?.r2Configured}>{busy ? <LoaderCircle className="spin" size={18} /> : <FileArchive size={18} />}{busy ? '正在上传…' : '上传并生成知识库'}</Button>
            </Card>

            <Card className="material-upload-card remote-import-card">
              <SectionTitle title="从公开文件地址补充" description="粘贴可直接下载的 GitHub/ChinaTextbook 或国家智慧教育平台文件地址。仓库目录页不能直接导入。" />
              <label className="remote-url-field">文件地址<input value={remoteUrl} onChange={(event) => setRemoteUrl(event.target.value)} placeholder="https://raw.githubusercontent.com/.../教材.pdf" /></label>
              <label className="remote-url-field">文件名（可选）<input value={remoteFileName} onChange={(event) => setRemoteFileName(event.target.value)} placeholder="例如：数学必修第一册.pdf" /></label>
              <ImportMetadataFields subjectHint={subjectHint} setSubjectHint={setSubjectHint} gradeHint={gradeHint} setGradeHint={setGradeHint} bookId={bookId} setBookId={setBookId} resourceKind={resourceKind} setResourceKind={setResourceKind} sourceName={sourceName} setSourceName={setSourceName} compact />
              <Button className="full-width" size="lg" onClick={() => void handleRemoteImport()} disabled={busy || !remoteUrl.trim() || !serviceStatus?.r2Configured}><Globe2 size={18} />导入公开文件</Button>
              <div className="remote-import-note">只允许 HTTPS，且仅接收 GitHub 与国家智慧教育平台文件；不会抓取网页、登录页或整个 40GB 仓库。</div>
            </Card>
          </div>

          <Card className="material-jobs-card">
            <SectionTitle title="导入记录" description="教材、练习册、题库与试卷统一显示处理进度；已有资料不会在升级时自动清空。" />
            {imports.length ? <div className="material-job-list">{imports.map((job) => (
              <div className="material-job" key={job.id}>
                <div className="material-job-icon">{job.sourceType === 'open_resource' ? <Globe2 size={20} /> : <FileArchive size={20} />}</div>
                <div className="material-job-main"><div className="material-job-title"><strong>{job.fileName}</strong>{statusBadge(job.status)}</div><span>{job.bookTitle || job.subject || '自动识别'} · {resourceKinds.find((kind) => kind.value === job.resourceKind)?.label || job.resourceKind} · {job.stage} · {job.knowledgeCount} 条知识</span><ProgressBar value={job.progress} compact />{job.errors.length > 0 && <small title={job.errors.join('\n')}>{job.errors[job.errors.length - 1]}</small>}</div>
                <div className="material-job-actions">{job.status === 'failed' && <button onClick={() => void handleRetry(job)} aria-label="重试"><RefreshCw size={16} /></button>}<button onClick={() => void handleDelete(job)} aria-label="删除"><Trash2 size={16} /></button></div>
              </div>
            ))}</div> : <EmptyState title="还没有资料" description="先在书目总览查看缺失书册，再上传教材 ZIP 或导入单个公开文件。" />}
          </Card>

          {serviceStatus && (!serviceStatus.r2Configured || !serviceStatus.models.qwen) && <div className="material-config-warning">{!serviceStatus.r2Configured && <span>R2 未配置</span>}{!serviceStatus.models.qwen && <span>Qwen 未配置：不能解析教材和建立知识库</span>}</div>}
        </>
      )}

      {tab === 'knowledge' && (
        <>
          <Card className="material-filter-card material-filter-card--extended">
            <div className="search-box wide"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索书册、章节、知识点或正文" /></div>
            <label>科目<select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value as typeof subjectFilter); setBookFilter('') }}><option>全部</option>{FIXED_SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
            <label>书册<select value={bookFilter} onChange={(event) => setBookFilter(event.target.value)}><option value="">全部书册</option>{(subjectFilter === '全部' ? TEXTBOOK_BOOKS : getBooksBySubject(subjectFilter)).map((book) => <option key={book.id} value={book.id}>{book.shortTitle}</option>)}</select></label>
            <label>类型<select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as ResourceKind | '')}><option value="">全部类型</option>{resourceKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
            <label>年级<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value as typeof gradeFilter)}><option>全部</option><option>高一</option><option>高二</option><option>高三</option></select></label>
          </Card>
          <div className="material-results-head"><span>共 {filtered.length} 条</span>{loading && <small><LoaderCircle className="spin" size={13} />正在加载</small>}</div>
          {filtered.length ? <div className="material-knowledge-grid">{filtered.map((item) => (
            <Card key={item.id} className="material-knowledge-card" interactive><button onClick={() => setSelected(item)}><div className="badge-row"><Badge tone="primary">{SUBJECT_DISPLAY_NAMES[item.subject as SupportedSubject] || item.subject}</Badge><Badge>{item.grade}</Badge><Badge tone="success">{resourceKinds.find((kind) => kind.value === item.resourceKind)?.label || '资料'}</Badge></div><h3>{item.title}</h3><p>{item.content}</p><div className="material-path">{item.bookTitle || '未匹配书册'} · {item.chapter} / {item.knowledgePoint}</div><div className="tag-row">{item.tags.slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}</div></button></Card>
          ))}</div> : !loading && <Card><EmptyState title="没有匹配内容" description="调整筛选条件，或在“补充资料”中上传教材与练习册。" /></Card>}
        </>
      )}

      {tab === 'sources' && (
        <div className="resource-source-grid">
          {LEARNING_RESOURCE_SOURCES.map((source) => (
            <Card key={source.id} className="resource-source-card">
              <div className="resource-source-icon">{source.kind === 'textbook' ? <BookCopy size={22} /> : source.kind === 'exam' ? <FileText size={22} /> : <Globe2 size={22} />}</div>
              <div><div className="badge-row"><Badge tone={source.enabledByDefault ? 'success' : 'neutral'}>{source.enabledByDefault ? '已纳入策略' : '可选扩展'}</Badge><Badge>{source.coverage === '全部' ? '六科' : source.coverage.join('、')}</Badge></div><h3>{source.name}</h3><p>{source.description}</p><small>{source.usage}</small></div>
              <div className="resource-source-actions">{source.url && <Button variant="secondary" size="sm" onClick={() => window.open(source.url, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} />打开来源</Button>}<Button size="sm" onClick={() => { setResourceKind(source.kind); setSourceName(source.name); setTab('import') }}>补充资料</Button></div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(selected)} title={selected?.title || '知识条目'} onClose={() => setSelected(null)} size="lg">
        {selected && <div className="knowledge-detail"><div className="badge-row"><Badge tone="primary">{selected.subject}</Badge><Badge>{selected.grade}</Badge><Badge>{selected.bookTitle || selected.chapter}</Badge></div><div className="detail-block"><span>知识点</span><p>{selected.knowledgePoint}</p></div><div className="detail-block"><span>内容</span><p>{selected.content}</p></div><div className="answer-compare"><div><span>核心结论</span><p>{selected.answer || '—'}</p></div><div><span>理解说明</span><p>{selected.explanation || '—'}</p></div></div><div className="detail-block"><span>来源</span><p><FileText size={15} /> {selected.sourceName || selected.sourceFile || '家庭资料'}</p></div></div>}
      </Modal>
    </div>
  )
}

function ImportMetadataFields(props: {
  subjectHint: SupportedSubject | '自动判断'
  setSubjectHint: (value: SupportedSubject | '自动判断') => void
  gradeHint: (typeof grades)[number]
  setGradeHint: (value: (typeof grades)[number]) => void
  bookId: string
  setBookId: (value: string) => void
  resourceKind: ResourceKind
  setResourceKind: (value: ResourceKind) => void
  sourceName: string
  setSourceName: (value: string) => void
  compact?: boolean
}) {
  const books = props.subjectHint === '自动判断' ? [] : getBooksBySubject(props.subjectHint)
  return (
    <div className={`material-meta-grid ${props.compact ? 'is-compact' : ''}`}>
      <label>科目<select value={props.subjectHint} onChange={(event) => { props.setSubjectHint(event.target.value as typeof props.subjectHint); props.setBookId('') }}>{subjects.map((item) => <option key={item} value={item}>{item === '自动判断' ? item : SUBJECT_DISPLAY_NAMES[item]}</option>)}</select></label>
      <label>年级<select value={props.gradeHint} onChange={(event) => props.setGradeHint(event.target.value as typeof props.gradeHint)}>{grades.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="wide">书册<select value={props.bookId} onChange={(event) => props.setBookId(event.target.value)} disabled={props.subjectHint === '自动判断'}><option value="">自动匹配/不指定</option>{books.map((book) => <option key={book.id} value={book.id}>{book.shortTitle}（{book.grade}）</option>)}</select></label>
      <label>资料类型<select value={props.resourceKind} onChange={(event) => props.setResourceKind(event.target.value as ResourceKind)}>{resourceKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
      <label>来源名称<input value={props.sourceName} onChange={(event) => props.setSourceName(event.target.value)} placeholder="家庭上传资料" /></label>
    </div>
  )
}
