import { BarChart3, Check, ChevronDown, FileImage, FileSearch, LoaderCircle, Plus, Save, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { BarList } from '../components/Charts'
import { Badge, Button, Callout, Card, EmptyState, LoadingState, PageHeader, ProgressBar, SectionTitle } from '../components/ui'
import { learningApi } from '../services'
import { useAppStore } from '../store/useAppStore'
import type { ErrorCause, PaperQuestionAnalysis, PaperRecord, Subject } from '../types'
import { toDateKey } from '../utils/date'
import { compressImage } from '../utils/image'
import { causeLabels } from '../utils/learning'

const subjects: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

export function PaperAnalysisPage() {
  const { state, addPaper, notify } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [subject, setSubject] = useState<Subject>('数学')
  const [title, setTitle] = useState('高二阶段检测')
  const [date, setDate] = useState(toDateKey())
  const [images, setImages] = useState<Array<{ data: string; name: string }>>([])
  const [questions, setQuestions] = useState<PaperQuestionAnalysis[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'saved'>('idle')
  const [analysisReady, setAnalysisReady] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const imageFiles = [...files].filter((file) => file.type.startsWith('image/')).slice(0, 6 - images.length)
    try {
      const next = await Promise.all(imageFiles.map(async (file) => ({ data: await compressImage(file, 900, 0.66), name: file.name })))
      setImages((current) => [...current, ...next])
      setStatus('idle')
      setAnalysisReady(false)
    } catch {
      notify('error', '部分图片读取失败')
    }
  }

  const recognize = async () => {
    if (!images.length) return notify('info', '请先上传至少一张试卷图片')
    setStatus('loading')
    try {
      const result = await learningApi.ocr.recognizePaper({ subject, imageDataUrls: images.map((item) => item.data) })
      setQuestions(result)
      setStatus('ready')
      notify('success', '试卷题目已模拟识别', '请逐题核对得分、答案和错因。')
    } catch {
      setStatus('idle')
      notify('error', '试卷识别失败')
    }
  }

  const updateQuestion = (id: string, patch: Partial<PaperQuestionAnalysis>) => {
    setQuestions((items) => items.map((item) => item.id === id ? { ...item, ...patch, isCorrect: patch.score !== undefined ? patch.score >= item.fullScore : patch.isCorrect ?? item.isCorrect } : item))
    setAnalysisReady(false)
  }

  const fullScore = questions.reduce((sum, item) => sum + Number(item.fullScore || 0), 0)
  const score = questions.reduce((sum, item) => sum + Number(item.score || 0), 0)
  const scoreRate = fullScore ? Math.round((score / fullScore) * 100) : 0
  const wrong = questions.filter((item) => !item.isCorrect)
  const causeCounts = causeLabels.map((cause) => ({ label: cause, value: wrong.filter((item) => item.errorCause === cause).length })).filter((item) => item.value)
  const pointCounts = [...new Set(wrong.map((item) => item.knowledgePointName))].map((name) => ({ label: name, value: wrong.filter((item) => item.knowledgePointName === name).reduce((sum, item) => sum + (item.fullScore - item.score), 0) }))

  const save = () => {
    if (!questions.length || !analysisReady) return
    const mainCauses = causeCounts.sort((a, b) => b.value - a.value).slice(0, 3).map((item) => item.label as ErrorCause)
    const weakKnowledgePoints = pointCounts.sort((a, b) => b.value - a.value).slice(0, 4).map((item) => item.label)
    const paper: PaperRecord = {
      id: crypto.randomUUID(), title, subject, date, fullScore, score, imageDataUrls: images.map((item) => item.data), questions,
      summary: { scoreRate, mainCauses, weakKnowledgePoints, weakChapters: [title], suggestions: [
        weakKnowledgePoints.length ? `优先订正：${weakKnowledgePoints.slice(0, 2).join('、')}` : '保持当前知识掌握',
        mainCauses.length ? `重点减少“${mainCauses[0]}”类错误` : '继续保持审题与步骤完整',
        '48 小时内完成错题第一次复习，并在一周内安排同类题训练。',
      ] }, createdAt: new Date().toISOString(),
    }
    addPaper(paper)
    setStatus('saved')
  }

  return (
    <div>
      <PageHeader eyebrow="试卷 → 错题 → 画像" title="试卷分析" description="上传试卷后逐题确认，系统会把失分题拆入错题本，并生成薄弱点和后续学习建议。" actions={<Button variant="secondary" onClick={() => { setImages([]); setQuestions([]); setStatus('idle'); setAnalysisReady(false) }}><Plus size={17} />新建分析</Button>} />

      <div className="content-grid upload-grid">
        <Card>
          <SectionTitle title="1. 试卷基本信息" />
          <div className="form-stack">
            <label>试卷名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <div className="form-row two"><label>科目<select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label><label>考试日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
          </div>
          <SectionTitle title="2. 上传试卷图片" description="最多 6 张，建议按页码顺序上传。" />
          <div className="paper-image-grid">
            {images.map((image, index) => <div key={`${image.name}-${index}`}><img src={image.data} alt={`试卷第 ${index + 1} 页`} /><button onClick={() => setImages((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button><span>第 {index + 1} 页</span></div>)}
            {images.length < 6 && <button className="paper-add-image" onClick={() => inputRef.current?.click()}><Upload size={23} /><strong>添加试卷图片</strong><span>JPG / PNG / WEBP</span></button>}
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(event) => void handleFiles(event.target.files)} />
          </div>
          <Button className="full-width" onClick={() => void recognize()} disabled={!images.length || status === 'loading'}>{status === 'loading' ? <LoaderCircle className="spin" size={18} /> : <FileSearch size={18} />}{status === 'loading' ? '正在模拟识别多道题…' : '识别试卷并拆分题目'}</Button>
        </Card>

        <Card>
          <SectionTitle title="历史试卷" description="已保存的分析会保留在浏览器中" />
          {state.papers.length ? <div className="paper-history">{state.papers.slice(0, 5).map((paper) => <div key={paper.id}><span className="paper-icon"><FileImage size={19} /></span><div><strong>{paper.title}</strong><span>{paper.subject} · {paper.date}</span></div><Badge tone={paper.summary.scoreRate >= 80 ? 'success' : paper.summary.scoreRate >= 60 ? 'warning' : 'danger'}>{paper.score}/{paper.fullScore}</Badge></div>)}</div> : <EmptyState title="还没有试卷记录" description="完成首次试卷分析后，趋势和薄弱章节会出现在这里。" />}
          <Callout title="当前阶段如何体验">上传任意清晰图片后，系统使用模拟 OCR 拆出示例题目。你可以修改所有识别字段，验证完整业务流程。</Callout>
        </Card>
      </div>

      {status === 'loading' && <Card><LoadingState text="正在识别题号、知识点、得分和答案区域…" /></Card>}

      {questions.length > 0 && (
        <Card>
          <SectionTitle title="3. 逐题确认" description="只有确认后的数据才会进入试卷分析和错题本。" action={<Badge tone="warning">{wrong.length} 道失分题</Badge>} />
          <div className="table-scroll">
            <table className="data-table paper-table">
              <thead><tr><th>题号</th><th>知识点</th><th>题目摘要</th><th>得分</th><th>学生答案</th><th>正确答案</th><th>错因</th></tr></thead>
              <tbody>{questions.map((item) => <tr key={item.id} className={item.isCorrect ? '' : 'row-warning'}>
                <td><input className="mini-input" value={item.questionNo} onChange={(event) => updateQuestion(item.id, { questionNo: event.target.value })} /></td>
                <td><input value={item.knowledgePointName} onChange={(event) => updateQuestion(item.id, { knowledgePointName: event.target.value, knowledgePointId: `kp-${subject}-${event.target.value}` })} /></td>
                <td><input value={item.content} onChange={(event) => updateQuestion(item.id, { content: event.target.value })} /></td>
                <td><div className="score-input"><input type="number" min="0" max={item.fullScore} value={item.score} onChange={(event) => updateQuestion(item.id, { score: Number(event.target.value) })} /><span>/</span><input type="number" min="1" value={item.fullScore} onChange={(event) => updateQuestion(item.id, { fullScore: Number(event.target.value) })} /></div></td>
                <td><input value={item.studentAnswer} onChange={(event) => updateQuestion(item.id, { studentAnswer: event.target.value })} /></td>
                <td><input value={item.correctAnswer} onChange={(event) => updateQuestion(item.id, { correctAnswer: event.target.value })} /></td>
                <td>{item.isCorrect ? <Badge tone="success"><Check size={13} />正确</Badge> : <select value={item.errorCause || '知识点不会'} onChange={(event) => updateQuestion(item.id, { errorCause: event.target.value as ErrorCause })}>{causeLabels.map((cause) => <option key={cause}>{cause}</option>)}</select>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="confirm-row"><div><strong>确认本次得分：{score} / {fullScore}</strong><span>确认后生成失分分布、主要错因和学习建议。</span></div><Button onClick={() => setAnalysisReady(true)}><BarChart3 size={18} />生成试卷分析</Button></div>
        </Card>
      )}

      {analysisReady && (
        <div className="stack">
          <div className="stats-grid four paper-stats">
            <Card><span>总分</span><strong>{score}/{fullScore}</strong><ProgressBar value={scoreRate} /></Card>
            <Card><span>得分率</span><strong>{scoreRate}%</strong><Badge tone={scoreRate >= 80 ? 'success' : scoreRate >= 60 ? 'warning' : 'danger'}>{scoreRate >= 80 ? '表现良好' : scoreRate >= 60 ? '需要巩固' : '优先补弱'}</Badge></Card>
            <Card><span>失分题</span><strong>{wrong.length}</strong><p>将自动进入错题本</p></Card>
            <Card><span>薄弱知识点</span><strong>{pointCounts.length}</strong><p>按失分值排序</p></Card>
          </div>
          <div className="content-grid two-equal">
            <Card><SectionTitle title="失分知识点" description="按累计失分值排序" />{pointCounts.length ? <BarList items={pointCounts.sort((a, b) => b.value - a.value)} /> : <EmptyState title="没有失分知识点" description="本次试卷全部答对。" />}</Card>
            <Card><SectionTitle title="主要错因" description="用于调整下一步训练方式" />{causeCounts.length ? <BarList items={causeCounts.sort((a, b) => b.value - a.value)} /> : <EmptyState title="没有错因记录" description="请检查逐题得分设置。" />}</Card>
          </div>
          <Card className="analysis-suggestion-card">
            <SectionTitle title="后续学习建议" />
            <div className="suggestion-grid">
              <div><span>01</span><strong>优先订正</strong><p>{pointCounts.sort((a, b) => b.value - a.value).slice(0, 2).map((item) => item.label).join('、') || '保持当前节奏'}</p></div>
              <div><span>02</span><strong>错因改进</strong><p>{causeCounts.sort((a, b) => b.value - a.value)[0]?.label ? `重点减少“${causeCounts.sort((a, b) => b.value - a.value)[0].label}”` : '继续保持步骤完整'}</p></div>
              <div><span>03</span><strong>复习节奏</strong><p>24–48 小时内完成第一次订正，一周内完成同类题训练。</p></div>
            </div>
            <div className="save-paper-row"><div><strong>保存后将自动联动</strong><span>错题本、学习画像、每日复习和后续模拟训练</span></div>{status === 'saved' ? <Badge tone="success"><Check size={15} />已保存</Badge> : <Button onClick={save}><Save size={18} />保存分析并生成任务</Button>}</div>
          </Card>
        </div>
      )}
    </div>
  )
}
