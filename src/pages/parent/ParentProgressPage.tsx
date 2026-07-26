import { AlertCircle, TrendingUp } from 'lucide-react'
import { MiniLineChart } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, ProgressBar, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentProgressPage() {
  const { dashboard, loading, error } = useParentData()
  if (loading) return <LoadingState text="正在汇总各科进度…" />
  if (error || !dashboard) return <EmptyState title="暂无学习进度" description={error || '请先绑定学生并等待数据同步。'} />
  return <div>
    <PageHeader eyebrow="学科、章节与知识点" title="学习进度" description="按科目查看掌握度、正确率、薄弱数量和遗忘风险。" />
    <div className="parent-subject-grid">{dashboard.subjects.map((item) => <Card key={item.subject} className="parent-subject-card"><div className="subject-card-head"><span>{item.subject}</span><Badge tone={item.mastery < 60 ? 'warning' : 'success'}>{item.mastery}%</Badge></div><ProgressBar value={item.mastery} label="掌握度" compact /><div className="subject-card-stats"><span>正确率 <strong>{item.accuracy}%</strong></span><span>薄弱 <strong>{item.weakCount}</strong></span><span>高风险 <strong>{item.riskCount}</strong></span></div></Card>)}</div>
    <div className="content-grid main-side">
      <Card>
        <SectionTitle title="知识点明细" description="优先显示当前薄弱和高风险内容" />
        <div className="parent-knowledge-table"><div className="table-head"><span>知识点</span><span>掌握度</span><span>正确率</span><span>错误次数</span><span>风险</span></div>{dashboard.weakPoints.map((point) => <div className="table-row" key={point.id}><div><strong>{point.subject} · {point.name}</strong><small>{point.chapter}</small></div><span>{point.mastery}%</span><span>{point.accuracy}%</span><span>{point.errorCount}</span><Badge tone={point.forgettingRisk === '高' ? 'danger' : 'warning'}>{point.forgettingRisk || '中'}</Badge></div>)}</div>
      </Card>
      <Card>
        <SectionTitle title="下一步重点" />
        <div className="recommendation-list">{dashboard.recommendations.map((item) => <div key={item.priority}><span>{item.priority}</span><div><strong>{item.title}</strong><p>{item.description}</p></div></div>)}</div>
        <div className="progress-trend-card"><div><TrendingUp size={18} /><strong>小测正确率趋势</strong></div><MiniLineChart values={dashboard.trend.length ? dashboard.trend : [0]} height={120} /></div>
        {dashboard.overview.highRiskCount > 0 && <div className="risk-note"><AlertCircle size={18} /><span>有 {dashboard.overview.highRiskCount} 个知识点处于高遗忘风险，建议优先完成系统安排的复习任务。</span></div>}
      </Card>
    </div>
  </div>
}
