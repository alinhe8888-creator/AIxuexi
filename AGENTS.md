# AIxuexi v1.4.0 项目执行规则

## 项目结构

```text
同一仓库
├─ 学生端 React/Vite：npm run build:student → dist-student
├─ 家长端 React/Vite：npm run build:parent → dist-parent
└─ Render Express API：backend/
```

学生端和家长端部署为两个不同的 Cloudflare Pages 项目和两个不同域名，共享同一个 Render API 与 PostgreSQL 数据库。

## 硬性规则

1. 学生端代码运行时不能出现家长端登录、注册、导航、入口或宣传文案。
2. 家长端代码运行时不能出现拍题、试卷分析、错题操作、训练等学生学习工具。
3. 不能依靠前端隐藏实现权限；`/api/parent/*` 必须校验登录、`parent` 角色以及绑定关系。
4. 学生 Token 访问家长接口必须返回 403，未绑定家长读取学生数据必须返回 404。
5. 前端菜单切换必须立即渲染，不能依赖刷新。
6. 页面渲染异常必须被错误边界捕获，不能显示整页白屏。
7. Cloudflare Pages 使用 BrowserRouter，并保留 `public/_redirects` 与 `public/_headers`。
8. Render 发布前必须执行数据库迁移。
9. 密钥只能放在 Render/Cloudflare 环境变量，不得提交到 GitHub。
10. 不使用旧 GitHub Pages workflow；仓库中不应存在 `.github/workflows/deploy-pages.yml`。
11. 不得把结构化兜底 OCR 宣传成真实 OCR 准确率。
12. 交付前必须执行完整 `npm run check`，不能只做构建。

## 验收命令

```bash
npm ci
npm --prefix backend ci
VITE_API_BASE_URL=https://aixuexi-api.onrender.com \
VITE_USE_MOCK_API=false \
VITE_ALLOW_API_FALLBACK=true \
npm run check
```

该命令必须通过：

```text
前端lint和TypeScript
学生端/家长端生产构建
11个学生导航和5个家长导航映射
后端TypeScript和构建
认证、OCR、AI、知识库、记录CRUD、报告、绑定、权限、CORS冒烟测试
```

## 关键生产验收

```text
学生端11个导航逐项点击，不刷新、不白屏
家长端5个导航逐项点击，不刷新、不白屏
深层路由直接刷新不404
学生端完全看不到家长端
家长端完全看不到学生工具
学生生成绑定码 → 家长绑定 → 读取学生汇总
学生学习数据更新 → Render同步 → 家长端数据更新
Console无未处理异常
Network无业务接口404
```
