import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { learningApi } from '../services/learningApi'
import { useAppStore } from '../store/useAppStore'
import type { QuestionFormat, QuizQuestion, Subject } from '../types'
import {
  clearSimulationDraft,
  loadSimulationDraft,
  saveSimulationDraft,
  type SimulationDifficulty,
  type SimulationDraft,
  type SimulationMode,
} from '../utils/familyLearningWorkspace'

const formats: QuestionFormat[] = ['选择题', '填空题', '判断题', '解答题', '默写题']
const difficulties: SimulationDifficulty[] = ['基础', '中等', '提高', '混合']

function normalized(value: string) {
  return value.replace(/\s+/g, '').replace(/[，。；：、]/g, '').toLowerCase()
}

function questionCorrect(question: QuizQuestion, answer: string) {
  const user = normalized(answer)
  const correct = normalized(question.correctAnswer)
  if (!user) return false
  return user === correct || correct.includes(user) || user.includes(correct)
}

export function SimulationPage() {
  const { state } = useAppStore()
  const restored = loadSimulationDraft()
  const subjects = state.profile.selectedSubjects.length ? state.profile.selectedSubjects : (['数学'] as Subject[])
  const defaultSubject: Subject = subjects[0] || '数学'
  const [mode, setMode] = useState<SimulationMode>(restored?.mode || 'mini')
  const [subject, setSubject] = useState<Subject>(restored?.subject || defaultSubject)
  const points = useMemo(
    () => state.knowledgePoints.filter((item) => item.subject === subject).sort((a, b) => a.mastery - b.mastery),
    [state.knowledgePoints, subject],
  )
  const [pointIds, setPointIds] = useState<string[]>(restored?.pointIds || points.slice(0, 2).map((item) => item.id))
  const [customPoint, setCustomPoint] = useState(restored?.customPoint || '')
  const [count, setCount] = useState(restored?.count || 5)
  const [selectedFormats, setSelectedFormats] = useState<QuestionFormat[]>(restored?.formats || ['选择题', '填空题', '解答题'])
  const [difficulty, setDifficulty] = useState<SimulationDifficulty>(restored?.difficulty || '混合')
  const [durationMinutes, setDurationMinutes] = useState(restored?.durationMinutes || 25)
  const [questions, setQuestions] = useState<QuizQuestion[]>(restored?.questions || [])
  const [answers, setAnswers] = useState<Record<string, string>>(restored?.answers || {})
  const [submitted, setSubmitted] = useState(restored?.submitted || false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const effectiveCount = mode === 'paper' ? count : Math.min(count, 10)
  const score = questions.length
    ? Math.round((questions.filter((question) => questionCorrect(question, answers[question.id] || '')).length / questions.length) * 100)
    : 0

  const persist = (patch: Partial<SimulationDraft> = {}) => {
    const draft: SimulationDraft = {
      mode,
      subject,
      pointIds,
      customPoint,
      count,
      formats: selectedFormats,
      difficulty,
      durationMinutes,
      questions,
      answers,
      submitted,
      ...patch,
    }
    saveSimulationDraft(draft)
  }

  const changeMode = (next: SimulationMode) => {
    setMode(next)
    setCount(next === 'paper' ? 20 : 5)
    setDurationMinutes(next === 'paper' ? 90 : 25)
    if (next === 'paper') setSelectedFormats(['选择题', '填空题', '解答题'])
  }

  const toggleFormat = (format: QuestionFormat) => {
    setSelectedFormats((current) => current.includes(format)
      ? current.length === 1 ? current : current.filter((item) => item !== format)
      : [...current, format])
  }

  const togglePoint = (id: string) => {
    setPointIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const generate = async () => {
    setLoading(true)
    setError('')
    setSubmitted(false)
    setAnswers({})
    try {
      const selectedPoints = points.filter((item) => pointIds.includes(item.id)).map((item) => ({ id: item.id, name: item.name }))
      if (customPoint.trim()) selectedPoints.push({ id: `custom-${Date.now()}`, name: customPoint.trim() })
      const generated = await learningApi.ai.generateSimulation({
        subject,
        points: selectedPoints,
        count: effectiveCount,
        mode,
        formats: selectedFormats,
        difficulty,
        durationMinutes,
      })
      setQuestions(generated)
      saveSimulationDraft({
        mode,
        subject,
        pointIds,
        customPoint,
        count,
        formats: selectedFormats,
        difficulty,
        durationMinutes,
        questions: generated,
        answers: {},
        submitted: false,
        generatedAt: new Date().toISOString(),
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '生成失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const updateAnswer = (id: string, value: string) => {
    const next = { ...answers, [id]: value }
    setAnswers(next)
    persist({ answers: next })
  }

  const reset = () => {
    clearSimulationDraft()
    setQuestions([])
    setAnswers({})
    setSubmitted(false)
    setError('')
  }

  return (
    <div className="family-page simulation-v160">
      <header className="family-page-header">
        <div>
          <span className="family-eyebrow"><Sparkles size={15} /> 按需要出题，不再固定一套模板</span>
          <h1>模拟训练</h1>
          <p>可以生成整套模拟卷，也可以只练 3—10 道题；题型、难度和知识点都能自己选。</p>
        </div>
        {questions.length > 0 && <button className="family-secondary-button" onClick={reset}><RotateCcw size={16} /> 重新设置</button>}
      </header>

      {!questions.length && (
        <section className="simulation-builder">
          <div className="simulation-mode-grid">
            <button className={mode === 'mini' ? 'active' : ''} onClick={() => changeMode('mini')}>
              <Target size={24} /><span><strong>专项小练</strong><small>3、5、8 或 10 道题，快速验证一个知识点</small></span>
            </button>
            <button className={mode === 'paper' ? 'active' : ''} onClick={() => changeMode('paper')}>
              <FileText size={24} /><span><strong>整套模拟卷</strong><small>12、15 或 20 道题，按考试结构混合题型</small></span>
            </button>
          </div>

          <div className="simulation-form-grid">
            <label>科目
              <span className="select-wrap"><select value={subject} onChange={(event) => { setSubject(event.target.value as Subject); setPointIds([]) }}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></span>
            </label>
            <label>题量
              <span className="select-wrap"><select value={count} onChange={(event) => setCount(Number(event.target.value))}>{(mode === 'paper' ? [12, 15, 20] : [3, 5, 8, 10]).map((item) => <option key={item} value={item}>{item} 道</option>)}</select><ChevronDown size={16} /></span>
            </label>
            <label>建议时间
              <span className="select-wrap"><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{(mode === 'paper' ? [45, 60, 90, 120] : [10, 15, 25, 40]).map((item) => <option key={item} value={item}>{item} 分钟</option>)}</select><ChevronDown size={16} /></span>
            </label>
          </div>

          <div className="simulation-section">
            <div className="simulation-section-title"><strong>难度</strong><span>整套卷建议选择“混合”</span></div>
            <div className="option-pills">{difficulties.map((item) => <button key={item} className={difficulty === item ? 'active' : ''} onClick={() => setDifficulty(item)}>{item}</button>)}</div>
          </div>

          <div className="simulation-section">
            <div className="simulation-section-title"><strong>题型</strong><span>至少保留一种题型</span></div>
            <div className="format-checkbox-grid">{formats.map((format) => <label key={format} className={selectedFormats.includes(format) ? 'active' : ''}><input type="checkbox" checked={selectedFormats.includes(format)} onChange={() => toggleFormat(format)} /><span>{format}</span></label>)}</div>
          </div>

          <div className="simulation-section">
            <div className="simulation-section-title"><strong>知识点</strong><span>不选择时按当前章节综合出题</span></div>
            {points.length > 0 && <div className="point-chip-grid">{points.slice(0, 12).map((point) => <button key={point.id} className={pointIds.includes(point.id) ? 'active' : ''} onClick={() => togglePoint(point.id)}><span>{point.name}</span><small>掌握 {point.mastery}%</small></button>)}</div>}
            <input className="custom-point-input" value={customPoint} onChange={(event) => setCustomPoint(event.target.value)} placeholder="也可以手动输入知识点，例如：函数单调性" />
          </div>

          {error && <div className="family-error">{error}</div>}
          <button className="family-generate-button" disabled={loading} onClick={generate}>
            {loading ? <><LoaderCircle className="spin" size={19} /> 正在生成 {effectiveCount} 道题，请不要关闭页面</> : <><Sparkles size={19} /> 生成{mode === 'paper' ? '整套模拟卷' : `${effectiveCount} 道专项题`}</>}
          </button>
        </section>
      )}

      {questions.length > 0 && (
        <section className="simulation-paper">
          <div className="simulation-paper-head">
            <div><span>{subject} · {mode === 'paper' ? '整套模拟卷' : '专项小练'}</span><h2>{questions.length} 道题 · {difficulty}难度</h2><p>建议用时 {durationMinutes} 分钟。先独立完成，提交后统一查看答案和解析。</p></div>
            <div className="simulation-timer"><Timer size={19} /><strong>{durationMinutes}</strong><span>分钟</span></div>
          </div>

          <div className="simulation-question-list">
            {questions.map((question, index) => {
              const isCorrect = submitted && questionCorrect(question, answers[question.id] || '')
              return (
                <article key={question.id} className={submitted ? (isCorrect ? 'is-correct' : 'is-wrong') : ''}>
                  <div className="simulation-question-head"><span>{index + 1}</span><div><b>{question.format}</b><em>{question.knowledgePointName}</em></div>{submitted && (isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />)}</div>
                  <h3>{question.content}</h3>
                  {question.options?.length ? (
                    <div className="simulation-options">{question.options.map((option) => <label key={option}><input type="radio" name={`question-${question.id}`} disabled={submitted} checked={answers[question.id] === option} onChange={() => updateAnswer(question.id, option)} />{option}</label>)}</div>
                  ) : <textarea disabled={submitted} value={answers[question.id] || ''} onChange={(event) => updateAnswer(question.id, event.target.value)} placeholder="写下你的答案或解题步骤" />}
                  {submitted && <div className="simulation-explanation"><strong>参考答案：{question.correctAnswer}</strong><p>{question.explanation}</p></div>}
                </article>
              )
            })}
          </div>

          {!submitted ? (
            <button className="family-generate-button" onClick={() => { setSubmitted(true); persist({ submitted: true }) }}><ClipboardCheck size={19} /> 提交并查看解析</button>
          ) : (
            <div className="simulation-result-bar"><div><span>本次得分</span><strong>{score}%</strong><p>{score >= 80 ? '掌握不错，可以进入下一知识点。' : score >= 60 ? '基本掌握，建议再复习错题。' : '先返回预习复习，重新梳理薄弱点。'}</p></div><button onClick={reset}>再出一组</button></div>
          )}
        </section>
      )}
    </div>
  )
}
