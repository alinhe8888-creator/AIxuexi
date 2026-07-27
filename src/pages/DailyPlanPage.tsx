import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  RefreshCcw,
  Sparkles,
  Target,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import {
  loadDailyCompletions,
  loadProfileAssessment,
  loadStudySessions,
  localDateKey,
  toggleDailyCompletion,
  type StudySession,
} from '../utils/familyLearningWorkspace'

type PlanItem = {
  id: string
  title: string
  description: string
  minutes: number
  kind: 'preview' | 'review' | 'training' | 'existing'
  route: string
  completed: boolean
}

function kindMeta(kind: PlanItem['kind']) {
  if (kind === 'preview') return { label: '预习', icon: BookOpen }
  if (kind === 'review') return { label: '复习', icon: RefreshCcw }
  if (kind === 'training') return { label: '训练', icon: ClipboardCheck }
  return { label: '计划', icon: Target }
}

export function DailyPlanPage() {
  const navigate = useNavigate()
  const { state } = useAppStore()
  const [sessions, setSessions] = useState<StudySession[]>(() => loadStudySessions())
  const [completions, setCompletions] = useState(() => loadDailyCompletions())
  const [assessment, setAssessment] = useState(() => loadProfileAssessment())
  const today = localDateKey()

  useEffect(() => {
    const refresh = () => {
      setSessions(loadStudySessions())
      setCompletions(loadDailyCompletions())
      setAssessment(loadProfileAssessment())
    }
    window.addEventListener('aixuexi:workspace-changed', refresh)
    return () => window.removeEventListener('aixuexi:workspace-changed', refresh)
  }, [])

  const planItems = useMemo<PlanItem[]>(() => {
    const todayPlan = [...state.dailyPlans].reverse().find((plan) => plan.date.slice(0, 10) === today)
    const existing = (todayPlan?.tasks || []).map((task) => ({
      id: `existing:${task.id}`,
      title: task.title,
      description: task.description,
      minutes: task.estimatedMinutes,
      kind: task.type === 'review' ? 'review' as const : task.type === 'quiz' ? 'training' as const : 'existing' as const,
      route: task.type === 'review' ? '/study-cycle' : task.type === 'quiz' ? '/simulation' : '/photo-explain',
      completed: task.status === 'completed' || Boolean(completions[`existing:${task.id}`]),
    }))

    const generated = sessions
      .filter((session) => session.createdAt.slice(0, 10) === today)
      .map((session) => ({
        id: `session:${session.id}`,
        title: session.result.title,
        description: `${session.subject} · ${session.chapter || session.knowledgePoint || '自主学习'}`,
        minutes: session.duration,
        kind: session.mode,
        route: '/study-cycle',
        completed: Boolean(completions[`session:${session.id}`]),
      }))

    const result = [...generated, ...existing]
    if (result.length) return result

    const shortTask = assessment?.focusScore !== undefined && assessment.focusScore < 70
    const previewMinutes = shortTask ? 15 : 25
    const reviewMinutes = shortTask ? 15 : 20
    const trainingMinutes = shortTask ? 15 : 25
    const weakest = [...state.knowledgePoints].sort((a, b) => a.mastery - b.mastery)[0]
    const pendingCorrection = state.mistakes
      .filter((item) => !item.archived && item.correction?.status !== '已验证' && !item.correction?.transferPassed)
      .sort((a, b) => a.wrongAt.localeCompare(b.wrongAt))[0]
    const subject = pendingCorrection?.subject || weakest?.subject || state.profile.selectedSubjects[0] || '数学'
    const chapter = state.profile.currentChapters[subject] || pendingCorrection?.chapter || weakest?.chapter || '当前章节'
    return [
      {
        id: 'starter:preview',
        title: `预习 ${subject} · ${chapter}`,
        description: '先看学习目标和核心概念，再做 2—3 道自测题。',
        minutes: previewMinutes,
        kind: 'preview',
        route: '/study-cycle',
        completed: Boolean(completions['starter:preview']),
      },
      {
        id: 'starter:review',
        title: pendingCorrection ? `完成错题闭环 · ${pendingCorrection.knowledgePointName}` : weakest ? `复习 ${weakest.name}` : '复习最近错题',
        description: pendingCorrection
          ? `${pendingCorrection.correction?.status || '待订正'}：重新作答、换讲法并完成迁移检测。`
          : weakest ? `当前掌握度 ${weakest.mastery}%，先回忆再订正。` : '从错题和遗忘风险中选一个重点。',
        minutes: reviewMinutes,
        kind: 'review',
        route: pendingCorrection ? '/mistakes' : '/study-cycle',
        completed: Boolean(completions['starter:review']),
      },
      {
        id: 'starter:training',
        title: '完成一组专项小练',
        description: '建议 5 道题，题型混合，用于验证预习和复习结果。',
        minutes: trainingMinutes,
        kind: 'training',
        route: '/simulation',
        completed: Boolean(completions['starter:training']),
      },
    ]
  }, [assessment, completions, sessions, state.dailyPlans, state.knowledgePoints, state.profile, today])

  const completed = planItems.filter((item) => item.completed).length
  const totalMinutes = planItems.reduce((sum, item) => sum + item.minutes, 0)
  const progress = planItems.length ? Math.round((completed / planItems.length) * 100) : 0

  const toggle = (id: string) => setCompletions(toggleDailyCompletion(id))

  return (
    <div className="family-page daily-plan-v160">
      <header className="family-page-header">
        <div>
          <span className="family-eyebrow"><Sparkles size={15} /> 每天先看这里</span>
          <h1>今日计划</h1>
          <p>把预习、复习和训练排成一条线，完成一项再进入下一项。{assessment ? ` 已按“${assessment.rhythm}”画像调整任务长度。` : ''}</p>
        </div>
        <button className="family-primary-button" onClick={() => navigate('/study-cycle')}>
          生成预习/复习 <ChevronRight size={17} />
        </button>
      </header>

      <section className="plan-overview-card">
        <div className="plan-overview-main">
          <div className="plan-progress-ring" style={{ '--plan-progress': `${progress}%` } as CSSProperties}>
            <strong>{progress}%</strong><span>已完成</span>
          </div>
          <div>
            <h2>{completed === planItems.length ? '今天的计划已完成' : `还有 ${planItems.length - completed} 项待完成`}</h2>
            <p>预计 {totalMinutes} 分钟 · 建议按预习 → 复习 → 训练的顺序进行</p>
          </div>
        </div>
        <div className="plan-overview-stats">
          <div><Check size={18} /><strong>{completed}/{planItems.length}</strong><span>任务</span></div>
          <div><Clock3 size={18} /><strong>{totalMinutes}</strong><span>分钟</span></div>
        </div>
      </section>

      <section className="plan-task-list">
        {planItems.map((item, index) => {
          const meta = kindMeta(item.kind)
          const Icon = meta.icon
          return (
            <article key={item.id} className={item.completed ? 'plan-task is-completed' : 'plan-task'}>
              <button className="plan-task-check" onClick={() => toggle(item.id)} aria-label={item.completed ? '标记未完成' : '标记完成'}>
                {item.completed ? <Check size={17} /> : <span>{index + 1}</span>}
              </button>
              <div className={`plan-task-icon plan-task-icon--${item.kind}`}><Icon size={20} /></div>
              <div className="plan-task-copy">
                <div><span>{meta.label}</span><em>{item.minutes} 分钟</em></div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <button className="plan-task-enter" onClick={() => navigate(item.route)}>开始 <ChevronRight size={16} /></button>
            </article>
          )
        })}
      </section>

      <section className="plan-quick-grid">
        <button onClick={() => navigate('/study-cycle', { state: { mode: 'preview' } })}>
          <BookOpen size={22} /><strong>生成预习</strong><span>围绕下一章节建立框架</span>
        </button>
        <button onClick={() => navigate('/study-cycle', { state: { mode: 'review' } })}>
          <RefreshCcw size={22} /><strong>安排复习</strong><span>优先处理错题和遗忘风险</span>
        </button>
        <button onClick={() => navigate('/simulation')}>
          <ClipboardCheck size={22} /><strong>出一组题</strong><span>整卷或 3—10 道专项题</span>
        </button>
      </section>
    </div>
  )
}
