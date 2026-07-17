# 知航 AI 高中学习系统 v1.4.0

本版本优先修复系统底座：**菜单点击白屏、路由不稳定、后端接口404、学习数据同步与权限隔离**。

## 系统结构

```text
学生端 Cloudflare Pages
├─ 独立学生登录/注册
├─ 11个学习功能
├─ BrowserRouter + SPA回退
├─ 页面错误边界
├─ 接口失败本地兜底
└─ 本地数据 + Render异步同步
            │
            ▼
Render API v1.4.0
├─ JWT学生/家长角色
├─ OCR单题与整卷接口
├─ AI分步讲解与模拟组卷
├─ 知识库查询
├─ 学习记录CRUD
├─ 学生学习快照
├─ 家长绑定与只读汇总
└─ PostgreSQL
            ▲
            │
家长端 Cloudflare Pages
├─ 独立域名和登录
├─ 独立导航与路由
└─ 只读取已绑定学生汇总数据
```

## 本版解决的问题

### 1. 点击菜单白屏

原代码在每次切换路由时强制销毁页面容器，同时执行从透明到可见的动画；页面一旦抛出渲染错误，也没有任何错误边界。

本版已经：

```text
取消路由容器强制重建
取消路由透明度动画
增加页面级错误边界
修正独立家长端旧 /parent 路径
验证11个学生导航与5个家长导航均有真实路由
```

### 2. Render接口404

已实现前端当前使用的全部接口：

```text
/api/ocr/question
/api/ocr/paper
/api/ai/explain
/api/ai/simulation
/api/knowledge
/api/sync/snapshot
```

同时补充认证、学习快照、记录CRUD、报告和家长绑定接口。完整清单见 [API_ENDPOINTS.md](./API_ENDPOINTS.md)。

### 3. 数据稳定性

- localStorage按学生账号分别保存，避免多个学生共用同一份数据。
- localStorage容量不足时自动移除原始大图后再次保存，不再因Quota错误拖垮页面。
- Render冷启动或AI供应商异常时，OCR与AI功能返回结构化兜底结果。
- 每个接口响应带 `x-request-id`，便于在Render日志定位。

## 本地检查

```bash
npm ci
npm run check
```

`npm run check`依次执行：

```text
前端lint
前端TypeScript
学生端生产构建
家长端生产构建
导航与构建产物验证
后端TypeScript
后端生产构建
后端全接口冒烟测试
```

## Cloudflare Pages

### 学生端

```text
Root directory: /
Build command: npm ci && npm run build:student
Build output directory: dist-student
```

### 家长端

```text
Root directory: /
Build command: npm ci && npm run build:parent
Build output directory: dist-parent
```

两个项目都设置：

```env
VITE_API_BASE_URL=https://aixuexi-api.onrender.com
VITE_USE_MOCK_API=false
VITE_ALLOW_API_FALLBACK=true
```

`public/_redirects` 会进入两个构建目录，用于Cloudflare SPA路由回退；`public/_headers` 禁止缓存旧的 `index.html`。

## Render后端

```text
Root directory: backend
Build command: npm ci && npm run build
Pre-deploy command: npm run migrate
Start command: npm start
Health check: /api/health
```

必填环境变量：

```env
NODE_ENV=production
DATABASE_URL=<Render PostgreSQL连接地址>
JWT_SECRET=<至少32位随机字符串>
CORS_ORIGIN=https://学生端.pages.dev,https://家长端.pages.dev
MAX_JSON_MB=30
```

可选真实AI/OCR：

```env
AI_API_BASE_URL=https://你的OpenAI兼容接口/v1
AI_API_KEY=<密钥>
AI_MODEL=gpt-4.1-mini
AI_VISION_MODEL=gpt-4.1-mini
```

密钥只放在Render Secrets，不能放到前端或GitHub。

## 项目目录

```text
src/                         React前端
├─ StudentPortal.tsx         学生端路由
├─ ParentPortal.tsx          家长端路由
├─ components/               布局、错误边界、UI
├─ pages/                    学生页面
├─ pages/parent/             家长页面
├─ services/                 API客户端与兜底服务
└─ store/                    学习闭环与同步
backend/
├─ src/server.ts             全部HTTP接口
├─ src/learning.ts           OCR、AI、知识库及模型接入
├─ src/store.ts              PostgreSQL/内存数据层
├─ src/migrate.ts            数据库迁移
└─ scripts/smoke-test.mjs    全接口冒烟测试
scripts/verify-routes.mjs    路由与构建产物检查
render.yaml                  Render Blueprint
```

## 当前边界

```text
已完成：接口、鉴权、数据库、结构化OCR/AI结果、完整学习闭环
可选增强：配置真实多模态模型后获得真实图片识别与动态讲解
```

未配置模型密钥时系统仍能操作，但OCR结果属于兜底演示数据，必须由学生人工核对；不能把兜底结果宣传为真实OCR准确率。
