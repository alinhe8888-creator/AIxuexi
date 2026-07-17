import { BookOpenCheck, ChevronDown, Database, Search, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, EmptyState, Modal, PageHeader, SectionTitle } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { KnowledgeItem, SourceType, Subject } from '../types'
import { sourceLabels } from '../utils/learning'
import { learningApi } from '../services/learningApi'

export function KnowledgeBasePage() {
  const { state } = useAppStore()
  const [subject, setSubject] = useState<Subject | '全部'>('全部')
  const [grade, setGrade] = useState<'全部' | '高一' | '高二' | '高三'>('全部')
  const [source, setSource] = useState<SourceType | '全部'>('全部')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<KnowledgeItem | null>(null)
  const [remoteItems, setRemoteItems] = useState<KnowledgeItem[]>([])
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const allItems = useMemo(() => {
    const map = new Map(state.knowledgeItems.map((item) => [item.id, item]))
    remoteItems.forEach((item) => map.set(item.id, item))
    return [...map.values()]
  }, [state.knowledgeItems, remoteItems])
  const subjects = [...new Set(allItems.map((item) => item.subject))]

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setRemoteState('loading')
      learningApi.knowledge.search({ subject: subject === '全部' ? undefined : subject, grade: grade === '全部' ? undefined : grade, sourceType: source === '全部' ? undefined : source, keyword })
        .then((items) => { if (!cancelled) { setRemoteItems(items); setRemoteState('ready') } })
        .catch((error) => { console.warn('Knowledge API search failed.', error); if (!cancelled) setRemoteState('error') })
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [subject, grade, source, keyword])

  const filtered = useMemo(() => allItems.filter((item) => {
    if (subject !== '全部' && item.subject !== subject) return false
    if (grade !== '全部' && item.grade !== grade) return false
    if (source !== '全部' && item.sourceType !== source) return false
    if (keyword && !`${item.title}${item.knowledgePoint}${item.chapter}${item.tags.join('')}`.toLowerCase().includes(keyword.toLowerCase())) return false
    return true
  }), [allItems, subject, grade, source, keyword])

  return (
    <div>
      <PageHeader eyebrow="题库与教材知识结构" title="知识库" description="按照科目、年级、章节、知识点、年份、地区和题型分类。真实真题、AI 生成题和演示数据始终明确区分来源。" actions={<Badge tone="success"><ShieldCheck size={15} />来源透明</Badge>} />

      <div className="knowledge-summary-grid">
        <Card><Database size={23} /><div><strong>{allItems.length}</strong><span>知识条目</span></div></Card>
        <Card><BookOpenCheck size={23} /><div><strong>{new Set(allItems.map((item) => item.knowledgePoint)).size}</strong><span>知识点</span></div></Card>
        <Card><ShieldCheck size={23} /><div><strong>{allItems.filter((item) => item.sourceType === 'real_exam').length}</strong><span>公开真题结构</span></div></Card>
      </div>

      <Card className="filter-card knowledge-filters">
        <div className="search-box wide"><Search size={18} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索标题、知识点、章节或标签" /></div>
        <label>科目<select value={subject} onChange={(event) => setSubject(event.target.value as Subject | '全部')}><option>全部</option>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
        <label>年级<select value={grade} onChange={(event) => setGrade(event.target.value as typeof grade)}><option>全部</option><option>高一</option><option>高二</option><option>高三</option></select><ChevronDown size={14} /></label>
        <label>来源<select value={source} onChange={(event) => setSource(event.target.value as SourceType | '全部')}><option>全部</option><option value="user_upload">用户上传</option><option value="real_exam">公开真题</option><option value="ai_generated">AI 生成</option><option value="demo">演示题</option></select><ChevronDown size={14} /></label>
      </Card>

      <div className="knowledge-layout">
        <Card className="knowledge-tree">
          <SectionTitle title="知识目录" />
          {subjects.map((item) => <div key={item} className="tree-subject"><button onClick={() => setSubject(item)}><strong>{item}</strong><span>{allItems.filter((knowledge) => knowledge.subject === item).length}</span></button>{allItems.filter((knowledge) => knowledge.subject === item).map((knowledge) => knowledge.chapter).filter((value, index, array) => array.indexOf(value) === index).map((chapter) => <button key={chapter} className="tree-chapter" onClick={() => { setSubject(item); setKeyword(chapter) }}>{chapter}</button>)}</div>)}
        </Card>

        <div>
          <div className="results-head"><span>共 {filtered.length} 条结果</span><small>{remoteState === 'loading' ? '正在查询后端知识库…' : remoteState === 'error' ? '后端暂不可用，正在展示本地数据' : '点击条目查看完整数据结构'}</small></div>
          {filtered.length ? <div className="knowledge-card-grid">{filtered.map((item) => <Card key={item.id} className="knowledge-item" interactive><button onClick={() => setSelected(item)}><div className="knowledge-item-head"><Badge tone="primary">{item.subject}</Badge><Badge>{item.grade}</Badge><Badge tone={item.sourceType === 'real_exam' ? 'success' : item.sourceType === 'ai_generated' ? 'primary' : 'neutral'}>{sourceLabels[item.sourceType]}</Badge></div><h3>{item.title}</h3><p>{item.content}</p><div className="knowledge-path">{item.chapter} / {item.knowledgePoint}</div><div className="tag-row">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>{item.sourceType === 'real_exam' && <div className="source-detail">{item.year || '年份待录入'} · {item.region || '地区待录入'} · {item.questionType}</div>}</button></Card>)}</div> : <Card><EmptyState title="没有匹配的知识条目" description="调整筛选条件或清空搜索词。" /></Card>}
        </div>
      </div>

      <Card className="knowledge-api-note"><div><Database size={24} /><div><strong>知识库接口已接通</strong><p>当前页面可调用 Render 知识库检索接口；后续只需向 PostgreSQL、D1 或向量库补充合法内容，不需要重写页面。</p></div></div><code>GET /api/knowledge → KnowledgeItem[]</code></Card>

      <Modal open={Boolean(selected)} title={selected?.title || '知识条目'} onClose={() => setSelected(null)} size="lg">
        {selected && <div className="knowledge-detail"><div className="badge-row"><Badge tone="primary">{selected.subject}</Badge><Badge>{selected.grade}</Badge><Badge>{selected.chapter}</Badge><Badge tone={selected.sourceType === 'real_exam' ? 'success' : selected.sourceType === 'ai_generated' ? 'primary' : 'neutral'}>{sourceLabels[selected.sourceType]}</Badge></div><div className="detail-block"><span>知识点</span><p>{selected.knowledgePoint}</p></div><div className="detail-block"><span>题目或内容</span><p>{selected.content}</p></div><div className="answer-compare"><div><span>标准答案</span><p>{selected.answer}</p></div><div><span>解析</span><p>{selected.explanation}</p></div></div>{selected.sourceType === 'real_exam' && <div className="detail-block"><span>真题来源字段</span><p>{selected.year || '年份待录入'} · {selected.region || '地区待录入'} · {selected.questionType}</p></div>}</div>}
      </Modal>
    </div>
  )
}
