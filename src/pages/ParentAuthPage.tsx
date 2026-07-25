import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'

export function ParentAuthPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="family-auth-page">
      <section className="family-auth-card">
        <h1>家长登录</h1>
        <label>
          邮箱
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label>
          密码
          <span className="family-password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              onKeyDown={(event) => { if (event.key === 'Enter') void submit() }}
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {error && <Callout tone="danger" title="登录失败">{error}</Callout>}
        <Button size="lg" onClick={() => void submit()} disabled={loading || !email.trim() || !password}>
          <LogIn size={18} />{loading ? '登录中…' : '登录'}
        </Button>
      </section>
    </main>
  )
}
