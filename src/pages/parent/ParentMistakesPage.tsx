import { AlertTriangle, BookX } from 'lucide-react'
import { BarList } from '../../components/Charts'
import { Badge, Card, EmptyState, LoadingState, PageHeader, SectionTitle } from '../../components/ui'
import { useParentData } from '../../parent/useParentData'

export function ParentMistakesPage() {
  const { dashboard, loading, error } = useParentData()
  if (loading) return <LoadingState text="正在分析错题和错因…" />
  if (error || !dashboard) return <EmptyState title="暂无错题数据" description={error || '请先绑定学生。'} />
  return <div>
    <PageHeader eyebrow="只看规律，不替孩子做题" title="错题与错因" description="家长端展示错误类型和趋势，不显示 AI 完整答案入口。" actions={<Badge tone="info"><BookX size={14} />活跃错题 {dashboard.overview.activeMistakeCount}</Badge>} />
    <div className="content-grid two-equal">
      <Card><SectionTitle title="主要错误原因" description="按当前错题记录统计" /><BarList items={dashboard.causes} /></Card>
      <Card><SectionTitle title="家长需要关注什么" /><div className="parent-guidance"><div><AlertTriangle size={19} /><span><strong>知识性错误</strong><small>连续出现时，应减少新题数量，先回到概念和例题。</small></span></div><div><AlertTriangle size={19} /><span><strong>审题与粗心</strong><small>重点观察是否与时间压力、步骤习惯有关，不要简单归因于态度。</small></span></div><div><AlertTriangle size={19} /><span><strong>时间不足</strong><small>先拆分训练节奏，再逐步增加限时要求。</small></span></div></div></Card>
    </div>
    <Card>
      <SectionTitle title="最近错题记录" description="这里只展示知识点、错因和掌握情况" />
      <div className="mistake-parent-list">{dashboard.recentMistakes.map((item) => <div key={item.id}><div className="mistake-subject">{item.subject}</div><div><strong>{item.knowledgePointName}</strong><small>{item.chapter}｜{new Date(item.wrongAt).toLocaleDateString('zh-CN')}</small></div><Badge tone="warning">{item.primaryCause}</Badge><span>错误 {item.wrongCount} 次</span><span>掌握度 {item.mastery}%</span></div>)}</div>
    </Card>
  </div>
}
