# Sophia's Dialectic - GitHub Pages 部署指南

## 本地运行

1. 安装依赖

```bash
npm ci
```

2. 配置 `.env.local`

```env
SOPHIA_API_KEY=your_key_here
SOPHIA_API_BASE_URL=https://api.linhongkuan.com/v1
SOPHIA_API_MODEL=gpt-5.4-mini
SOPHIA_IMAGE_MODEL=grok-imagine-image-lite
SOPHIA_IMAGE_SIZE=1024x1024
SOPHIA_IMAGE_ASPECT_HINT=portrait 1:1.2 aspect ratio
SOPHIA_API_PROVIDER=OpenAI-compatible
```

3. 启动开发服务器

```bash
npm run dev
```

打开 `http://127.0.0.1:7878`。

本地 `dev` 和 `preview` 会使用 Vite 代理 `/sophia-api` 转发请求，浏览器不会直接请求 `api.linhongkuan.com`，因此不会触发本地 CORS 报错。本地 API key 由 Vite 代理添加，不会注入本地浏览器 bundle。

4. 构建预览

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/deploy.yml`。每次推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

### 1. 配置 GitHub Secret

进入仓库：Settings → Secrets and variables → Actions → Secrets → New repository secret。

添加：

| Name | Value |
| --- | --- |
| `SOPHIA_API_KEY` | 你的 OpenAI-compatible API Key |

### 2. 可选配置 GitHub Variables

进入仓库：Settings → Secrets and variables → Actions → Variables → New repository variable。

可配置：

| Name | 默认值 | 用途 |
| --- | --- | --- |
| `SOPHIA_API_BASE_URL` | `https://api.linhongkuan.com/v1` | OpenAI-compatible API 地址 |
| `SOPHIA_API_MODEL` | `gpt-5.4-mini` | 文本生成模型 |
| `SOPHIA_IMAGE_MODEL` | `grok-imagine-image-lite` | 生图模型 |
| `SOPHIA_API_PROVIDER` | `OpenAI-compatible` | 页面错误提示里的供应商名称 |

如果不配置 Variables，workflow 会使用上面的默认值。

### 3. 启用 GitHub Pages

进入仓库：Settings → Pages → Build and deployment → Source，选择 `GitHub Actions`。

### 4. 推送 main 分支

```bash
git push origin main
```

推送后进入仓库的 Actions 页面查看 `Deploy to GitHub Pages` 工作流。成功后 GitHub 会在 Pages 设置页展示访问地址。

## 重要安全提示

GitHub Pages 是静态托管。部署版本里，Vite 会把 API 配置注入浏览器 bundle，API key 可能被用户从前端代码中看到。因此：

1. 不要使用高额度生产 API Key。
2. 建议使用限额 key，并限制额度和可用模型。
3. 定期轮换 key。
4. 如果要真正隐藏 key，需要增加 Cloudflare Workers、Vercel Functions 或其他服务端代理。

## 项目结构

```text
components/
  Arena.tsx              # 结果页节目化布局
  HistoryPage.tsx        # 历史结果归档
  ReasoningDisplay.tsx   # 实时生成进度
  ThoughtVoiceCard.tsx   # 长篇思想声音卡片
services/
  sophiaService.ts       # Sophia OpenAI-compatible API 服务
data/
  preloadedHistory.ts    # 预置参考样本
App.tsx                  # 主应用与渐进生成流程
types/domain.ts                 # 结果模型与生成进度类型
vite.config.ts           # Vite 环境变量与本地代理配置
```

## 常见问题

### 部署后显示缺少 API Key

确认 GitHub Actions Secret 中存在 `SOPHIA_API_KEY`，然后重新运行 Actions 或重新推送一次 main。

### 部署后仍然 CORS

GitHub Pages 线上没有 Vite dev proxy。线上是静态页面直连 `SOPHIA_API_BASE_URL`，所以目标 API 服务必须允许 GitHub Pages 域名跨域访问。若 API 不支持 CORS，需要改用服务端代理，例如 Cloudflare Workers 或 Vercel Functions。

### 如何更换生图模型？

在 GitHub Variables 里设置 `SOPHIA_IMAGE_MODEL`，例如改为你的 OpenAI-compatible 服务支持的图片模型名。修改后重新运行 GitHub Actions 部署。

### 生成很慢

长篇思想声音是核心体验。当前采用先生成分析骨架，再并发生成长文卡片的方式；用户会先看到页面结构和生成进度，长文完成一篇显示一篇。
