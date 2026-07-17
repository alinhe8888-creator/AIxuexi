import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  Camera,
  CheckCircle2,
  Circle,
  Clock3,
  Flame,
  NotebookTabs,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MiniLineChart } from '../components/Charts'
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, SectionTitle, StatCard } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import { formatDate, toDateKey } from '../utils/date'

export function HomePage() {
  const navigate = useNavigate()
  const { state, toggleTask } = useAppStore()
  const today = toDateKey()
  const plan = state.dailyPlans.find((item) => item.date === today)
  const quiz = state.quizzes.find((item) => item.date === today)
  const dueReviews = state.reviewTasks.filter((task) => task.status === 'pending' && task.scheduledDate <= today).slice(0, 5)
  const weakPoints = [...state.knowledgePoints].sort((a, b) => a.mastery - b.mastery).slice(0, 4)
  const averageMastery = Math.round(state.knowledgePoints.reduce((sum, item) => sum + item.mastery, 0) / Math.max(1, state.knowledgePoints.length))
  const completedTasks = plan?.tasks.filter((task) => task.status === 'completed').length ?? 0
  const taskTotal = plan?.tasks.length ?? 0
  const weeklyTrend = useMemo(() => {
    const trends = state.knowledgePoints.map((point) => point.trend)
    const maxLength = Math.max(...trends.map((trend) => trend.length), 1)
    return Array.from({ length: maxLength }, (_, index) => Math.round(trends.reduce((sum, trend) => sum + (trend[index] ?? trend.at(-1) ?? 0), 0) / Math.max(1, trends.length)))
  }, [state.knowledgePoints])

  return (
    <div>
      <PageHeader
        eyebrow="TODAY · 智能学习台"
        title={`上午好，${state.profile.name}`}
        description="先完成最重要的薄弱点，再做小测验证。今天的任务已经按优先级排好。"
        actions={<Button onClick={() => navigate('/photo-explain')}><Camera size={18} />上传一道错题</Button>}
      />

      <div className="hero-grid">
        <Card className="hero-card">
          <div className="hero-card-content">
            <Badge tone="primary"><Sparkles size={14} /> AI 今日建议</Badge>
            <h2>优先突破“导数的几何意义”</h2>
            <p>这是当前掌握度最低且近期重复出错的知识点。先复习概念，再完成 2 道同类题，预计 20 分钟。</p>
            <div className="hero-actions">
              <Button onClick={() => navigate('/mistakes')}>开始复习<ArrowRight size={18} /></Button>
              <Button variant="ghost" onClick={() => navigate('/profile')}>查看判断依据</Button>
            </div>
          </div>
          <div className="hero-orbit" aria-hidden="true"><BrainCircuit size={50} /><span /><span /><span /></div>
        </Card>
        <Card className="today-progress-card">
          <div className="card-topline"><span>今日完成度</span><Flame size={20} /></div>
          <strong className="big-percent">{taskTotal ? Math.round((completedTasks / taskTotal) * 100) : 0}%</strong>
          <ProgressBar value={taskTotal ? (completedTasks / taskTotal) * 100 : 0} />
          <div className="progress-meta"><span>{completedTasks} 项已完成</span><span>{Math.max(0, taskTotal - completedTasks)} 项待完成</span></div>
        </Card>
      </div>

      <div className="stats-grid four">
        <StatCard label="综合掌握度" value={`${averageMastery}%`} hint="基于当前知识点画像" icon={<Target size={20} />} trend={{ value: 6, label: '近四次' }} />
        <StatCard label="待复习任务" value={dueReviews.length} hint="按遗忘风险排序" icon={<CalendarClock size={20} />} />
        <StatCard label="活跃错题" value={state.mistakes.filter((item) => !item.archived).length} hint="掌握后可归档" icon={<NotebookTabs size={20} />} />
        <StatCard label="连续学习" value="7 天" hint="保持稳定比突击更重要" icon={<Flame size={20} />} />
      </div>

      <div className="content-grid main-side">
        <div className="stack">
          <Card>
            <SectionTitle title="今日学习安排" description="每项任务都可以直接完成或进入对应功能" action={<button className="text-button" onClick={() => navigate('/daily-plan')}>管理计划<ArrowRight size={15} /></button>} />
            {plan?.tasks.length ? (
              <div className="task-list">
                {plan.tasks.map((task) => (
                  <div className={`task-row ${task.status === 'completed' ? 'done' : ''}`} key={task.id}>
                    <button className="task-check" onClick={() => toggleTask(plan.id, task.id)} aria-label={task.status === 'completed' ? '标记未完成' : '标记完成'}>{task.status === 'completed' ? <CheckCircle2 size={22} /> : <Circle size={22} />}</button>
                    <div className="task-main"><strong>{task.title}</strong><span>{task.description}</span></div>
                    {task.subject && <Badge>{task.subject}</Badge>}
                    <span className="task-time"><Clock3 size={14} />{task.estimatedMinutes} 分钟</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="今天还没有任务" description="系统会根据错题和薄弱知识点生成每日计划。" action={<Button onClick={() => navigate('/daily-plan')}>生成计划</Button>} />}
          </Card>

          <Card>
            <SectionTitle title="每日小测验" description="来自错题、薄弱点与近期复习记录" />
            {quiz ? (
              <div className="quiz-home-card">
                <div className="quiz-home-icon"><BookOpenCheck size={26} /></div>
                <div><strong>{quiz.title}</strong><p>{quiz.questions.length} 道题 · 预计 15 分钟 · AI 动态组卷</p><div className="badge-row">{[...new Set(quiz.questions.map((item) => item.subject))].map((subject) => <Badge key={subject}>{subject}</Badge>)}</div></div>
                <Button onClick={() => navigate('/quiz')}>{quiz.status === 'completed' ? `查看结果 ${quiz.correctRate}%` : '开始小测'}<ArrowRight size={17} /></Button>
              </div>
            ) : <EmptyState title="今日小测尚未生成" description="完成一条错题讲解后，系统会自动补充测试内容。" />}
          </Card>

          <Card>
            <SectionTitle title="学习进步趋势" description="综合各知识点最近几次掌握度变化" />
            <div className="trend-chart-block">
              <div><strong>{averageMastery}%</strong><span>当前平均掌握度</span></div>
              <MiniLineChart values={weeklyTrend} height={120} />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <SectionTitle title="今日复习安排" description={`${dueReviews.length} 项已到期`} action={<button className="text-button" onClick={() => navigate('/mistakes')}>全部复习</button>} />
            <div className="review-list">
              {dueReviews.map((task) => (
                <button key={task.id} onClick={() => navigate(task.sourceKind === 'card' ? '/challenge' : '/mistakes')}>
                  <span className={`priority-dot p${task.priority}`} /><div><strong>{task.title}</strong><span>{task.subject} · {task.scheduledDate === today ? '今天到期' : `已逾期`}</span></div><ArrowRight size={16} />
                </button>
              ))}
              {!dueReviews.length && <EmptyState title="今天没有到期复习" description="保持当前节奏，完成小测后系统会安排下一轮。" />}
            </div>
          </Card>

          <Card>
            <SectionTitle title="当前薄弱知识点" description="按掌握度和遗忘风险综合排序" />
            <div className="weak-list">
              {weakPoints.map((point, index) => (
                <button key={point.id} onClick={() => navigate('/profile')}>
                  <span className="rank">{index + 1}</span>
                  <div><strong>{point.name}</strong><span>{point.subject} · {point.mainCause || '待分析'}</span><ProgressBar value={point.mastery} compact /></div>
                  <Badge tone={point.forgettingRisk === '高' ? 'danger' : point.forgettingRisk === '中' ? 'warning' : 'success'}>{point.forgettingRisk}风险</Badge>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle title="常用入口" />
            <div className="quick-grid">
              <button onClick={() => navigate('/photo-explain')}><Camera size={21} /><span>拍题讲解</span></button>
              <button onClick={() => navigate('/paper-analysis')}><BookOpenCheck size={21} /><span>试卷分析</span></button>
              <button onClick={() => navigate('/challenge')}><Target size={21} /><span>卡片闯关</span></button>
              <button onClick={() => navigate('/reports')}><TrendingUp size={21} /><span>学习报告</span></button>
            </div>
          </Card>

          <Card>
            <SectionTitle title="最近学习动态" />
            <div className="activity-list">
              {state.activityLogs.slice(0, 4).map((log) => <div key={log.id}><span className="activity-dot" /><div><strong>{log.title}</strong><p>{log.description}</p></div><time>{formatDate(log.createdAt, true)}</time></div>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
