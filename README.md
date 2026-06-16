# AI 求职画布

AI 求职画布是一个面向学生求职场景的 AI 工作台。产品以画布为主界面，把简历画像、岗位推荐、JD 匹配分析、简历优化建议和不同版本的优化简历拆成可追溯的文本节点，帮助用户看清楚一次求职决策是如何被分析和迭代出来的。

## 当前能力

- 账号登录与受保护工作区。
- 画布式 AI 对话工作区，左侧展示节点，右侧进行对话和上传。
- 支持上传简历和 JD 文件，格式包括 PNG、JPG、JPEG、WebP、MD、DOC、DOCX。
- 对图片类 JD/简历先做服务端 OCR，再交给 AI 分析。
- AI 生成用户画像、至少 5 个岗位方向、岗位介绍、JD 匹配分析、简历优化建议和优化版简历。
- 每次用户输入都会生成独立输入节点，后续分析节点保留版本历史。
- 节点和连线持久化到 Supabase。
- 支持拖拽、缩放节点，并保留用户手动调整的位置和尺寸。
- 支持导出当前画布为 Markdown。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- lucide-react
- Supabase Auth / Database / Storage
- `@xyflow/react` 画布
- Tesseract.js OCR
- Kimi / Moonshot 兼容 OpenAI Chat Completions 的服务端 AI 调用

## 本地运行

安装依赖：

```bash
pnpm install
```

复制环境变量模板：

```bash
cp .env.example .env
```

填写 `.env` 中的 Supabase 和 AI 配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key

AI_PROVIDER=kimi
AI_API_KEY=your-secret-token
AI_BASE_URL=https://api.moonshot.cn/v1
AI_MODEL=kimi-k2.6

APP_UPLOAD_BUCKET=career-canvas-assets
APP_MAX_UPLOAD_MB=10
APP_AI_TIMEOUT_MS=120000
APP_OCR_LANG=chi_sim
```

启动开发服务器：

```bash
pnpm dev
```

打开 `http://localhost:3000`。

## Supabase 初始化

项目的数据库和 Storage 结构位于 `supabase/migrations/`。

首个版本的核心表包括：

- `job_workspaces`
- `uploaded_files`
- `canvas_nodes`
- `canvas_edges`
- `ai_messages`

私有文件桶默认为：

```text
career-canvas-assets
```

执行迁移前请确认目标 Supabase 项目正确，且不要把 service role key、数据库密码、AI token 写入前端代码或提交到仓库。

## 常用命令

```bash
pnpm lint
pnpm build
pnpm dev
pnpm start
```

## 文档结构

- `docs/prd.md`：产品需求、已确认决策和待办问题。
- `docs/api/`：AI 工作流、画布节点规范、接口契约、环境变量和 Supabase 数据模型。
- `docs/images/`：产品参考图和截图资产。

## 产品原则

- 画布不是装饰，而是用来保留求职分析的上下文、版本和推理路径。
- 一个节点只负责一类内容，避免长对话里信息混在一起。
- JD 分析和简历优化必须基于用户提供的真实材料，不能编造经历、指标、证书或技能。
- AI 调用只在服务端执行，浏览器不能拿到 AI provider token。
- 用户上传的简历和 JD 属于敏感数据，默认走私有存储和最小权限访问。
