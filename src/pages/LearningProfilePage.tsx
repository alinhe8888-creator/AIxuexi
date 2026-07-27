import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Database,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState, type ChangeEvent } from 'react'
import { BarList, MiniLineChart } from '../components/Charts'
import { Badge, Card, EmptyState, PageHeader, ProgressBar, SectionTitle, StatCard } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { Subject } from '../types'
import { formatDate } from '../utils/date'
import {
  clearProfileAssessment,
  loadProfileAssessment,
  saveProfileAssessment,
  type ProfileAssessmentResult,
} from '../utils/familyLearningWorkspace'
import { buildStudentProfile } from '../utils/profileEngine'

type AssessmentDimension = 'focus' | 'planning' | 'confidence' | 'persistence'
type AssessmentQuestion = { id: string; dimension: AssessmentDimension; text: string }

const assessmentQuestions: AssessmentQuestion[] = [
  { id: 'focus-1', dimension: 'focus', text: '学习 20 分钟时，我通常能保持注意力，不会频繁切换应用或做别的事。' },
  { id: 'focus-2', dimension: 'focus', text: '遇到图表、示意图或例子时，我比只看文字更容易理解。' },
  { id: 'planning-1', dimension: 'planning', text: '我开始学习前，通常知道今天先做什么、后做什么。' },
  { id: 'planning-2', dimension: 'planning', text: '没有人提醒时，我也能按计划完成大部分任务。' },
  { id: 'confidence-1', dimension: 'confidence', text: '遇到不会的题时，我愿意先独立尝试，再看提示或答案。' },
  { id: 'confidence-2', dimension: 'confidence', text: '做错题不会让我立刻放弃，我会想知道自己具体错在哪里。' },
  { id: 'persistence-1', dimension: 'persistence', text: '复习过的内容，我愿意隔几天再测一次，确认自己真的记住了。' },
  { id: 'persistence-2', dimension: 'persistence', text: '我更喜欢少量多次地学习，而不是临时一次学很久。' },
]

const optionLabels = ['完全不像我', '不太像我', '一般', '比较像我', '非常像我']

function buildAssessmentResult(answers: Record<string, number>): ProfileAssessmentResult {
  const score = (dimension: AssessmentDimension) => {
    const values = assessmentQuestions.filter((item) => item.dimension === dimension).map((item) => answers[item.id] || 3)
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 20)
  }
  const focusScore = score('focus')
  const planningScore = score('planning')
  const confidenceScore = score('confidence')
  const persistenceScore = score('persistence')
  const visualAnswer = answers['focus-2'] || 3
  const persistenceAnswer = answers['persistence-2'] || 3
  const learningPreference = visualAnswer >= 4
    ? '图像理解型'
    : confidenceScore >= 75
      ? '练习驱动型'
      : planningScore >= 75
        ? '文字归纳型'
        : '均衡型'
  const rhythm = persistenceAnswer >= 4 ? '短时高频' : focusScore >= 75 ? '稳定持续' : '集中突破'
  const tags = [
    focusScore >= 75 ? '专注稳定' : '需要短任务',
    planningScore >= 75 ? '计划清晰' : '需要明确顺序',
    confidenceScore >= 75 ? '敢于尝试' : '需要低门槛起步',
    persistenceScore >= 75 ? '复习意识好' : '需要复习提醒',
  ]
  const recommendations = [
    planningScore < 70 ? '每天只安排 3 个核心任务，并把计划固定放在首页最上方。' : '继续使用“预习—复习—训练”顺序，避免任务太多。',
    focusScore < 70 ? '每次学习控制在 15—25 分钟，完成后短暂休息。' : '可使用 25—40 分钟的标准学习单。',
    confidenceScore < 70 ? '先做基础题建立成功感，再逐步增加难度。' : '先独立作答，再查看提示与解析。',
    persistenceScore < 70 ? '错题复习后隔 1、3、7 天各做一次小测。' : '保持短时高频复习，用小测验证记忆。',
  ]
  return {
    completedAt: new Date().toISOString(),
    focusScore,
    planningScore,
    confidenceScore,
    persistenceScore,
    learningPreference,
    rhythm,
    tags,
    recommendations,
  }
}

export function LearningProfilePage() {
  const { state } = useAppStore()
  const profile = useMemo(() => buildStudentProfile(state), [state])
  const subjects = useMemo(() => profile.subjects.map((item) => item.subject), [profile.subjects])
  const [selectedSubject, setSelectedSubject] = useState<Subject | '全部'>('全部')
  const [assessment, setAssessment] = useState<ProfileAssessmentResult | null>(() => loadProfileAssessment())
  const [assessmentOpen, setAssessmentOpen] = useState(!assessment)
  const [assessmentStep, setAssessmentStep] = useState(0)
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({})
  const points = selectedSubject === '全部' ? profile.points : profile.points.filter((item) => item.subject === selectedSubject)
  const selectedStats = selectedSubject === '全部' ? null : profile.subjects.find((item) => item.subject === selectedSubject)
  const topWeak = points.find((point) => point.confidence >= 35) || points[0]
  const selectedTrend = points.length
    ? Array.from({ length: Math.max(0, ...points.map((item) => item.trend.length)) }, (_, index) => Math.round(points.reduce((sum, point) => sum + (point.trend[index] ?? point.trend.at(-1) ?? point.mastery), 0) / points.length))
    : []
  const metricMastery = selectedStats?.mastery ?? profile.averageMastery
  const metricAccuracy = selectedStats?.accuracy ?? profile.averageAccuracy
  const metricScore = selectedStats?.score ?? profile.overallScore
  const metricConfidence = selectedStats?.confidence ?? profile.confidence
  const currentQuestion = assessmentQuestions[assessmentStep]

  const answerAssessment = (value: number) => {
    if (!currentQuestion) return
    const nextAnswers = { ...assessmentAnswers, [currentQuestion.id]: value }
    setAssessmentAnswers(nextAnswers)
    if (assessmentStep < assessmentQuestions.length - 1) {
      setAssessmentStep((current) => current + 1)
      return
    }
    const result = buildAssessmentResult(nextAnswers)
    saveProfileAssessment(result)
    setAssessment(result)
    setAssessmentOpen(false)
    setAssessmentStep(0)
    setAssessmentAnswers({})
  }

  const restartAssessment = () => {
    clearProfileAssessment()
    setAssessment(null)
    setAssessmentOpen(true)
    setAssessmentStep(0)
    setAssessmentAnswers({})
  }

  return (
    <div className="family-page profile-v160">
      <PageHeader
        eyebrow="学习数据 + 画像小测"
        title="学生画像"
        description="一部分来自错题、试卷、复习和计划执行；另一部分通过简短小测了解学习节奏、专注和自我管理。"
        actions={<label className="header-select">查看科目<select value={selectedSubject} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedSubject(event.target.value as Subject | '全部')}><option>全部</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>}
      />

      <Card className="profile-assessment-card">
        <div className="profile-assessment-heading">
          <div className="profile-assessment-icon"><Sparkles size={23} /></div>
          <div><Badge tone="primary">画像小测</Badge><h2>{assessment ? '你的学习方式画像' : '用 8 道小题补全画像'}</h2><p>没有标准答案，只需要选择最像自己的情况。结果不会替代真实学习数据，只用于优化任务长度和学习顺序。</p></div>
          {assessment && <button className="family-secondary-button" onClick={restartAssessment}><RotateCcw size={16} /> 重新测试</button>}
        </div>

        {assessmentOpen && currentQuestion ? (
          <div className="profile-assessment-test">
            <div className="assessment-progress"><span style={{ width: `${((assessmentStep + 1) / assessmentQuestions.length) * 100}%` }} /><em>{assessmentStep + 1}/{assessmentQuestions.length}</em></div>
            <h3>{currentQuestion.text}</h3>
            <div className="assessment-options">{optionLabels.map((label, index) => <button key={label} onClick={() => answerAssessment(index + 1)}><strong>{index + 1}</strong><span>{label}</span></button>)}</div>
          </div>
        ) : assessment ? (
          <div className="profile-assessment-result">
            <div className="assessment-persona"><span>{assessment.learningPreference}</span><strong>{assessment.rhythm}</strong><p>{assessment.tags.join(' · ')}</p></div>
            <div className="assessment-score-grid">
              <div><span>专注</span><strong>{assessment.focusScore}</strong><ProgressBar value={assessment.focusScore} compact /></div>
              <div><span>计划</span><strong>{assessment.planningScore}</strong><ProgressBar value={assessment.planningScore} compact /></div>
              <div><span>信心</span><strong>{assessment.confidenceScore}</strong><ProgressBar value={assessment.confidenceScore} compact /></div>
              <div><span>坚持</span><strong>{assessment.persistenceScore}</strong><ProgressBar value={assessment.persistenceScore} compact /></div>
            </div>
            <div className="assessment-recommendations">{assessment.recommendations.map((item, index) => <div key={item}><i>{index + 1}</i><span>{item}</span></div>)}</div>
          </div>
        ) : null}
      </Card>

      <Card className="profile-method-card">
        <div className="profile-method-card__main"><div className="profile-method-card__icon"><Database size={22} /></div><div><strong>本次画像依据 {profile.totalEvidence} 条学习证据</strong><span>当前置信度 {metricConfidence}% · {metricConfidence >= 72 ? '结论较稳定' : metricConfidence >= 42 ? '可用于安排近期复习' : '仍需更多练习验证'}</span></div></div>
        <div className="profile-method-card__formula">知识状态 = 掌握度 34% + 正确率 25% + 趋势 13% + 遗忘风险 13% + 复习稳定性 8% + 时效 7%</div>
      </Card>

      <div className="stats-grid four">
        <StatCard label="综合学习状态" value={`${metricScore}%`} hint="知识状态 78% + 学习习惯 22%" icon={<BrainCircuit size={20} />} trend={{ value: selectedTrend.length > 1 ? (selectedTrend.at(-1) || 0) - (selectedTrend[0] || 0) : 0, label: '本阶段' }} />
        <StatCard label="平均掌握度" value={`${metricMastery}%`} hint="按证据量加权" icon={<Target size={20} />} />
        <StatCard label="平均正确率" value={`${metricAccuracy}%`} hint="来自练习、错题与试卷" icon={<CheckCircle2 size={20} />} />
        <StatCard label="到期复习" value={profile.dueReviewCount} hint="含高遗忘风险与已到期任务" icon={<AlertTriangle size={20} />} />
      </div>

      {topWeak && <Card className="priority-guidance"><div className="priority-icon"><Compass size={28} /></div><div><Badge tone={topWeak.confidence >= 42 ? 'danger' : 'warning'}>当前复习优先级</Badge><h2>{topWeak.subject} · {topWeak.name}</h2><p>综合状态 {topWeak.score}%，掌握度 {topWeak.mastery}%，正确率 {topWeak.accuracy}%。已有 {topWeak.evidenceCount} 条证据，置信度 {topWeak.confidence}%。{topWeak.confidence < 35 ? ' 当前证据仍少，应先用一次短测验证。' : ` 主要错因为“${topWeak.mainCause || '待进一步分析'}”，建议先回忆概念，再独立做 2 道同类题。`}</p></div><div className="priority-score"><strong>{topWeak.score}</strong><span>综合状态</span></div></Card>}

      <div className="content-grid main-side">
        <div className="stack">
          <Card><SectionTitle title="知识点掌握地图" description="同时查看证据量、置信度和遗忘风险" />{points.length ? <div className="profile-point-list evidence-profile-list">{points.map((point) => <div key={point.id}><div className="profile-point-head"><div><Badge tone="primary">{point.subject}</Badge><strong>{point.name}</strong><span>{point.chapter}</span></div><div className="profile-evidence-badges"><span className={`confidence-${point.confidenceLevel}`}>置信度 {point.confidence}%</span><Badge tone={point.forgettingRisk === '高' ? 'danger' : point.forgettingRisk === '中' ? 'warning' : 'success'}>{point.forgettingRisk}风险</Badge></div></div><ProgressBar value={point.score} label={`综合状态 · 掌握度 ${point.mastery}% · 正确率 ${point.accuracy}%`} /><div className="profile-point-meta"><span>证据 {point.evidenceCount} 条</span><span>错误 {point.errorCount} 次</span><span>主要错因：{point.mainCause || '暂无'}</span><span>最近复习：{formatDate(point.lastReviewedAt)}</span><span>趋势：{point.trendDelta >= 0 ? '+' : ''}{point.trendDelta}</span></div></div>)}</div> : <EmptyState title="暂无画像数据" description="完成一次题目讲解、小测或试卷分析后开始生成。" />}</Card>
          <Card><SectionTitle title="进步趋势" description="按当前筛选范围综合知识点历史趋势" />{selectedTrend.length ? <div className="profile-trend"><div><strong>{selectedTrend.at(-1) ?? 0}%</strong><span>最近一次综合掌握度</span></div><MiniLineChart values={selectedTrend} height={160} /></div> : <EmptyState title="趋势证据不足" description="完成至少两轮练习或复习后显示变化。" />}</Card>
          <Card><SectionTitle title="近 14 天学习习惯" description="画像不仅看分数，也看计划是否真正执行" /><div className="profile-habit-grid"><div><CalendarCheck2 size={20} /><strong>{profile.planCompletion14}%</strong><span>计划完成率</span></div><div><Activity size={20} /><strong>{profile.activeDays14}/14</strong><span>活跃天数</span></div><div><Clock3 size={20} /><strong>{profile.mistakeReviewRate}%</strong><span>错题复习率</span></div><div><TrendingUp size={20} /><strong>{profile.habitScore}%</strong><span>学习习惯状态</span></div></div></Card>
        </div>
        <div className="stack">
          <Card><SectionTitle title="各科表现" description="综合状态、证据量与到期复习一起看" />{profile.subjects.length ? <div className="subject-profile-list evidence-subject-list">{profile.subjects.map((item) => <button key={item.subject} onClick={() => setSelectedSubject(item.subject)}><div><strong>{item.subject}</strong><span>正确率 {item.accuracy}% · 证据 {item.evidenceCount} 条 · 到期 {item.dueCount}</span></div><div><ProgressBar value={item.score} compact /><em>{item.score}%</em></div></button>)}</div> : <EmptyState title="暂无科目数据" description="有学习记录后显示。" />}</Card>
          <Card><SectionTitle title="结果交叉验证" description="不同任务结果一致时，结论才更可靠" /><div className="profile-validation-list"><div><span>最近小测平均</span><strong>{profile.quizAverage === null ? '暂无' : `${profile.quizAverage}%`}</strong></div><div><span>最近试卷平均</span><strong>{profile.paperAverage === null ? '暂无' : `${profile.paperAverage}%`}</strong></div><div><span>知识状态</span><strong>{profile.academicScore}%</strong></div><div><span>整体画像置信度</span><strong>{profile.confidence}%</strong></div></div></Card>
          <Card><SectionTitle title="最常见错误原因" description="找出反复出错的过程" />{profile.causes.length ? <BarList items={profile.causes} /> : <EmptyState title="暂无错因数据" description="完成错题分析后显示。" />}</Card>
          <Card className="next-step-card"><Badge tone="primary">下一步行动</Badge><h3>先验证，再补弱，最后扩展新内容</h3><ol>{(assessment?.recommendations || profile.recommendations).slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ol></Card>
        </div>
      </div>
    </div>
  )
}
