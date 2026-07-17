# 交给 Codex 的完整执行提示词

你现在负责把“AIxuexi 学生端 + 独立家长端”完整更新到 GitHub，并使用我当前打开的 Chrome 浏览器，通过 Computer Use 完成 Cloudflare Pages 前端和 Render 后端部署。

## 一、工作目录和仓库

本地代码目录：

```text
~/Downloads/AIxuexi-parent-portal-v1.2.0
```

如果实际解压目录名称略有不同，先在 `~/Downloads` 中定位包含以下文件的目录：

```text
AGENTS.md
README.md
package.json
backend/package.json
public/_redirects
render.yaml
```

GitHub 仓库：

```text
https://github.com/alinhe8888-creator/AIxuexi
```

默认分支：

```text
main
```

## 二、执行原则

1. 先完整阅读 `AGENTS.md`、`README.md`、`.env.example`、`backend/.env.example` 和 `render.yaml`。
2. 不要重新设计产品，不要删减家长端功能。
3. 学生端不能出现家长端入口。
4. 学生访问 `/parent` 必须被前端拦截；学生 token 请求 `/api/parent/*` 必须返回 403。
5. 不依赖 GitHub CLI。当前 GitHub CLI 未通过身份验证，使用当前已登录 GitHub 的 Chrome 页面和 Computer Use 操作。
6. 不创建任何付费资源。若现有 Render 后端没有 PostgreSQL，且平台只提供付费数据库，暂停并明确告诉用户需要确认费用。
7. 不把密码、JWT_SECRET、DATABASE_URL 或 Render 密钥提交到 GitHub。
8. 必须删除仓库旧文件 `.github/workflows/deploy-pages.yml`，避免 GitHub Actions 继续执行 npm 并报错。
9. 不能只上传 ZIP 文件到仓库，必须上传解压后的真实项目文件。
10. 全部部署、验证完成后再宣布结束。

## 三、先在本地检查代码

在项目根目录执行：

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

在后端目录执行：

```bash
cd backend
npm ci
npm run typecheck
npm run build
cd ..
```

确认：

```text
dist/index.html 存在
dist/_redirects 存在
dist/_headers 存在
backend/dist/server.js 存在
backend/dist/migrate.js 存在
```

任何检查失败必须先修复，不得跳过。

## 四、使用 Chrome Computer Use 更新 GitHub

使用当前打开且已登录 GitHub 的 Chrome：

1. 打开仓库 `alinhe8888-creator/AIxuexi`。
2. 删除旧的 `.github/workflows/deploy-pages.yml`。
3. 将本地项目文件完整更新到仓库根目录。
4. 确保隐藏文件和目录也被提交：
   - `.env.example`
   - `.gitignore`
   - `public/_redirects`
   - `public/_headers`
   - `backend/.env.example`
5. 确保以下新目录存在：
   - `src/auth`
   - `src/parent`
   - `src/pages/parent`
   - `backend`
6. 提交信息：

```text
Add protected parent portal and fix Cloudflare SPA navigation
```

7. 提交到 `main`。
8. 回到仓库文件页核对最新提交和关键文件内容。

如果 GitHub 网页不适合一次上传大量文件，允许在本地使用已认证的 GitHub Desktop；不要依赖未认证的 GitHub CLI。

## 五、使用 Chrome Computer Use 部署 Render 后端

1. 在当前 Chrome 打开 Render Dashboard。
2. 找到 AIxuexi 当前后端服务。
3. 优先更新现有服务，不重复创建同名后端。
4. 将服务连接到 GitHub 仓库 `alinhe8888-creator/AIxuexi` 的 `main` 分支。
5. 配置：

```text
Root Directory：backend
Runtime：Node
Build Command：npm ci && npm run build
Pre-Deploy Command：npm run migrate
Start Command：npm start
Health Check Path：/api/health
```

6. 环境变量：

```text
NODE_ENV=production
DATABASE_URL=复用现有Render PostgreSQL连接地址
JWT_SECRET=生成至少32位随机字符串
CORS_ORIGIN=Cloudflare Pages正式域名
```

`CORS_ORIGIN` 如有多个域名，用英文逗号分隔，例如：

```text
https://项目名.pages.dev,https://正式域名.com
```

7. 触发后端部署。
8. 等待部署成功。
9. 在浏览器打开：

```text
https://后端域名.onrender.com/api/health
```

必须返回 `ok: true`。
10. 记录最终 Render API URL。

## 六、使用 Chrome Computer Use 部署 Cloudflare Pages 前端

1. 打开 Cloudflare Dashboard。
2. 找到现有 AIxuexi Pages 项目。
3. 将项目连接到 `alinhe8888-creator/AIxuexi` 的 `main` 分支。
4. 配置：

```text
Framework preset：Vite
Root Directory：/
Build Command：npm ci && npm run build
Build Output Directory：dist
```

5. 设置生产环境变量：

```text
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=刚才确认的Render API URL
```

API URL 末尾不要加 `/`。
6. 保存并触发重新部署。
7. 等待部署成功，记录 Cloudflare Pages 正式地址。
8. 回到 Render，把 `CORS_ORIGIN` 更新为准确的 Cloudflare Pages 地址和正式域名，再部署一次后端。
9. 再部署一次 Cloudflare 前端，确保环境变量和后端地址均为最终值。

## 七、必须完成的浏览器验收

### A. 路由即时显示

在前端依次点击：

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

每次点击后页面必须立即显示，不允许手动刷新。

然后直接打开并刷新以下地址：

```text
/photo-explain
/mistakes
/reports
/settings
```

刷新后仍必须正常显示，不得出现 Cloudflare 404。

### B. 学生账号

1. 注册一个测试学生账号。
2. 确认学生端没有任何“家长端”菜单或按钮。
3. 直接在地址栏输入 `/parent`。
4. 必须自动回到学生端。
5. 在个人设置生成 6 位家长绑定码。

### C. 家长账号

1. 退出学生账号。
2. 注册一个测试家长账号。
3. 登录后必须直接进入 `/parent`。
4. 使用学生生成的绑定码完成绑定。
5. 确认可以看到：
   - 今日完成率
   - 综合掌握度
   - 薄弱知识点
   - 错题与错因
   - 小测趋势
   - 学习报告
6. 家长端不能进入学生拍题、答案或学习操作页面。

### D. 后端权限

使用学生登录 token 请求任意 `/api/parent/*` 接口，必须返回 403。

未绑定的家长访问某个学生 dashboard，必须返回 404。

### E. 同步

1. 学生完成一个任务或小测。
2. 等待约 2 秒。
3. 切换到家长账号并刷新家长数据。
4. 家长端数据必须更新。

## 八、完成后输出

最后只输出以下结果：

```text
1. GitHub 最新提交地址
2. Cloudflare Pages 正式地址
3. Render API 正式地址
4. Render /api/health 验证结果
5. 学生端路由点击测试结果
6. 家长端绑定与权限测试结果
7. 修改/新增文件清单
8. 尚存风险（如有）
```

不要只告诉用户“代码已上传”或“部署成功”，必须给出真实地址和逐项验收结果。
