import { Check, ChevronDown, ChevronRight, FileImage, Lightbulb, LoaderCircle, RotateCcw, Save, Sparkles, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Badge, Button, Callout, Card, LoadingState, PageHeader, ProgressBar, SectionTitle } from '../components/ui'
import { learningApi } from '../services'
import { useAppStore } from '../store/useAppStore'
import type { AiExplanation, ErrorCause, QuestionFormat, QuestionRecord, Subject } from '../types'
import { compressImage } from '../utils/image'
import { causeLabels } from '../utils/learning'

const subjects: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
const steps = ['上传图片', '确认题目', '分步讲解', '错因分析', '保存闭环']

export function PhotoExplainPage() {
  const { saveMistake, notify } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [subject, setSubject] = useState<Subject>('数学')
  const [image, setImage] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [ocrError, setOcrError] = useState('')
  const [content, setContent] = useState('')
  const [chapter, setChapter] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [studentAnswer, setStudentAnswer] = useState('')
  const [format, setFormat] = useState<QuestionFormat>('解答题')
  const [explanation, setExplanation] = useState<AiExplanation | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [revealCount, setRevealCount] = useState(0)
  const [primaryCause, setPrimaryCause] = useState<ErrorCause>('知识点不会')
  const [secondaryCause, setSecondaryCause] = useState<ErrorCause | ''>('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [instantOpen, setInstantOpen] = useState(false)
  const [instantAnswer, setInstantAnswer] = useState('')
  const [instantChecked, setInstantChecked] = useState(false)

  const currentStep = useMemo(() => {
    if (saved) return 4
    if (explanation) return 3
    if (ocrStatus === 'done') return 1
    return 0
  }, [saved, explanation, ocrStatus])

  const handleFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify('error', '请选择图片文件')
      return
    }
    try {
      const compressed = await compressImage(file)
      setImage(compressed)
      setFileName(file.name)
      setOcrStatus('idle')
      setExplanation(null)
      setSaved(false)
    } catch (error) {
      notify('error', '图片处理失败', error instanceof Error ? error.message : '请重新选择图片')
    }
  }

  const recognize = async () => {
    if (!image) return notify('info', '请先上传题目图片')
    setOcrStatus('loading')
    setOcrError('')
    try {
      const result = await learningApi.ocr.recognizeQuestion({ subject, imageDataUrl: image, fileName })
      setContent(result.content)
      setChapter(result.chapter)
      setKnowledgePoint(result.knowledgePointName)
      setCorrectAnswer(result.correctAnswer)
      setFormat(result.questionFormat)
      setOcrStatus('done')
      notify('success', '题目识别完成', '请检查题目文字并手动修正识别错误。')
    } catch (error) {
      setOcrStatus('error')
      setOcrError(error instanceof Error ? error.message : '识别失败')
    }
  }

  const explain = async () => {
    if (!content.trim() || !knowledgePoint.trim()) return notify('error', '请先确认题目和知识点')
    setAiLoading(true)
    try {
      const result = await learningApi.ai.explainQuestion({ subject, content, correctAnswer })
      setExplanation(result)
      setRevealCount(0)
      notify('success', 'AI 讲解已生成', '答案不会直接展开，请按步骤查看。')
    } catch {
      notify('error', '讲解生成失败', '请稍后重试。')
    } finally {
      setAiLoading(false)
    }
  }

  const save = () => {
    if (!explanation) return
    const question: QuestionRecord = {
      id: crypto.randomUUID(), subject, chapter, knowledgePointId: `kp-${subject}-${knowledgePoint}`.replace(/\s+/g, '-'), knowledgePointName: knowledgePoint,
      content, imageDataUrl: image, studentAnswer, correctAnswer: correctAnswer || explanation.finalAnswer, questionFormat: format, sourceType: 'user_upload', explanation, createdAt: new Date().toISOString(),
    }
    saveMistake({ question, studentAnswer, primaryCause, secondaryCause: secondaryCause || undefined, note })
    setSaved(true)
  }

  const reset = () => {
    setImage(''); setFileName(''); setOcrStatus('idle'); setContent(''); setChapter(''); setKnowledgePoint(''); setCorrectAnswer(''); setStudentAnswer(''); setExplanation(null); setRevealCount(0); setSaved(false); setInstantOpen(false); setInstantChecked(false); setInstantAnswer('')
  }

  return (
    <div>
      <PageHeader eyebrow="AI 分步讲题" title="拍题讲解" description="上传错题图片，先确认识别结果，再按提示一步步理解。系统会在最后分析错因并安排复习。" actions={<Button variant="secondary" onClick={reset}><RotateCcw size={17} />重新开始</Button>} />

      <Card className="flow-steps">
        {steps.map((item, index) => <div key={item} className={`${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`}><span>{index < currentStep ? <Check size={16} /> : index + 1}</span><strong>{item}</strong>{index < steps.length - 1 && <ChevronRight size={17} />}</div>)}
      </Card>

      <div className="content-grid upload-grid">
        <Card>
          <SectionTitle title="1. 上传题目图片" description="支持 JPG、PNG、WEBP；图片仅保存在当前浏览器本地。" />
          <div className={`upload-zone ${image ? 'has-image' : ''}`} onClick={() => !image && inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files[0]) }}>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
            {image ? <><img src={image} alt="题目预览" /><button className="image-remove" onClick={(event) => { event.stopPropagation(); setImage(''); setOcrStatus('idle') }}><X size={17} /></button><div className="image-caption"><FileImage size={16} />{fileName}</div></> : <><div className="upload-icon"><Upload size={28} /></div><strong>点击上传或拖入题目图片</strong><p>建议保证题目完整、文字清晰、画面端正</p></>}
          </div>
          <div className="form-row two">
            <label>科目<select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
            <label>题型<select value={format} onChange={(event) => setFormat(event.target.value as QuestionFormat)}>{['选择题', '填空题', '判断题', '解答题', '默写题'].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
          </div>
          <Button className="full-width" onClick={() => void recognize()} disabled={!image || ocrStatus === 'loading'}>{ocrStatus === 'loading' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{ocrStatus === 'loading' ? '正在识别题目…' : '开始识别题目'}</Button>
          {ocrStatus === 'error' && <Callout tone="danger" title="识别失败">{ocrError}<div className="inline-actions"><Button size="sm" variant="secondary" onClick={() => void recognize()}>重新识别</Button><Button size="sm" variant="ghost" onClick={() => { setOcrStatus('done'); setContent(''); }}>手动录入</Button></div></Callout>}
        </Card>

        <Card>
          <SectionTitle title="2. 确认识别结果" description="OCR 可能出错，进入讲解前请检查并修改。" action={ocrStatus === 'done' ? <Badge tone="success">可人工修改</Badge> : <Badge>等待识别</Badge>} />
          {ocrStatus === 'loading' ? <LoadingState text="正在提取题目文字和知识点…" /> : (
            <div className="form-stack">
              <label>题目内容<textarea rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder="识别结果会显示在这里，也可以直接手动输入题目。" /></label>
              <div className="form-row two"><label>章节<input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="例如：函数与导数" /></label><label>知识点<input value={knowledgePoint} onChange={(event) => setKnowledgePoint(event.target.value)} placeholder="例如：导数的几何意义" /></label></div>
              <label>你的原答案<textarea rows={2} value={studentAnswer} onChange={(event) => setStudentAnswer(event.target.value)} placeholder="填写你当时的答案，便于判断错因。" /></label>
              <label>参考答案（可修改）<textarea rows={2} value={correctAnswer} onChange={(event) => setCorrectAnswer(event.target.value)} placeholder="由后端识别或知识库返回，请在保存前核对。" /></label>
              <Button onClick={() => void explain()} disabled={!content.trim() || aiLoading}>{aiLoading ? <LoaderCircle className="spin" size={18} /> : <BrainIcon />}{aiLoading ? '正在生成分步讲解…' : '确认题目并开始讲解'}</Button>
            </div>
          )}
        </Card>
      </div>

      {explanation && (
        <Card className="explanation-card">
          <SectionTitle title="3. AI 分步骤讲解" description="先看思路和提示，确实需要时再展开下一步。" action={<div className="badge-row">{explanation.knowledgePoints.map((item) => <Badge tone="primary" key={item}>{item}</Badge>)}</div>} />
          <div className="hint-panel"><Lightbulb size={22} /><div><strong>先看解题思路</strong><p>{explanation.thinking}</p></div></div>
          <div className="reveal-progress"><ProgressBar value={(revealCount / (explanation.steps.length + 1)) * 100} label={`已查看 ${revealCount} / ${explanation.steps.length + 1} 个阶段`} /></div>
          <div className="explain-steps">
            {explanation.steps.slice(0, revealCount).map((step, index) => <div key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.content}</p></div></div>)}
            {revealCount > explanation.steps.length && <div className="final-answer"><Check size={20} /><div><strong>最终答案</strong><p>{explanation.finalAnswer}</p></div></div>}
          </div>
          <div className="explain-actions">
            {revealCount === 0 && <Button onClick={() => setRevealCount(1)}>只看第一个提示<ChevronRight size={17} /></Button>}
            {revealCount > 0 && revealCount <= explanation.steps.length && <Button onClick={() => setRevealCount((value) => value + 1)}>查看下一步<ChevronRight size={17} /></Button>}
            {revealCount <= explanation.steps.length && <Button variant="secondary" onClick={() => setRevealCount(explanation.steps.length + 1)}>查看完整答案</Button>}
          </div>
          {revealCount > explanation.steps.length && (
            <div className="after-answer-grid">
              <div><h3>容易出错的地方</h3><ul>{explanation.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h3>生活化理解</h3><p>{explanation.lifeExample}</p></div>
            </div>
          )}
        </Card>
      )}

      {explanation && revealCount > explanation.steps.length && (
        <div className="content-grid main-side">
          <Card>
            <SectionTitle title="4. 错因分析" description="系统给出建议，但最终由你确认。" />
            <div className="cause-selector">
              {causeLabels.map((cause) => <button key={cause} className={primaryCause === cause ? 'active' : ''} onClick={() => setPrimaryCause(cause)}>{primaryCause === cause && <Check size={15} />}{cause}</button>)}
            </div>
            <div className="form-stack">
              <label>次要错因（可选）<select value={secondaryCause} onChange={(event) => setSecondaryCause(event.target.value as ErrorCause | '')}><option value="">无</option>{causeLabels.filter((item) => item !== primaryCause).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>我的订正笔记<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="写下以后如何避免同类错误…" /></label>
            </div>
          </Card>
          <Card>
            <SectionTitle title="即时检测题" description="用一道新题验证是否真的理解。" />
            {!instantOpen ? <div className="instant-locked"><Lightbulb size={28} /><p>不要只觉得“看懂了”，做一道题才能验证。</p><Button onClick={() => setInstantOpen(true)}>开始即时检测</Button></div> : <div className="instant-check"><strong>{explanation.instantCheck.question}</strong><textarea rows={3} value={instantAnswer} onChange={(event) => setInstantAnswer(event.target.value)} placeholder="输入答案或关键步骤…" disabled={instantChecked} />{!instantChecked ? <Button onClick={() => setInstantChecked(true)} disabled={!instantAnswer.trim()}>检查答案</Button> : <Callout tone={instantAnswer.trim().toLowerCase() === explanation.instantCheck.answer.trim().toLowerCase() ? 'success' : 'warning'} title={`参考答案：${explanation.instantCheck.answer}`}>{explanation.instantCheck.explanation}</Callout>}</div>}
          </Card>
        </div>
      )}

      {explanation && revealCount > explanation.steps.length && (
        <Card className="save-closure-card">
          <div><Save size={25} /><div><h3>保存后将完成学习闭环</h3><p>错题本、知识点掌握度、复习任务和首页计划会同步更新。</p></div></div>
          {saved ? <Badge tone="success"><Check size={15} />已保存并安排复习</Badge> : <Button onClick={save}><Save size={18} />保存到错题本</Button>}
        </Card>
      )}
    </div>
  )
}

function BrainIcon() {
  return <Sparkles size={18} />
}
