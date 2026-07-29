import { AlertTriangle, BrainCircuit, CalendarCheck2, CheckCircle2, Target } from 'lucide-react'
import { ActivityHeatmap, Donut, GroupedBarChart, MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, SectionTitle, StatCard } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

function formatSyncedAt(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp).toLocaleString('zh-CN')
    : '等待学生端首次同步'
}

export function ParentHomePage() {
  const { dashboard, loading, error, children } = useParentData()
  if (loading && !dashboard) return <LoadingState text="正在同步真实学习数据…" />
  if (error || !children.length) return <EmptyState title="暂时没有学习数据" description={error || '学生端完成一次学习并同步后，这里会自动更新。'} />
  if (!dashboard) return <EmptyState title="等待首次同步" description="当前没有可展示的学生学习快照。" />

  const { overview, today } = dashboard
  const hasQuizTrend = dashboard.trend.length > 0

  return <div>
    <PageHeader
      eyebrow={dashboard.student.grade}
      title={`${dashboard.student.displayName}的学习看板`}
      description="聚焦今日完成、学科表现和需要关注的薄弱点。"
      actions={<Badge tone="success">更新于 {formatSyncedAt(dashboard.student.lastSyncedAt)}</Badge>}
    />

    <div className="stats-grid three">
      <StatCard label="今日完成" value={`${today.completionRate}%`} hint={`${today.completed}/${today.total} 项 · ${today.completedMinutes}/${today.plannedMinutes} 分钟`} icon={<CalendarCheck2 size={19} />} />
      <StatCard label="综合掌握度" value={`${overview.mastery}%`} hint="基于当前真实知识点" icon={<BrainCircuit size={19} />} />
      <StatCard label="薄弱知识点" value={overview.weakPointCount} hint={overview.highRiskCount ? `${overview.highRiskCount} 个遗忘高风险` : '暂无遗忘高风险'} icon={<Target size={19} />} />
    </div>

    <div className="parent-chart-grid parent-chart-grid--hero">
      <Card>
        <SectionTitle title="各科掌握与正确率" description="掌握度、正确率与学习稳定度对比" />
        {dashboard.subjectRadar.length
          ? <GroupedBarChart items={dashboard.subjectRadar.map((item) => ({ label: item.label, primary: item.mastery, secondary: item.accuracy, tertiary: item.stability }))} />
          : <EmptyState title="暂无学科数据" description="完成知识点学习后将生成学科对比。" />}
      </Card>
      <Card>
        <SectionTitle title="今日学习进度" description={`计划 ${today.plannedMinutes} 分钟，已完成 ${today.completedMinutes} 分钟`} />
        <div className="parent-donut-row parent-donut-row--single">
          <Donut value={today.completionRate} label="完成率" sublabel={`${today.completed}/${today.total} 项`} />
        </div>
      </Card>
    </div>

    <div className="parent-chart-grid">
      <Card>
        <SectionTitle title="近 14 天学习热度" description="按每天真实完成率展示" />
        <ActivityHeatmap items={dashboard.dailyActivity} />
      </Card>
      <Card>
        <SectionTitle title="近期小测趋势" description={hasQuizTrend ? '最近已完成小测的正确率变化' : '完成小测后自动生成趋势'} />
        {hasQuizTrend
          ? <><div className="chart-score-head"><strong>{dashboard.trend.at(-1)}%</strong><span>最近一次</span></div><MiniLineChart values={dashboard.trend} height={120} /></>
          : <EmptyState title="暂无小测记录" description="这里不会使用示例或回退数据。" />}
      </Card>
    </div>

    <div className="content-grid two-equal">
      <Card>
        <SectionTitle title="需要关注" />
        <div className="parent-alert-list">
          {dashboard.alerts.length ? dashboard.alerts.map((alert) => <div key={alert.title} className={`parent-alert ${alert.level}`}><AlertTriangle size={18} /><div><strong>{alert.title}</strong><p>{alert.description}</p></div></div>) : <div className="all-good"><CheckCircle2 size={21} /><span>目前没有明显问题</span></div>}
        </div>
      </Card>
      <Card>
        <SectionTitle title="优先复习" />
        {dashboard.weakPoints.length
          ? <div className="weak-point-list">{dashboard.weakPoints.slice(0, 5).map((point, index) => <div key={point.id}><span className="rank-number">{index + 1}</span><div><strong>{point.subject} · {point.name}</strong><small>{point.chapter}｜{point.mainCause || '待确认'}</small></div><Badge tone={point.mastery < 45 ? 'danger' : 'warning'}>{point.mastery}%</Badge></div>)}</div>
          : <div className="all-good"><CheckCircle2 size={21} /><span>暂无需要优先复习的薄弱点</span></div>}
      </Card>
    </div>
  </div>
}
