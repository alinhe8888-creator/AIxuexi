# 知航 AI · 高中学习助手（学生端 + 独立家长端）

## 系统结构

```text
Cloudflare Pages 前端
├─ 学生登录与学生端
├─ 家长登录与独立家长端
├─ BrowserRouter
├─ SPA 路由回退
└─ 禁止缓存旧 index.html
        │
        ▼
Render API 后端
├─ 注册与登录
├─ JWT 角色校验
├─ 学生学习快照同步
├─ 学生生成临时绑定码
├─ 家长绑定学生
├─ 家长汇总数据接口
└─ PostgreSQL 数据库
```

## 本版主要更新

### 1. 独立家长端

家长端包含：

- 家长首页
- 今日学习完成情况
- 综合掌握度
- 薄弱知识点
- 高遗忘风险提醒
- 各科学习进度
- 错题和主要错因
- 小测趋势
- 阶段学习报告
- 家长行动建议
- 多个学生绑定与切换

### 2. 学生不能看到家长端

权限采用两层控制：

```text
前端
├─ 学生导航没有家长入口
├─ 学生访问 /parent 自动跳回学生端
└─ 家长和学生使用不同页面结构

后端
├─ /api/parent/* 必须登录
├─ 必须是 parent 角色
├─ 必须已经绑定目标学生
└─ 学生 token 请求家长接口返回 403
```

### 3. 学生与家长绑定

```text
学生个人设置
→ 生成 6 位临时绑定码
→ 15 分钟有效
→ 家长端输入绑定码
→ 建立家长—学生关联
→ 绑定码立即失效
```

### 4. 修复“点击功能后必须刷新才显示”

本版采用：

- 顶层 `BrowserRouter`
- 单一角色路由结构
- 页面路由切换强制建立新视图容器
- `public/_redirects` 提供 Cloudflare SPA 回退
- `public/_headers` 禁止缓存旧 `index.html`
- API 请求超时、重试和错误状态
- Render 冷启动时 GET 请求自动重试
- 学习数据本地保存并异步同步，不阻塞页面渲染

## 项目目录

```text
.
├─ src/                         前端源码
│  ├─ auth/                     登录状态和角色路由守卫
│  ├─ parent/                   家长数据上下文
│  ├─ pages/parent/             家长端页面
│  ├─ services/                 API、登录、同步、家长接口
│  ├─ store/                    学生学习状态与云端同步
│  └─ components/               学生与家长布局
├─ public/
│  ├─ _redirects                Cloudflare SPA 回退
│  └─ _headers                  缓存与安全响应头
├─ backend/
│  ├─ src/server.ts             Render API
│  ├─ src/migrate.ts            PostgreSQL 数据表迁移
│  ├─ src/summary.ts            家长汇总数据计算
│  └─ package.json
├─ render.yaml                  Render 服务配置参考
├─ AGENTS.md                    Codex 执行规则
└─ CODEX_DEPLOY_PROMPT.md       浏览器部署提示词
```

## 本地运行

### 前端

```bash
npm ci
cp .env.example .env.local
npm run dev
```

本地演示可以设置：

```env
VITE_USE_MOCK_API=true
VITE_API_BASE_URL=
```

### 后端

```bash
cd backend
npm ci
cp .env.example .env
npm run build
npm run migrate
npm start
```

## Cloudflare Pages 配置

```text
Framework preset：Vite
Root directory：/
Build command：npm ci && npm run build
Build output directory：dist
```

环境变量：

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=https://你的Render服务.onrender.com
```

## Render 配置

```text
Root directory：backend
Build command：npm ci && npm run build
Pre-deploy command：npm run migrate
Start command：npm start
Health check：/api/health
```

环境变量：

```env
NODE_ENV=production
DATABASE_URL=Render PostgreSQL连接地址
JWT_SECRET=至少32位随机字符串
CORS_ORIGIN=https://你的Cloudflare域名.pages.dev,https://你的正式域名
```

## API

```text
GET    /api/health
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/student/snapshot
PUT    /api/student/snapshot
POST   /api/student/pair-code
POST   /api/parent/link
GET    /api/parent/children
GET    /api/parent/children/:studentId/dashboard
DELETE /api/parent/children/:studentId
```

## 已完成检查

```text
前端 npm run typecheck  通过
前端 npm run build      通过
后端 npm run typecheck  通过
后端 npm run build      通过
Cloudflare _redirects   已进入 dist
Cloudflare _headers     已进入 dist
```
