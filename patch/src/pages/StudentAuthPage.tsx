import { ArrowRight, BookOpenCheck, Eye, EyeOff, Sparkles, Target, TimerReset } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { USE_MOCK_API } from '../services/apiClient'

export function StudentAuthPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = async () => {
    setEmail('student@example.com')
    setPassword('demo-password')
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
          <p>家庭自用系统，不开放注册。使用已经创建好的学生账号登录。</p>
          <div className="auth-feature-list">
            <div><BookOpenCheck size={20} /><span><strong>分步讲解</strong><small>Qwen 识图，DeepSeek 负责推理与讲解</small></span></div>
            <div><Target size={20} /><span><strong>薄弱点追踪</strong><small>错题、知识点和掌握度持续联动</small></span></div>
            <div><TimerReset size={20} /><span><strong>自动复习</strong><small>根据遗忘风险安排每天的复习任务</small></span></div>
          </div>
        </div>
      </section>
      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-panel-title"><h2>学生登录</h2><p>登录后进入你的学习空间。</p></div>
          <div className="auth-form">
            <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /></label>
            <label>密码<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <Callout tone="danger" title="登录失败">{error}</Callout>}
            <Button size="lg" onClick={() => void submit()} disabled={loading || !email || !password}>{loading ? '正在登录…' : '登录'}<ArrowRight size={18} /></Button>
          </div>
          {USE_MOCK_API && <div className="demo-auth"><span>本地演示入口</span><Button variant="secondary" onClick={() => void demoLogin()} disabled={loading}>学生演示</Button></div>}
        </div>
      </section>
    </div>
  )
}
