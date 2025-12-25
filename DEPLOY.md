# Sophia's Dialectic - GitHub Pages 部署指南

## 🚀 快速开始

### 本地预览

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置 API Key**
   
   编辑 `.env.local` 文件，将 `YOUR_DEEPSEEK_API_KEY_HERE` 替换为你的 DeepSeek API Key：
   ```
   DEEPSEEK_API_KEY=your_actual_api_key_here
   ```
   
   > 获取 DeepSeek API Key: https://platform.deepseek.com/

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   
   打开浏览器访问 `http://localhost:3000`

4. **构建预览**
   ```bash
   npm run build
   npm run preview
   ```

---

## 📦 部署到 GitHub Pages

### 步骤 1: 创建 GitHub 仓库

1. 在 GitHub 上创建一个新仓库，命名为 `sophia-dialectic`（或你喜欢的名字）
2. 如果仓库名称不同，需要修改 `vite.config.ts` 中的 `base` 路径

### 步骤 2: 配置 GitHub Secrets

1. 进入你的 GitHub 仓库
2. 点击 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**
4. 添加一个 secret:
   - **Name**: `DEEPSEEK_API_KEY`
   - **Value**: 你的 DeepSeek API Key

### 步骤 3: 启用 GitHub Pages

1. 进入仓库 **Settings** → **Pages**
2. 在 **Source** 下选择 **GitHub Actions**

### 步骤 4: 推送代码

```bash
# 初始化 Git（如果还没有）
git init

# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/sophia-dialectic.git

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Sophia's Dialectic with DeepSeek API"

# 推送到 main 分支
git push -u origin main
```

### 步骤 5: 等待部署

1. 进入仓库的 **Actions** 标签页
2. 查看 "Deploy to GitHub Pages" 工作流的运行状态
3. 部署完成后，访问 `https://YOUR_USERNAME.github.io/sophia-dialectic/`

---

## ⚠️ 重要安全提示

### API Key 安全

由于这是一个纯前端应用，API Key 会被打包到 JavaScript 中。这意味着：

1. **不要使用生产环境的高额度 API Key**
2. **建议在 DeepSeek 平台设置 API Key 的使用限额**
3. **定期轮换 API Key**

### 更安全的架构（可选）

如果你担心 API Key 暴露，可以考虑：

1. **使用 Cloudflare Workers 或 Vercel Functions 作为代理**
2. **部署到 Vercel/Netlify 并使用服务端函数**

---

## 🔧 自定义配置

### 修改仓库名称

如果你的仓库名称不是 `sophia-dialectic`，需要修改 `vite.config.ts`：

```typescript
base: process.env.GITHUB_ACTIONS ? '/your-repo-name/' : '/',
```

### 环境变量

| 变量名 | 说明 |
|--------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 |

---

## 📁 项目结构

```
sophia-dialectic/
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 部署配置
├── components/
│   ├── Arena.tsx           # 辩论场组件
│   ├── DynamicBackground.tsx # 3D 动态背景
│   ├── PhilosopherCard.tsx # 哲学家卡片
│   └── ReasoningDisplay.tsx # 推理过程展示
├── services/
│   └── deepseekService.ts  # DeepSeek API 服务
├── .env.local              # 本地环境变量（不上传）
├── App.tsx                 # 主应用组件
├── index.html              # HTML 入口
├── index.tsx               # React 入口
├── types.ts                # TypeScript 类型定义
├── vite.config.ts          # Vite 配置
└── package.json            # 项目依赖
```

---

## 🐛 常见问题

### Q: 部署后显示空白页？

A: 检查浏览器控制台错误，通常是 base 路径配置问题。确保 `vite.config.ts` 中的 base 与你的仓库名称一致。

### Q: API 请求失败？

A: 
1. 确保在 GitHub Secrets 中正确配置了 `DEEPSEEK_API_KEY`
2. 检查 API Key 是否有效
3. DeepSeek API 可能有地区限制

### Q: 3D 背景不显示？

A: 
1. 检查浏览器是否支持 WebGL
2. 某些移动设备可能性能不足

---

## 📜 许可证

MIT License
