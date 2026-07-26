import { AlertTriangle, BookOpenCheck, BrainCircuit, CalendarCheck2, CheckCircle2, Clock3, Target, TrendingUp } from 'lucide-react'
import { BarList, MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, ProgressBar, SectionTitle, StatCard } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentHomePage() {
  const { dashboard, loading, error, children } = useParentData()
  if (loading && !dashboard) return <LoadingState text="正在同步…" />
  if (!children.length) return <EmptyState title="还没有学习数据" description="完成一次连接后，这里会自动更新。" />
  if (error || !dashboard) return <EmptyState title="暂时没有新数据" description={error || '等待首次同步。'} />
  const { overview, today } = dashboard

  return (
    <div>
      <PageHeader eyebrow={dashboard.student.grade} title={`${dashboard.student.displayName}的学习情况`} description="最近的学习情况和需要关注的内容。" actions={<Badge tone="success">更新于 {new Date(dashboard.student.lastSyncedAt).toLocaleString('zh-CN')}</Badge>} />
      <div className="stats-grid four">
        <StatCard label="掌握度" value={`${overview.mastery}%`} hint="当前知识点平均" icon={<BrainCircuit size={19} />} />
        <StatCard label="今日完成" value={`${today.completionRate}%`} hint={`${today.completed}/${today.total} 项`} icon={<CalendarCheck2 size={19} />} />
        <StatCard label="薄弱点" value={overview.weakPointCount} hint="需要继续巩固" icon={<Target size={19} />} />
        <StatCard label="最近小测" value={`${overview.latestQuizRate}%`} hint="最近一次结果" icon={<BookOpenCheck size={19} />} />
      </div>
      <div className="parent-home-grid">
        <Card className="parent-today-card">
          <SectionTitle title="今天的安排" description={`计划 ${today.plannedMinutes} 分钟，已完成约 ${today.completedMinutes} 分钟`} />
          <ProgressBar value={today.completionRate} label="完成度" />
          <div className="parent-today-meta"><span><CheckCircle2 size={17} />完成 {today.completed} 项</span><span><Clock3 size={17} />剩余 {Math.max(today.plannedMinutes - today.completedMinutes, 0)} 分钟</span></div>
          <div className="parent-trend"><div><span>近期小测</span><strong>{dashboard.trend.at(-1) ?? 0}%</strong></div><MiniLineChart values={dashboard.trend.length ? dashboard.trend : [0]} height={96} /></div>
        </Card>
        <Card>
          <SectionTitle title="需要关注" />
          <div className="parent-alert-list">{dashboard.alerts.length ? dashboard.alerts.map((alert) => <div key={alert.title} className={`parent-alert ${alert.level}`}><AlertTriangle size={18} /><div><strong>{alert.title}</strong><p>{alert.description}</p></div></div>) : <div className="all-good"><CheckCircle2 size={21} /><span>目前没有明显问题</span></div>}</div>
        </Card>
      </div>
      <div className="content-grid two-equal">
        <Card><SectionTitle title="优先复习" /><div className="weak-point-list">{dashboard.weakPoints.slice(0, 6).map((point, index) => <div key={point.id}><span className="rank-number">{index + 1}</span><div><strong>{point.subject} · {point.name}</strong><small>{point.chapter}｜{point.mainCause || '待确认'}</small></div><Badge tone={point.mastery < 45 ? 'danger' : 'warning'}>{point.mastery}%</Badge></div>)}</div></Card>
        <Card><SectionTitle title="常见错因" /><BarList items={dashboard.causes.slice(0, 6)} /></Card>
      </div>
      <Card className="parent-activity-card"><SectionTitle title="最近记录" /><div className="parent-activity-list">{dashboard.activity.slice(0, 6).map((item) => <div key={item.id}><span className="activity-dot"><TrendingUp size={15} /></span><div><strong>{item.title}</strong><p>{item.description}</p></div><time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></div>)}</div></Card>
    </div>
  )
}
