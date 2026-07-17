import { CalendarDays, CheckCircle2, TrendingUp } from 'lucide-react'
import { MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentReportsPage() {
  const { dashboard, loading, error } = useParentData()
  if (loading) return <LoadingState text="正在生成家长学习报告…" />
  if (error || !dashboard) return <EmptyState title="暂无报告" description={error || '请先绑定学生。'} />
  return <div>
    <PageHeader eyebrow="阶段性观察" title="学习报告" description="通过执行、正确率、薄弱点变化判断学习是否真正改善。" actions={<Badge tone="success"><CalendarDays size={14} />自动同步</Badge>} />
    <div className="content-grid two-equal">
      <Card className="parent-report-trend"><SectionTitle title="近期小测趋势" description="完成小测后自动更新" /><div className="report-score"><strong>{dashboard.overview.latestQuizRate}%</strong><span><TrendingUp size={17} />最近一次正确率</span></div><MiniLineChart values={dashboard.trend.length ? dashboard.trend : [0]} height={150} /></Card>
      <Card><SectionTitle title="本阶段结论" /><div className="report-conclusions"><div><CheckCircle2 size={18} /><span>当前综合掌握度为 <strong>{dashboard.overview.mastery}%</strong></span></div><div><CheckCircle2 size={18} /><span>仍有 <strong>{dashboard.overview.weakPointCount}</strong> 个薄弱知识点</span></div><div><CheckCircle2 size={18} /><span>今日任务完成率为 <strong>{dashboard.today.completionRate}%</strong></span></div></div></Card>
    </div>
    <Card><SectionTitle title="最近小测记录" /><div className="quiz-report-list">{dashboard.recentQuizzes.length ? dashboard.recentQuizzes.map((quiz) => <div key={quiz.id}><div><strong>{quiz.title}</strong><small>{quiz.date}{quiz.weakPoints?.length ? `｜薄弱：${quiz.weakPoints.join('、')}` : ''}</small></div><Badge tone={quiz.correctRate >= 80 ? 'success' : quiz.correctRate >= 60 ? 'warning' : 'danger'}>{quiz.correctRate}%</Badge></div>) : <p className="muted-line">暂无已完成的小测。</p>}</div></Card>
    <Card><SectionTitle title="下一阶段行动清单" /><div className="recommendation-list report-actions">{dashboard.recommendations.map((item) => <div key={item.priority}><span>{item.priority}</span><div><strong>{item.title}</strong><p>{item.description}</p></div></div>)}</div></Card>
  </div>
}
