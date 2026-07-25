import { BarChart3, BookOpen, CheckCircle2, Target } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParentData } from '../../parent/useParentData'
import { parentApi } from '../../services/parentApi'
import type { StudentAnalytics } from '../../services/analyticsApi'

export function ParentReportsPage() {
  const { selectedChildId } = useParentData()
  const [data, setData] = useState<StudentAnalytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    if (!selectedChildId) return
    parentApi.getAnalytics(selectedChildId).then(setData).catch((err: unknown) => setError(err instanceof Error ? err.message : '分析加载失败'))
  }, [selectedChildId])

  if (!selectedChildId) return <div className="family-page"><div className="family-panel">先在设置里绑定孩子。</div></div>
  if (error) return <div className="family-page"><div className="family-panel family-error">{error}</div></div>
  if (!data) return <div className="family-page"><div className="family-panel">正在分析…</div></div>

  return (
    <div className="family-page analytics-page">
      <section className="analytics-summary-grid">
        <div className="family-panel"><Target size={22} /><strong>{data.overview.latestAccuracy}%</strong><span>最近正确率</span></div>
        <div className="family-panel"><BookOpen size={22} /><strong>{data.overview.activeMistakes}</strong><span>未解决错题</span></div>
        <div className="family-panel"><CheckCircle2 size={22} /><strong>{data.overview.completedTasks}/{data.overview.totalTasks}</strong><span>今日任务</span></div>
        <div className="family-panel"><BarChart3 size={22} /><strong>{data.overview.materialCount}</strong><span>学习资料</span></div>
      </section>
      <section className="family-panel"><div className="family-panel__title"><strong>薄弱科目</strong></div><div className="analytics-bars">{data.weakSubjects.map((item) => <div key={item.subject}><span>{item.subject}</span><div><i style={{ width: `${Math.max(4, item.mastery)}%` }} /></div><b>{item.mastery}%</b></div>)}</div></section>
      <section className="family-panel"><div className="family-panel__title"><strong>接下来怎么做</strong></div><ol className="analytics-recommendations">{data.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></section>
    </div>
  )
}
