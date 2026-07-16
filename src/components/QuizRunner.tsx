import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Flag, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { QuizQuestion } from '../types'
import { sourceLabels } from '../utils/learning'
import { Badge, Button, Card, ProgressBar } from './ui'

export interface QuizRunnerResult {
  answers: Record<string, string>
  correct: number
  total: number
  wrong: QuizQuestion[]
}

export function QuizRunner({ questions, title, onSubmit, submitLabel = '提交训练' }: { questions: QuizQuestion[]; title: string; onSubmit: (result: QuizRunnerResult) => void; submitLabel?: string }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const current = questions[index]
  const answered = Object.values(answers).filter(Boolean).length
  const result = useMemo(() => {
    const wrong = questions.filter((question) => (answers[question.id] || '').trim() !== question.correctAnswer.trim())
    return { answers, correct: questions.length - wrong.length, total: questions.length, wrong }
  }, [answers, questions])

  if (!current) return <Card><p>暂无题目。</p></Card>

  const choose = (answer: string) => {
    if (submitted) return
    setAnswers((old) => ({ ...old, [current.id]: answer }))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    onSubmit(result)
  }

  const restart = () => {
    setAnswers({})
    setIndex(0)
    setSubmitted(false)
  }

  return (
    <div className="quiz-runner">
      <Card className="quiz-toolbar">
        <div><Badge tone="primary">{title}</Badge><strong>{index + 1} / {questions.length}</strong></div>
        <ProgressBar value={(answered / questions.length) * 100} compact />
      </Card>

      <Card className="quiz-question-card">
        <div className="question-meta">
          <div><Badge tone="info">{current.subject}</Badge><Badge>{current.knowledgePointName}</Badge><Badge tone={current.sourceType === 'real_exam' ? 'success' : current.sourceType === 'ai_generated' ? 'primary' : 'neutral'}>{sourceLabels[current.sourceType]}</Badge></div>
          <Flag size={18} />
        </div>
        <h2>{current.content}</h2>
        {current.options ? (
          <div className="answer-options">
            {current.options.map((option, optionIndex) => {
              const selected = answers[current.id] === option
              const isCorrect = submitted && option === current.correctAnswer
              const isWrong = submitted && selected && option !== current.correctAnswer
              return (
                <button key={option} className={`${selected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => choose(option)}>
                  <span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong>
                  {isCorrect && <CheckCircle2 size={18} />}{isWrong && <CircleAlert size={18} />}
                </button>
              )
            })}
          </div>
        ) : (
          <textarea className="answer-textarea" placeholder="输入你的答案…" value={answers[current.id] || ''} onChange={(event) => choose(event.target.value)} disabled={submitted} />
        )}
        {submitted && (
          <div className={`answer-explanation ${(answers[current.id] || '').trim() === current.correctAnswer.trim() ? 'correct' : 'wrong'}`}>
            <strong>{(answers[current.id] || '').trim() === current.correctAnswer.trim() ? '回答正确' : `正确答案：${current.correctAnswer}`}</strong>
            <p>{current.explanation}</p>
          </div>
        )}
      </Card>

      <div className="quiz-nav">
        <Button variant="secondary" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}><ChevronLeft size={18} />上一题</Button>
        <div className="question-dots">{questions.map((question, dotIndex) => <button key={question.id} className={`${dotIndex === index ? 'active' : ''} ${answers[question.id] ? 'answered' : ''}`} onClick={() => setIndex(dotIndex)}>{dotIndex + 1}</button>)}</div>
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>下一题<ChevronRight size={18} /></Button>
        ) : submitted ? (
          <Button variant="secondary" onClick={restart}><RotateCcw size={18} />再做一次</Button>
        ) : (
          <Button onClick={handleSubmit} disabled={answered < questions.length}>{submitLabel}</Button>
        )}
      </div>

      {submitted && (
        <Card className="quiz-result-strip">
          <div><strong>{result.correct}/{result.total}</strong><span>答对题数</span></div>
          <div><strong>{Math.round((result.correct / result.total) * 100)}%</strong><span>正确率</span></div>
          <div><strong>{result.wrong.length}</strong><span>需要加强</span></div>
        </Card>
      )}
    </div>
  )
}
