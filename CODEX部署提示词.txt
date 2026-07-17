# Codex 执行任务：发布 AIxuexi v1.4.0 并完成真实验收

你现在负责把本地 **AIxuexi v1.4.0** 完整更新到 GitHub，并使用当前已打开、已登录的 Chrome 浏览器，通过 Computer Use 完成 Render 后端和两个 Cloudflare Pages 前端的部署与验收。

不要只给操作建议。必须实际执行、实际部署、实际测试，并在出现错误时继续定位修复，直到验收通过或遇到必须由用户确认的付费/权限问题。

---

## 一、定位本地代码

先在 `~/Downloads` 查找刚解压的目录，目录名称通常为：

```text
AIxuexi-stable-architecture-v1.4.0
```

正确项目根目录必须同时包含：

```text
package.json
package-lock.json
src/
backend/package.json
render.yaml
.env.student
.env.parent
public/_redirects
public/_headers
API_ENDPOINTS.md
TEST_REPORT.md
```

进入该目录后，先阅读：

```text
AGENTS.md
README.md
API_ENDPOINTS.md
CLOUDFLARE_DEPLOYMENT.md
render.yaml
.env.example
backend/.env.example
```

禁止从旧下载目录、旧 ZIP 或旧 GitHub 工作区发布。

---

## 二、先完成本地强制检查

在项目根目录执行：

```bash
npm ci
npm --prefix backend ci
npm run check
```

`npm run check` 必须依次通过：

```text
前端 lint
前端 TypeScript
学生端构建
家长端构建
11 个学生导航 + 5 个家长导航映射检查
后端 TypeScript
后端构建
后端全接口冒烟测试
```

确认以下文件存在：

```text
dist-student/index.html
dist-student/_redirects
dist-student/_headers
dist-parent/index.html
dist-parent/_redirects
dist-parent/_headers
backend/dist/server.js
backend/dist/migrate.js
```

任何一步失败都必须先修复，禁止跳过检查后直接部署。

---

## 三、更新 GitHub 仓库

目标仓库：

```text
https://github.com/alinhe8888-creator/AIxuexi
```

默认分支：`main`。

### 认证方式

先执行：

```bash
gh auth status
```

若显示 GitHub CLI 未认证：

```bash
gh auth login --hostname github.com --git-protocol https --web
```

然后使用当前 Chrome 的 Computer Use 完成设备授权。不要把 Token 粘贴到聊天、代码、日志或仓库。

如果 CLI Web 授权仍不可用，使用当前 Chrome 登录的 GitHub 网页或 GitHub Desktop完成提交；不能因为 CLI 未登录而停止整个任务。

### 提交要求

1. 拉取或克隆仓库最新 `main`。
2. 用本地 v1.4.0 代码完整覆盖仓库工作区，但保留 `.git`。
3. 删除旧 GitHub Pages 工作流（如存在）：

```text
.github/workflows/deploy-pages.yml
```

当前正式前端由 Cloudflare Pages 发布，不再使用 GitHub Pages。

4. 禁止提交：

```text
node_modules/
backend/node_modules/
.env
.env.local
backend/.env
数据库密码
JWT_SECRET
AI_API_KEY
```

5. 必须提交：

```text
.env.example
.env.student
.env.parent
backend/.env.example
public/_redirects
public/_headers
backend/
scripts/
render.yaml
API_ENDPOINTS.md
TEST_REPORT.md
```

6. 执行：

```bash
git status
git add -A
git commit -m "Stabilize routing and implement complete Render API"
git push origin main
```

7. 使用 Chrome 打开 GitHub 仓库，确认最新提交已经出现在 `main`，并核对 `backend/src/server.ts`、`src/StudentPortal.tsx`、`src/ParentPortal.tsx`、`render.yaml` 已更新。

记录最新提交 URL。

---

## 四、部署 Render 后端

使用当前 Chrome Computer Use 打开 Render Dashboard，更新现有服务：

```text
aixuexi-api
```

优先更新现有服务，不重复创建同名服务，不创建任何未经用户确认的付费资源。

服务配置必须为：

```text
Repository: alinhe8888-creator/AIxuexi
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm ci && npm run build
Pre-Deploy Command: npm run migrate
Start Command: npm start
Health Check Path: /api/health
Auto Deploy: On Commit
```

Render 环境变量：

```env
NODE_VERSION=22.16.0
NODE_ENV=production
DATABASE_URL=<复用现有 PostgreSQL Internal Database URL>
JWT_SECRET=<至少32位随机字符串，只放Render Secret>
CORS_ORIGIN=<学生端正式域名>,<家长端正式域名>
MAX_JSON_MB=30
```

可选真实 AI/OCR：

```env
AI_API_BASE_URL=<OpenAI兼容接口，末尾通常为/v1>
AI_API_KEY=<只放Render Secret>
AI_MODEL=<文本模型名>
AI_VISION_MODEL=<支持图片的模型名>
```

未配置 AI 密钥时也不允许接口返回 404；系统必须返回可人工核对的结构化兜底结果。

触发部署并等待完成。打开：

```text
https://aixuexi-api.onrender.com/api/health
```

必须得到 HTTP 200 和 `ok: true`。记录返回中的 `version`、`database`、`ai` 状态。

若数据库迁移失败，打开 Render 日志定位并修复；不得绕过迁移直接宣布完成。

---

## 五、部署学生端 Cloudflare Pages

使用当前 Chrome Computer Use 打开 Cloudflare Dashboard，找到现有学生端项目（当前正式地址通常为）：

```text
https://aixuexi-29x.pages.dev
```

配置：

```text
Repository: alinhe8888-creator/AIxuexi
Production branch: main
Framework preset: Vite
Root directory: /
Build command: npm ci && npm run build:student
Build output directory: dist-student
```

生产环境变量：

```env
VITE_API_BASE_URL=https://aixuexi-api.onrender.com
VITE_USE_MOCK_API=false
VITE_ALLOW_API_FALLBACK=true
```

不要设置 `VITE_PORTAL_ROLE`。

保存并触发正式部署，等待成功。记录学生端最终 URL。

---

## 六、部署独立家长端 Cloudflare Pages

找到现有独立家长端项目；如尚未创建，创建一个新的 **Cloudflare Pages 免费项目**，建议名称：

```text
aixuexi-parent
```

必须与学生端使用不同 Pages 项目和不同域名。

配置：

```text
Repository: alinhe8888-creator/AIxuexi
Production branch: main
Framework preset: Vite
Root directory: /
Build command: npm ci && npm run build:parent
Build output directory: dist-parent
```

生产环境变量：

```env
VITE_API_BASE_URL=https://aixuexi-api.onrender.com
VITE_USE_MOCK_API=false
VITE_ALLOW_API_FALLBACK=true
```

不要设置 `VITE_PORTAL_ROLE`。

保存并部署，记录家长端最终 URL。

家长端必须完全独立：学生端登录页、注册页、导航和文案中不能出现家长端入口；家长端也不能出现学生学习工具。

---

## 七、回填 Render CORS 并重新部署

获得两个准确 Pages 地址后，将 Render 的 `CORS_ORIGIN` 更新为：

```env
CORS_ORIGIN=https://学生端实际地址,https://家长端实际地址
```

如有自定义域名，也追加在同一变量中，以英文逗号分隔。

保存并重新部署 Render，然后再次确认 `/api/health` 返回 HTTP 200。

---

## 八、生产环境强制验收

所有验收必须在真实 Cloudflare/Render 地址完成。不要只依据本地构建成功。

### A. 学生端导航即时显示

登录学生端后，依次点击：

```text
首页
拍题讲解
试卷分析
错题本
闯关学习
模拟训练
每日计划
学习画像
知识库
学习报告
个人设置
```

每个页面都必须：

```text
点击后立即显示
不需要刷新
不出现整页白屏
不出现旧页面残留
Console 无未处理异常
```

再直接访问并刷新：

```text
/photo-explain
/paper-analysis
/mistakes
/challenge
/simulation
/daily-plan
/profile
/knowledge
/reports
/settings
```

全部必须正常返回，不得出现 Cloudflare 404。

### B. 学生端接口

注册一个新的测试学生账号，并逐项实际操作：

```text
拍题讲解：上传图片并识别
试卷分析：上传至少2张图片并拆题
AI分步讲解
模拟训练生成
知识库查询
错题保存
每日计划保存
学习快照同步
```

Network 中以下接口不能再返回 404：

```text
POST /api/ocr/question
POST /api/ocr/paper
POST /api/ai/explain
POST /api/ai/simulation
GET  /api/knowledge
POST /api/sync/snapshot
```

接口失败时页面必须显示可读错误或兜底结果，不能导致整个页面白屏。

### C. 学生端与家长端隔离

学生端必须满足：

```text
登录页不出现家长端文字或入口
注册页只能注册学生
导航中无家长端
学生 Token 请求 /api/parent/* 返回 403
```

家长端必须满足：

```text
独立域名
登录/注册只属于家长
导航只有家长观察功能
不能进入拍题、试卷分析、错题操作或训练页面
```

### D. 数据互传

1. 学生在个人设置生成 6 位绑定码。
2. 家长在独立家长端注册并绑定。
3. 学生完成任务、保存错题或完成小测。
4. 等待同步完成。
5. 家长端刷新数据后必须看到：

```text
今日完成率
综合掌握度
薄弱知识点
错题和主要错因
小测趋势
学习建议
```

家长只能读取已绑定学生；访问未绑定学生必须返回 404。

### E. 浏览器检查

学生端和家长端都打开 DevTools：

```text
Console：无未处理红色错误
Network：无业务接口404
Application：学生/家长Token使用不同localStorage key
```

Render 冷启动允许出现明确加载状态，但不能表现为白屏。

---

## 九、结束条件和最终报告

必须全部完成后再结束。最终报告按以下结构输出：

```text
1. GitHub最新提交URL
2. Render API URL
3. /api/health实际返回
4. 学生端Cloudflare URL
5. 家长端Cloudflare URL
6. 11个学生导航逐项结果
7. 5个家长导航逐项结果
8. OCR/AI/知识库/同步接口结果
9. 学生与家长隔离结果
10. 绑定和数据互传结果
11. Console和Network检查结果
12. 尚未配置的第三方密钥或真实限制
```

禁止把“接口存在”写成“真实OCR已经接入”。若未配置多模态模型，必须明确说明 OCR/AI 当前使用结构化兜底结果。
