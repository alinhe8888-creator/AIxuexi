import { ArrowRight, Check, GraduationCap, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button, Card, ProgressBar } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import type { StudentProfile, Subject } from '../types'

const allSubjects: Subject[] = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

export function OnboardingPage() {
  const { state, updateProfile } = useAppStore()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<StudentProfile>({ ...state.profile })
  if (state.profile.onboarded) return <Navigate to="/" replace />

  const finish = () => {
    updateProfile({ ...profile, onboarded: true })
    navigate('/')
  }

  return <div className="onboarding-page"><div className="onboarding-brand"><span><Sparkles size={22} /></span><strong>知航 AI 高中学习助手</strong></div><Card className="onboarding-card"><div className="onboarding-head"><div><span>建立初始学习档案</span><h1>{step === 1 ? '先认识一下你' : step === 2 ? '选择你的学习科目' : '确定学习节奏'}</h1><p>建档只需要一次，后续系统会根据真实学习记录动态调整。</p></div><GraduationCap size={42} /></div><ProgressBar value={step / 3 * 100} />{step === 1 && <div className="form-stack"><label>学生昵称<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label>年级<select value={profile.grade} onChange={(event) => setProfile({ ...profile, grade: event.target.value as StudentProfile['grade'] })}><option>高一</option><option>高二</option><option>高三</option></select></label><label>当前成绩区间<input value={profile.currentScoreRange} onChange={(event) => setProfile({ ...profile, currentScoreRange: event.target.value })} /></label></div>}{step === 2 && <div className="subject-toggle-grid large">{allSubjects.map((subject) => <button key={subject} className={profile.selectedSubjects.includes(subject) ? 'active' : ''} onClick={() => setProfile({ ...profile, selectedSubjects: profile.selectedSubjects.includes(subject) ? profile.selectedSubjects.filter((item) => item !== subject) : [...profile.selectedSubjects, subject] })}>{profile.selectedSubjects.includes(subject) && <Check size={16} />}{subject}</button>)}</div>}{step === 3 && <div className="form-stack"><label>每天可投入时间<div className="range-field"><input type="range" min="30" max="240" step="10" value={profile.dailyMinutes} onChange={(event) => setProfile({ ...profile, dailyMinutes: Number(event.target.value) })} /><strong>{profile.dailyMinutes} 分钟</strong></div></label><label>当前学习诉求<textarea rows={4} value={profile.learningGoal} onChange={(event) => setProfile({ ...profile, learningGoal: event.target.value })} placeholder="例如：优先补数学和物理薄弱点，同时稳定英语词汇复习。" /></label></div>}<div className="onboarding-actions">{step > 1 && <Button variant="secondary" onClick={() => setStep((value) => value - 1)}>上一步</Button>}{step < 3 ? <Button onClick={() => setStep((value) => value + 1)}>下一步<ArrowRight size={17} /></Button> : <Button onClick={finish}>完成建档并进入首页<ArrowRight size={17} /></Button>}</div></Card></div>
}
