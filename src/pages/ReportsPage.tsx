import { BarChart3, Download, FileText, Flame, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { BarList, Donut, MiniLineChart } from '../components/Charts'
import { Badge, Button, Card, PageHeader, SectionTitle, StatCard } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import { startOfWeek } from '../utils/date'

export function ReportsPage() {
  const { state, notify } = useAppStore()
  const weekStart = startOfWeek()
  const weeklyLogs = state.activityLogs.filter((log) => new Date(log.createdAt) >= weekStart)
  const completedTasks = state.dailyPlans.flatMap((plan) => plan.tasks).filter((task) => task.status === 'completed').length
  const allTasks = state.dailyPlans.flatMap((plan) => plan.tasks).length
  const latestQuiz = state.quizzes.filter((item) => item.status === 'completed').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0]
  const averageMastery = Math.round(state.knowledgePoints.reduce((sum, item) => sum + item.mastery, 0) / Math.max(1, state.knowledgePoints.length))
  const masteryTrend = useMemo(() => {
    const points = state.knowledgePoints
    const length = Math.max(...points.map((item) => item.trend.length), 1)
    return Array.from({ length }, (_, index) => Math.round(points.reduce((sum, point) => sum + (point.trend[index] ?? point.trend.at(-1) ?? 0), 0) / Math.max(1, points.length)))
  }, [state.knowledgePoints])
  const weak = [...state.knowledgePoints].sort((a, b) => a.mastery - b.mastery).slice(0, 5)
  const masteryChange = masteryTrend.length > 1 ? masteryTrend.at(-1)! - masteryTrend[0] : 0
  const causeStats = [...new Set(state.mistakes.map((item) => item.primaryCause))].map((cause) => ({ label: cause, value: state.mistakes.filter((item) => item.primaryCause === cause).length })).sort((a, b) => b.value - a.value)

  const downloadReport = () => {
    const lines = [
      `AI 高中学习助手 · 学习报告`,
      `学生：${state.profile.name}（${state.profile.grade}）`,
      `综合掌握度：${averageMastery}%`,
      `计划完成：${completedTasks}/${allTasks}`,
      `最近小测：${latestQuiz ? `${latestQuiz.correctRate}%` : '暂无'}`,
      `最薄弱知识点：${weak.map((item) => `${item.subject}-${item.name}(${item.mastery}%)`).join('；')}`,
      `主要错因：${causeStats.slice(0, 3).map((item) => `${item.label}(${item.value}次)`).join('；')}`,
      `下一步建议：优先复习 ${weak[0]?.name || '薄弱知识点'}，完成同类题并用每日小测验证。`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `学习报告-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
    notify('success', '学习报告已导出')
  }

  return (
    <div>
      <PageHeader eyebrow="周度复盘与行动建议" title="学习报告" description="把任务完成、错题、复习、小测和画像变化汇总成一份能指导下一步行动的报告。" actions={<Button onClick={downloadReport}><Download size={17} />导出报告</Button>} />

      <div className="report-cover">
        <div><Badge tone="primary">本周学习简报</Badge><h2>{state.profile.name}，本周的关键不是做了多少题，而是薄弱点是否真的改善。</h2><p>当前最优先解决：{weak[0]?.subject} · {weak[0]?.name}。建议继续采用“复习概念 → 独立作答 → 同类题 → 小测验证”的闭环。</p></div><div className="report-score"><strong>{averageMastery}</strong><span>综合掌握度</span></div>
      </div>

      <div className="stats-grid four">
        <StatCard label="本周学习动态" value={weeklyLogs.length} hint="上传、复习、小测等行为" icon={<Flame size={20} />} />
        <StatCard label="计划完成率" value={`${allTasks ? Math.round(completedTasks / allTasks * 100) : 0}%`} hint={`${completedTasks}/${allTasks} 项任务`} icon={<FileText size={20} />} />
        <StatCard label="最近小测" value={latestQuiz ? `${latestQuiz.correctRate}%` : '暂无'} hint={latestQuiz?.title || '完成每日小测后显示'} icon={<BarChart3 size={20} />} />
        <StatCard label="掌握度变化" value={`${masteryChange >= 0 ? '+' : ''}${masteryChange}`} hint="最近画像记录" icon={<TrendingUp size={20} />} />
      </div>

      <div className="content-grid two-equal">
        <Card><SectionTitle title="综合进步趋势" description="最近几次知识点画像的平均变化" /><div className="report-trend"><div><strong>{masteryTrend.at(-1) ?? 0}%</strong><span>当前综合掌握度</span></div><MiniLineChart values={masteryTrend} height={180} /></div></Card>
        <Card><SectionTitle title="计划执行情况" /><Donut value={allTasks ? Math.round(completedTasks / allTasks * 100) : 0} label="已完成" sublabel="计划完成不是目的，完成高优先级任务才最重要。" /></Card>
      </div>

      <div className="content-grid two-equal">
        <Card><SectionTitle title="薄弱知识点排行" description="掌握度最低的 5 个知识点" /><div className="report-weak-list">{weak.map((item, index) => <div key={item.id}><span>{index + 1}</span><div><strong>{item.subject} · {item.name}</strong><small>主要错因：{item.mainCause || '待分析'} · 错误 {item.errorCount} 次</small></div><em>{item.mastery}%</em></div>)}</div></Card>
        <Card><SectionTitle title="错误原因分布" description="下一步要改进的是方法，而不只是题目" /><BarList items={causeStats} /></Card>
      </div>

      <Card className="report-actions-card">
        <SectionTitle title="下周行动清单" description="系统根据当前数据给出的优先建议" />
        <div className="report-action-grid"><div><span>01</span><strong>补最弱知识点</strong><p>围绕“{weak[0]?.name || '待识别'}”完成 2 次复习和 1 次小测。</p></div><div><span>02</span><strong>减少重复错因</strong><p>每次提交前增加一次“条件、单位、步骤”自检。</p></div><div><span>03</span><strong>稳定记忆任务</strong><p>每天完成到期卡片，不用一次刷很多新卡。</p></div><div><span>04</span><strong>周末做一次模拟</strong><p>用薄弱点专项训练验证本周是否真正进步。</p></div></div>
      </Card>
    </div>
  )
}
