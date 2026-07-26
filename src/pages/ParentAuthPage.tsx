import { ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'

const LAST_EMAIL_KEY = 'aixuexi:last-parent-email'

export function ParentAuthPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState(() => localStorage.getItem(LAST_EMAIL_KEY) || 'alinhe8888@gmail.com')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      await login(email.trim(), password)
      localStorage.setItem(LAST_EMAIL_KEY, email.trim())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="private-login-page">
      <section className="private-login-card" aria-labelledby="family-login-title">
        <div className="private-login-brand"><span><Sparkles size={22} /></span><strong>知航 AI</strong></div>
        <div className="private-login-title">
          <h1 id="family-login-title">查看学习情况</h1>
        </div>
        <div className="auth-form">
          <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="请输入邮箱" autoComplete="email" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /></label>
          <label>密码<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" autoComplete="current-password" onKeyDown={(event) => { if (event.key === 'Enter') void submit() }} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <Callout tone="danger" title="登录失败">{error}</Callout>}
          <Button size="lg" onClick={() => void submit()} disabled={loading || !email.trim() || !password}>{loading ? '正在登录…' : '进入'}<ArrowRight size={18} /></Button>
        </div>
      </section>
    </main>
  )
}
