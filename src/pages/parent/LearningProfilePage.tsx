import { AlertTriangle, BrainCircuit, ChevronDown, Compass, Target, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BarList, MiniLineChart } from '../components/Charts'
import { Badge, Card, EmptyState, PageHeader, ProgressBar, SectionTitle, StatCard } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { Subject } from '../types'
import { formatDate } from '../utils/date'

export function LearningProfilePage() {
  const { state } = useAppStore()
  const subjects = useMemo(() => [...new Set(state.knowledgePoints.map((item) => item.subject))], [state.knowledgePoints])
  const [selectedSubject, setSelectedSubject] = useState<Subject | '全部'>('全部')
  const points = selectedSubject === '全部' ? state.knowledgePoints : state.knowledgePoints.filter((item) => item.subject === selectedSubject)
  const averageMastery = Math.round(points.reduce((sum, item) => sum + item.mastery, 0) / Math.max(1, points.length))
  const averageAccuracy = Math.round(points.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(1, points.length))
  const errors = points.reduce((sum, item) => sum + item.errorCount, 0)
  const weak = [...points].sort((a, b) => a.mastery - b.mastery)
  const topWeak = weak[0]

  const subjectStats = useMemo(() => subjects.map((subject) => {
    const items = state.knowledgePoints.filter((item) => item.subject === subject)
    return {
      subject,
      mastery: Math.round(items.reduce((sum, item) => sum + item.mastery, 0) / Math.max(1, items.length)),
      accuracy: Math.round(items.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(1, items.length)),
      errors: items.reduce((sum, item) => sum + item.errorCount, 0),
    }
  }).sort((a, b) => a.mastery - b.mastery), [state.knowledgePoints, subjects])

  const causeStats = [...new Set(points.map((item) => item.mainCause).filter(Boolean))].map((cause) => ({ label: cause || '待分析', value: points.filter((item) => item.mainCause === cause).reduce((sum, item) => sum + item.errorCount, 0) })).sort((a, b) => b.value - a.value)
  const trend = points.length ? Array.from({ length: Math.max(...points.map((item) => item.trend.length)) }, (_, index) => Math.round(points.reduce((sum, point) => sum + (point.trend[index] ?? point.trend.at(-1) ?? 0), 0) / points.length)) : []

  return (
    <div>
      <PageHeader eyebrow="持续更新的学习模型" title="学习画像" description="画像不是一次测评结果，而是根据错题、复习、卡片和小测持续更新的动态学习模型。" actions={<label className="header-select">查看科目<select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value as Subject | '全部')}><option>全部</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>} />

      <div className="stats-grid four">
        <StatCard label="平均掌握度" value={`${averageMastery}%`} hint="所有已建档知识点" icon={<BrainCircuit size={20} />} trend={{ value: trend.length > 1 ? trend.at(-1)! - trend[0] : 0, label: '本阶段' }} />
        <StatCard label="平均正确率" value={`${averageAccuracy}%`} hint="按历史练习动态计算" icon={<Target size={20} />} />
        <StatCard label="累计错误" value={errors} hint="重复错误会提高优先级" icon={<AlertTriangle size={20} />} />
        <StatCard label="高遗忘风险" value={points.filter((item) => item.forgettingRisk === '高').length} hint="建议今天优先复习" icon={<TrendingUp size={20} />} />
      </div>

      {topWeak && <Card className="priority-guidance"><div className="priority-icon"><Compass size={28} /></div><div><Badge tone="danger">当前最高优先级</Badge><h2>{topWeak.subject} · {topWeak.name}</h2><p>掌握度 {topWeak.mastery}%，历史错误 {topWeak.errorCount} 次，主要错因为“{topWeak.mainCause || '待进一步分析'}”。下一步先复习概念，再完成 2 道同类题。</p></div><div className="priority-score"><strong>{topWeak.mastery}</strong><span>掌握度</span></div></Card>}

      <div className="content-grid main-side">
        <div className="stack">
          <Card>
            <SectionTitle title="知识点掌握地图" description="可以直接看到每个知识点当前状态和遗忘风险" />
            {weak.length ? <div className="profile-point-list">{weak.map((point) => <div key={point.id}><div className="profile-point-head"><div><Badge tone="primary">{point.subject}</Badge><strong>{point.name}</strong><span>{point.chapter}</span></div><Badge tone={point.forgettingRisk === '高' ? 'danger' : point.forgettingRisk === '中' ? 'warning' : 'success'}>{point.forgettingRisk}风险</Badge></div><ProgressBar value={point.mastery} label={`掌握度 · 正确率 ${point.accuracy}%`} /><div className="profile-point-meta"><span>错误 {point.errorCount} 次</span><span>主要错因：{point.mainCause || '暂无'}</span><span>最近复习：{formatDate(point.lastReviewedAt)}</span><span>趋势：{point.trend.at(-1)! - point.trend[0] >= 0 ? '+' : ''}{point.trend.at(-1)! - point.trend[0]}</span></div></div>)}</div> : <EmptyState title="暂无画像数据" description="完成题目讲解或小测后开始生成。" />}
          </Card>

          <Card>
            <SectionTitle title="进步趋势" description="综合当前筛选范围内的掌握度变化" />
            <div className="profile-trend"><div><strong>{trend.at(-1) ?? 0}%</strong><span>最近一次综合掌握度</span></div><MiniLineChart values={trend} height={160} /></div>
          </Card>
        </div>

        <div className="stack">
          <Card><SectionTitle title="各科表现" description="按平均掌握度从低到高" /><div className="subject-profile-list">{subjectStats.map((item) => <button key={item.subject} onClick={() => setSelectedSubject(item.subject)}><div><strong>{item.subject}</strong><span>正确率 {item.accuracy}% · 错误 {item.errors} 次</span></div><div><ProgressBar value={item.mastery} compact /><em>{item.mastery}%</em></div></button>)}</div></Card>
          <Card><SectionTitle title="最常见错误原因" description="错误原因比单个题目更值得长期关注" />{causeStats.length ? <BarList items={causeStats} /> : <EmptyState title="暂无错因数据" description="完成错题分析后显示。" />}</Card>
          <Card className="next-step-card"><Badge tone="primary">AI 下一步建议</Badge><h3>先解决重复错误，再扩充新内容</h3><ol><li>今天完成 {topWeak?.name || '最薄弱知识点'} 的错题复习</li><li>使用“只看提示”方式重新独立作答</li><li>完成每日小测，验证是否真正掌握</li></ol></Card>
        </div>
      </div>
    </div>
  )
}
