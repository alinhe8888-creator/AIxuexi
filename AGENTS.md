# AIxuexi 项目执行规则

## 项目结构

- 仓库根目录：React + Vite + TypeScript 前端，部署到 Cloudflare Pages。
- `backend/`：Node.js + Express + PostgreSQL 后端，部署到 Render。
- `public/_redirects`：Cloudflare Pages SPA 路由回退，禁止删除。
- `public/_headers`：禁止缓存旧 `index.html`，解决更新后页面行为异常。

## 硬性规则

1. 学生账号不能看到家长端导航。
2. 学生直接访问 `/parent` 必须跳回学生端。
3. 后端 `/api/parent/*` 必须同时校验：登录、`parent` 角色、家长与学生绑定关系。
4. 不得只在前端隐藏家长入口冒充权限隔离。
5. 前端页面切换必须立即渲染，不能要求手动刷新。
6. Cloudflare Pages 使用 BrowserRouter + `/* /index.html 200`。
7. Render 后端必须执行数据库迁移。
8. 密钥只能放在 Cloudflare/Render 环境变量，不得提交 GitHub。
9. 不得继续使用旧的 GitHub Pages workflow；仓库中不应存在 `.github/workflows/deploy-pages.yml`。
10. 部署前必须运行前后端 typecheck 和 build。

## 验收命令

前端：

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

后端：

```bash
cd backend
npm ci
npm run typecheck
npm run build
```

## 关键验收流程

```text
注册学生账号
→ 完成学生端进入
→ 设置页生成 6 位绑定码
→ 注册家长账号
→ 家长端输入绑定码
→ 查看学生学习画像
→ 学生访问 /parent 被拒绝
→ 家长接口使用学生 token 返回 403
→ 各导航点击后立即显示，不刷新浏览器
→ 直接刷新任意前端路由仍能打开
```
