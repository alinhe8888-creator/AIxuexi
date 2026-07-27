import {
  Brain,
  Check,
  ChevronRight,
  EyeOff,
  Lightbulb,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { learningApi } from '../services/learningApi'
import { useAppStore } from '../store/useAppStore'
import type {
  AiExplanation,
  AnswerAssessment,
  ExplanationMethod,
  Subject,
} from '../types'

interface AdaptiveCorrectionPanelProps {
  mistakeId?: string
  subject: Subject
  question: string
  correctAnswer: string
  knowledgePointName: string
  explanation: AiExplanation
  initialAnswer?: string
  onCompleted?: (passed: boolean) => void
  compact?: boolean
}

function methodScore(
  method: ExplanationMethod,
  subject: Subject,
  preferences: ReturnType<typeof useAppStore>['state']['strategyPreferences'],
) {
  const preference = preferences.find((item) => item.subject === subject && item.style === method.style)
  if (!preference?.usedCount) return 0
  return (preference.successCount / preference.usedCount) * 70 + (preference.totalScore / preference.usedCount) * 0.3
}

export function AdaptiveCorrectionPanel({
  mistakeId,
  subject,
  question,
  correctAnswer,
  knowledgePointName,
  explanation,
  initialAnswer = '',
  onCompleted,
  compact = false,
}: AdaptiveCorrectionPanelProps) {
  const {
    state,
    setCorrectionMethod,
    recordCorrectionAttempt,
    completeCorrection,
    notify,
  } = useAppStore()
  const mistake = mistakeId ? state.mistakes.find((item) => item.id === mistakeId) : undefined
  const persistedAttempts = mistake?.correction?.attempts || []
  const preferredMethod = useMemo(() => {
    const ranked = [...explanation.methods].sort(
      (left, right) => methodScore(right, subject, state.strategyPreferences) - methodScore(left, subject, state.strategyPreferences),
    )
    return ranked[0]?.id || explanation.recommendedMethodId || explanation.methods[0]?.id || ''
  }, [explanation.methods, explanation.recommendedMethodId, state.strategyPreferences, subject])

  const [methodId, setMethodId] = useState(
    mistake?.correction?.currentMethodId || mistake?.correction?.preferredMethodId || preferredMethod,
  )
  const [answer, setAnswer] = useState(initialAnswer)
  const [checking, setChecking] = useState(false)
  const [assessment, setAssessment] = useState<AnswerAssessment | null>(null)
  const [hintCount, setHintCount] = useState(0)
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [answerRevealed, setAnswerRevealed] = useState(mistake?.correction?.finalAnswerRevealed || false)
  const [transferAnswer, setTransferAnswer] = useState('')
  const [transferAssessment, setTransferAssessment] = useState<AnswerAssessment | null>(null)
  const [transferAttempts, setTransferAttempts] = useState(0)
  const [transferChecking, setTransferChecking] = useState(false)
  const [selfExplanation, setSelfExplanation] = useState(mistake?.correction?.selfExplanation || '')
  const [bestMethodId, setBestMethodId] = useState(mistake?.correction?.preferredMethodId || methodId)
  const [finished, setFinished] = useState(mistake?.correction?.status === '已验证')

  const activeMethod = explanation.methods.find((item) => item.id === methodId) || explanation.methods[0]
  const revealAfterAttempts = Math.max(2, state.settings.answerRevealAttempts || explanation.answerRevealAfterAttempts || 2)
  const attemptNumber = persistedAttempts.length + 1
  const firstWrong = persistedAttempts.length >= 1 && !persistedAttempts.at(-1)?.correct
  const secondWrong = persistedAttempts.length >= revealAfterAttempts && !persistedAttempts.at(-1)?.correct
  const originalCorrect = Boolean(persistedAttempts.at(-1)?.correct || assessment?.correct)
  const canShowSolution = answerRevealed || secondWrong || originalCorrect
  const showTransfer = canShowSolution || originalCorrect

  useEffect(() => {
    if (!methodId && explanation.methods[0]?.id) setMethodId(explanation.methods[0].id)
  }, [explanation.methods, methodId])

  useEffect(() => {
    if (mistakeId && methodId && mistake?.correction?.status !== '已验证') setCorrectionMethod(mistakeId, methodId)
  // setCorrectionMethod is intentionally omitted: store actions are recreated with provider renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodId, mistake?.correction?.status, mistakeId])

  if (!activeMethod) {
    return <div className="adaptive-empty">暂时没有可用讲解方法，请重新生成讲解。</div>
  }

  const switchMethod = (targetId?: string) => {
    const tried = new Set([...(mistake?.correction?.triedMethodIds || []), methodId])
    const target = explanation.methods.find((item) => item.id === targetId)
      || explanation.methods.find((item) => !tried.has(item.id))
      || explanation.methods.find((item) => item.id !== methodId)
      || activeMethod
    setMethodId(target.id)
    setBestMethodId(target.id)
    setHintCount(0)
    setVisibleSteps(firstWrong ? 1 : 0)
    setAssessment(null)
    notify('info', '已换一种讲法', `${target.name}：${target.bestFor}`)
  }

  const checkOriginalAnswer = async () => {
    if (!answer.trim()) return notify('info', '先写下你的答案或关键步骤')
    setChecking(true)
    try {
      const revealAllowed = attemptNumber >= revealAfterAttempts
      const result = await learningApi.ai.assessAnswer({
        subject,
        content: question,
        correctAnswer,
        studentAnswer: answer,
        attemptNumber,
        methodId: activeMethod.id,
        methodName: activeMethod.name,
        methodStyle: activeMethod.style,
        revealAllowed,
      })
      setAssessment(result)
      if (mistakeId) {
        recordCorrectionAttempt(mistakeId, {
          attemptNumber,
          answer,
          methodId: activeMethod.id,
          correct: result.correct,
          score: result.score,
          feedback: result.feedback,
          errorCause: result.errorCause,
        })
      }
      if (result.correct) {
        setVisibleSteps(activeMethod.steps.length)
        notify('success', '这次答对了', '还要完成一道迁移检测，确认不是只记住原题。')
        return
      }
      if (result.nextAction === 'reveal' || result.revealAnswer) {
        setAnswerRevealed(true)
        setVisibleSteps(activeMethod.steps.length)
        return
      }
      setVisibleSteps((value) => Math.max(value, 1))
      if (result.nextAction === 'switch_method') switchMethod(result.suggestedMethodId)
    } catch (error) {
      notify('error', '答案判断失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setChecking(false)
    }
  }

  const checkTransfer = async () => {
    if (!transferAnswer.trim()) return notify('info', '先完成迁移检测题')
    setTransferChecking(true)
    try {
      const nextAttempt = transferAttempts + 1
      const result = await learningApi.ai.assessAnswer({
        subject,
        content: explanation.instantCheck.question,
        correctAnswer: explanation.instantCheck.answer,
        studentAnswer: transferAnswer,
        attemptNumber: nextAttempt,
        methodId: activeMethod.id,
        methodName: activeMethod.name,
        methodStyle: activeMethod.style,
        revealAllowed: nextAttempt >= 2,
        transfer: true,
      })
      setTransferAttempts(nextAttempt)
      setTransferAssessment(result)
    } catch (error) {
      notify('error', '迁移检测失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setTransferChecking(false)
    }
  }

  const finish = () => {
    const bestMethod = explanation.methods.find((item) => item.id === bestMethodId) || activeMethod
    if (selfExplanation.trim().length < 8) {
      notify('info', '请先用自己的话总结', '至少写一句你现在真正理解的关键。')
      return
    }
    const passed = Boolean(transferAssessment?.correct)
    if (mistakeId) {
      completeCorrection(mistakeId, {
        methodId: bestMethod.id,
        style: bestMethod.style,
        methodName: bestMethod.name,
        transferPassed: passed,
        transferScore: transferAssessment?.score,
        selfExplanation: selfExplanation.trim(),
        finalAnswerRevealed: answerRevealed || secondWrong,
      })
    }
    if (!passed) {
      setTransferAnswer('')
      setTransferAssessment(null)
      notify('info', '讲法已暂存，继续验证', '迁移题还没有通过，请再做一道，真正答对后才会写入有效讲法画像。')
      onCompleted?.(false)
      return
    }
    setFinished(true)
    onCompleted?.(true)
  }

  return (
    <section className={`adaptive-correction ${compact ? 'adaptive-correction--compact' : ''}`}>
      <div className="adaptive-policy">
        <EyeOff size={20} />
        <div>
          <strong>答案保护已开启</strong>
          <p>前几次作答只给提示和换讲法；达到设定次数仍未答对，才显示完整答案与推导。</p>
        </div>
        <span>{Math.min(persistedAttempts.length, revealAfterAttempts)}/{revealAfterAttempts} 次</span>
      </div>

      <div className="adaptive-diagnosis">
        <Brain size={22} />
        <div>
          <strong>初步卡点：{explanation.diagnosis.likelyCause}</strong>
          <p>{explanation.diagnosis.evidence}</p>
        </div>
        <em>{Math.round(explanation.diagnosis.confidence * 100)}% 置信</em>
      </div>

      <div className="adaptive-methods">
        <div className="adaptive-section-heading">
          <div><strong>选择讲解方法</strong><span>系统会优先推荐过去更有效的讲法</span></div>
          <Sparkles size={20} />
        </div>
        <div className="adaptive-method-grid">
          {explanation.methods.map((method) => {
            const historical = methodScore(method, subject, state.strategyPreferences)
            return (
              <button
                type="button"
                key={method.id}
                className={method.id === activeMethod.id ? 'active' : ''}
                onClick={() => switchMethod(method.id)}
              >
                <span>{method.style}</span>
                <strong>{method.name}</strong>
                <p>{method.bestFor}</p>
                <small>{method.id === preferredMethod ? '推荐' : historical > 0 ? `历史适配 ${Math.round(historical)}%` : '可尝试'}</small>
              </button>
            )
          })}
        </div>
      </div>

      <div className="adaptive-guidance">
        <div className="adaptive-opening">
          <Lightbulb size={21} />
          <div><strong>先想一想</strong><p>{activeMethod.openingQuestion || explanation.diagnosis.firstQuestion}</p></div>
        </div>

        <div className="adaptive-hints">
          {activeMethod.hints.slice(0, hintCount).map((hint, index) => (
            <div key={`${hint}-${index}`}><span>{index + 1}</span><p>{hint}</p></div>
          ))}
          {hintCount < activeMethod.hints.length && !canShowSolution && (
            <button type="button" onClick={() => setHintCount((value) => value + 1)}>
              <Lightbulb size={16} />给我一个提示
            </button>
          )}
        </div>

        {visibleSteps > 0 && (
          <div className="adaptive-steps">
            {activeMethod.steps.slice(0, visibleSteps).map((step, index) => (
              <article key={`${step.title}-${index}`}>
                <span>{index + 1}</span>
                <div><strong>{step.title}</strong><p>{step.content}</p></div>
              </article>
            ))}
            {visibleSteps < activeMethod.steps.length && !canShowSolution && (
              <button type="button" onClick={() => setVisibleSteps((value) => value + 1)}>
                下一步讲解<ChevronRight size={16} />
              </button>
            )}
          </div>
        )}

        {!finished && !originalCorrect && !secondWrong && (
          <div className="adaptive-answer-box">
            <label>第 {attemptNumber} 次作答
              <textarea
                rows={compact ? 2 : 4}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="不要只写最终数值，尽量写出判断依据或关键步骤。"
              />
            </label>
            <button type="button" disabled={checking || !answer.trim()} onClick={checkOriginalAnswer}>
              {checking ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
              {checking ? '正在判断…' : '提交本次作答'}
            </button>
          </div>
        )}

        {assessment && (
          <div className={`adaptive-feedback ${assessment.correct ? 'success' : 'warning'}`}>
            {assessment.correct ? <Check size={20} /> : <RefreshCcw size={20} />}
            <div><strong>{assessment.correct ? '原题订正正确' : assessment.feedback}</strong><p>{assessment.targetedHint}</p>{assessment.misconception && <small>可能误区：{assessment.misconception}</small>}</div>
            {!assessment.correct && assessment.nextAction === 'switch_method' && <button type="button" onClick={() => switchMethod(assessment.suggestedMethodId)}>换一种讲法</button>}
          </div>
        )}

        {canShowSolution && (
          <div className="adaptive-solution">
            <div className="adaptive-solution-head"><Sparkles size={20} /><div><strong>{originalCorrect ? '核对完整方法' : `${revealAfterAttempts} 次尝试后展示完整方法`}</strong><span>先对照自己卡住的位置，不要只抄结果。</span></div></div>
            <div className="adaptive-final-answer"><span>最终答案</span><p>{assessment?.revealAnswer || explanation.finalAnswer || correctAnswer}</p></div>
            <div className="adaptive-method-summary">
              {activeMethod.steps.map((step, index) => <article key={`${step.title}-${index}`}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.content}</p></div></article>)}
            </div>
            <div className="adaptive-memory-tip"><Star size={18} /><strong>记忆提示</strong><span>{activeMethod.memoryTip}</span></div>
          </div>
        )}
      </div>

      {showTransfer && !finished && (
        <div className="adaptive-transfer">
          <div className="adaptive-section-heading"><div><strong>迁移检测</strong><span>换一道题验证，避免只记住原题答案</span></div><ShieldCheck size={20} /></div>
          <h4>{explanation.instantCheck.question}</h4>
          <textarea rows={3} value={transferAnswer} onChange={(event) => setTransferAnswer(event.target.value)} placeholder="写下答案和关键步骤" />
          <button type="button" disabled={transferChecking || !transferAnswer.trim()} onClick={checkTransfer}>
            {transferChecking ? <LoaderCircle className="spin" size={18} /> : <ShieldCheck size={18} />}
            {transferChecking ? '正在检测…' : `提交迁移检测${transferAttempts ? `（第 ${transferAttempts + 1} 次）` : ''}`}
          </button>
          {transferAssessment && (
            <div className={`adaptive-feedback ${transferAssessment.correct ? 'success' : 'warning'}`}>
              {transferAssessment.correct ? <Check size={20} /> : <RefreshCcw size={20} />}
              <div>
                <strong>{transferAssessment.correct ? '迁移检测通过' : transferAssessment.feedback}</strong>
                <p>{transferAssessment.targetedHint}</p>
                {!transferAssessment.correct && transferAssessment.revealAnswer && <small>第二次仍未通过，参考答案：{transferAssessment.revealAnswer}</small>}
              </div>
            </div>
          )}
        </div>
      )}

      {(showTransfer || finished) && (
        <div className="adaptive-closure">
          <div className="adaptive-section-heading"><div><strong>把有效讲法留下来</strong><span>以后同类题优先采用成功率更高的方法</span></div><Star size={20} /></div>
          <div className="adaptive-best-methods">
            {explanation.methods.map((method) => (
              <button type="button" key={method.id} className={bestMethodId === method.id ? 'active' : ''} onClick={() => setBestMethodId(method.id)}>
                {bestMethodId === method.id && <Check size={15} />}{method.name}
              </button>
            ))}
          </div>
          <label>用自己的话总结
            <textarea rows={3} value={selfExplanation} onChange={(event) => setSelfExplanation(event.target.value)} placeholder={`例如：这道${knowledgePointName}题先看什么条件，再用什么方法，最后如何检查。`} />
          </label>
          {finished ? (
            <div className="adaptive-complete"><Check size={20} /><strong>本次订正已保存</strong><span>{mistake?.correction?.transferPassed ? '迁移检测通过，已更新学习画像。' : '讲法已保存，后续继续安排验证。'}</span></div>
          ) : (
            <button className="adaptive-finish-button" type="button" onClick={finish} disabled={!transferAssessment || selfExplanation.trim().length < 8}>
              <Star size={18} />{transferAssessment?.correct ? '保存最有效讲法并完成订正' : '暂存讲法并继续验证'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
