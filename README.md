# 知航 AI：家庭自用学习系统

只服务一个家庭、一个学生账号。没有公开注册、宣传首页、授权码、演示知识库或多教材版本。

## 学生端

登录后直接进入拍题：拍题、试卷、错题、训练、计划、分析、资料、设置。

## 资料与知识库

上传 ZIP 后保存到私有 Cloudflare R2，安全解压 PDF、图片、DOCX、PPTX、XLSX、EPUB 和文本文件。Qwen 解析内容并生成真实知识条目；首次使用新版资料页会清空旧演示知识。

## 固定教材

- 语文：人教版（人民教育出版社）
- 数学：人教版（A版）（人民教育出版社）
- 英语：外研版（外语教学与研究出版社）
- 历史：人教版（部编版），必修《中外历史纲要（上）》《中外历史纲要（下）》
- 地理：人教版（人民教育出版社）
- 思想政治：人教版（部编版）

## Qwen 深度学习链路

题目图片和试卷图片先写入家庭私有 R2，再由 Qwen 视觉模型理解题干、公式、图表、章节和知识点。讲解、训练和资料知识库会优先检索家庭上传的教材知识。

## 家庭查看

Render 设置 `FAMILY_STUDENT_EMAIL` 后，查看账号自动连接唯一学生，不再生成、输入或解除 6 位授权码。

## 部署

前端环境：`.env.student`、`.env.parent`。Render 变量模板：`backend-env.example`。R2 CORS：`R2_CORS.json`。

## 真实接口

完整接口说明见 `PRIVATE_API_ENDPOINTS.md`。资料 ZIP 使用浏览器直传 R2，不经过 Render 大文件请求；Render 只负责解压、AI 分析和写入知识库。

## 兼容已有 R2 变量

后端同时识别两套变量名：

- `R2_BUCKET_NAME` 或 `R2_BUCKET`
- `R2_ACCESS_KEY_ID` 或 `R2_ACCESS_KEY`
- `R2_SECRET_ACCESS_KEY` 或 `R2_SECRET_KEY`
- `R2_ENDPOINT_HOST` 或 `R2_ENDPOINT`
