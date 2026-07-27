import { AlertTriangle, BookOpenCheck, BrainCircuit, CalendarCheck2, CheckCircle2, Target } from 'lucide-react'
import { ActivityHeatmap, Donut, DonutBreakdown, GroupedBarChart, MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, SectionTitle, StatCard } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentHomePage() {
  const { dashboard, loading, error, children } = useParentData()
  if (loading && !dashboard) return <LoadingState text="正在同步…" />
  if (!children.length) return <EmptyState title="还没有学习数据" description="学生端完成一次学习后，这里会自动更新。" />
  if (error || !dashboard) return <EmptyState title="暂时没有新数据" description={error || '等待首次同步。'} />
  const { overview, today } = dashboard
  return <div>
    <PageHeader eyebrow={dashboard.student.grade} title={`${dashboard.student.displayName}的学习看板`} description="用图表快速看清今天做了什么、哪一科更薄弱、下一步该关注什么。" actions={<Badge tone="success">更新于 {new Date(dashboard.student.lastSyncedAt).toLocaleString('zh-CN')}</Badge>} />
    <div className="stats-grid four">
      <StatCard label="综合掌握度" value={`${overview.mastery}%`} hint="当前知识点平均" icon={<BrainCircuit size={19} />} />
      <StatCard label="今日完成" value={`${today.completionRate}%`} hint={`${today.completed}/${today.total} 项`} icon={<CalendarCheck2 size={19} />} />
      <StatCard label="薄弱知识点" value={overview.weakPointCount} hint="需要继续巩固" icon={<Target size={19} />} />
      <StatCard label="最近小测" value={`${overview.latestQuizRate}%`} hint="最近一次正确率" icon={<BookOpenCheck size={19} />} />
    </div>

    <div className="parent-chart-grid parent-chart-grid--hero">
      <Card><SectionTitle title="各科掌握与正确率" description="紫色为掌握度，绿色为正确率，橙色为稳定度" /><GroupedBarChart items={dashboard.subjectRadar.map((item) => ({ label: item.label, primary: item.mastery, secondary: item.accuracy, tertiary: item.stability }))} /></Card>
      <Card><SectionTitle title="今日计划" description={`计划 ${today.plannedMinutes} 分钟，已完成约 ${today.completedMinutes} 分钟`} /><div className="parent-donut-row"><Donut value={today.completionRate} label="完成率" sublabel={`${today.completed}/${today.total} 项`} /><Donut value={today.plannedMinutes ? Math.round(today.completedMinutes / today.plannedMinutes * 100) : 0} label="时间" sublabel={`${today.completedMinutes}/${today.plannedMinutes} 分钟`} /></div></Card>
    </div>

    <div className="parent-chart-grid">
      <Card><SectionTitle title="近 14 天学习热度" description="颜色越深代表完成率越高" /><ActivityHeatmap items={dashboard.dailyActivity} /></Card>
      <Card><SectionTitle title="学习内容结构" description="预习、复习、训练是否均衡" /><DonutBreakdown items={dashboard.learningMix} centerLabel="任务" /></Card>
      <Card><SectionTitle title="知识掌握分布" /><DonutBreakdown items={dashboard.masteryDistribution} centerLabel="知识点" /></Card>
      <Card><SectionTitle title="近期小测趋势" /><div className="chart-score-head"><strong>{dashboard.trend.at(-1) ?? 0}%</strong><span>最近一次</span></div><MiniLineChart values={dashboard.trend.length ? dashboard.trend : [0]} height={120} /></Card>
    </div>

    <div className="content-grid two-equal">
      <Card><SectionTitle title="需要关注" /><div className="parent-alert-list">{dashboard.alerts.length ? dashboard.alerts.map((alert) => <div key={alert.title} className={`parent-alert ${alert.level}`}><AlertTriangle size={18} /><div><strong>{alert.title}</strong><p>{alert.description}</p></div></div>) : <div className="all-good"><CheckCircle2 size={21} /><span>目前没有明显问题</span></div>}</div></Card>
      <Card><SectionTitle title="优先复习" /><div className="weak-point-list">{dashboard.weakPoints.slice(0, 6).map((point, index) => <div key={point.id}><span className="rank-number">{index + 1}</span><div><strong>{point.subject} · {point.name}</strong><small>{point.chapter}｜{point.mainCause || '待确认'}</small></div><Badge tone={point.mastery < 45 ? 'danger' : 'warning'}>{point.mastery}%</Badge></div>)}</div></Card>
    </div>
  </div>
}
