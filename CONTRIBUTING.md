# Contributing to Sophia's Dialectic

谢谢你愿意为 Sophia's Dialectic 出力。这份文档汇集本地启动方式、目录速览、常见扩展点（怎样加新分析路径 / 思想声音类型 / 预置模型）和提交规范。

## 本地启动

需要 Node.js ≥ 20（仓库里有 `.nvmrc` 与 `package.json` 的 `engines.node`）。

```bash
git clone <repo> sophia-dialectic
cd sophia-dialectic
nvm use            # 可选：自动切到 .nvmrc 指定的版本
npm ci
cp .env.local.example .env.local
# 在 .env.local 中填入真实的 SOPHIA_API_KEY；其余按需调整
npm run dev
```

打开 `http://127.0.0.1:7878`。本地 dev / preview 走 Vite 代理 (`/sophia-api`)，API key 不进入浏览器 bundle。

构建：

```bash
npm run build      # 输出到 dist/，并复制 index.html 为 404.html 用作 GitHub Pages 的 SPA 回退
npm test           # 运行 tsx/node:test 的最小质量门
npm run preview    # 在 7878 端口预览生产构建
```

提交前至少跑 `npm test` 与 `npm run build`；涉及 UI、路由或生成流的改动，需要再用浏览器手验关键路径。

## 目录速览

```
.
├── App.tsx                  # 主应用：路由协调与跨页状态装配
├── hooks/                   # useAnalysisRun / useHistoryLibrary 等应用状态 hooks
├── components/              # 视图组件
│   ├── AppShell.tsx         # 全局 shell、导航、弹窗挂载
│   ├── Arena.tsx            # 结果页操作、导出与 Continuation Studio
│   ├── ArenaSections.tsx    # 问题图谱、概念标记、路线图、综合等稳定结果区块
│   ├── ReasoningDisplay.tsx # 实时进度 + 生成日志面板挂载点
│   ├── HistoryPage.tsx      # 历史归档
│   ├── ManifestoPage.tsx    # 项目宣言页
│   ├── SettingsPage.tsx     # 设置页（模型切换 / 提示词 / token 预算）
│   ├── ThoughtVoiceCard.tsx # 单个思想声音卡片
│   ├── DynamicBackground.tsx + BackgroundScene.tsx
│   ├── GenerationLogPanel.tsx
│   └── TopicReframeDialog.tsx
├── services/
│   ├── sophiaService.ts     # 生成编排、阶段缓存、流式声音与头像流程
│   ├── apiClient.ts         # OpenAI-compatible 端点、headers、fetch retry 与 API 错误归一化
│   ├── historyStore.ts      # 历史 JSON 的 typed localStorage gateway + 头像拆分/迁移
│   ├── localStorageGateway.ts
│   ├── runSnapshotStore.ts  # IndexedDB run snapshot 恢复
│   ├── prompts.ts           # 集中管理的 system prompts
│   ├── sophiaConfig.ts      # 运行时配置 store（localStorage 持久化）
│   ├── modelPresets.ts      # GPT / MiMo / Grok preset 描述
│   ├── topicReframe.ts      # 提交前对非哲学输入的轻量 reframe
│   └── tokenAccounting.ts   # token 用量累计与持久化
├── utils/
│   ├── inputValidation.ts   # 共用的客户端输入校验
│   ├── routing.ts           # SPA route normalize / encode / decode helpers
│   ├── generationLog.ts     # 日志截断与 checkpoint 推断
│   ├── runLifecycle.ts      # active run progress / snapshot payload / log helpers
│   └── exportResult.ts      # AnalysisResult → Markdown 导出
├── tests/                   # node:test + tsx 质量门
├── data/
│   ├── preloadedHistory.ts  # 内置示例
│   └── reference-avatars/   # 参考头像 (PNG)
├── public/                  # 静态资源（HDR 等）
├── scripts/                 # 构建辅助脚本
├── constants.ts             # 共享常量（STAGE_LABEL / STAGE_ORDER 等）
├── types.ts                 # 全部数据形态声明
├── vite.config.ts           # Vite + 本地 API 代理 + define 注入
└── .github/workflows/       # GitHub Actions（自动部署到 GitHub Pages）
```

## 扩展点

### 加一个新的分析路径（mode）

例：想加 `dialectic_court`（辩证法庭）。

1. **`types.ts`** — `ProgramMode` 加 `'dialectic_court'`。
2. **`services/prompts.ts`** — 在 `MODE_LABELS` 加 `'dialectic_court': '辩证法庭'`；在 `outlineSystemPrompt` 的"可选分析路径"列表里加一行说明。
3. **`services/sophiaService.ts`** — 如果在编排里有 mode-aware 分支（比如 `school_seminar` 走的特殊路径），按需补上对应分支；否则走 `custom` 默认编排即可。
4. **`components/ArenaSections.tsx`** — 在 `modeIcon` 映射为合适的 lucide-react 图标。
5. **可选**：如果该 mode 需要专有渲染区域（像 `diagnosisFrame` / `thoughtExperiment` / `seminarMatrix`），在 `types.ts` 加新字段，在 `ArenaSections.tsx` 加对应 section。

### 加一个新的思想声音类型（voiceKind）

例：想加 `'fictional'`（虚构人物）。

1. **`types.ts`** — `VoiceKind` 加 `'fictional'`。
2. **`components/ThoughtVoiceCard.tsx`** — `kindLabel`（行 13）加 `'fictional': '虚构人物'`；`VOICE_KIND_SYMBOL`（行 53）加一个符号字符；如果 ERA 推断需要扩展，更新 `ERA_RULES` / `FALLBACK_ERA_LABEL`。
3. **`services/sophiaService.ts`** — `VOICE_KIND_AVATAR_SUBJECT`（行 182-188）加描述用于头像 prompt。
4. **`services/prompts.ts`** — 如果需要在 outline / voice prompts 里专门提到这种 kind，补段说明。

### 加一个新的预置模型

例：想加 `claude` preset。

1. **`vite.config.ts`** — 在 `define` 块加 `'process.env.SOPHIA_PRESET_CLAUDE_MODEL': JSON.stringify(env.SOPHIA_PRESET_CLAUDE_MODEL || '')`。
2. **`vite-env.d.ts`** — 在 `ProcessEnv` 接口加 `SOPHIA_PRESET_CLAUDE_MODEL: string`。
3. **`.github/workflows/deploy.yml`** — 在 build env 段加 `SOPHIA_PRESET_CLAUDE_MODEL: ${{ vars.SOPHIA_PRESET_CLAUDE_MODEL }}`。
4. **`services/modelPresets.ts`** — 加一项 `{ id: 'preset:claude', label: 'Claude', modelName: process.env.SOPHIA_PRESET_CLAUDE_MODEL, configured: !!process.env.SOPHIA_PRESET_CLAUDE_MODEL }`。
5. **DEPLOY.md / README.md** — 把新变量写进 GitHub Variables 表里。

### 改一段内置 prompt

直接编辑 `services/prompts.ts`。对应的设置页提示词面板支持运行时覆盖（写入 `sophia.settings.v1.promptOverrides`），所以本地实验不用每次改源码，但要把改动落到代码里时改这里。

## 提交规范

约定式提交（[Conventional Commits](https://www.conventionalcommits.org/)）：

```
type(scope): 简短描述

可选正文：解释 why。
```

`type` 用 `feat` / `fix` / `refactor` / `chore` / `docs` / `style` / `perf` / `test`。`scope` 是模块名（`prompts` / `settings` / `harness` / `generation` / `metrics` / `input` 等）。例子：

- `feat(settings): add prompt editor and runtime knobs`
- `fix(prompts): tighten tension content target to 220-320 chars`
- `refactor: extract stage labels to constants.ts`

提交前请确保：

- `npm test` 通过。
- `npm run build` 通过（隐含 TypeScript 检查）。
- 关键路径手验：首页输入 → 提交 → 生成日志面板 → 历史保存。
- 涉及生成或 prompt 改动时，跑一次完整生成做肉眼验证。

## 报问题与提 PR

- Bug 请用 `.github/ISSUE_TEMPLATE/bug_report.md` 模板，附浏览器、是否本地 / GH Pages、是否 BYO LLM、复现步骤。
- 新功能请用 `feature_request.md` 模板。
- PR 描述请参考 `.github/pull_request_template.md` 自测项。
