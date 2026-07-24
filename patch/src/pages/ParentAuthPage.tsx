import { ArrowRight, BarChart3, Eye, EyeOff, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { USE_MOCK_API } from '../services/apiClient'

export function ParentAuthPage() {
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
    setEmail('parent@example.com')
    setPassword('demo-password')
    setLoading(true)
    try {
      await login('parent@example.com', 'demo-password')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '演示登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page parent-auth-page">
      <section className="auth-visual parent-auth-visual">
        <div className="auth-brand"><span><Sparkles size={22} /></span><div><strong>知航家长</strong><small>家庭学习观察台</small></div></div>
        <div className="auth-copy">
          <span className="auth-kicker">独立家长访问入口</span>
          <h1>不打扰孩子学习，只看真正需要家长掌握的进度、风险和行动建议。</h1>
          <p>家庭自用系统，不开放注册。家长端保持只读，不修改学生答题与错题记录。</p>
          <div className="auth-feature-list">
            <div><BarChart3 size={20} /><span><strong>学习进度</strong><small>掌握度、任务完成率与近期趋势</small></span></div>
            <div><Users size={20} /><span><strong>家庭关联</strong><small>读取已绑定学生的学习摘要</small></span></div>
            <div><ShieldCheck size={20} /><span><strong>只读权限</strong><small>后端验证家长身份与绑定关系</small></span></div>
          </div>
        </div>
      </section>
      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-panel-title"><h2>家长登录</h2><p>登录后查看已绑定学生的学习摘要。</p></div>
          <div className="auth-form">
            <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="parent@example.com" autoComplete="email" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /></label>
            <label>密码<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <Callout tone="danger" title="登录失败">{error}</Callout>}
            <Button size="lg" onClick={() => void submit()} disabled={loading || !email || !password}>{loading ? '正在登录…' : '登录家长端'}<ArrowRight size={18} /></Button>
          </div>
          {USE_MOCK_API && <div className="demo-auth"><span>本地演示入口</span><Button variant="secondary" onClick={() => void demoLogin()} disabled={loading}>家长演示</Button></div>}
        </div>
      </section>
    </div>
  )
}
