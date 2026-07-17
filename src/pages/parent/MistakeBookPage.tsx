import { Archive, BookMarked, ChevronDown, Filter, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, SectionTitle, Segmented } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { ErrorCause, MistakeRecord, Subject } from '../types'
import { formatDate, isDue } from '../utils/date'
import { causeLabels, sourceLabels } from '../utils/learning'

type ViewMode = 'active' | 'due' | 'archived'

export function MistakeBookPage() {
  const { state, reviewMistake, archiveMistake, removeMistake } = useAppStore()
  const [view, setView] = useState<ViewMode>('active')
  const [subject, setSubject] = useState<Subject | '全部'>('全部')
  const [cause, setCause] = useState<ErrorCause | '全部'>('全部')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<MistakeRecord | null>(null)

  const subjects = [...new Set(state.mistakes.map((item) => item.subject))]
  const filtered = useMemo(() => state.mistakes.filter((item) => {
    if (view === 'active' && item.archived) return false
    if (view === 'due' && (item.archived || !isDue(item.nextReviewAt))) return false
    if (view === 'archived' && !item.archived) return false
    if (subject !== '全部' && item.subject !== subject) return false
    if (cause !== '全部' && item.primaryCause !== cause) return false
    if (keyword && !`${item.originalQuestion}${item.knowledgePointName}${item.chapter}`.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  }), [state.mistakes, view, subject, cause, keyword])

  const subjectCounts = subjects.map((item) => ({ subject: item, count: state.mistakes.filter((mistake) => mistake.subject === item && !mistake.archived).length }))

  return (
    <div>
      <PageHeader eyebrow="错题沉淀与复习" title="错题本" description="每道错题都关联知识点、错因、掌握度和下次复习时间。复习结果会反向更新学习画像。" />

      <div className="stats-grid four compact-stats">
        <Card><span>活跃错题</span><strong>{state.mistakes.filter((item) => !item.archived).length}</strong><p>仍需继续复习</p></Card>
        <Card><span>今日到期</span><strong>{state.mistakes.filter((item) => !item.archived && isDue(item.nextReviewAt)).length}</strong><p>建议优先完成</p></Card>
        <Card><span>重复错误</span><strong>{state.mistakes.filter((item) => item.wrongCount >= 2 && !item.archived).length}</strong><p>错误次数 ≥ 2</p></Card>
        <Card><span>已掌握</span><strong>{state.mistakes.filter((item) => item.archived).length}</strong><p>可以随时恢复查看</p></Card>
      </div>

      <Card className="filter-card">
        <div className="filter-top">
          <Segmented value={view} options={[{ value: 'active', label: '全部错题' }, { value: 'due', label: '待复习' }, { value: 'archived', label: '已掌握' }]} onChange={setView} />
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
            <Card key={mistake.id} className="mistake-card" interactive>
              <div className="mistake-card-head">
                <div className="badge-row"><Badge tone="primary">{mistake.subject}</Badge><Badge>{mistake.chapter}</Badge><Badge tone={mistake.sourceType === 'real_exam' ? 'success' : mistake.sourceType === 'ai_generated' ? 'primary' : 'neutral'}>{sourceLabels[mistake.sourceType]}</Badge></div>
                <span className="mistake-date">错误于 {formatDate(mistake.wrongAt)}</span>
              </div>
              <button className="mistake-question" onClick={() => setSelected(mistake)}>{mistake.originalQuestion}</button>
              <div className="mistake-info-grid">
                <div><span>知识点</span><strong>{mistake.knowledgePointName}</strong></div>
                <div><span>主要错因</span><strong>{mistake.primaryCause}</strong></div>
                <div><span>错误次数</span><strong className={mistake.wrongCount >= 2 ? 'danger-text' : ''}>{mistake.wrongCount} 次</strong></div>
                <div><span>下次复习</span><strong className={isDue(mistake.nextReviewAt) ? 'danger-text' : ''}>{isDue(mistake.nextReviewAt) ? '已到期' : formatDate(mistake.nextReviewAt)}</strong></div>
              </div>
              <div className="mistake-progress"><ProgressBar value={mistake.mastery} label={`掌握度 · ${mistake.masteryLevel}`} /></div>
              <div className="mistake-actions"><Button size="sm" onClick={() => setSelected(mistake)}>开始复习</Button><Button size="sm" variant="ghost" onClick={() => archiveMistake(mistake.id)}><Archive size={15} />标记掌握</Button><Button size="sm" variant="ghost" onClick={() => removeMistake(mistake.id)}><Trash2 size={15} />删除</Button></div>
            </Card>
          )) : <Card><EmptyState title="没有符合条件的错题" description="调整筛选条件，或通过拍题讲解和每日小测新增错题。" /></Card>}
        </div>

        <div className="stack">
          <Card>
            <SectionTitle title="按科目分布" />
            <div className="subject-count-list">{subjectCounts.map((item) => <button key={item.subject} onClick={() => setSubject(item.subject)}><span>{item.subject}</span><strong>{item.count}</strong></button>)}</div>
          </Card>
          <Card>
            <SectionTitle title="常见错因" description="帮助你发现比知识点更深层的问题" />
            <div className="cause-summary">{causeLabels.map((item) => ({ cause: item, count: state.mistakes.filter((mistake) => !mistake.archived && mistake.primaryCause === item).length })).filter((item) => item.count).sort((a, b) => b.count - a.count).slice(0, 6).map((item, index) => <div key={item.cause}><span>{index + 1}</span><strong>{item.cause}</strong><em>{item.count} 次</em></div>)}</div>
          </Card>
          <Card className="review-tip-card"><BookMarked size={26} /><h3>复习不是重看答案</h3><p>先遮住解析重新作答，再根据结果选择“没掌握、模糊、掌握、很熟练”，系统才会正确安排下次复习。</p></Card>
        </div>
      </div>

      <Modal open={Boolean(selected)} title={selected ? `${selected.subject} · ${selected.knowledgePointName}` : '错题复习'} onClose={() => setSelected(null)} size="lg" footer={selected && !selected.archived ? <div className="review-rating"><span>这次掌握得怎么样？</span><Button size="sm" variant="danger" onClick={() => { reviewMistake(selected.id, 'again'); setSelected(null) }}>没掌握</Button><Button size="sm" variant="secondary" onClick={() => { reviewMistake(selected.id, 'hard'); setSelected(null) }}>有点模糊</Button><Button size="sm" onClick={() => { reviewMistake(selected.id, 'good'); setSelected(null) }}>掌握了</Button><Button size="sm" variant="success" onClick={() => { reviewMistake(selected.id, 'easy'); setSelected(null) }}>很熟练</Button></div> : undefined}>
        {selected && <div className="mistake-detail">
          {selected.imageDataUrl && <img src={selected.imageDataUrl} alt="错题原图" />}
          <div className="detail-block"><span>原题</span><p>{selected.originalQuestion}</p></div>
          <div className="answer-compare"><div><span>你的答案</span><p>{selected.studentAnswer || '未填写'}</p></div><div><span>正确答案</span><p>{selected.correctAnswer}</p></div></div>
          <div className="detail-block"><span>错因与笔记</span><div className="badge-row"><Badge tone="danger">{selected.primaryCause}</Badge>{selected.secondaryCause && <Badge tone="warning">{selected.secondaryCause}</Badge>}</div>{selected.note && <p>{selected.note}</p>}</div>
          <div className="detail-block"><span>复习信息</span><p>已错 {selected.wrongCount} 次 · 当前掌握度 {selected.mastery}% · 下次复习 {formatDate(selected.nextReviewAt)}</p></div>
        </div>}
      </Modal>
    </div>
  )
}
