import { ChevronDown, LoaderCircle, Settings2, Sparkles, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { QuizRunner, type QuizRunnerResult } from '../components/QuizRunner'
import { Badge, Button, Card, EmptyState, PageHeader, SectionTitle } from '../components/ui'
import { learningApi } from '../services'
import { useAppStore } from '../store/useAppStore'
import type { ErrorCause, QuizQuestion, Subject } from '../types'

const subjects: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

export function SimulationPage() {
  const { state, applySimulation, notify } = useAppStore()
  const [subject, setSubject] = useState<Subject>('数学')
  const [count, setCount] = useState(5)
  const [mode, setMode] = useState<'weak' | 'mixed'>('weak')
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [lastResult, setLastResult] = useState<{ correct: number; total: number; rate: number } | null>(null)

  const weakPoints = useMemo(() => state.knowledgePoints.filter((point) => point.subject === subject).sort((a, b) => a.mastery - b.mastery), [state.knowledgePoints, subject])

  const generate = async () => {
    setLoading(true)
    setLastResult(null)
    try {
      const points = (mode === 'weak' ? weakPoints.slice(0, 3) : weakPoints).map((point) => ({ id: point.id, name: point.name }))
      const result = await learningApi.ai.generateSimulation({ subject, points, count })
      setQuestions(result)
      notify('success', '模拟训练已生成', `共 ${result.length} 道题，重点覆盖 ${points.map((item) => item.name).join('、') || `${subject}基础知识`}。`)
    } catch (error) {
      notify('error', '模拟训练生成失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const submit = (result: QuizRunnerResult) => {
    const items = result.wrong.map((wrong) => wrong.id)
    const complete = applySimulation(`${subject}模拟训练`, questions.map((question) => ({ question, userAnswer: result.answers[question.id] || '', isCorrect: !items.includes(question.id), cause: (!items.includes(question.id) ? undefined : '知识点不会') as ErrorCause | undefined })))
    setLastResult({ correct: complete.correct, total: complete.total, rate: complete.correctRate })
  }

  return (
    <div>
      <PageHeader eyebrow="AI 动态组卷" title="模拟训练" description="根据当前薄弱知识点生成专项或混合训练。提交后，错题会进入错题本并重新计算画像。" actions={<Badge tone="primary"><Target size={15} />AI 生成题明确标记来源</Badge>} />

      <Card className="simulation-config">
        <SectionTitle title="训练设置" description="选择科目、题量和组卷策略" />
        <div className="simulation-fields">
          <label>训练科目<select value={subject} onChange={(event) => { setSubject(event.target.value as Subject); setQuestions([]) }}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
          <label>题目数量<select value={count} onChange={(event) => setCount(Number(event.target.value))}>{[5, 8, 10].map((item) => <option key={item} value={item}>{item} 题</option>)}</select><ChevronDown size={16} /></label>
          <div className="mode-selector"><span>组卷策略</span><div><button className={mode === 'weak' ? 'active' : ''} onClick={() => setMode('weak')}>薄弱点专项</button><button className={mode === 'mixed' ? 'active' : ''} onClick={() => setMode('mixed')}>综合混合</button></div></div>
          <Button onClick={() => void generate()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{loading ? '正在组卷…' : '生成模拟训练'}</Button>
        </div>
        <div className="selected-points"><Settings2 size={17} /><span>本次优先知识点：</span>{weakPoints.length ? weakPoints.slice(0, 4).map((point) => <Badge key={point.id} tone={point.mastery < 45 ? 'danger' : 'warning'}>{point.name} {point.mastery}%</Badge>) : <Badge>{subject}基础知识</Badge>}</div>
      </Card>

      {questions.length ? <QuizRunner key={questions.map((item) => item.id).join('-')} questions={questions} title={`${subject} · ${mode === 'weak' ? '薄弱点专项' : '综合训练'}`} onSubmit={submit} submitLabel="提交并更新画像" /> : <Card><EmptyState title="尚未生成训练题" description="选择训练设置后点击“生成模拟训练”。系统通过 Render 后端生成训练题；未配置模型密钥时使用结构化兜底题目，页面仍可完整体验。" /></Card>}

      {lastResult && <Card className="simulation-result-summary"><div><strong>{lastResult.rate}%</strong><span>本次正确率</span></div><div><strong>{lastResult.correct}/{lastResult.total}</strong><span>答对题数</span></div><div><strong>{lastResult.total - lastResult.correct}</strong><span>已加入错题本</span></div><p>本次结果已同步到知识点掌握度、遗忘风险和复习任务。</p></Card>}
    </div>
  )
}
