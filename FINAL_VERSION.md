# AIxuexi Production 6.0 完整源码

本目录是正式启用版完整仓库源码，不包含 `.command`、`node_modules`、`dist`、前端构建产物、`.git` 或教材 PDF。

## 正式版边界

- 不启用 Demo、Mock API、示例学习数据或假数据回退。
- 不开放公开注册、6 位绑定码或家长端解除固定绑定。
- 不提供一键清空全部教材，避免误删 R2 原文件。
- 数据不足时显示空状态，不生成虚构掌握度、趋势、错题或画像。

## 正式启用迁移

数据库迁移 `2026-07-28-formal-launch-reset-v1` 只执行一次：

- 清除 `student_snapshots`。
- 清除非教材类 `student_records`。
- 保留 `users`、`parent_student_links`、`material-imports`、`knowledge-items`。
- 不调用任何 R2 删除接口。

## 教材与家长端

- 六科 34 册教材目录前后端一致。
- 自动识别正式书名、别名和历史文件名。
- 支持未匹配提示、真实处理进度、手动绑定和安全重新解析。
- 家长端读取真实学生快照时间、学习周期、完成状态和时长。
- 首页收敛为三项核心指标和四块主要图表。

## 完整检查

```bash
npm ci
npm --prefix backend ci
npm run check
```
