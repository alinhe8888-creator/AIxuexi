import { Brain, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, PageHeader, ProgressBar, SectionTitle } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import { formatDate, isDue } from '../utils/date'

export function ChallengePage() {
  const { state, reviewCard, notify } = useAppStore()
  const categories = ['全部', ...new Set(state.cards.map((item) => item.category))]
  const [category, setCategory] = useState('全部')
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [sessionDone, setSessionDone] = useState(0)

  const cards = useMemo(() => state.cards.filter((card) => (category === '全部' || card.category === category) && (isDue(card.nextReviewAt) || category !== '全部')).sort((a, b) => new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()), [state.cards, category])
  const card = cards[index % Math.max(1, cards.length)]

  const rate = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    if (!card) return
    reviewCard(card.id, rating)
    setSessionDone((value) => value + 1)
    setFlipped(false)
    setShowAnswer(false)
    setIndex((value) => cards.length > 1 ? (value + 1) % cards.length : 0)
    if ((sessionDone + 1) % 5 === 0) notify('success', '完成 5 张卡片', '保持节奏，短时高频复习更有效。')
  }

  return (
    <div>
      <PageHeader eyebrow="主动回忆 + 间隔复习" title="卡片式闯关学习" description="用翻转、选择、判断、填空和默写完成主动回忆。认识程度会决定卡片下一次出现时间。" actions={<Badge tone="primary"><Trophy size={15} />本轮已完成 {sessionDone} 张</Badge>} />

      <div className="challenge-layout">
        <Card className="challenge-sidebar">
          <SectionTitle title="闯关分类" description="选择分类后开始专项复习" />
          <div className="category-list">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setIndex(0); setFlipped(false); setShowAnswer(false) }}><span>{item}</span><strong>{item === '全部' ? state.cards.filter((card) => isDue(card.nextReviewAt)).length : state.cards.filter((card) => card.category === item).length}</strong></button>)}</div>
          <div className="challenge-summary"><div><strong>{state.cards.filter((item) => isDue(item.nextReviewAt)).length}</strong><span>今日到期</span></div><div><strong>{Math.round(state.cards.reduce((sum, item) => sum + item.familiarity, 0) / Math.max(1, state.cards.length) / 5 * 100)}%</strong><span>平均熟悉度</span></div></div>
        </Card>

        <div className="challenge-main">
          {card ? <>
            <Card className="challenge-progress"><div><strong>{category} · 第 {index + 1} 张</strong><span>共 {cards.length} 张</span></div><ProgressBar value={((index + 1) / cards.length) * 100} compact /></Card>
            <div className={`study-flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((value) => !value)}>
              <div className="flashcard-inner">
                <Card className="flashcard-face flashcard-front">
                  <div className="flashcard-meta"><Badge tone="primary">{card.category}</Badge><Badge>{card.subject}</Badge></div>
                  <span className="flash-label">点击卡片翻转</span>
                  <h2>{card.front}</h2>
                  <div className="flash-hint"><Sparkles size={17} /><span>提示：{card.hint}</span></div>
                  <div className="familiarity-dots">{[1, 2, 3, 4, 5].map((value) => <span key={value} className={card.familiarity >= value ? 'active' : ''} />)}<small>熟悉度 {card.familiarity}/5</small></div>
                </Card>
                <Card className="flashcard-face flashcard-back">
                  <div className="flashcard-meta"><Badge tone="success">答案</Badge><span>上次复习：{formatDate(card.lastReviewedAt)}</span></div>
                  <h2>{card.back}</h2>
                  <p>下一次复习会根据你的选择自动安排。</p>
                  <div className="back-icon"><Check size={28} /></div>
                </Card>
              </div>
            </div>

            <Card className="card-question-area">
              <div className="question-area-head"><div><strong>{card.format}</strong><span>先作答，再查看卡片背面</span></div><Button size="sm" variant="ghost" onClick={() => setShowAnswer((value) => !value)}>{showAnswer ? '隐藏答案' : '查看答案'}</Button></div>
              {card.options ? <div className="compact-options">{card.options.map((option) => <button key={option} onClick={() => setShowAnswer(true)}>{option}</button>)}</div> : <textarea rows={3} placeholder="在这里默写或输入你的答案…" />}
              {showAnswer && <div className="card-answer"><strong>参考答案</strong><p>{card.answer}</p></div>}
            </Card>

            <div className="rating-panel">
              <span>根据刚才的回忆情况选择：</span>
              <div><Button variant="danger" onClick={() => rate('again')}>不认识<small>1 天后</small></Button><Button variant="secondary" onClick={() => rate('hard')}>模糊<small>2 天后</small></Button><Button onClick={() => rate('good')}>认识<small>3–7 天</small></Button><Button variant="success" onClick={() => rate('easy')}>很熟练<small>7–14 天</small></Button></div>
            </div>

            <div className="challenge-nav"><Button variant="ghost" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false) }} disabled={index === 0}><ChevronLeft size={18} />上一张</Button><Button variant="ghost" onClick={() => { setIndex((value) => (value + 1) % cards.length); setFlipped(false) }}>跳过此卡<ChevronRight size={18} /></Button></div>
          </> : <Card><EmptyState title="今天没有到期卡片" description="你可以选择左侧具体分类继续自由复习。" action={<Button onClick={() => setCategory(categories[1] || '全部')}><RotateCcw size={17} />自由复习</Button>} /></Card>}
        </div>
      </div>

      <div className="stats-grid three">
        <Card className="feature-card"><Brain size={24} /><strong>主动回忆</strong><p>先尝试从记忆中提取答案，而不是反复阅读。</p></Card>
        <Card className="feature-card"><RotateCcw size={24} /><strong>智能重复</strong><p>不熟悉的卡片更快出现，熟练卡片逐渐拉长间隔。</p></Card>
        <Card className="feature-card"><Trophy size={24} /><strong>持续闯关</strong><p>每次只完成少量到期卡片，降低学习启动成本。</p></Card>
      </div>
    </div>
  )
}
