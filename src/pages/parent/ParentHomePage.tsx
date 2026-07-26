import { AlertTriangle, BookOpenCheck, BrainCircuit, CalendarCheck2, CheckCircle2, Clock3, Target, TrendingUp } from 'lucide-react'
import { BarList, MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, ProgressBar, SectionTitle, StatCard } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentHomePage() {
  const { dashboard, loading, error, children } = useParentData()
  if (loading) return <LoadingState text="正在读取孩子的最新学习数据…" />
  if (!children.length) return <EmptyState title="还没有绑定学生" description="请到“绑定与设置”输入学生端生成的 6 位绑定码。" />
  if (error || !dashboard) return <EmptyState title="暂时无法读取学习数据" description={error || '学生尚未完成首次同步。'} />
  const { overview, today } = dashboard
  return (
    <div>
      <PageHeader eyebrow={`${dashboard.student.displayName} · ${dashboard.student.grade}`} title="孩子今天学得怎么样？" description="这里仅展示学习进展、风险和建议，不向学生端暴露家长页面。" actions={<Badge tone="success">最近同步 {new Date(dashboard.student.lastSyncedAt).toLocaleString('zh-CN')}</Badge>} />
      <div className="stats-grid four">
        <StatCard label="综合掌握度" value={`${overview.mastery}%`} hint="按当前知识点平均计算" icon={<BrainCircuit size={19} />} />
        <StatCard label="今日完成率" value={`${today.completionRate}%`} hint={`${today.completed}/${today.total} 项任务`} icon={<CalendarCheck2 size={19} />} />
        <StatCard label="薄弱知识点" value={overview.weakPointCount} hint="掌握度低于 60%" icon={<Target size={19} />} />
        <StatCard label="最近小测" value={`${overview.latestQuizRate}%`} hint="最近一次已完成小测" icon={<BookOpenCheck size={19} />} />
      </div>

      <div className="parent-home-grid">
        <Card className="parent-today-card">
          <SectionTitle title="今日学习执行" description={`计划 ${today.plannedMinutes} 分钟，已完成约 ${today.completedMinutes} 分钟`} />
          <ProgressBar value={today.completionRate} label="计划完成度" />
          <div className="parent-today-meta"><span><CheckCircle2 size={17} />已完成 {today.completed} 项</span><span><Clock3 size={17} />剩余 {Math.max(today.plannedMinutes - today.completedMinutes, 0)} 分钟</span></div>
          <div className="parent-trend"><div><span>近期小测趋势</span><strong>{dashboard.trend.at(-1) ?? 0}%</strong></div><MiniLineChart values={dashboard.trend.length ? dashboard.trend : [0]} height={96} /></div>
        </Card>

        <Card>
          <SectionTitle title="当前风险提醒" description="只显示需要家长关注的重点，不制造焦虑" />
          <div className="parent-alert-list">{dashboard.alerts.length ? dashboard.alerts.map((alert) => <div key={alert.title} className={`parent-alert ${alert.level}`}><AlertTriangle size={18} /><div><strong>{alert.title}</strong><p>{alert.description}</p></div></div>) : <div className="all-good"><CheckCircle2 size={21} /><span>目前没有高风险知识点</span></div>}</div>
        </Card>
      </div>

      <div className="content-grid two-equal">
        <Card>
          <SectionTitle title="最需要优先补的知识点" />
          <div className="weak-point-list">{dashboard.weakPoints.slice(0, 6).map((point, index) => <div key={point.id}><span className="rank-number">{index + 1}</span><div><strong>{point.subject} · {point.name}</strong><small>{point.chapter}｜{point.mainCause || '错因待确认'}</small></div><Badge tone={point.mastery < 45 ? 'danger' : 'warning'}>{point.mastery}%</Badge></div>)}</div>
        </Card>
        <Card>
          <SectionTitle title="常见错误原因" />
          <BarList items={dashboard.causes.slice(0, 6)} />
        </Card>
      </div>

      <Card className="parent-activity-card">
        <SectionTitle title="最近学习动态" />
        <div className="parent-activity-list">{dashboard.activity.slice(0, 6).map((item) => <div key={item.id}><span className="activity-dot"><TrendingUp size={15} /></span><div><strong>{item.title}</strong><p>{item.description}</p></div><time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></div>)}</div>
      </Card>
    </div>
  )
}
