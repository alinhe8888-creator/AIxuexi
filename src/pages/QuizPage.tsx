import { ArrowLeft, BookOpenCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { QuizRunner, type QuizRunnerResult } from '../components/QuizRunner'
import { Badge, Button, Card, EmptyState, PageHeader } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import { toDateKey } from '../utils/date'

export function QuizPage() {
  const navigate = useNavigate()
  const { state, completeQuiz } = useAppStore()
  const quiz = state.quizzes.find((item) => item.date === toDateKey())

  const submit = (result: QuizRunnerResult) => {
    if (quiz) completeQuiz(quiz.id, result.answers)
  }

  return (
    <div>
      <PageHeader eyebrow="每日验证" title="每日小测验" description="题目来自近期错题、薄弱知识点和复习记录。完成后会自动生成第二天的加强任务。" actions={<Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft size={17} />返回首页</Button>} />
      {quiz ? <>
        {quiz.status === 'completed' && <Card className="completed-quiz-banner"><BookOpenCheck size={24} /><div><strong>今日小测已完成</strong><p>正确率 {quiz.correctRate}%，薄弱点：{quiz.weakPoints.join('、') || '暂无明显薄弱点'}。你仍可重新作答查看解析。</p></div><Badge tone={quiz.correctRate >= 80 ? 'success' : 'warning'}>{quiz.correctRate}%</Badge></Card>}
        <QuizRunner questions={quiz.questions} title={quiz.title} onSubmit={submit} submitLabel="提交每日小测" />
      </> : <Card><EmptyState title="今天还没有小测" description="完成错题讲解或模拟训练后，系统会根据画像生成每日小测。" /></Card>}
    </div>
  )
}
