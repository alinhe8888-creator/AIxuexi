import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { learningApi } from '../services/learningApi'
import { useAppStore } from '../store/useAppStore'
import type { Subject } from '../types'
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

export function StudyCyclePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useAppStore()
  const initialMode = (location.state as { mode?: StudyCycleMode } | null)?.mode || 'preview'
  const [mode, setMode] = useState<StudyCycleMode>(initialMode)
  const subjects = state.profile.selectedSubjects.length ? state.profile.selectedSubjects : (['数学'] as Subject[])
  const defaultSubject: Subject = subjects[0] || '数学'
  const [subject, setSubject] = useState<Subject>(defaultSubject)
  const [chapter, setChapter] = useState(state.profile.currentChapters[defaultSubject] || '')
  const weakPoints = useMemo(
    () => state.knowledgePoints.filter((item) => item.subject === subject).sort((a, b) => a.mastery - b.mastery),
    [state.knowledgePoints, subject],
  )
  const [knowledgePoint, setKnowledgePoint] = useState(weakPoints[0]?.name || '')
  const [duration, setDuration] = useState(25)
  const [depth, setDepth] = useState<StudyDepth>('标准')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<StudyCycleResult | null>(null)
  const [sessions, setSessions] = useState<StudySession[]>(() => loadStudySessions())
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const nextChapter = state.profile.currentChapters[subject] || ''
    setChapter(nextChapter)
    const point = state.knowledgePoints.filter((item) => item.subject === subject).sort((a, b) => a.mastery - b.mastery)[0]
    setKnowledgePoint(point?.name || '')
  }, [state.knowledgePoints, state.profile.currentChapters, subject])

  const generate = async () => {
    setLoading(true)
    setError('')
    setChecked(false)
    setAnswers({})
    try {
      const response = await learningApi.ai.generateStudyCycle({
        mode,
        subject,
        chapter: chapter.trim(),
        knowledgePoint: knowledgePoint.trim(),
        duration,
        depth,
      })
      const session: StudySession = {
        id: crypto.randomUUID(),
        mode,
        subject,
        chapter: chapter.trim(),
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
    setChapter(session.chapter)
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
          <span className="family-eyebrow"><Sparkles size={15} /> 学前先搭框架，学后及时加固</span>
          <h1>预习与复习</h1>
          <p>预习负责看懂下一步要学什么，复习负责把错题和遗忘点重新拉回来。</p>
        </div>
        <button className="family-secondary-button" onClick={() => navigate('/daily-plan')}>返回今日计划</button>
      </header>

      <div className="cycle-mode-switch" role="tablist" aria-label="学习模式">
        <button className={mode === 'preview' ? 'active' : ''} onClick={() => { setMode('preview'); setResult(null) }}>
          <BookOpen size={21} /><span><strong>预习</strong><small>建立章节框架和问题清单</small></span>
        </button>
        <button className={mode === 'review' ? 'active' : ''} onClick={() => { setMode('review'); setResult(null) }}>
          <RefreshCcw size={21} /><span><strong>复习</strong><small>回忆、订正、再验证</small></span>
        </button>
      </div>

      <section className="cycle-config-card">
        <div className="cycle-config-grid">
          <label>科目
            <select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>
              {subjects.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>{mode === 'preview' ? '要预习的章节' : '要复习的章节'}
            <input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="例如：函数的概念与性质" />
          </label>
          <label>{mode === 'preview' ? '重点问题（可选）' : '薄弱知识点'}
            <input
              list="weak-point-options"
              value={knowledgePoint}
              onChange={(event) => setKnowledgePoint(event.target.value)}
              placeholder={mode === 'preview' ? '例如：函数定义域' : '例如：单调性判断'}
            />
            <datalist id="weak-point-options">{weakPoints.map((item) => <option key={item.id} value={item.name} />)}</datalist>
          </label>
        </div>

        <div className="cycle-option-row">
          <div><span>时间</span><div className="option-pills">{durations.map((item) => <button key={item} className={duration === item ? 'active' : ''} onClick={() => setDuration(item)}>{item} 分钟</button>)}</div></div>
          <div><span>深度</span><div className="option-pills">{depths.map((item) => <button key={item} className={depth === item ? 'active' : ''} onClick={() => setDepth(item)}>{item}</button>)}</div></div>
        </div>

        {error && <div className="family-error">{error}</div>}
        <button className="family-generate-button" disabled={loading || (!chapter.trim() && !knowledgePoint.trim())} onClick={generate}>
          {loading ? <><LoaderCircle className="spin" size={19} /> AI 正在结合教材生成</> : <><Sparkles size={19} /> 生成{mode === 'preview' ? '预习单' : '复习单'}</>}
        </button>
      </section>

      {result && (
        <section className="cycle-result-card">
          <div className="cycle-result-heading">
            <div className={`cycle-result-icon cycle-result-icon--${mode}`}>{mode === 'preview' ? <BookOpen size={24} /> : <RefreshCcw size={24} />}</div>
            <div><span>{subject} · {mode === 'preview' ? '预习' : '复习'}</span><h2>{result.title}</h2><p>{result.summary}</p></div>
          </div>

          <div className="cycle-objectives">
            {result.objectives.map((item, index) => <div key={`${item}-${index}`}><Target size={17} /><span>{item}</span></div>)}
          </div>

          <div className="cycle-content-grid">
            <div className="cycle-panel">
              <h3>核心内容</h3>
              {result.keyPoints.map((item, index) => <article key={`${item.title}-${index}`}><span>{index + 1}</span><div><strong>{item.title}</strong><p>{item.content}</p></div></article>)}
            </div>
            <div className="cycle-panel">
              <h3>执行步骤</h3>
              {result.steps.map((item, index) => <article key={`${item.title}-${index}`}><span>{index + 1}</span><div><strong>{item.title}</strong><p>{item.content}</p><em><Clock3 size={14} /> {item.minutes} 分钟</em></div></article>)}
            </div>
          </div>

          <div className="cycle-self-check">
            <div className="cycle-section-title"><div><h3>完成后自测</h3><p>先独立回答，再查看答案和解析。</p></div>{checked && <span><CheckCircle2 size={16} /> 已核对</span>}</div>
            {result.selfCheck.map((question, index) => (
              <article key={question.id || index}>
                <strong>{index + 1}. {question.content}</strong>
                {question.options?.length ? (
                  <div className="simulation-options">{question.options.map((option) => <label key={option}><input type="radio" name={`cycle-${question.id}`} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>)}</div>
                ) : <input value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="写下你的答案" />}
                {checked && <div className="cycle-answer"><b>参考答案：{question.correctAnswer}</b><span>{question.explanation}</span></div>}
              </article>
            ))}
            <button className="family-secondary-button" onClick={() => setChecked(true)}>核对答案</button>
          </div>

          <div className="cycle-next-action"><ChevronRight size={20} /><div><strong>下一步</strong><span>{result.nextAction}</span></div><button onClick={() => navigate('/simulation')}>去出题验证</button></div>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="cycle-history">
          <div className="cycle-section-title"><div><h2>最近生成</h2><p>切换页面后仍会保留，可以继续学习。</p></div><RotateCcw size={19} /></div>
          <div className="cycle-history-grid">
            {sessions.slice(0, 6).map((session) => (
              <article key={session.id}>
                <button className="cycle-history-open" onClick={() => openSession(session)}>
                  <span>{session.mode === 'preview' ? '预习' : '复习'}</span>
                  <strong>{session.result.title}</strong>
                  <small>{session.subject} · {session.duration} 分钟</small>
                </button>
                <button className="cycle-history-delete" aria-label="删除记录" onClick={() => setSessions(deleteStudySession(session.id))}><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
