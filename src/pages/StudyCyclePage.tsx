import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getBookById, getBooksBySubject } from '../config/curriculum'
import { learningApi } from '../services/learningApi'
import { materialApi } from '../services/materialApi'
import { useAppStore } from '../store/useAppStore'
import type { KnowledgeItem, Subject } from '../types'
import {
  deleteStudySession,
  loadStudySessions,
  saveStudySession,
  type StudyCycleMode,
  type StudyCycleResult,
  type StudyDepth,
  type StudySession,
} from '../utils/familyLearningWorkspace'

const durations = [15, 25, 40]
const depths: StudyDepth[] = ['快速', '标准', '深入']
const sourceOptions = [
  { id: 'textbook', label: '已上传教材' },
  { id: 'workbook', label: '练习册/讲义' },
  { id: 'mistakes', label: '错题与薄弱点' },
  { id: 'exam', label: '真题/试卷' },
]

export function StudyCyclePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useAppStore()
  const initialMode = (location.state as { mode?: StudyCycleMode } | null)?.mode || 'preview'
  const [mode, setMode] = useState<StudyCycleMode>(initialMode)
  const subjects = state.profile.selectedSubjects.length ? state.profile.selectedSubjects : (['数学'] as Subject[])
  const defaultSubject: Subject = subjects[0] || '数学'
  const [subject, setSubject] = useState<Subject>(defaultSubject)
  const books = useMemo(() => getBooksBySubject(subject), [subject])
  const [bookId, setBookId] = useState(books[0]?.id || '')
  const selectedBook = useMemo(() => getBookById(bookId) || books[0], [bookId, books])
  const [chapter, setChapter] = useState(selectedBook?.chapters[0] || '')
  const [customChapter, setCustomChapter] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [customGoal, setCustomGoal] = useState('')
  const [duration, setDuration] = useState(25)
  const [depth, setDepth] = useState<StudyDepth>('标准')
  const [sourceScopes, setSourceScopes] = useState<string[]>(['textbook', 'mistakes'])
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<StudyCycleResult | null>(null)
  const [sessions, setSessions] = useState<StudySession[]>(() => loadStudySessions())
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  const weakPoints = useMemo(
    () => state.knowledgePoints.filter((item) => item.subject === subject).sort((a, b) => a.mastery - b.mastery),
    [state.knowledgePoints, subject],
  )

  const importedChapters = useMemo(
    () => [...new Set(knowledgeItems.map((item) => item.chapter).filter(Boolean))],
    [knowledgeItems],
  )
  const chapterOptions = useMemo(
    () => [...new Set([...(selectedBook?.chapters || []), ...importedChapters])],
    [selectedBook, importedChapters],
  )
  const pointOptions = useMemo(
    () => [...new Set([
      ...knowledgeItems.filter((item) => !chapter || item.chapter === chapter).map((item) => item.knowledgePoint),
      ...weakPoints.filter((item) => !chapter || item.chapter === chapter).map((item) => item.name),
    ].filter(Boolean))],
    [knowledgeItems, weakPoints, chapter],
  )

  useEffect(() => {
    const nextBooks = getBooksBySubject(subject)
    const preferred = nextBooks.find((book) => book.grade === state.profile.grade) || nextBooks[0]
    setBookId(preferred?.id || '')
    setChapter(preferred?.chapters[0] || state.profile.currentChapters[subject] || '')
    setCustomChapter('')
    setKnowledgePoint('')
  }, [subject, state.profile.currentChapters, state.profile.grade])

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setLoadingKnowledge(true)
    materialApi.searchKnowledge({ subject, bookId })
      .then((items) => { if (!cancelled) setKnowledgeItems(items) })
      .catch(() => { if (!cancelled) setKnowledgeItems([]) })
      .finally(() => { if (!cancelled) setLoadingKnowledge(false) })
    return () => { cancelled = true }
  }, [bookId, subject])

  useEffect(() => {
    if (mode === 'review' && !knowledgePoint && weakPoints[0]) setKnowledgePoint(weakPoints[0].name)
  }, [mode, knowledgePoint, weakPoints])

  const resolvedChapter = customChapter.trim() || (chapter === '__custom__' ? '' : chapter.trim())
  const toggleSource = (id: string) => {
    setSourceScopes((current) => current.includes(id)
      ? current.length === 1 ? current : current.filter((item) => item !== id)
      : [...current, id])
  }

  const generate = async () => {
    if (!selectedBook) return
    setLoading(true)
    setError('')
    setChecked(false)
    setAnswers({})
    try {
      const response = await learningApi.ai.generateStudyCycle({
        mode,
        subject,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        chapter: resolvedChapter,
        knowledgePoint: knowledgePoint.trim(),
        customGoal: customGoal.trim(),
        sourceScopes,
        duration,
        depth,
      })
      const session: StudySession = {
        id: crypto.randomUUID(),
        mode,
        subject,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        chapter: resolvedChapter,
        knowledgePoint: knowledgePoint.trim(),
        duration,
        depth,
        createdAt: new Date().toISOString(),
        result: response,
      }
      setResult(response)
      setSessions(saveStudySession(session))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const openSession = (session: StudySession) => {
    setMode(session.mode)
    setSubject(session.subject)
    setBookId(session.bookId || getBooksBySubject(session.subject)[0]?.id || '')
    setChapter(session.chapter || '')
    setCustomChapter('')
    setKnowledgePoint(session.knowledgePoint)
    setDuration(session.duration)
    setDepth(session.depth)
    setResult(session.result)
    setChecked(false)
    setAnswers({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="family-page study-cycle-page">
      <header className="family-page-header">
        <div>
          <span className="family-eyebrow"><Sparkles size={15} /> 先选教材，再选章节，知识库跟着书册走</span>
          <h1>预习与复习</h1>
          <p>系统会优先读取对应书册和章节的家庭知识库，也允许手动补充学习目标。</p>
        </div>
        <button className="family-secondary-button" onClick={() => navigate('/daily-plan')}>返回今日计划</button>
      </header>

      <div className="cycle-mode-switch" role="tablist" aria-label="学习模式">
        <button className={mode === 'preview' ? 'active' : ''} onClick={() => { setMode('preview'); setResult(null) }}>
          <BookOpen size={21} /><span><strong>预习</strong><small>先搭章节框架，再带着问题听课</small></span>
        </button>
        <button className={mode === 'review' ? 'active' : ''} onClick={() => { setMode('review'); setResult(null) }}>
          <RefreshCcw size={21} /><span><strong>复习</strong><small>回忆、订正、再验证</small></span>
        </button>
      </div>

      <section className="cycle-config-card">
        <div className="cycle-step-label"><span>1</span><strong>选择教材书册</strong><small>不同科目按指定版本列出高中完整书目</small></div>
        <div className="cycle-config-grid cycle-config-grid--books">
          <label>科目
            <select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>
              {subjects.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="wide">教材书册
            <select value={bookId} onChange={(event) => { const next = getBookById(event.target.value); setBookId(event.target.value); setChapter(next?.chapters[0] || ''); setCustomChapter(''); setKnowledgePoint('') }}>
              {books.map((book) => <option key={book.id} value={book.id}>{book.shortTitle} · {book.grade} · {book.version}</option>)}
            </select>
          </label>
          <div className="cycle-library-status"><Database size={18} /><div><strong>{selectedBook?.shortTitle || '未选择'}</strong><small>{loadingKnowledge ? '正在读取知识库…' : `已匹配 ${knowledgeItems.length} 条家庭知识`}</small></div></div>
        </div>

        <div className="cycle-step-label"><span>2</span><strong>选择章节和重点</strong><small>章节可选，也能输入学校当前进度</small></div>
        <div className="cycle-config-grid">
          <label>{mode === 'preview' ? '要预习的章节' : '要复习的章节'}
            <select value={chapter} onChange={(event) => { setChapter(event.target.value); setCustomChapter(''); setKnowledgePoint('') }}>
              <option value="">请选择章节</option>
              {chapterOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              <option value="__custom__">其他/手动输入</option>
            </select>
          </label>
          <label>自定义章节
            <input value={customChapter} onChange={(event) => setCustomChapter(event.target.value)} placeholder="教材目录中没有时填写" />
          </label>
          <label>{mode === 'preview' ? '重点问题（可选）' : '薄弱知识点'}
            <input list="cycle-point-options" value={knowledgePoint} onChange={(event) => setKnowledgePoint(event.target.value)} placeholder="可选择或自己输入" />
            <datalist id="cycle-point-options">{pointOptions.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
          <label className="wide">自己的要求（可选）
            <input value={customGoal} onChange={(event) => setCustomGoal(event.target.value)} placeholder="例如：只讲老师明天要提问的部分；重点整理易混概念" />
          </label>
        </div>

        <div className="simulation-section cycle-source-section">
          <div className="simulation-section-title"><strong>参考资料</strong><span>系统按书册和章节筛选，不会把无关资料混进来</span></div>
          <div className="format-checkbox-grid">{sourceOptions.map((option) => <label key={option.id} className={sourceScopes.includes(option.id) ? 'active' : ''}><input type="checkbox" checked={sourceScopes.includes(option.id)} onChange={() => toggleSource(option.id)} /><span>{option.label}</span></label>)}</div>
        </div>

        <div className="cycle-option-row">
          <div><span>时间</span><div className="option-pills">{durations.map((item) => <button key={item} className={duration === item ? 'active' : ''} onClick={() => setDuration(item)}>{item} 分钟</button>)}</div></div>
          <div><span>深度</span><div className="option-pills">{depths.map((item) => <button key={item} className={depth === item ? 'active' : ''} onClick={() => setDepth(item)}>{item}</button>)}</div></div>
        </div>

        {error && <div className="family-error">{error}</div>}
        <button className="family-generate-button" disabled={loading || !selectedBook || !resolvedChapter} onClick={generate}>
          {loading ? <><LoaderCircle className="spin" size={19} /> AI 正在按书册与章节生成</> : <><Sparkles size={19} /> 生成{mode === 'preview' ? '预习单' : '复习单'}</>}
        </button>
      </section>

      {result && (
        <section className="cycle-result-card">
          <div className="cycle-result-heading">
            <div className={`cycle-result-icon cycle-result-icon--${mode}`}>{mode === 'preview' ? <BookOpen size={24} /> : <RefreshCcw size={24} />}</div>
            <div><span>{subject} · {selectedBook?.shortTitle} · {resolvedChapter}</span><h2>{result.title}</h2><p>{result.summary}</p></div>
          </div>
          <div className="cycle-objectives">{result.objectives.map((item, index) => <div key={`${item}-${index}`}><Target size={17} /><span>{item}</span></div>)}</div>
          <div className="cycle-content-grid">
            <div className="cycle-panel"><h3>核心内容</h3>{result.keyPoints.map((item, index) => <article key={`${item.title}-${index}`}><span>{index + 1}</span><div><strong>{item.title}</strong><p>{item.content}</p></div></article>)}</div>
            <div className="cycle-panel"><h3>执行步骤</h3>{result.steps.map((item, index) => <article key={`${item.title}-${index}`}><span>{index + 1}</span><div><strong>{item.title}</strong><p>{item.content}</p><em><Clock3 size={14} /> {item.minutes} 分钟</em></div></article>)}</div>
          </div>
          <div className="cycle-self-check">
            <div className="cycle-section-title"><div><h3>完成后自测</h3><p>先独立回答，再查看答案和解析。</p></div>{checked && <span><CheckCircle2 size={16} /> 已核对</span>}</div>
            {result.selfCheck.map((question, index) => <article key={question.id || index}><strong>{index + 1}. {question.content}</strong>{question.options?.length ? <div className="simulation-options">{question.options.map((option) => <label key={option}><input type="radio" name={`cycle-${question.id}`} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>)}</div> : <input value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="写下你的答案" />}{checked && <div className="cycle-answer"><b>参考答案：{question.correctAnswer}</b><span>{question.explanation}</span></div>}</article>)}
            <button className="family-secondary-button" onClick={() => setChecked(true)}>核对答案</button>
          </div>
          <div className="cycle-next-action"><ChevronRight size={20} /><div><strong>下一步</strong><span>{result.nextAction}</span></div><button onClick={() => navigate('/simulation')}>去出题验证</button></div>
        </section>
      )}

      {sessions.length > 0 && <section className="cycle-history"><div className="cycle-section-title"><div><h2>最近生成</h2><p>切换页面后仍会保留。</p></div><RotateCcw size={19} /></div><div className="cycle-history-grid">{sessions.slice(0, 6).map((session) => <article key={session.id}><button className="cycle-history-open" onClick={() => openSession(session)}><span>{session.mode === 'preview' ? '预习' : '复习'}</span><strong>{session.result.title}</strong><small>{session.bookTitle || session.subject} · {session.duration} 分钟</small></button><button className="cycle-history-delete" aria-label="删除记录" onClick={() => setSessions(deleteStudySession(session.id))}><Trash2 size={15} /></button></article>)}</div></section>}
    </div>
  )
}
