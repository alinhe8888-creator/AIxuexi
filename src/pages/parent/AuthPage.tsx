import { ArrowRight, BookOpenCheck, Eye, EyeOff, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Callout } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import type { UserRole } from '../types'
import { USE_MOCK_API } from '../services/apiClient'

export function AuthPage() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<UserRole>('student')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const finish = (userRole: UserRole) => navigate(userRole === 'parent' ? '/parent' : '/', { replace: true })

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await register({ email, password, displayName, role })
      finish(user.role)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = async (demoRole: UserRole) => {
    setLoading(true)
    try {
      const user = await login(demoRole === 'parent' ? 'parent@example.com' : 'student@example.com', 'demo-password')
      finish(user.role)
    } catch (err) {
      setError(err instanceof Error ? err.message : '演示登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand"><span><Sparkles size={22} /></span><div><strong>知航 AI</strong><small>高中学习助手</small></div></div>
        <div className="auth-copy">
          <span className="auth-kicker">学生学习闭环 · 家长独立查看</span>
          <h1>学生专注学习，家长掌握进度，两个端互不干扰。</h1>
          <p>学生端负责错题、讲解、训练和复习；家长端只展示进度、薄弱点、学习风险与行动建议。</p>
          <div className="auth-feature-list">
            <div><BookOpenCheck size={20} /><span><strong>学生端</strong><small>完整学习工具与个性化任务</small></span></div>
            <div><Users size={20} /><span><strong>家长端</strong><small>绑定后查看孩子的学习概况</small></span></div>
            <div><ShieldCheck size={20} /><span><strong>双重权限</strong><small>前端隐藏＋后端角色校验</small></span></div>
          </div>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button>
          </div>
          <div className="auth-panel-title">
            <h2>{mode === 'login' ? '欢迎回来' : '创建学习账号'}</h2>
            <p>{mode === 'login' ? '登录后系统会自动进入对应的学生端或家长端。' : '注册时选择账号身份，后续不能在前端自行切换角色。'}</p>
          </div>

          {mode === 'register' && (
            <div className="role-select">
              <button className={role === 'student' ? 'active' : ''} onClick={() => setRole('student')}><BookOpenCheck size={20} /><span><strong>学生账号</strong><small>学习、训练与错题管理</small></span></button>
              <button className={role === 'parent' ? 'active' : ''} onClick={() => setRole('parent')}><Users size={20} /><span><strong>家长账号</strong><small>查看已绑定学生数据</small></span></button>
            </div>
          )}

          <div className="auth-form">
            {mode === 'register' && <label>姓名或昵称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={role === 'parent' ? '例如：小林妈妈' : '例如：林同学'} autoComplete="name" /></label>}
            <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label>
            <label>密码<div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /><button onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <Callout tone="danger" title="操作失败">{error}</Callout>}
            <Button size="lg" onClick={() => void submit()} disabled={loading || !email || !password || (mode === 'register' && !displayName)}>{loading ? '正在处理…' : mode === 'login' ? '登录' : '完成注册'}<ArrowRight size={18} /></Button>
          </div>

          {USE_MOCK_API && (
            <div className="demo-auth">
              <span>本地演示入口</span>
              <div><Button variant="secondary" onClick={() => void demoLogin('student')} disabled={loading}>学生演示</Button><Button variant="secondary" onClick={() => void demoLogin('parent')} disabled={loading}>家长演示</Button></div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
