# Sophia's Dialectic - GitHub Pages 部署指南

## 本地预览

1. 安装依赖

```bash
npm install
```

2. 配置 `.env.local`

```env
SOPHIA_API_KEY=your_key_here
SOPHIA_API_BASE_URL=https://api.linhongkuan.com/v1
SOPHIA_API_MODEL=gpt-5.4-mini
SOPHIA_API_PROVIDER=OpenAI-compatible
```

3. 启动开发服务器

```bash
npm run dev
```

打开 `http://localhost:7878`。

4. 构建预览

```bash
npm run build
npm run preview
```

## 部署到 GitHub Pages

### 1. 配置 GitHub Secret

进入仓库：Settings → Secrets and variables → Actions → New repository secret。

添加：

| Name | Value |
| --- | --- |
| `SOPHIA_API_KEY` | 你的 OpenAI-compatible API Key |

当前 workflow 已默认使用：

```env
SOPHIA_API_BASE_URL=https://api.linhongkuan.com/v1
SOPHIA_API_MODEL=gpt-5.4-mini
SOPHIA_API_PROVIDER=OpenAI-compatible
```

### 2. 启用 GitHub Pages

Settings → Pages → Source 选择 GitHub Actions。

### 3. 推送 main 分支

GitHub Actions 会自动构建并部署到 Pages。

## 重要安全提示

这是纯前端应用，Vite 会把环境变量注入浏览器 bundle。因此：

1. 不要使用高额度生产 API Key。
2. 建议使用限额 key。
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
types.ts                 # 结果模型与生成进度类型
vite.config.ts           # Vite 环境变量注入
```

## 常见问题

### 部署后显示缺少 API Key

确认 GitHub Actions Secret 中存在 `SOPHIA_API_KEY`，并重新触发部署。

### 生成很慢

长篇思想声音是核心体验。当前采用先生成分析骨架，再并发生成长文卡片的方式；用户会先看到页面结构和生成进度，长文完成一篇显示一篇。

### API Key 是否安全？

前端直连不隐藏 key。正式公开运营前建议加服务端代理。
