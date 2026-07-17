import { ArrowRight, BarChart3, Eye, EyeOff, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { USE_MOCK_API } from '../services/apiClient'

export function ParentAuthPage() {
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
          <p>家长账号只能读取已授权绑定学生的学习摘要，不能进入学生学习工具，也不能修改学生答题记录。</p>
          <div className="auth-feature-list">
            <div><BarChart3 size={20} /><span><strong>学习进度</strong><small>掌握度、任务完成率与近期趋势</small></span></div>
            <div><Users size={20} /><span><strong>家庭绑定</strong><small>通过一次性授权码关联学生</small></span></div>
            <div><ShieldCheck size={20} /><span><strong>只读权限</strong><small>后端验证家长身份与绑定关系</small></span></div>
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
            <h2>{mode === 'login' ? '家长登录' : '创建家长账号'}</h2>
            <p>{mode === 'login' ? '登录后查看已绑定学生的学习摘要。' : '注册后使用学生提供的一次性授权码完成绑定。'}</p>
          </div>
          <div className="auth-form">
            {mode === 'register' && <label>家长称呼<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：小林妈妈" autoComplete="name" /></label>}
            <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="parent@example.com" autoComplete="email" /></label>
            <label>密码<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /><button onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <Callout tone="danger" title="操作失败">{error}</Callout>}
            <Button size="lg" onClick={() => void submit()} disabled={loading || !email || !password || (mode === 'register' && !displayName)}>{loading ? '正在处理…' : mode === 'login' ? '登录家长端' : '完成注册'}<ArrowRight size={18} /></Button>
          </div>
          {USE_MOCK_API && <div className="demo-auth"><span>本地演示入口</span><Button variant="secondary" onClick={() => void demoLogin()} disabled={loading}>家长演示</Button></div>}
        </div>
      </section>
    </div>
  )
}
