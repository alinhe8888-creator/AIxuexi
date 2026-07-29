import { AlertCircle } from 'lucide-react'
import { DonutBreakdown, GroupedBarChart, RadarChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentProgressPage() {
  const { dashboard, loading, error } = useParentData()
  if (loading) return <LoadingState text="正在汇总各科进度…" />
  if (error || !dashboard) return <EmptyState title="暂无学习进度" description={error || '请等待学生端同步。'} />
  const radar = dashboard.subjectRadar.map((item) => ({ label: item.label, value: Math.round((item.mastery + item.accuracy + item.stability) / 3) }))
  return <div>
    <PageHeader eyebrow="学科、章节与知识点" title="学习进度" description="掌握度、正确率、稳定度和遗忘风险全部用图表展示。" />
    <div className="parent-chart-grid parent-chart-grid--hero">
      <Card><SectionTitle title="学科能力雷达" description="综合掌握、正确率和复习稳定度" />{radar.length >= 3 ? <RadarChart items={radar} /> : <EmptyState title="学科数据不足" description="至少积累 3 个学科的真实学习数据后生成雷达图。" />}</Card>
      <Card><SectionTitle title="各科详细对比" /><GroupedBarChart items={dashboard.subjectRadar.map((item) => ({ label: item.label, primary: item.mastery, secondary: item.accuracy, tertiary: item.stability }))} /></Card>
    </div>
    <div className="parent-chart-grid">
      <Card><SectionTitle title="掌握层级分布" /><DonutBreakdown items={dashboard.masteryDistribution} centerLabel="知识点" /></Card>
      <Card><SectionTitle title="错题订正闭环" /><DonutBreakdown items={dashboard.reviewStatus} centerLabel="订正" />{dashboard.overview.highRiskCount > 0 && <div className="risk-note"><AlertCircle size={18} /><span>{dashboard.overview.highRiskCount} 个知识点处于高遗忘风险。</span></div>}</Card>
    </div>
    <Card><SectionTitle title="薄弱知识点明细" description="按掌握度从低到高排列" />{dashboard.weakPoints.length ? <div className="parent-knowledge-table"><div className="table-head"><span>知识点</span><span>掌握度</span><span>正确率</span><span>错误次数</span><span>风险</span></div>{dashboard.weakPoints.map((point) => <div className="table-row" key={point.id}><div><strong>{point.subject} · {point.name}</strong><small>{point.chapter}</small></div><span>{point.mastery}%</span><span>{point.accuracy}%</span><span>{point.errorCount}</span><Badge tone={point.forgettingRisk === '高' ? 'danger' : 'warning'}>{point.forgettingRisk || '中'}</Badge></div>)}</div> : <EmptyState title="暂无薄弱知识点" description="这里不会生成示例记录。" />}</Card>
  </div>
}
