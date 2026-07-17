import { CalendarCheck2, CheckCircle2, Circle, Clock3, Plus, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, SectionTitle } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { Subject, TaskType } from '../types'
import { addDays, formatDate, toDateKey } from '../utils/date'

export function DailyPlanPage() {
  const navigate = useNavigate()
  const { state, toggleTask, addDailyTask } = useAppStore()
  const [date, setDate] = useState(toDateKey())
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState<Subject>('数学')
  const [minutes, setMinutes] = useState(20)
  const [type, setType] = useState<TaskType>('study')

  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => toDateKey(addDays(new Date(), index - 2))), [])
  const plan = state.dailyPlans.find((item) => item.date === date)
  const completed = plan?.tasks.filter((item) => item.status === 'completed').length ?? 0
  const total = plan?.tasks.length ?? 0
  const totalMinutes = plan?.tasks.reduce((sum, item) => sum + item.estimatedMinutes, 0) ?? 0
  const dueReviews = state.reviewTasks.filter((task) => task.status === 'pending' && task.scheduledDate <= date)

  const add = () => {
    if (!title.trim()) return
    addDailyTask({ title, description, subject, estimatedMinutes: minutes, type })
    setModalOpen(false); setTitle(''); setDescription('')
  }

  return (
    <div>
      <PageHeader eyebrow="自动计划 + 手动调整" title="每日计划" description="系统根据错题、薄弱知识点、到期复习和近期小测生成任务。你也可以添加自己的任务。" actions={<Button onClick={() => setModalOpen(true)}><Plus size={17} />添加任务</Button>} />

      <Card className="date-strip">{dates.map((item) => { const currentPlan = state.dailyPlans.find((planItem) => planItem.date === item); const done = currentPlan?.tasks.filter((task) => task.status === 'completed').length ?? 0; const taskCount = currentPlan?.tasks.length ?? 0; return <button key={item} className={date === item ? 'active' : ''} onClick={() => setDate(item)}><span>{new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(item))}</span><strong>{new Date(item).getDate()}</strong><small>{taskCount ? `${done}/${taskCount}` : '暂无'}</small></button> })}</Card>

      <div className="stats-grid three">
        <Card><span>任务完成度</span><strong>{total ? Math.round(completed / total * 100) : 0}%</strong><ProgressBar value={total ? completed / total * 100 : 0} /></Card>
        <Card><span>预计学习时间</span><strong>{totalMinutes} 分钟</strong><p>建议分成 2–3 个学习时段</p></Card>
        <Card><span>到期复习</span><strong>{dueReviews.length} 项</strong><p>优先处理高遗忘风险内容</p></Card>
      </div>

      <div className="content-grid main-side">
        <Card>
          <SectionTitle title={`${date === toDateKey() ? '今日' : date}任务`} description="点击圆圈即可标记完成" action={date === toDateKey() ? <Badge tone="primary"><Sparkles size={14} />智能生成</Badge> : undefined} />
          {plan?.tasks.length ? <div className="plan-task-list">{plan.tasks.map((task) => <div key={task.id} className={task.status === 'completed' ? 'done' : ''}><button onClick={() => toggleTask(plan.id, task.id)}>{task.status === 'completed' ? <CheckCircle2 size={23} /> : <Circle size={23} />}</button><span className={`task-type ${task.type}`}>{task.type === 'study' ? '学' : task.type === 'review' ? '复' : '测'}</span><div><strong>{task.title}</strong><p>{task.description}</p></div>{task.subject && <Badge>{task.subject}</Badge>}<span className="task-minutes"><Clock3 size={14} />{task.estimatedMinutes} 分钟</span>{task.type === 'quiz' && task.status !== 'completed' && <Button size="sm" onClick={() => navigate('/quiz')}>开始</Button>}</div>)}</div> : <EmptyState title="这一天还没有计划" description="当前演示版自动生成今天和明天的关键任务，也可以手动添加。" />}
        </Card>

        <div className="stack">
          <Card><SectionTitle title="任务生成依据" /><div className="plan-basis"><div><span>1</span><strong>到期错题</strong><p>按照下次复习时间自动进入计划</p></div><div><span>2</span><strong>薄弱知识点</strong><p>掌握度低、重复出错的内容优先</p></div><div><span>3</span><strong>小测结果</strong><p>今日答错内容自动进入第二天任务</p></div></div></Card>
          <Card><SectionTitle title="近期计划" />{state.dailyPlans.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((item) => <button className="plan-history-row" key={item.id} onClick={() => setDate(item.date)}><CalendarCheck2 size={18} /><div><strong>{item.date}</strong><span>{item.tasks.filter((task) => task.status === 'completed').length}/{item.tasks.length} 项完成</span></div><ProgressBar value={item.tasks.length ? item.tasks.filter((task) => task.status === 'completed').length / item.tasks.length * 100 : 0} compact /></button>)}</Card>
          <Card className="plan-tip"><strong>计划不是越满越好</strong><p>当前每日目标为 {state.profile.dailyMinutes} 分钟。系统会优先保留高价值任务，避免堆积大量无效练习。</p><small>档案更新时间：{formatDate(state.profile.updatedAt, true)}</small></Card>
        </div>
      </div>

      <Modal open={modalOpen} title="添加今日任务" onClose={() => setModalOpen(false)} footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button><Button onClick={add}>添加任务</Button></>}>
        <div className="form-stack"><label>任务名称<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：完成导数同类题" /></label><label>任务说明<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="写清楚要完成什么" /></label><div className="form-row two"><label>科目<select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>{state.profile.selectedSubjects.map((item) => <option key={item}>{item}</option>)}</select></label><label>预计分钟<input type="number" min="5" max="180" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label></div><label>任务类型<select value={type} onChange={(event) => setType(event.target.value as TaskType)}><option value="study">学习</option><option value="review">复习</option><option value="quiz">小测</option></select></label></div>
      </Modal>
    </div>
  )
}
