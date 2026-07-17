import { Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../components/ui'

export function NotFoundPage() {
  const navigate = useNavigate()
  return <div className="not-found"><Card><strong>404</strong><h1>页面不存在</h1><p>当前地址没有对应功能，返回首页继续学习。</p><Button onClick={() => navigate('/')}><Home size={17} />返回首页</Button></Card></div>
}
