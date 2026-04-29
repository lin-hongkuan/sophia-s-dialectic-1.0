# Sophia's Dialectic

Sophia's Dialectic 是一个用 Vite + React 构建的“哲学问题生成与辩证分析”网页应用。用户输入一个现代困惑、伦理难题或哲学问题后，系统会调用 OpenAI-compatible API，把问题展开成结构化的长篇分析：包括问题重述、思想声音、多路线张力、概念解释、开放结论和可继续追问的方向。

项目适合用作个人哲学思考工具、知识展示页面、AI 交互实验，或部署成一个公开可访问的 GitHub Pages 静态站点。

## 主要功能

- 输入任意问题并生成完整的辩证分析。
- 支持多种分析模式，例如层层深入、圆桌辩论、历史谱系、思想实验等。
- 为不同“思想声音”生成长文观点卡片。
- 支持思想声音头像生成，生图模型可配置。
- 首页可以用 AI 生成新的哲学问题建议。
- 内置历史记录和预置示例，方便回看和演示。
- 本地开发通过 Vite 代理解决 CORS 问题。
- 已内置 GitHub Actions，可自动部署到 GitHub Pages。

## 本地运行

需要 Node.js 20 或更高版本。

1. 安装依赖：

```bash
npm install
```

2. 创建 `.env.local`：

```env
SOPHIA_API_KEY=your_key_here
SOPHIA_API_BASE_URL=https://api.linhongkuan.com/v1
SOPHIA_API_MODEL=gpt-5.4-mini
SOPHIA_IMAGE_MODEL=grok-imagine-image-lite
SOPHIA_API_PROVIDER=OpenAI-compatible
```

变量说明：

| 变量 | 说明 |
| --- | --- |
| `SOPHIA_API_KEY` | OpenAI-compatible API Key |
| `SOPHIA_API_BASE_URL` | API 基础地址，例如 `https://api.linhongkuan.com/v1` |
| `SOPHIA_API_MODEL` | 文本生成模型 |
| `SOPHIA_IMAGE_MODEL` | 生图模型 |
| `SOPHIA_API_PROVIDER` | 页面错误提示中展示的供应商名称 |

3. 启动开发服务器：

```bash
npm run dev
```

打开 `http://127.0.0.1:7878`。

本地 `dev` 和 `preview` 会使用 Vite 代理 `/sophia-api` 转发请求，浏览器不会直接请求 `api.linhongkuan.com`，因此可以避免本地 CORS 报错。本地 API key 由 Vite 代理添加，不会注入本地浏览器 bundle。

## 构建和预览

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/deploy.yml`。每次推送到 `main` 分支后，GitHub Actions 会自动构建 `dist/` 并部署到 GitHub Pages。

### 1. 配置 GitHub Secret

进入 GitHub 仓库：Settings → Secrets and variables → Actions → Secrets → New repository secret。

添加：

| Name | Value |
| --- | --- |
| `SOPHIA_API_KEY` | 你的 OpenAI-compatible API Key |

### 2. 可选配置 GitHub Variables

进入 GitHub 仓库：Settings → Secrets and variables → Actions → Variables → New repository variable。

可配置：

| Name | 默认值 | 用途 |
| --- | --- | --- |
| `SOPHIA_API_BASE_URL` | `https://api.linhongkuan.com/v1` | OpenAI-compatible API 地址 |
| `SOPHIA_API_MODEL` | `gpt-5.4-mini` | 文本生成模型 |
| `SOPHIA_IMAGE_MODEL` | `grok-imagine-image-lite` | 生图模型 |
| `SOPHIA_API_PROVIDER` | `OpenAI-compatible` | 页面错误提示里的供应商名称 |

如果不配置 Variables，workflow 会使用上面的默认值。

### 3. 启用 GitHub Pages

进入 GitHub 仓库：Settings → Pages → Build and deployment → Source，选择 `GitHub Actions`。

### 4. 推送代码

```bash
git push origin main
```

推送后进入仓库的 Actions 页面查看 `Deploy to GitHub Pages` 工作流。成功后，GitHub 会在 Pages 设置页展示访问地址。

## 关于 CORS

本地开发时，Vite 代理会解决 CORS。

GitHub Pages 是静态托管，线上页面会从浏览器直接请求 `SOPHIA_API_BASE_URL`。因此你的 API 服务必须允许 GitHub Pages 域名跨域访问。若目标 API 不支持 CORS，需要增加服务端代理，例如 Cloudflare Workers、Vercel Functions 或自己的后端服务。

## 安全提示

GitHub Pages 不能隐藏前端使用的 API key。部署版本里，Vite 会把 API 配置注入浏览器 bundle，API key 可能被用户从前端代码中看到。因此建议：

1. 不要使用高额度生产 API Key。
2. 使用限额 key，并限制额度和可用模型。
3. 定期轮换 key。
4. 如果要真正隐藏 key，请改用服务端代理。

## 项目结构

```text
components/              # 页面组件
services/sophiaService.ts # OpenAI-compatible API 调用与结果规范化
data/                    # 预置示例和参考头像资源
scripts/                 # 辅助脚本
App.tsx                  # 主应用与生成流程
vite.config.ts           # Vite 环境变量与本地代理配置
.github/workflows/       # GitHub Pages 自动部署 workflow
```
