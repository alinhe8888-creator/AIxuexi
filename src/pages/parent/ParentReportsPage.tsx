import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { ActivityHeatmap, BarList, DonutBreakdown, MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentReportsPage() {
  const { dashboard, loading, error } = useParentData()
  if (loading) return <LoadingState text="正在生成家长学习报告…" />
  if (error || !dashboard) return <EmptyState title="暂无报告" description={error || '请等待学生端同步。'} />
  return <div>
    <PageHeader eyebrow="阶段性观察" title="学习报告" description="从执行、正确率、错因和知识掌握变化判断学习是否真正改善。" actions={<Badge tone="success"><CalendarDays size={14} />自动同步</Badge>} />
    <div className="parent-chart-grid parent-chart-grid--hero">
      <Card className="parent-report-trend"><SectionTitle title="近期小测趋势" description="完成小测后自动更新" />{dashboard.trend.length ? <><div className="report-score"><strong>{dashboard.overview.latestQuizRate}%</strong><span>最近一次正确率</span></div><MiniLineChart values={dashboard.trend} height={160} /></> : <EmptyState title="暂无小测记录" description="完成真实小测后再生成趋势。" />}</Card>
      <Card><SectionTitle title="近 14 天计划执行" /><ActivityHeatmap items={dashboard.dailyActivity} /><div className="report-conclusions"><div><CheckCircle2 size={18} /><span>综合掌握度 <strong>{dashboard.overview.mastery}%</strong></span></div><div><CheckCircle2 size={18} /><span>今日完成率 <strong>{dashboard.today.completionRate}%</strong></span></div></div></Card>
    </div>
    <div className="parent-chart-grid">
      <Card><SectionTitle title="主要错因" /><BarList items={dashboard.causes.slice(0, 8)} /></Card>
      <Card><SectionTitle title="知识掌握结构" /><DonutBreakdown items={dashboard.masteryDistribution} centerLabel="知识点" /></Card>
      <Card><SectionTitle title="错题订正进度" /><DonutBreakdown items={dashboard.reviewStatus} centerLabel="闭环" /></Card>
      <Card><SectionTitle title="有效讲法成功率" description="只统计完成订正并经过迁移验证的讲解方式" />{(dashboard.strategyMethods || []).length ? <BarList items={(dashboard.strategyMethods || []).map((item) => ({ label: item.label, value: item.value, meta: `${item.value}% · ${item.usedCount} 次` }))} /> : <p className="muted-line">完成几次错题订正后显示。</p>}</Card>
    </div>
    <Card><SectionTitle title="最近小测记录" /><div className="quiz-report-list">{dashboard.recentQuizzes.length ? dashboard.recentQuizzes.map((quiz) => <div key={quiz.id}><div><strong>{quiz.title}</strong><small>{quiz.date}{quiz.weakPoints?.length ? `｜薄弱：${quiz.weakPoints.join('、')}` : ''}</small></div><Badge tone={quiz.correctRate >= 80 ? 'success' : quiz.correctRate >= 60 ? 'warning' : 'danger'}>{quiz.correctRate}%</Badge></div>) : <p className="muted-line">暂无已完成的小测。</p>}</div></Card>
    <Card><SectionTitle title="下一阶段行动清单" />{dashboard.recommendations.length ? <div className="recommendation-list report-actions">{dashboard.recommendations.map((item) => <div key={item.priority}><span>{item.priority}</span><div><strong>{item.title}</strong><p>{item.description}</p></div></div>)}</div> : <EmptyState title="暂无行动建议" description="积累真实知识点和错题后生成。" />}</Card>
  </div>
}
