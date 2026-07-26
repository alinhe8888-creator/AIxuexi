import {
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  ChevronDown,
  LoaderCircle,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BarList, MiniLineChart } from '../components/Charts'
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  StatCard,
} from '../components/ui'
import { analysisApi, type StudentAiAnalysis } from '../services/analysisApi'
import { useAppStore } from '../store/useAppStore'
import type { Subject } from '../types'
import { formatDate } from '../utils/date'

export function LearningProfilePage() {
  const { state } = useAppStore()
  const subjects = useMemo(
    () => [...new Set(state.knowledgePoints.map((item) => item.subject))],
    [state.knowledgePoints],
  )
  const [selectedSubject, setSelectedSubject] = useState<Subject | '全部'>('全部')
  const [analysis, setAnalysis] = useState<StudentAiAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  useEffect(() => {
    void analysisApi.getLatest().then(setAnalysis).catch(() => undefined)
  }, [])

  const points = selectedSubject === '全部'
    ? state.knowledgePoints
    : state.knowledgePoints.filter((item) => item.subject === selectedSubject)
  const averageMastery = Math.round(
    points.reduce((sum, item) => sum + item.mastery, 0) / Math.max(1, points.length),
  )
  const averageAccuracy = Math.round(
    points.reduce((sum, item) => sum + item.accuracy, 0) / Math.max(1, points.length),
  )
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
  const causeStats = [...new Set(points.map((item) => item.mainCause).filter(Boolean))]
    .map((cause) => ({
      label: cause || '待分析',
      value: points
        .filter((item) => item.mainCause === cause)
        .reduce((sum, item) => sum + item.errorCount, 0),
    }))
    .sort((a, b) => b.value - a.value)
  const trend = points.length
    ? Array.from(
      { length: Math.max(...points.map((item) => item.trend.length)) },
      (_, index) => Math.round(
        points.reduce(
          (sum, point) => sum + (point.trend[index] ?? point.trend.at(-1) ?? 0),
          0,
        ) / points.length,
      ),
    )
    : []

  const generateAnalysis = async () => {
    setAnalysisLoading(true)
    setAnalysisError('')
    try {
      setAnalysis(await analysisApi.generate())
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : '分析失败')
    } finally {
      setAnalysisLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="学习数据"
        title="分析"
        description="根据错题、试卷、训练、教材知识库和复习记录持续更新。"
        actions={
          <div className="header-actions">
            <label className="header-select">
              科目
              <select
                value={selectedSubject}
                onChange={(event) => setSelectedSubject(event.target.value as Subject | '全部')}
              >
                <option>全部</option>
                {subjects.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <Button onClick={() => void generateAnalysis()} disabled={analysisLoading}>
              {analysisLoading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
              {analysis ? '重新分析' : '生成 AI 分析'}
            </Button>
          </div>
        }
      />

      {analysisError && <Callout tone="danger" title="AI 分析失败">{analysisError}</Callout>}

      {analysis && (
        <Card className="ai-analysis-card">
          <SectionTitle
            title="AI 学习总结"
            description={`更新于 ${new Date(analysis.generatedAt).toLocaleString('zh-CN')}`}
            action={<Badge tone="primary">{analysis.provider === 'deepseek' ? 'DeepSeek' : 'Qwen'}</Badge>}
          />
          <div className="ai-analysis-summary">
            <div><strong>当前情况</strong><p>{analysis.summary}</p></div>
            <div><strong>当前重点</strong><p>{analysis.currentFocus}</p></div>
            <div><strong>给家人的说明</strong><p>{analysis.parentNote}</p></div>
          </div>
          <div className="content-grid main-side">
            <div>
              <h3>优先解决</h3>
              <div className="analysis-weak-list">
                {analysis.weaknesses.map((item) => (
                  <div key={`${item.subject}-${item.chapter}-${item.knowledgePoint}`}>
                    <Badge tone={item.priority === '高' ? 'danger' : item.priority === '中' ? 'warning' : 'info'}>
                      {item.priority}优先级
                    </Badge>
                    <strong>{item.subject} · {item.knowledgePoint}</strong>
                    <span>{item.chapter}</span>
                    <p>{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>今天安排</h3>
              <div className="analysis-task-list">
                {analysis.todayTasks.map((item) => (
                  <div key={item.title}>
                    <CalendarDays size={18} />
                    <div><strong>{item.title}</strong><span>{item.reason}</span></div>
                    <em>{item.minutes} 分钟</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="seven-day-plan">
            <h3>未来 7 天</h3>
            <div>
              {analysis.sevenDayPlan.map((item) => (
                <article key={item.day}>
                  <strong>{item.day}</strong>
                  <span>{item.focus}</span>
                  <ul>{item.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
                </article>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="stats-grid four">
        <StatCard label="平均掌握度" value={`${averageMastery}%`} hint="已建档知识点" icon={<BrainCircuit size={20} />} trend={{ value: trend.length > 1 ? trend.at(-1)! - trend[0] : 0, label: '本阶段' }} />
        <StatCard label="平均正确率" value={`${averageAccuracy}%`} hint="按真实练习计算" icon={<Target size={20} />} />
        <StatCard label="累计错误" value={errors} hint="重复错误会提高优先级" icon={<AlertTriangle size={20} />} />
        <StatCard label="高遗忘风险" value={points.filter((item) => item.forgettingRisk === '高').length} hint="建议今天优先复习" icon={<TrendingUp size={20} />} />
      </div>

      {topWeak && (
        <Card className="priority-guidance">
          <div><Badge tone="danger">当前优先级最高</Badge><h2>{topWeak.subject} · {topWeak.name}</h2><p>掌握度 {topWeak.mastery}%，历史错误 {topWeak.errorCount} 次，主要错因为“{topWeak.mainCause || '待进一步分析'}”。</p></div>
          <div className="priority-score"><strong>{topWeak.mastery}</strong><span>掌握度</span></div>
        </Card>
      )}

      <div className="content-grid main-side">
        <div className="stack">
          <Card>
            <SectionTitle title="知识点掌握情况" />
            {weak.length ? (
              <div className="profile-point-list">
                {weak.map((point) => (
                  <div key={point.id}>
                    <div className="profile-point-head"><div><Badge tone="primary">{point.subject}</Badge><strong>{point.name}</strong><span>{point.chapter}</span></div><Badge tone={point.forgettingRisk === '高' ? 'danger' : point.forgettingRisk === '中' ? 'warning' : 'success'}>{point.forgettingRisk}风险</Badge></div>
                    <ProgressBar value={point.mastery} label={`掌握度 · 正确率 ${point.accuracy}%`} />
                    <div className="profile-point-meta"><span>错误 {point.errorCount} 次</span><span>主要错因：{point.mainCause || '暂无'}</span><span>最近复习：{formatDate(point.lastReviewedAt)}</span></div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="暂无学习数据" description="完成拍题、试卷分析或训练后开始生成。" />}
          </Card>
          <Card><SectionTitle title="掌握度趋势" /><div className="profile-trend"><div><strong>{trend.at(-1) ?? 0}%</strong><span>最近综合掌握度</span></div><MiniLineChart values={trend} height={160} /></div></Card>
        </div>
        <div className="stack">
          <Card><SectionTitle title="各科表现" />{subjectStats.length ? <div className="subject-profile-list">{subjectStats.map((item) => <button key={item.subject} onClick={() => setSelectedSubject(item.subject)}><div><strong>{item.subject}</strong><span>正确率 {item.accuracy}% · 错误 {item.errors} 次</span></div><div><ProgressBar value={item.mastery} compact /><em>{item.mastery}%</em></div></button>)}</div> : <EmptyState title="暂无科目数据" description="完成拍题、试卷分析或训练后开始生成科目表现。" />}</Card>
          <Card><SectionTitle title="常见错因" />{causeStats.length ? <BarList items={causeStats} /> : <EmptyState title="暂无错因数据" description="产生错题并完成分析后，这里会汇总常见错因。" />}</Card>
        </div>
      </div>
    </div>
  )
}
