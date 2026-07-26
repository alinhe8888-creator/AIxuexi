import { ArrowRight, BookOpenCheck, Eye, EyeOff, Sparkles, Target, TimerReset } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { USE_MOCK_API } from '../services/apiClient'

export function StudentAuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>(location.pathname === '/register' ? 'register' : 'login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register({ email, password, displayName })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = async () => {
    setLoading(true)
    try {
      await login('student@example.com', 'demo-password')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '演示登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page student-auth-page">
      <section className="auth-visual">
        <div className="auth-brand"><span><Sparkles size={22} /></span><div><strong>知航 AI</strong><small>高中学习助手</small></div></div>
        <div className="auth-copy">
          <span className="auth-kicker">专属学生学习空间</span>
          <h1>把错题、讲解、训练和复习，真正连成每天都能执行的学习闭环。</h1>
          <p>系统根据你的错题、薄弱知识点和近期表现安排任务，逐步形成更了解你的 AI 学习助手。</p>
          <div className="auth-feature-list">
            <div><BookOpenCheck size={20} /><span><strong>分步讲解</strong><small>先提示、再推导，不直接抛出完整答案</small></span></div>
            <div><Target size={20} /><span><strong>薄弱点追踪</strong><small>错题、知识点和掌握度持续联动</small></span></div>
            <div><TimerReset size={20} /><span><strong>自动复习</strong><small>根据遗忘风险安排每天的复习任务</small></span></div>
          </div>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); navigate('/login', { replace: true }) }}>登录</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); navigate('/register', { replace: true }) }}>注册</button>
          </div>
          <div className="auth-panel-title">
            <h2>{mode === 'login' ? '欢迎回来' : '创建学生账号'}</h2>
            <p>{mode === 'login' ? '登录后进入你的学习空间。' : '注册后开始建立专属学习档案。'}</p>
          </div>
          <div className="auth-form">
            {mode === 'register' && <label>学生昵称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：林同学" autoComplete="name" /></label>}
            <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
            <label>密码<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /><button onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <Callout tone="danger" title="操作失败">{error}</Callout>}
            <Button size="lg" onClick={() => void submit()} disabled={loading || !email || !password || (mode === 'register' && !displayName)}>{loading ? '正在处理…' : mode === 'login' ? '登录' : '完成注册'}<ArrowRight size={18} /></Button>
          </div>
          {USE_MOCK_API && <div className="demo-auth"><span>本地演示入口</span><Button variant="secondary" onClick={() => void demoLogin()} disabled={loading}>学生演示</Button></div>}
        </div>
      </section>
    </div>
  )
}
