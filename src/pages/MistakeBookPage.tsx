import {
  Archive,
  BookMarked,
  CheckCircle2,
  ChevronDown,
  Filter,
  LoaderCircle,
  LockKeyhole,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { AdaptiveCorrectionPanel } from '../components/AdaptiveCorrectionPanel'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, SectionTitle, Segmented } from '../components/ui'
import { learningApi } from '../services/learningApi'
import { useAppStore } from '../store/useAppStore'
import type { AiExplanation, ErrorCause, MistakeRecord, Subject } from '../types'
import { formatDate, isDue } from '../utils/date'
import { causeLabels, sourceLabels } from '../utils/learning'

type ViewMode = 'active' | 'due' | 'verified' | 'archived'

const statusTone = (status?: string) => {
  if (status === '已验证') return 'success' as const
  if (status === '待验证') return 'warning' as const
  if (status === '订正中') return 'primary' as const
  return 'neutral' as const
}

export function MistakeBookPage() {
  const { state, archiveMistake, removeMistake, notify } = useAppStore()
  const [view, setView] = useState<ViewMode>('active')
  const [subject, setSubject] = useState<Subject | '全部'>('全部')
  const [cause, setCause] = useState<ErrorCause | '全部'>('全部')
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [explanation, setExplanation] = useState<AiExplanation | null>(null)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [explanationError, setExplanationError] = useState('')

  const selected = state.mistakes.find((item) => item.id === selectedId) || null
  const subjects = [...new Set(state.mistakes.map((item) => item.subject))]
  const filtered = useMemo(() => state.mistakes.filter((item) => {
    if (view === 'active' && item.archived) return false
    if (view === 'due' && (item.archived || !isDue(item.nextReviewAt))) return false
    if (view === 'verified' && (item.archived || item.correction?.status !== '已验证')) return false
    if (view === 'archived' && !item.archived) return false
    if (subject !== '全部' && item.subject !== subject) return false
    if (cause !== '全部' && item.primaryCause !== cause) return false
    if (keyword && !`${item.originalQuestion}${item.knowledgePointName}${item.chapter}`.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  }), [state.mistakes, view, subject, cause, keyword])

  const subjectCounts = subjects.map((item) => ({
    subject: item,
    count: state.mistakes.filter((mistake) => mistake.subject === item && !mistake.archived).length,
  }))

  const openMistake = (mistake: MistakeRecord) => {
    setSelectedId(mistake.id)
    const question = state.questions.find((item) => item.id === mistake.questionId)
    setExplanation(question?.explanation || null)
    setExplanationError('')
  }

  const loadExplanation = async () => {
    if (!selected) return
    setLoadingExplanation(true)
    setExplanationError('')
    try {
      const preferredStyles = [...state.strategyPreferences]
        .filter((item) => !item.subject || item.subject === selected.subject)
        .sort((left, right) => (right.successCount / Math.max(1, right.usedCount)) - (left.successCount / Math.max(1, left.usedCount)))
        .slice(0, 4)
        .map((item) => item.style)
      const result = await learningApi.ai.explainQuestion({
        subject: selected.subject,
        content: selected.originalQuestion,
        correctAnswer: selected.correctAnswer,
        studentAnswer: selected.studentAnswer,
        preferredStyles,
      })
      setExplanation(result)
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : '讲解生成失败')
    } finally {
      setLoadingExplanation(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="两轮订正与方法沉淀"
        title="错题本"
        description="错题不会直接展示答案；先尝试、再换讲法、完成迁移检测，最后把有效方法留进学习画像。"
      />

      <div className="stats-grid four compact-stats">
        <Card><span>待订正</span><strong>{state.mistakes.filter((item) => !item.archived && (!item.correction || item.correction.status === '待订正')).length}</strong><p>尚未开始纠错</p></Card>
        <Card><span>订正中</span><strong>{state.mistakes.filter((item) => !item.archived && item.correction?.status === '订正中').length}</strong><p>正在尝试不同讲法</p></Card>
        <Card><span>已验证</span><strong>{state.mistakes.filter((item) => !item.archived && item.correction?.status === '已验证').length}</strong><p>迁移检测已通过</p></Card>
        <Card><span>重复错误</span><strong>{state.mistakes.filter((item) => item.wrongCount >= 2 && !item.archived).length}</strong><p>需要优先干预</p></Card>
      </div>

      <Card className="filter-card">
        <div className="filter-top">
          <Segmented<ViewMode>
            value={view}
            options={[
              { value: 'active', label: '全部错题' },
              { value: 'due', label: '今日到期' },
              { value: 'verified', label: '已验证' },
              { value: 'archived', label: '已掌握' },
            ]}
            onChange={setView}
          />
          <div className="search-box"><Search size={17} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索题目或知识点" /></div>
        </div>
        <div className="filter-row">
          <Filter size={17} />
          <label>科目<select value={subject} onChange={(event) => setSubject(event.target.value as Subject | '全部')}><option>全部</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
          <label>错因<select value={cause} onChange={(event) => setCause(event.target.value as ErrorCause | '全部')}><option>全部</option>{causeLabels.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
          <span className="filter-result">找到 {filtered.length} 道</span>
        </div>
      </Card>

      <div className="content-grid main-side">
        <div className="stack">
          {filtered.length ? filtered.map((mistake) => (
            <Card key={mistake.id} className="mistake-card mistake-card--adaptive" interactive>
              <div className="mistake-card-head">
                <div className="badge-row">
                  <Badge tone="primary">{mistake.subject}</Badge>
                  <Badge>{mistake.chapter}</Badge>
                  <Badge tone={statusTone(mistake.correction?.status)}>{mistake.correction?.status || '待订正'}</Badge>
                  <Badge tone={mistake.sourceType === 'real_exam' ? 'success' : mistake.sourceType === 'ai_generated' ? 'primary' : 'neutral'}>{sourceLabels[mistake.sourceType]}</Badge>
                </div>
                <span className="mistake-date">错误于 {formatDate(mistake.wrongAt)}</span>
              </div>
              <button type="button" className="mistake-question" onClick={() => openMistake(mistake)}>{mistake.originalQuestion}</button>
              <div className="mistake-info-grid">
                <div><span>知识点</span><strong>{mistake.knowledgePointName}</strong></div>
                <div><span>主要错因</span><strong>{mistake.primaryCause}</strong></div>
                <div><span>订正尝试</span><strong>{mistake.correction?.attempts.length || 0} 次</strong></div>
                <div><span>有效讲法</span><strong>{mistake.correction?.preferredStyle || '待发现'}</strong></div>
              </div>
              <div className="mistake-progress"><ProgressBar value={mistake.mastery} label={`掌握度 · ${mistake.masteryLevel}`} /></div>
              <div className="mistake-actions">
                <Button size="sm" onClick={() => openMistake(mistake)}>{mistake.correction?.status === '已验证' ? '查看订正记录' : '开始订正'}</Button>
                {mistake.correction?.transferPassed && <Button size="sm" variant="ghost" onClick={() => archiveMistake(mistake.id)}><Archive size={15} />标记掌握</Button>}
                <Button size="sm" variant="ghost" onClick={() => removeMistake(mistake.id)}><Trash2 size={15} />删除</Button>
              </div>
            </Card>
          )) : <Card><EmptyState title="没有符合条件的错题" description="调整筛选条件，或通过拍题、试卷和训练新增错题。" /></Card>}
        </div>

        <div className="stack">
          <Card>
            <SectionTitle title="按科目分布" />
            <div className="subject-count-list">{subjectCounts.map((item) => <button type="button" key={item.subject} onClick={() => setSubject(item.subject)}><span>{item.subject}</span><strong>{item.count}</strong></button>)}</div>
          </Card>
          <Card>
            <SectionTitle title="常见错因" description="帮助发现比知识点更深层的问题" />
            <div className="cause-summary">{causeLabels.map((item) => ({ cause: item, count: state.mistakes.filter((mistake) => !mistake.archived && mistake.primaryCause === item).length })).filter((item) => item.count).sort((a, b) => b.count - a.count).slice(0, 6).map((item, index) => <div key={item.cause}><span>{index + 1}</span><strong>{item.cause}</strong><em>{item.count} 次</em></div>)}</div>
          </Card>
          <Card className="review-tip-card"><BookMarked size={26} /><h3>订正不是重看答案</h3><p>先独立再答一次；第一次不会就给提示并换讲法，第二次仍不会才显示答案，最后必须做迁移题。</p></Card>
          <Card>
            <SectionTitle title="有效讲法偏好" description="来自真实订正结果，不是一次问卷标签" />
            <div className="strategy-preference-list">
              {state.strategyPreferences.length ? state.strategyPreferences.slice(0, 6).map((item) => (
                <div key={`${item.subject}-${item.style}`}><span>{item.subject || '通用'} · {item.style}</span><strong>{Math.round((item.successCount / Math.max(1, item.usedCount)) * 100)}%</strong><small>{item.methodName}</small></div>
              )) : <p>完成几道错题订正后，系统会自动发现更适合的讲法。</p>}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected ? `${selected.subject} · ${selected.knowledgePointName}` : '错题订正'}
        onClose={() => { setSelectedId(''); setExplanation(null); setExplanationError('') }}
        size="lg"
      >
        {selected && (
          <div className="mistake-detail mistake-detail--adaptive">
            {selected.imageDataUrl && <img src={selected.imageDataUrl} alt="错题原图" />}
            <div className="detail-block"><span>原题</span><p>{selected.originalQuestion}</p></div>
            <div className="answer-compare answer-compare--locked">
              <div><span>你的原答案</span><p>{selected.studentAnswer || '未填写'}</p></div>
              <div><span><LockKeyhole size={15} />正确答案</span><p>{selected.correction?.finalAnswerRevealed || selected.correction?.transferPassed ? selected.correctAnswer : '完成两次作答后按规则解锁'}</p></div>
            </div>
            <div className="detail-block"><span>订正状态</span><div className="badge-row"><Badge tone={statusTone(selected.correction?.status)}>{selected.correction?.status || '待订正'}</Badge><Badge tone="danger">{selected.primaryCause}</Badge>{selected.correction?.preferredStyle && <Badge tone="success">有效讲法：{selected.correction.preferredStyle}</Badge>}</div>{selected.note && <p>{selected.note}</p>}</div>

            {!explanation && (
              <div className="mistake-start-correction">
                <Sparkles size={28} />
                <div><strong>准备自适应订正</strong><p>AI 会根据原答案生成至少三种讲法，前两次不显示答案。</p></div>
                <Button onClick={() => void loadExplanation()} disabled={loadingExplanation}>{loadingExplanation ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{loadingExplanation ? '正在准备…' : '开始订正'}</Button>
                {explanationError && <p className="danger-text">{explanationError}</p>}
              </div>
            )}

            {explanation && (
              <AdaptiveCorrectionPanel
                mistakeId={selected.id}
                subject={selected.subject}
                question={selected.originalQuestion}
                correctAnswer={selected.correctAnswer || explanation.finalAnswer}
                knowledgePointName={selected.knowledgePointName}
                explanation={explanation}
                compact
                onCompleted={(passed) => {
                  if (passed) notify('success', '这道错题已通过迁移验证')
                }}
              />
            )}

            {selected.correction?.transferPassed && (
              <div className="mistake-verified-strip"><CheckCircle2 size={20} /><div><strong>迁移检测已通过</strong><p>可以标记掌握，系统仍会按间隔复习安排后续巩固。</p></div><Button size="sm" onClick={() => archiveMistake(selected.id)}>标记掌握</Button></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
