import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Flag,
  LockKeyhole,
  RotateCcw,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { QuizQuestion } from '../types'
import { sourceLabels } from '../utils/learning'
import { Badge, Button, Card, ProgressBar } from './ui'

export interface QuizRunnerResult {
  answers: Record<string, string>
  correct: number
  total: number
  wrong: QuizQuestion[]
}

interface QuizRunnerProps {
  questions: QuizQuestion[]
  title: string
  onSubmit: (result: QuizRunnerResult) => void
  submitLabel?: string
}

export function QuizRunner({ questions, title, onSubmit, submitLabel = '提交训练' }: QuizRunnerProps) {
  const navigate = useNavigate()
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

  const currentCorrect = submitted && (answers[current.id] || '').trim() === current.correctAnswer.trim()

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
          <div>
            <Badge tone="info">{current.subject}</Badge>
            <Badge>{current.knowledgePointName}</Badge>
            <Badge tone={current.sourceType === 'real_exam' ? 'success' : current.sourceType === 'ai_generated' ? 'primary' : 'neutral'}>
              {sourceLabels[current.sourceType]}
            </Badge>
          </div>
          <Flag size={18} />
        </div>
        <h2>{current.content}</h2>
        {current.options ? (
          <div className="answer-options">
            {current.options.map((option, optionIndex) => {
              const selected = answers[current.id] === option
              const selectedCorrect = submitted && selected && option === current.correctAnswer
              const selectedWrong = submitted && selected && option !== current.correctAnswer
              return (
                <button type="button"
                  key={option}
                  className={`${selected ? 'selected' : ''} ${selectedCorrect ? 'correct' : ''} ${selectedWrong ? 'wrong' : ''}`}
                  onClick={() => choose(option)}
                >
                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                  <strong>{option}</strong>
                  {selectedCorrect && <CheckCircle2 size={18} />}
                  {selectedWrong && <CircleAlert size={18} />}
                </button>
              )
            })}
          </div>
        ) : (
          <textarea
            className="answer-textarea"
            placeholder="输入你的答案…"
            value={answers[current.id] || ''}
            onChange={(event) => choose(event.target.value)}
            disabled={submitted}
          />
        )}
        {submitted && (
          currentCorrect ? (
            <div className="answer-explanation correct">
              <strong><CheckCircle2 size={18} /> 回答正确</strong>
              <p>{current.explanation}</p>
            </div>
          ) : (
            <div className="answer-explanation wrong protected-answer-card">
              <strong><LockKeyhole size={18} /> 已自动进入错题本，答案暂不显示</strong>
              <p>先在错题本完成分步讲解和两次订正。第一次仍不会时，系统会自动换一种讲法；第二次仍未答对才会显示答案，再安排一道迁移题验证。</p>
              <Button variant="secondary" onClick={() => navigate('/mistakes')}>去错题本订正<ChevronRight size={17} /></Button>
            </div>
          )
        )}
      </Card>

      <div className="quiz-nav">
        <Button variant="secondary" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
          <ChevronLeft size={18} />上一题
        </Button>
        <div className="question-dots">
          {questions.map((question, dotIndex) => (
            <button type="button"
              key={question.id}
              className={`${dotIndex === index ? 'active' : ''} ${answers[question.id] ? 'answered' : ''}`}
              onClick={() => setIndex(dotIndex)}
            >
              {dotIndex + 1}
            </button>
          ))}
        </div>
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
          <div><strong>{result.wrong.length}</strong><span>已进入订正</span></div>
        </Card>
      )}
    </div>
  )
}
