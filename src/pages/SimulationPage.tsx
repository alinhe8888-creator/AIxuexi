import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Flame,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AdaptiveCorrectionPanel } from '../components/AdaptiveCorrectionPanel'
import { getBookById, getBooksBySubject } from '../config/curriculum'
import { learningApi } from '../services/learningApi'
import { useAppStore } from '../store/useAppStore'
import type { AiExplanation, ErrorCause, QuestionFormat, QuizQuestion, Subject } from '../types'
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
const sourceOptions = [
  { id: 'textbook', label: '已上传教材' },
  { id: 'workbook', label: '练习册/讲义' },
  { id: 'mistakes', label: '个人错题' },
  { id: 'exam', label: '真题/试卷' },
  { id: 'question-bank', label: '开放题源' },
]

const modeLabel: Record<SimulationMode, string> = {
  mini: '专项小练',
  paper: '整套模拟卷',
  sprint: '考前冲刺',
}

type GradeItem = {
  id: string
  correct: boolean
  score: number
  feedback: string
  errorCause: ErrorCause
}

export function SimulationPage() {
  const { state, applySimulation, notify } = useAppStore()
  const restored = loadSimulationDraft()
  const subjects = state.profile.selectedSubjects.length ? state.profile.selectedSubjects : (['数学'] as Subject[])
  const defaultSubject: Subject = subjects[0] || '数学'
  const [mode, setMode] = useState<SimulationMode>(restored?.mode || 'mini')
  const [subject, setSubject] = useState<Subject>(restored?.subject || defaultSubject)
  const books = useMemo(() => getBooksBySubject(subject), [subject])
  const [bookId, setBookId] = useState(restored?.bookId || books[0]?.id || '')
  const selectedBook = useMemo(() => getBookById(bookId) || books[0], [bookId, books])
  const [chapter, setChapter] = useState(restored?.chapter || '')
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
  const [sourceScopes, setSourceScopes] = useState<string[]>(restored?.sourceScopes?.length ? restored.sourceScopes : ['textbook', 'mistakes'])
  const [examDate, setExamDate] = useState('')
  const [sprintFocus, setSprintFocus] = useState('高频易错、基础得分和个人薄弱点')
  const [questions, setQuestions] = useState<QuizQuestion[]>(restored?.questions || [])
  const [answers, setAnswers] = useState<Record<string, string>>(restored?.answers || {})
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState('')
  const [grades, setGrades] = useState<Record<string, GradeItem>>({})
  const [correctionQuestionId, setCorrectionQuestionId] = useState('')
  const [explanations, setExplanations] = useState<Record<string, AiExplanation>>({})
  const [loadingCorrection, setLoadingCorrection] = useState('')

  const effectiveCount = mode === 'mini' ? Math.min(count, 10) : count
  const gradeItems = Object.values(grades)
  const score = gradeItems.length ? Math.round(gradeItems.reduce((sum, item) => sum + item.score, 0) / gradeItems.length) : 0
  const wrongCount = gradeItems.filter((item) => !item.correct).length

  const persist = (patch: Partial<SimulationDraft> = {}) => {
    saveSimulationDraft({
      mode,
      subject,
      bookId,
      chapter,
      sourceScopes,
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
    })
  }

  const changeMode = (next: SimulationMode) => {
    setMode(next)
    if (next === 'mini') {
      setCount(5)
      setDurationMinutes(25)
    } else if (next === 'paper') {
      setCount(20)
      setDurationMinutes(90)
      setSelectedFormats(['选择题', '填空题', '解答题'])
    } else {
      setCount(15)
      setDurationMinutes(45)
      setDifficulty('混合')
      setSelectedFormats(['选择题', '填空题', '解答题'])
      setSourceScopes(['textbook', 'mistakes', 'exam'])
    }
  }

  const changeSubject = (next: Subject) => {
    setSubject(next)
    const nextBook = getBooksBySubject(next)[0]
    setBookId(nextBook?.id || '')
    setChapter('')
    setPointIds([])
  }

  const toggleFormat = (format: QuestionFormat) => {
    setSelectedFormats((current) => current.includes(format)
      ? current.length === 1 ? current : current.filter((item) => item !== format)
      : [...current, format])
  }
  const togglePoint = (id: string) => setPointIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const toggleSource = (id: string) => setSourceScopes((current) => current.includes(id)
    ? current.length === 1 ? current : current.filter((item) => item !== id)
    : [...current, id])

  const generate = async () => {
    setLoading(true)
    setError('')
    setSubmitted(false)
    setAnswers({})
    setGrades({})
    setCorrectionQuestionId('')
    try {
      const selectedPoints = points.filter((item) => pointIds.includes(item.id)).map((item) => ({ id: item.id, name: item.name }))
      if (customPoint.trim()) selectedPoints.push({ id: `custom-${Date.now()}`, name: customPoint.trim() })
      const generated = await learningApi.ai.generateSimulation({
        subject,
        bookId: selectedBook?.id,
        bookTitle: selectedBook?.title,
        chapter,
        points: selectedPoints,
        count: effectiveCount,
        mode,
        formats: selectedFormats,
        difficulty,
        durationMinutes,
        sourceScopes,
        examDate: examDate || undefined,
        sprintFocus: mode === 'sprint' ? sprintFocus.trim() : undefined,
      })
      setQuestions(generated)
      saveSimulationDraft({
        mode,
        subject,
        bookId,
        chapter,
        sourceScopes,
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

  const submitForGrading = async () => {
    if (questions.some((question) => !(answers[question.id] || '').trim())) {
      return notify('info', '还有题目未作答', '完成全部题目后再统一提交。')
    }
    setGrading(true)
    setError('')
    try {
      const result = await learningApi.ai.gradeSimulation({
        subject,
        questions: questions.map((question) => ({
          id: question.id,
          content: question.content,
          format: question.format,
          correctAnswer: question.correctAnswer,
          studentAnswer: answers[question.id] || '',
          knowledgePointId: question.knowledgePointId,
          knowledgePointName: question.knowledgePointName,
        })),
      })
      const nextGrades = Object.fromEntries(result.items.map((item) => [item.id, item]))
      setGrades(nextGrades)
      setSubmitted(true)
      persist({ submitted: true })
      applySimulation(
        `${modeLabel[mode]} · ${selectedBook?.shortTitle || subject}`,
        questions.map((question) => ({
          question,
          isCorrect: Boolean(nextGrades[question.id]?.correct),
          userAnswer: answers[question.id] || '',
          cause: nextGrades[question.id]?.errorCause,
        })),
      )
      notify('success', '批改完成', '错误题已自动进入错题本，但答案不会直接展示。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '批改失败，请稍后重试')
    } finally {
      setGrading(false)
    }
  }

  const startCorrection = async (question: QuizQuestion) => {
    setCorrectionQuestionId(question.id)
    if (explanations[question.id]) return
    setLoadingCorrection(question.id)
    try {
      const preferredStyles = [...state.strategyPreferences]
        .filter((item) => !item.subject || item.subject === question.subject)
        .sort((left, right) => (right.successCount / Math.max(1, right.usedCount)) - (left.successCount / Math.max(1, left.usedCount)))
        .slice(0, 4)
        .map((item) => item.style)
      const explanation = await learningApi.ai.explainQuestion({
        subject: question.subject,
        content: question.content,
        correctAnswer: question.correctAnswer,
        studentAnswer: answers[question.id] || '',
        preferredStyles,
      })
      setExplanations((current) => ({ ...current, [question.id]: explanation }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '订正讲解生成失败')
    } finally {
      setLoadingCorrection('')
    }
  }

  const reset = () => {
    clearSimulationDraft()
    setQuestions([])
    setAnswers({})
    setSubmitted(false)
    setGrades({})
    setError('')
    setCorrectionQuestionId('')
    setExplanations({})
  }

  const countOptions = mode === 'mini' ? [3, 5, 8, 10] : mode === 'paper' ? [12, 15, 20, 25] : [10, 15, 20]
  const timeOptions = mode === 'mini' ? [10, 15, 25, 40] : mode === 'paper' ? [45, 60, 90, 120] : [20, 30, 45, 60]

  return (
    <div className="family-page simulation-v160 simulation-v5">
      <header className="family-page-header">
        <div>
          <span className="family-eyebrow"><Sparkles size={15} /> 专项、整卷和考前冲刺三种训练</span>
          <h1>模拟训练</h1>
          <p>按教材、章节、题型和薄弱点出题；提交后先判断和订正，不会立刻把答案铺出来。</p>
        </div>
        {questions.length > 0 && <button className="family-secondary-button" onClick={reset}><RotateCcw size={16} />重新设置</button>}
      </header>

      {!questions.length && (
        <section className="simulation-builder">
          <div className="simulation-mode-grid simulation-mode-grid--three">
            <button className={mode === 'mini' ? 'active' : ''} onClick={() => changeMode('mini')}><Target size={24} /><span><strong>专项小练</strong><small>3—10 道，集中验证一个知识点</small></span></button>
            <button className={mode === 'paper' ? 'active' : ''} onClick={() => changeMode('paper')}><FileText size={24} /><span><strong>整套模拟卷</strong><small>按考试结构组合章节和题型</small></span></button>
            <button className={mode === 'sprint' ? 'active sprint' : 'sprint'} onClick={() => changeMode('sprint')}><Flame size={24} /><span><strong>考前冲刺</strong><small>限时、高频、易错和得分策略</small></span></button>
          </div>

          <div className="simulation-form-grid">
            <label>科目<span className="select-wrap"><select value={subject} onChange={(event) => changeSubject(event.target.value as Subject)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></span></label>
            <label>教材书册<span className="select-wrap"><select value={bookId} onChange={(event) => { setBookId(event.target.value); setChapter('') }}>{books.map((book) => <option key={book.id} value={book.id}>{book.shortTitle} · {book.grade}</option>)}</select><ChevronDown size={16} /></span></label>
            <label>章节<span className="select-wrap"><select value={chapter} onChange={(event) => setChapter(event.target.value)}><option value="">全册/综合</option>{selectedBook?.chapters.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={16} /></span></label>
            <label>题量<span className="select-wrap"><select value={count} onChange={(event) => setCount(Number(event.target.value))}>{countOptions.map((item) => <option key={item} value={item}>{item} 道</option>)}</select><ChevronDown size={16} /></span></label>
            <label>建议时间<span className="select-wrap"><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>{timeOptions.map((item) => <option key={item} value={item}>{item} 分钟</option>)}</select><ChevronDown size={16} /></span></label>
            {mode === 'sprint' && <label>考试日期<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label>}
          </div>

          {mode === 'sprint' && <div className="sprint-focus-card"><Flame size={21} /><label><strong>冲刺重点</strong><input value={sprintFocus} onChange={(event) => setSprintFocus(event.target.value)} placeholder="例如：选择题速度、古诗文易错、函数高频考点" /></label><p>系统会优先安排短时可提分内容，并给出时间分配和舍题策略。</p></div>}

          <div className="simulation-section"><div className="simulation-section-title"><strong>难度</strong><span>{mode === 'sprint' ? '冲刺版建议混合难度，先保基础分' : '整套卷建议选择“混合”'}</span></div><div className="option-pills">{difficulties.map((item) => <button key={item} className={difficulty === item ? 'active' : ''} onClick={() => setDifficulty(item)}>{item}</button>)}</div></div>
          <div className="simulation-section"><div className="simulation-section-title"><strong>题型</strong><span>至少保留一种题型</span></div><div className="format-checkbox-grid">{formats.map((format) => <label key={format} className={selectedFormats.includes(format) ? 'active' : ''}><input type="checkbox" checked={selectedFormats.includes(format)} onChange={() => toggleFormat(format)} /><span>{format}</span></label>)}</div></div>
          <div className="simulation-section"><div className="simulation-section-title"><strong>题源范围</strong><span>优先从家庭知识库和个人数据生成</span></div><div className="format-checkbox-grid">{sourceOptions.map((option) => <label key={option.id} className={sourceScopes.includes(option.id) ? 'active' : ''}><input type="checkbox" checked={sourceScopes.includes(option.id)} onChange={() => toggleSource(option.id)} /><span>{option.label}</span></label>)}</div></div>
          <div className="simulation-section"><div className="simulation-section-title"><strong>知识点</strong><span>不选择时按书册与章节综合出题</span></div>{points.length > 0 && <div className="point-chip-grid">{points.slice(0, 12).map((point) => <button key={point.id} className={pointIds.includes(point.id) ? 'active' : ''} onClick={() => togglePoint(point.id)}><span>{point.name}</span><small>掌握 {point.mastery}%</small></button>)}</div>}<input className="custom-point-input" value={customPoint} onChange={(event) => setCustomPoint(event.target.value)} placeholder="可手动输入知识点或老师指定范围" /></div>

          {error && <div className="family-error">{error}</div>}
          <button className="family-generate-button" disabled={loading || !selectedBook} onClick={generate}>{loading ? <><LoaderCircle className="spin" size={19} />正在生成 {effectiveCount} 道题，请不要关闭页面</> : <><Sparkles size={19} />生成{modeLabel[mode]}</>}</button>
        </section>
      )}

      {questions.length > 0 && (
        <section className="simulation-paper">
          <div className="simulation-paper-head">
            <div><span>{subject} · {selectedBook?.shortTitle} · {modeLabel[mode]}</span><h2>{questions.length} 道题 · {difficulty}难度</h2><p>建议用时 {durationMinutes} 分钟。提交后错误题自动进错题本，不直接显示答案。</p></div>
            <div className="simulation-timer"><Timer size={19} /><strong>{durationMinutes}</strong><span>分钟</span></div>
          </div>

          <div className="simulation-question-list">
            {questions.map((question, index) => {
              const grade = grades[question.id]
              const isCorrect = Boolean(grade?.correct)
              const mistake = state.mistakes.find((item) => item.questionId === `simulation-${question.id}` && !item.archived)
              const explanation = explanations[question.id]
              const correctionOpen = correctionQuestionId === question.id
              return (
                <article key={question.id} className={submitted ? (isCorrect ? 'is-correct' : 'is-wrong') : ''}>
                  <div className="simulation-question-head">
                    <span>{index + 1}</span>
                    <div><b>{question.format}</b><em>{question.knowledgePointName}</em></div>
                    {submitted && (isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />)}
                  </div>
                  <h3>{question.content}</h3>
                  {question.options?.length ? (
                    <div className="simulation-options">{question.options.map((option) => <label key={option}><input type="radio" name={`question-${question.id}`} disabled={submitted} checked={answers[question.id] === option} onChange={() => updateAnswer(question.id, option)} />{option}</label>)}</div>
                  ) : (
                    <textarea disabled={submitted} value={answers[question.id] || ''} onChange={(event) => updateAnswer(question.id, event.target.value)} placeholder="写下你的答案或解题步骤" />
                  )}

                  {submitted && grade && (
                    <div className={`simulation-grade-feedback ${grade.correct ? 'correct' : 'wrong'}`}>
                      {grade.correct ? <CheckCircle2 size={19} /> : <LockKeyhole size={19} />}
                      <div>
                        <strong>{grade.correct ? `回答正确 · ${grade.score} 分` : `需要订正 · ${grade.score} 分`}</strong>
                        <p>{grade.feedback}</p>
                        {!grade.correct && <small>错因：{grade.errorCause} · 已自动进入错题本</small>}
                      </div>
                      {!grade.correct && (
                        <button onClick={() => void startCorrection(question)} disabled={loadingCorrection === question.id}>
                          {loadingCorrection === question.id ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                          {correctionOpen ? '继续订正' : '开始订正'}
                        </button>
                      )}
                    </div>
                  )}

                  {submitted && !isCorrect && correctionOpen && explanation && mistake && (
                    <AdaptiveCorrectionPanel
                      mistakeId={mistake.id}
                      subject={question.subject}
                      question={question.content}
                      correctAnswer={question.correctAnswer || explanation.finalAnswer}
                      knowledgePointName={question.knowledgePointName}
                      explanation={explanation}
                      compact
                    />
                  )}
                </article>
              )
            })}
          </div>

          {error && <div className="family-error">{error}</div>}
          {!submitted ? (
            <button className="family-generate-button" onClick={() => void submitForGrading()} disabled={grading}>
              {grading ? <LoaderCircle className="spin" size={19} /> : <ClipboardCheck size={19} />}
              {grading ? '正在按步骤批改并整理错题…' : '提交批改（错误题不直接显示答案）'}
            </button>
          ) : (
            <div className="simulation-result-bar simulation-result-bar--adaptive">
              <div><span>本次综合得分</span><strong>{score}%</strong><p>{wrongCount ? `${wrongCount} 道题已进入订正队列，完成迁移检测后才算真正掌握。` : '本组全部通过，可以进入下一知识点。'}</p></div>
              <div className="simulation-result-counters"><span><b>{questions.length - wrongCount}</b>已掌握</span><span><b>{wrongCount}</b>待订正</span></div>
              <button onClick={reset}>再出一组</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
