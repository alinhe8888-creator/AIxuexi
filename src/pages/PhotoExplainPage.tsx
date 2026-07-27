import {
  Check,
  ChevronDown,
  ChevronRight,
  FileImage,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { AdaptiveCorrectionPanel } from '../components/AdaptiveCorrectionPanel'
import { Badge, Button, Callout, Card, LoadingState, PageHeader, SectionTitle } from '../components/ui'
import { learningApi } from '../services'
import { useAppStore } from '../store/useAppStore'
import type { AiExplanation, ErrorCause, QuestionFormat, QuestionRecord, Subject } from '../types'
import { compressImage } from '../utils/image'
import { causeLabels } from '../utils/learning'

const subjects: Subject[] = ['语文', '数学', '英语', '历史', '地理', '政治']
const flowSteps = ['上传图片', '确认题目', '先入错题本', '两轮订正', '迁移检测', '保存讲法']

export function PhotoExplainPage() {
  const {
    state,
    saveMistake,
    updateMistakeDetails,
    notify,
  } = useAppStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [subject, setSubject] = useState<Subject>('数学')
  const [image, setImage] = useState('')
  const [imageKey, setImageKey] = useState('')
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
  const [questionId, setQuestionId] = useState('')
  const [mistakeId, setMistakeId] = useState('')
  const [primaryCause, setPrimaryCause] = useState<ErrorCause>('知识点不会')
  const [secondaryCause, setSecondaryCause] = useState<ErrorCause | ''>('')
  const [note, setNote] = useState('')
  const [completed, setCompleted] = useState(false)

  const currentStep = useMemo(() => {
    if (completed) return 5
    if (explanation) return 3
    if (mistakeId) return 2
    if (ocrStatus === 'done') return 1
    return 0
  }, [completed, explanation, mistakeId, ocrStatus])

  const preferredStyles = useMemo(() => (
    [...state.strategyPreferences]
      .filter((item) => !item.subject || item.subject === subject)
      .sort((left, right) => {
        const leftRate = left.usedCount ? left.successCount / left.usedCount : 0
        const rightRate = right.usedCount ? right.successCount / right.usedCount : 0
        return rightRate - leftRate
      })
      .slice(0, 4)
      .map((item) => item.style)
  ), [state.strategyPreferences, subject])

  const handleFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('error', '请选择图片文件')
    try {
      const compressed = await compressImage(file)
      setImage(compressed)
      setFileName(file.name)
      setImageKey('')
      setOcrStatus('idle')
      setExplanation(null)
      setQuestionId('')
      setMistakeId('')
      setCompleted(false)
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
      setImageKey(result.imageKey || '')
      setContent(result.content)
      setChapter(result.chapter)
      setKnowledgePoint(result.knowledgePointName)
      setCorrectAnswer(result.correctAnswer)
      setFormat(result.questionFormat)
      setOcrStatus('done')
      notify('success', '题目识别完成', '请核对题干和知识点，答案已锁定，不会提前展示。')
    } catch (error) {
      setOcrStatus('error')
      setOcrError(error instanceof Error ? error.message : '识别失败')
    }
  }

  const buildQuestion = (id: string, ai?: AiExplanation): QuestionRecord => ({
    id,
    subject,
    chapter: chapter || '待分类章节',
    knowledgePointId: `kp-${subject}-${knowledgePoint || '待识别'}`.replace(/\s+/g, '-'),
    knowledgePointName: knowledgePoint || '待识别知识点',
    content,
    imageKey: imageKey || undefined,
    studentAnswer,
    correctAnswer: correctAnswer || ai?.finalAnswer || '',
    questionFormat: format,
    sourceType: 'user_upload',
    explanation: ai,
    createdAt: new Date().toISOString(),
  })

  const beginCorrection = async () => {
    if (!content.trim() || !knowledgePoint.trim()) return notify('error', '请先确认题目和知识点')
    if (!studentAnswer.trim()) return notify('info', '请填写你当时的答案或关键步骤', '系统需要根据原答案判断卡点。')

    const nextQuestionId = questionId || crypto.randomUUID()
    setQuestionId(nextQuestionId)
    const initialMistakeId = saveMistake({
      question: buildQuestion(nextQuestionId),
      studentAnswer,
      primaryCause,
      secondaryCause: secondaryCause || undefined,
      note,
    })
    setMistakeId(initialMistakeId)
    setAiLoading(true)
    try {
      const result = await learningApi.ai.explainQuestion({
        subject,
        content,
        correctAnswer,
        studentAnswer,
        preferredStyles,
      })
      setExplanation(result)
      setPrimaryCause(result.diagnosis.likelyCause)
      updateMistakeDetails(initialMistakeId, { primaryCause: result.diagnosis.likelyCause })
      saveMistake({
        question: buildQuestion(nextQuestionId, result),
        studentAnswer,
        primaryCause: result.diagnosis.likelyCause,
        secondaryCause: secondaryCause || undefined,
        note,
      })
      notify('success', '已进入订正流程', '系统会先给提示，再换讲法；两次仍不会才显示答案。')
    } catch (error) {
      notify('error', '讲解生成失败', error instanceof Error ? error.message : '题目已经留在错题本，可稍后继续订正。')
    } finally {
      setAiLoading(false)
    }
  }

  const reset = () => {
    setImage('')
    setImageKey('')
    setFileName('')
    setOcrStatus('idle')
    setOcrError('')
    setContent('')
    setChapter('')
    setKnowledgePoint('')
    setCorrectAnswer('')
    setStudentAnswer('')
    setExplanation(null)
    setQuestionId('')
    setMistakeId('')
    setPrimaryCause('知识点不会')
    setSecondaryCause('')
    setNote('')
    setCompleted(false)
  }

  return (
    <div>
      <PageHeader
        eyebrow="自适应错题订正"
        title="拍题讲解"
        description="先把错误留进错题本，再通过两轮作答、换讲法和迁移检测真正学会。"
        actions={<Button variant="secondary" onClick={reset}><RotateCcw size={17} />重新开始</Button>}
      />

      <Card className="flow-steps flow-steps--adaptive">
        {flowSteps.map((item, index) => (
          <div key={item} className={`${index <= currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`}>
            <span>{index < currentStep ? <Check size={16} /> : index + 1}</span>
            <strong>{item}</strong>
            {index < flowSteps.length - 1 && <ChevronRight size={17} />}
          </div>
        ))}
      </Card>

      <div className="content-grid upload-grid">
        <Card>
          <SectionTitle title="1. 上传题目图片" description="图片写入家庭私有 R2，由 Qwen 理解题干、公式、图表和上下文。" />
          <div
            className={`upload-zone ${image ? 'has-image' : ''}`}
            onClick={() => !image && inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); void handleFile(event.dataTransfer.files[0]) }}
          >
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
            {image ? (
              <>
                <img src={image} alt="题目预览" />
                <button className="image-remove" onClick={(event) => { event.stopPropagation(); setImage(''); setImageKey(''); setOcrStatus('idle') }}><X size={17} /></button>
                <div className="image-caption"><FileImage size={16} />{fileName}</div>
              </>
            ) : (
              <>
                <div className="upload-icon"><Upload size={28} /></div>
                <strong>点击上传或拖入题目图片</strong>
                <p>建议保证题目完整、文字清晰、画面端正</p>
              </>
            )}
          </div>
          <div className="form-row two">
            <label>科目<select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
            <label>题型<select value={format} onChange={(event) => setFormat(event.target.value as QuestionFormat)}>{['选择题', '填空题', '判断题', '解答题', '默写题'].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
          </div>
          <Button className="full-width" onClick={() => void recognize()} disabled={!image || ocrStatus === 'loading'}>
            {ocrStatus === 'loading' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
            {ocrStatus === 'loading' ? '正在识别题目…' : '开始识别题目'}
          </Button>
          {ocrStatus === 'error' && (
            <Callout tone="danger" title="识别失败">
              {ocrError}
              <div className="inline-actions">
                <Button size="sm" variant="secondary" onClick={() => void recognize()}>重新识别</Button>
                <Button size="sm" variant="ghost" onClick={() => { setOcrStatus('done'); setContent('') }}>手动录入</Button>
              </div>
            </Callout>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="2. 确认题目和原答案"
            description="只核对题干、章节和知识点；参考答案会锁定到第二次订正失败之后。"
            action={ocrStatus === 'done' ? <Badge tone="success">可人工修改题干</Badge> : <Badge>等待识别</Badge>}
          />
          {ocrStatus === 'loading' ? <LoadingState text="Qwen 正在理解题目、章节和知识点…" /> : (
            <div className="form-stack">
              <label>题目内容<textarea rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder="识别结果会显示在这里，也可以直接手动输入题目。" /></label>
              <div className="form-row two">
                <label>章节<input value={chapter} onChange={(event) => setChapter(event.target.value)} placeholder="例如：函数与导数" /></label>
                <label>知识点<input value={knowledgePoint} onChange={(event) => setKnowledgePoint(event.target.value)} placeholder="例如：导数的几何意义" /></label>
              </div>
              <label>你的原答案<textarea rows={3} value={studentAnswer} onChange={(event) => setStudentAnswer(event.target.value)} placeholder="写下当时的答案、算式或卡住的位置。" /></label>
              <div className="locked-answer-row"><LockKeyhole size={18} /><div><strong>参考答案已锁定</strong><p>不会在提交后直接展示；前两次只给提示和换讲法。</p></div></div>
              <Button onClick={() => void beginCorrection()} disabled={!content.trim() || !studentAnswer.trim() || aiLoading || Boolean(explanation)}>
                {aiLoading ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                {aiLoading ? '正在分析卡点并准备多种讲法…' : mistakeId ? '继续生成订正讲解' : '先入错题本并开始订正'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {mistakeId && !explanation && aiLoading && (
        <Card className="adaptive-waiting-card"><LoaderCircle className="spin" size={24} /><div><strong>错题已保存</strong><p>AI 正在根据原答案判断卡点，并准备至少三种不同讲法。</p></div></Card>
      )}

      {explanation && (
        <>
          <AdaptiveCorrectionPanel
            mistakeId={mistakeId}
            subject={subject}
            question={content}
            correctAnswer={correctAnswer || explanation.finalAnswer}
            knowledgePointName={knowledgePoint}
            explanation={explanation}
            initialAnswer=""
            onCompleted={() => setCompleted(true)}
          />

          <Card className="adaptive-note-card">
            <SectionTitle title="错因与订正笔记" description="AI 会根据作答动态更新错因，你也可以人工修正。" />
            <div className="cause-selector">
              {causeLabels.map((cause) => (
                <button
                  key={cause}
                  className={primaryCause === cause ? 'active' : ''}
                  onClick={() => {
                    setPrimaryCause(cause)
                    updateMistakeDetails(mistakeId, { primaryCause: cause })
                  }}
                >
                  {primaryCause === cause && <Check size={15} />}{cause}
                </button>
              ))}
            </div>
            <div className="form-row two">
              <label>次要错因<select value={secondaryCause} onChange={(event) => { const next = event.target.value as ErrorCause | ''; setSecondaryCause(next); updateMistakeDetails(mistakeId, { secondaryCause: next || undefined }) }}><option value="">无</option>{causeLabels.filter((item) => item !== primaryCause).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label>我的订正笔记<textarea rows={3} value={note} onChange={(event) => { setNote(event.target.value); updateMistakeDetails(mistakeId, { note: event.target.value }) }} placeholder="写下以后如何识别同类题、避免同类错误。" /></label>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
