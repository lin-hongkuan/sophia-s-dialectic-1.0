# Sophia's Dialectic

> Where your modern anxieties become a map of thought.
> 输入一个困惑，生成一份可阅读的哲学分析。

Sophia's Dialectic 是一个用 Vite + React 18 构建的「哲学问题生成与辩证分析」单页应用。把一句现代困惑、伦理难题、价值争论或破碎的牢骚扔进首页输入框，Sophia 会调用 OpenAI-compatible 的 LLM API，把它展开成一份结构化的长篇分析：哲学化标题、问题重述、论证路线、2-5 位思想声音的长文论述（带头像）、声音之间的真实分歧、概念注解、综合判断、可继续追问的方向。

整个项目零后端，可以纯静态部署到 GitHub Pages；运行时所有的设置（模型切换、自带 LLM、提示词覆盖、运行参数、token 预算）都保存在用户浏览器里，对下一次生成立即生效，不需要重新部署。

适合的使用场景：

- 个人哲学思考与学习工具。
- 知识展示型博客 / 数字花园里的「思考引擎」入口。
- AI 编排实验场（多 prompt、并发流式、JSON-only 解析、错误回退）。
- 课堂演示、工作坊、读书会。
- 对一个 -ism 或一组立场做快速比较。

---

## 目录

- [核心功能](#核心功能)
- [快速开始（本地运行）](#快速开始本地运行)
- [环境变量](#环境变量)
- [Settings 页详解](#settings-页详解)
- [路由与页面](#路由与页面)
- [分析模式与思想声音类型](#分析模式与思想声音类型)
- [生成流程与可观测性](#生成流程与可观测性)
- [本地数据：localStorage 与 IndexedDB](#本地数据localstorage-与-indexeddb)
- [站内公告管理](#站内公告管理)
- [部署到 GitHub Pages](#部署到-github-pages)
- [关于 CORS](#关于-cors)
- [安全提示](#安全提示)
- [项目结构](#项目结构)
- [扩展指南](#扩展指南)
- [常见问题](#常见问题)
- [许可证](#许可证)

---

## 核心功能

### 生成

- **任意输入 → 完整辩证分析**：标题、导言、问题翻译、关键词、阅读结构、论证路线图、长篇思想声音、张力、综合判断、延伸追问。
- **多种分析路径**：层层深入 / 圆桌辩论 / 历史谱系 / 两难困境 / 概念考古 / 思想实验 / 流派研讨会 / 哲学门诊 / 思想实验出路 / 自由编排，由模型按问题自动选路。
- **5 种思想声音类型**：哲学家（philosopher）、流派（school）、概念（concept）、立场（position）、当代批评者（contemporary）。
- **思想头像生成**：每位思想声音同步生成一张博物馆肖像风格的头像（OpenAI-compatible `/images/generations`），与正文并行流式产出。
- **流式生成**：所有长文走 SSE 流式，App 端做 120ms 节流；流式中断会自动回退到非流式重试。
- **并发可调**：同一份分析里多位思想声音并发生成（默认 3 路，可在 Settings 调到 1-5）。

### 输入与编辑流

- **AI 生成首页问题建议**：首页 Sparkles 按钮一键让 LLM 生成 5 个新问题。
- **Topic reframe 转译**：当用户输入一个不像哲学问题的词（"奥特曼"、"自由"、"一句吐槽"）时，先用一次轻量 LLM 调用判断是否需要转译，并给出 3 个候选哲学化标题。用户可以选一个、保留原句、或取消。
- **客户端输入校验**：URL-only / 纯数字 / 纯 emoji / 纯标点 / 太短太长会被拦下并附建议（`utils/inputValidation.ts`）。
- **思想声音可重试**：单卡失败时，结果页该声音底部出现"重新生成"，只重跑这一位、其余复用。
- **追加思想声音**：在结果页对话栏输入"加缪会怎么说？"或"让阿伦特加入讨论"，会先规划新声音，再生成长文 + 头像 + 重算分歧与综合判断。
- **沿着追问继续**：点击 followUps 中的延伸问题，会带着上一份的标题、张力、结论作为 continuation context，开启一份延伸分析。

### 阅读体验

- **R3F 动态背景**：基于 `@react-three/fiber` 的轻量背景；首页可见时显示前置遮挡，进入结果页/历史/设置后自动收起。
- **博物馆主题**：自定义 `museum` 调色板 + Playfair / Inter / 思源宋体的字体组合，长文中文按"宋体感"渲染。
- **响应式 + 减少动画**：`prefers-reduced-motion` 媒体查询会关闭过度动画。
- **静态预置示例**：首页"Explore Preloaded Sample"打开 `/history/sample`，零配置就能看到一份完整的样本分析（包括打包好的本地头像 PNG）。

### 设置（运行时改动，无需重新部署）

详见 [Settings 页详解](#settings-页详解)。一切改动只写到当前浏览器的 `localStorage`，不影响其他用户。

- **生成模型切换**：在预置 GPT / MiMo / Grok 之间切换，或填入完全自定义的 OpenAI-compatible 网关（base URL + key + 文本/生图模型名）。
- **提示词编辑**：4 个核心 system prompt（outline / voice / synthesis / topic-reframe）支持运行时覆盖。
- **头像风格**：6 套头像视觉风格预设（博物馆肖像、像素艺术、电影写实、水彩素描、极简线稿、古典油画），可一键切换或精调具体字段。
- **运行参数**：temperature（0-1.2）、思想声音并发数（1-5）、单声音 max tokens（2000-12000）。
- **Token 预算面板**：今日 / 本周 / 本月 / 累计 token 用量，按阶段（outline / route / voices / synthesis / append / reflection / reframe / suggestion / avatar）和按模型聚合，CSV 导出。
- **连接测试**：当前 provider 的一次最小 ping，定位 401/403/404/429/5xx 等错误并本地化。
- **整体导入导出**：`settings.json` 完整导出 / 导入，方便迁移。

### 历史与归档

- **本地历史**：最多 10 条最近的分析存在 `localStorage`（`sophia.history.v1`）。
- **JSON 导入 / 导出**：在 History 页一键导出全部历史；按 schema 导入会做去重 + 排序 + 数量上限处理。
- **预置示例**：`data/preloadedHistory.ts` 是一份打包到 bundle 的样本（女性主义流派研讨会 + 5 张本地 PNG 头像）；用户可以"重新生成预置示例"得到自己版本，覆盖到 `sophia.preset.generated.feminism.v1`。
- **IndexedDB 头像存储**：base64 头像图（每张 200-300KB）放在 IndexedDB（`sophia-images-v1`），让 5MB 的 localStorage 配额不再成为瓶颈。已有的旧版数据会在首次加载时自动迁移。

### 部署与构建

- **Vite 6 + React 18**：极简构建，依赖 lock 在 `package-lock.json`。
- **GitHub Pages 自动部署**：仓库内置 `.github/workflows/deploy.yml`，push 到 `main` 自动构建并发布。
- **SPA fallback**：构建后 `dist/index.html` 会被复制为 `dist/404.html`，让 GH Pages 把所有未知路径回落到 SPA 路由。
- **本地 API 代理**：`npm run dev` 和 `npm run preview` 会把请求经过 `/sophia-api` 代理转发，并在代理层注入 `Authorization`，浏览器 bundle 不接触 key。
- **GitHub Actions 构建**：构建时 `GITHUB_ACTIONS=true` 会关闭本地代理，直连 `SOPHIA_API_BASE_URL`。
- **lazy chunk**：three.js 与 R3F 拆成独立 chunk，首页空闲时通过 `requestIdleCallback` 加载。

---

## 快速开始（本地运行）

### 前置条件

- Node.js **≥ 20**（仓库 `.nvmrc` 与 `package.json#engines.node` 都锁定 20+）。
- npm（项目用 `package-lock.json`，请用 `npm ci` 而不是 `pnpm` / `yarn`）。
- 一个 OpenAI-compatible 的 API 服务（默认指向 `https://api.linhongkuan.com/v1`，你也可以指自己的 OpenAI / Azure / 本地 vLLM / Cloudflare Workers AI 网关）。

### 步骤

```bash
git clone https://github.com/lin-hongkuan/sophia-s-dialectic-1.0.git sophia-dialectic
cd sophia-dialectic

# 可选：自动切换到 .nvmrc 指定的 Node 版本
nvm use

npm ci
cp .env.local.example .env.local
# 编辑 .env.local，至少填上 SOPHIA_API_KEY
npm run dev
```

打开 `http://127.0.0.1:7878`。

> **CORS 友好提示**：本地 `dev` 与 `preview` 都通过 Vite 的代理 (`/sophia-api`) 转发请求，由代理层注入 `Authorization`，所以浏览器永远只跟自己的本地端口说话；同时 API key 不会进入本地浏览器 bundle。

### 可用脚本

| 命令 | 行为 |
| --- | --- |
| `npm run dev` | Vite dev server，固定 `127.0.0.1:7878`，启用本地 API 代理。 |
| `npm run build` | 构建到 `dist/`，并把 `dist/index.html` 复制为 `dist/404.html`（GH Pages SPA 回退）。 |
| `npm run preview` | 在 `127.0.0.1:7878` 预览生产构建，仍走本地 API 代理。 |
| `npm test` | 运行 `tsx --test` 的最小质量门，覆盖 routing、输入校验、生成日志等纯函数。 |

本地交付前建议至少跑 `npm test` + `npm run build`；涉及 UI 的改动还应启动 `npm run dev` 或 `npm run preview` 做浏览器手验。

---

## 环境变量

所有变量都通过 `.env.local`（本地开发）或 GitHub Secrets / Variables（部署）注入。Vite 在构建时通过 `define` 把它们写入 `process.env.SOPHIA_*`（见 `vite.config.ts`）。

### 必填

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SOPHIA_API_KEY` | _空_ | OpenAI-compatible API Key。本地由 Vite 代理注入 `Authorization`；GH Pages 部署版会写入 bundle，请用限额 key。空值时会触发首页"未配置 API key"提示。 |

### 可选

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SOPHIA_API_BASE_URL` | `https://api.linhongkuan.com/v1` | API 基础地址。结尾不要带 `/`。 |
| `SOPHIA_API_MODEL` | `gpt-5.4-mini` | 默认文本模型；当某个 preset 的专属变量未设置时也会回退到它。 |
| `SOPHIA_IMAGE_MODEL` | `grok-imagine-image-lite` | 思想头像生图模型。 |
| `SOPHIA_IMAGE_SIZE` | `1024x1024` | 头像生图尺寸。 |
| `SOPHIA_IMAGE_ASPECT_HINT` | `portrait 1:1.2 aspect ratio` | 拼到头像 prompt 末尾的画幅提示。 |
| `SOPHIA_API_PROVIDER` | `OpenAI-compatible` | 仅出现在错误提示文案里的供应商展示名。 |
| `SOPHIA_PRESET_GPT_MODEL` | 与 `SOPHIA_API_MODEL` 同 | Settings 页 GPT preset 卡用的文本模型。 |
| `SOPHIA_PRESET_MIMO_MODEL` | `mimo-v2.5-pro` | Settings 页 MiMo preset 卡用的文本模型。 |
| `SOPHIA_PRESET_GROK_MODEL` | `grok-4.20-0309-non-reasoning` | Settings 页 Grok preset 卡用的文本模型。 |

### `.env.local` 示例

```env
SOPHIA_API_KEY=sk-your-real-key
SOPHIA_API_BASE_URL=https://api.linhongkuan.com/v1
SOPHIA_API_MODEL=gpt-5.4-mini
SOPHIA_IMAGE_MODEL=grok-imagine-image-lite
SOPHIA_API_PROVIDER=OpenAI-compatible

# 可选：设置后 Settings 页相应 preset 卡可点击；不设置则显示为"未配置"。
SOPHIA_PRESET_GPT_MODEL=gpt-5.4-mini
SOPHIA_PRESET_MIMO_MODEL=mimo-v2.5-pro
SOPHIA_PRESET_GROK_MODEL=grok-4.20-0309-non-reasoning
```

未配置的预置模型会在 Settings 页以灰色"未配置"卡片展示，并附操作员提示（"请在 GitHub Variables / .env.local 中设置 SOPHIA_PRESET_XX_MODEL 后重新部署"），用户点击不会切换。

---

## Settings 页详解

打开 `/settings`（顶部导航 `Settings`）。所有改动**立即对下一次生成生效**，写到当前浏览器的 `localStorage` (`sophia.settings.v1`)，不会污染其他用户和其他设备。

### 1. 生成模型（Provider）

- **预置 preset**：GPT / MiMo / Grok 三张卡，分别绑到 `SOPHIA_PRESET_{GPT,MIMO,GROK}_MODEL`。三者共享同一个 `SOPHIA_API_BASE_URL` 和 `SOPHIA_API_KEY`，差异只在请求体里的 `model` 字段。
- **自定义 LLM**：单独一张卡，可以填自己的 base URL、key、文本模型、生图模型。所有字段只活在 localStorage；导出 `settings.json` 会带上 key（注意安全）。
- **测试连接**：发一次 `max_tokens=1` 的 ping。401 / 403 / 404 / 429 / 5xx 都会给本地化的解释和延迟数字。

### 2. 系统提示词（Prompts）

可覆盖 4 个核心 prompt：

| 键 | 何时被用 |
| --- | --- |
| `outlineSystem` | 生成大问题、分析路径、声音名单。 |
| `voiceSystem` | 单个思想声音的 1800-2400 字论述写作。 |
| `synthesisSystem` | 张力、关键词、综合判断、延伸追问。 |
| `topicReframeSystem` | 提交前判断输入是否需要转译，以及生成 3 个候选标题。 |

每个 prompt 都可以"填入默认 / 复制默认 / 清空恢复默认"。空字符串等同于使用代码里的默认（`services/prompts.ts`）。已覆盖的字段在导出 `settings.json` 里有标记。

### 3. 头像风格（Avatars）

6 套一键预设：博物馆肖像（默认）、像素艺术、电影写实、水彩素描、极简线稿、古典油画。每套捆绑了"思想声音风格 + 历史哲学家风格 + 两条负向提示"。也可在精调区域单独覆盖任一字段。

> 改动只对**之后**生成的头像生效，已经存在的旧头像不会被自动替换；要替换需要重新生成那位思想声音（结果页该卡片底部"重新生成"）或重跑整份分析。

### 4. 运行参数（Options）

| 参数 | 范围 | 默认 | 说明 |
| --- | --- | --- | --- |
| `temperature` | 0.00 – 1.20 | 0.72 | 越低越保守，越高越发散。 |
| `voiceConcurrency` | 1 – 5 | 3 | 同时生成的思想声音数。提高更快，但更容易触发上游限流。 |
| `voiceMaxTokens` | 2000 – 12000 | 7000 | 单个思想声音正文的输出上限。 |

### 5. Token 预算（Tokens）

- 今日 / 本周 / 本月 / 全部 4 个 bucket。
- 按阶段（outline / route / voices / synthesis / append / reflection / reframe / suggestion / avatar）柱状图。
- 按模型柱状图。
- 一键导出 CSV，一键清空。

> 数据完全本地：来源是每次 API 响应里的 `usage` 字段，不接触任何后端账单，不会与 provider 的真实计费完全一致。最多保留 1000 行（`MAX_RECORDS`），更老的会被丢弃。

### 6. 数据管理（Data）

- 导出 / 导入 `settings.json`。
- 一键重置全部设置为代码里的默认（需要二次确认）。
- 红色安全提示：自定义 LLM 的 API Key 是明文存放的，导出 JSON 也包含它。

---

## 路由与页面

App 用 `window.history` 实现客户端路由，所有路径都被 GH Pages 的 `404.html` 回退到 SPA。

| 路径 | 视图 | 说明 |
| --- | --- | --- |
| `/` | Home | 输入框、AI 生成问题建议、首次访问的公告 modal、active run banner。 |
| `/history` | HistoryPage | 全部本地历史 + 预置样本，支持导入 / 导出 / 删除 / 跳转 active run。 |
| `/history/sample` | Arena | 打开预置示例（生成版优先于打包版）。 |
| `/history/<id>` | Arena | 打开任一历史条目；id 不存在会回到 `/history`。 |
| `/manifesto` | ManifestoPage | 项目宣言。 |
| `/settings` | SettingsPage | 详见上一节。 |

`Esc`、`X`、点击背景、`稍后再看` 都能关闭公告 modal；公告 dismiss 状态记在 `sophia.announcement.dismissed.v1`，作者更换 `id` 后会再次自动弹出（详见 [站内公告管理](#站内公告管理)）。

---

## 分析模式与思想声音类型

### 分析模式（`ProgramMode`）

| ID | 中文标签 | 何时被选 |
| --- | --- | --- |
| `progressive` | 层层深入 | 普通推进式追问。 |
| `roundtable` | 圆桌辩论 | 多个立场对话。 |
| `genealogy` | 历史谱系 | "X 是怎么来的"。 |
| `dilemma` | 两难困境 | 真正的伦理两难。 |
| `concept_archaeology` | 概念考古 | 拆解一个关键词。 |
| `thought_experiment` | 思想实验 | 围绕一个核心思想实验展开。 |
| `school_seminar` | 流派研讨会 | "某 -ism 有道理吗？" |
| `diagnosis_clinic` | 哲学门诊 | "如何克服 / 面对 / 走出 X？" |
| `thought_experiment_panel` | 思想实验的几条出路 | 几个声音对同一个思想实验给不同回应。 |
| `custom` | 自由编排 | 上面都不合适时。 |

### 思想声音类型（`VoiceKind`）

| ID | 含义 | 头像策略 |
| --- | --- | --- |
| `philosopher` | 真实历史哲学家 | 历史肖像写实（保留人物面部 / 衣冠 / 时代特征）。 |
| `school` | 流派 | 该流派气质的虚构代表，符号化但克制。 |
| `concept` | 概念 | 概念的拟人化（姿态、光、象征性背景道具）。 |
| `position` | 立场（如保守主义批评者） | 持该立场的虚构当代人，普通现代衣着。 |
| `contemporary` | 当代批评者 | 虚构当代评论者，思考表情，克制现代衣着。 |

### 给真实哲学家加的"长相提示"

`services/sophiaService.ts#buildThoughtVoiceAvatarPrompt` 会在 `kind === 'philosopher'` 时附加一段"historical likeness cues"，告诉模型可以参考人物面部结构、发型、衣着年代和气质（举例：萨特圆框眼镜 / 斯宾诺莎 17 世纪荷兰-塞法迪学者肖像 / 加缪中世纪法籍阿尔及利亚作家黑白编辑感）。

---

## 生成流程与可观测性

一次完整生成在 `services/sophiaService.ts#analyzeTopic` 里被编排为：

1. **outline**：单次 JSON 调用，决定标题、`mode`、问题翻译、关键词、阅读结构、`voicePlans`、可选的 `seminarMatrix` / `diagnosisFrame` / `thoughtExperiment`。
2. **route**：单次 JSON 调用补全论证路线图（每个节点 plain + philosophical 各 120-220 字）。
3. **voices**：`runWithConcurrency` 按 Settings 设置的并发数并发跑每位声音。每位声音内部并行做：
    - 流式长文（`callChatText` + SSE，120ms 节流回到 React）。
    - 头像生图（`/images/generations`，base64）。
    - 完成后再来一次小型 JSON 调用，提炼 `summaryForSynthesis` / `quote` / `challenges`。
4. **synthesis**：合并所有声音摘要，单次 JSON 调用产出 `tensions` / `keywords` / `followUps` / `conclusion`。
5. **done**：合成最终 `AnalysisResult`，App 写入历史。

围绕这套主线还有：

- **重试与退避**：`fetchWithRetry` 对 408/429/5xx 与网络错误做最多 4 次指数退避（base 800ms，最大 8s + jitter）。
- **流式空闲超时**：`STREAM_IDLE_TIMEOUT_MS = 45s`，无 chunk 则中止；少于 200 字时回退到非流式重试。
- **心跳日志**：长 JSON 调用每 10s 输出一条 `已等待 Ns，模型仍在处理...`，避免"卡死了？"。
- **本地化错误**：`apiErrorMessage` 把 401/403/404/408/429/5xx 翻译成中文运营建议。
- **生成日志面板**：每个步骤都通过 `onLog` emit 一行（`info` / `detail` / `warn` / `error`），ReasoningDisplay 里挂载的 `GenerationLogPanel` 渲染并自动 stick-to-bottom。
- **token 累计**：每次成功响应里的 `usage` 都被 `tokenAccounting.recordUsage` 收集并按阶段+模型聚合。
- **append 与 retry**：`appendThoughtVoice` / `regenerateThoughtVoice` 走自己的子流程，会重算综合判断；失败时保留上一份 tensions / conclusion。
- **continuation context**：从 followUps 进入下一份分析时，会把上一份的标题 / 原问题 / 大问题 / 总结 / 张力 / 选中的 followUp 理由打包传给 outline，避免它当成完全新题。
- **Reflection chat**（`getReflectionFeedback`）：在 Arena 底部对话框里跟 Sophia 追问当前分析的具体内容，prompt 强调"必须紧扣面前这份分析"，输出纯文本无 Markdown。

---

## 本地数据：localStorage 与 IndexedDB

| Key | 储存位置 | 内容 |
| --- | --- | --- |
| `sophia.history.v1` | localStorage | 用户历史条目数组（**不含**头像 base64，最多 10 条）。 |
| `sophia.preset.generated.feminism.v1` | localStorage | 用户重新生成过的预置示例（同样不含 base64 头像）。 |
| `sophia.announcement.dismissed.v1` | localStorage | 上一次被关闭的公告 `id`。 |
| `sophia.settings.v1` | localStorage | Settings 页的全部内容（provider 选择、自定义 LLM、prompt 覆盖、运行参数）。 |
| `sophia.tokens.v1` | localStorage | Token 用量原始记录（最多 1000 行）。 |
| `sophia.idb.migrated.v1` | localStorage | 头像迁移完成标记。 |
| `sophia-images-v1` (IndexedDB) | IndexedDB | 所有 base64 头像图（key = `${entryId}::${voiceId}`）。 |

**为什么把头像挪到 IndexedDB？** 一张博物馆风格头像的 base64 大约 200-300KB，写一份 5 位声音的分析就吃掉 1-1.5MB。localStorage 对单个 origin 通常只有 5MB，三四份分析就会爆掉。IDB 的配额一般是磁盘的 60%，挪过去之后历史归档可以远远超过 10 条。

`App.tsx` 启动时会跑一次 `maybeMigrateLegacyAvatars`，把旧版本（base64 内嵌在 localStorage 历史里）一次性升迁到 IDB；写一次 sentinel 后下次启动就跳过。

`imageStore.ts` 的所有操作都是 fail-safe：IDB 不可用、quota 满、事务异常都会安静返回空，UI 自动 fall back 到占位（`ThoughtVoiceCard` 在没有 `imageUrl` 时画一个语义化字符 + 渐变背景）。

---

## 站内公告管理

`data/announcement.ts` 是单一来源：

```ts
export const ANNOUNCEMENT: Announcement = {
  id: 'welcome-2026-05',          // 改 id 会重新对所有用户弹出
  enabled: true,                  // 关掉就永远不显示
  eyebrow: 'ANNOUNCEMENT · 公告',
  title: '欢迎来到 Sophia\'s Dialectic',
  body: '...',
  cta: { label: '阅读理念', href: '/manifesto' }, // SPA 路径
};
```

工作流：

1. 编辑 `data/announcement.ts`，修改 `title` / `body` / `cta`。
2. 如果想让所有人（包括关过的）再看到一次，**把 `id` 改成新值**。
3. push 到 `main`，GH Actions 自动构建。
4. 想临时下线公告但保留代码：把 `enabled` 改为 `false`。

公告 modal 也支持顶部导航的喇叭按钮重新打开，dismiss 后写 `sophia.announcement.dismissed.v1` 为当前 `id`。点 CTA `/manifesto` 时会自动用 SPA 路由跳转，不会刷新页面。

---

## 部署到 GitHub Pages

仓库已经包含 `.github/workflows/deploy.yml`：每次 push 到 `main` 或手动 dispatch，会执行 Node 20 → `npm ci` → `npm run build` → 上传 `dist/` → `actions/deploy-pages`。

### 1. 配置 GitHub Secret

`Settings → Secrets and variables → Actions → Secrets → New repository secret`：

| Name | Value |
| --- | --- |
| `SOPHIA_API_KEY` | 你的 OpenAI-compatible API Key |

### 2. 配置 GitHub Variables（可选）

`Settings → Secrets and variables → Actions → Variables`：

| Name | 默认 | 用途 |
| --- | --- | --- |
| `SOPHIA_API_BASE_URL` | `https://api.linhongkuan.com/v1` | API 地址 |
| `SOPHIA_API_MODEL` | `gpt-5.4-mini` | 默认文本模型 |
| `SOPHIA_IMAGE_MODEL` | `grok-imagine-image-lite` | 头像生图模型 |
| `SOPHIA_API_PROVIDER` | `OpenAI-compatible` | 错误提示展示名 |
| `SOPHIA_PRESET_GPT_MODEL` | _空_ | Settings GPT preset 模型 |
| `SOPHIA_PRESET_MIMO_MODEL` | _空_ | Settings MiMo preset 模型 |
| `SOPHIA_PRESET_GROK_MODEL` | _空_ | Settings Grok preset 模型 |

未配置的 preset 变量会让对应卡显示为"未配置"，用户点击不会切换。Variables 不强制必填；不配就用 workflow / 代码里的默认值。

### 3. 启用 GitHub Pages

`Settings → Pages → Build and deployment → Source = GitHub Actions`。

### 4. 推送代码

```bash
git push origin main
```

进入 Actions 页查看 `Deploy to GitHub Pages` 工作流。成功后 Pages 设置页会显示访问地址。

---

## 关于 CORS

- **本地 dev / preview**：Vite 代理 `/sophia-api` 把请求转给 `SOPHIA_API_BASE_URL`，浏览器只跟 `127.0.0.1:7878` 说话，永远不会触发 CORS。
- **GitHub Pages**：纯静态，浏览器直接请求 `SOPHIA_API_BASE_URL`，因此你的 API 服务**必须允许 GitHub Pages 域名跨域**（`Access-Control-Allow-Origin` 至少包含 `https://<user>.github.io`）。
- **如果上游不支持 CORS**，需要在前面加一层代理：Cloudflare Workers / Vercel Functions / 自己的后端任意一种都行。

---

## 安全提示

> **GitHub Pages 没有任何机制可以隐藏前端使用的 API key。** 部署版本里 Vite 把 API 配置注入浏览器 bundle，任何能访问页面源码的人都能看到这个 key。

请务必：

1. **不要使用高额度生产 API Key**。
2. 使用**限额 key**，并在 provider 端限制额度、可用模型、IP 等。
3. **定期轮换 key**（Secrets → Update → 重新跑 workflow 即可）。
4. 如果要真正隐藏 key，请在前面架一层服务端代理（例如 Cloudflare Workers），让代理做 `Authorization` 注入，前端只调代理。

Settings 页"自定义 LLM"里填的 key 也以**明文**存放在用户自己的 localStorage / 导出的 `settings.json` 里。Settings 页底部有醒目红色提示，请勿在公共设备上填写。

---

## 项目结构

```text
.
├── App.tsx                          # 主应用：路由 / active run / 历史 / IDB 迁移 / 公告
├── index.tsx                        # ReactDOM.createRoot 入口
├── index.html                       # Tailwind CDN、字体、import map、boot splash
├── index.css                        # 全局动画、滚动、滚动条、selection
├── types.ts                         # 全部数据形态声明
├── constants.ts                     # STAGE_LABEL / STAGE_ORDER 等共享常量
├── tailwind.config.js               # museum 调色板与字体扩展
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts                   # define 注入 + 本地 /sophia-api 代理 + manualChunks
├── vite-env.d.ts                    # process.env.SOPHIA_* 类型声明
│
├── components/
│   ├── ActiveRunBanner.tsx          # 首页正在生成的横幅
│   ├── AnnouncementModal.tsx        # 站内公告 modal
│   ├── Arena.tsx                    # 完整 / 流式结果展现 + Continuation Studio
│   ├── BackgroundScene.tsx          # R3F 背景实现
│   ├── DynamicBackground.tsx        # 懒加载入口 + 前置遮挡控制
│   ├── GenerationLogPanel.tsx       # 实时日志列表
│   ├── HistoryPage.tsx              # 历史归档
│   ├── ManifestoPage.tsx            # 项目宣言页
│   ├── PageHero.tsx                 # 复用的 hero label / accent / underline
│   ├── ReasoningDisplay.tsx         # 进度 + 日志面板挂载点
│   ├── SettingsPage.tsx             # 设置页（6 个 section）
│   ├── ThoughtVoiceCard.tsx         # 单声音长文卡片 + 头像 fallback
│   └── TopicReframeDialog.tsx       # 提交前转译选择
│
├── services/
│   ├── sophiaService.ts             # OpenAI-compatible 编排 + 流式 + 重试 + token 统计
│   ├── prompts.ts                   # system prompts + 头像风格预设
│   ├── sophiaConfig.ts              # 运行时配置 store（localStorage）
│   ├── modelPresets.ts              # GPT / MiMo / Grok preset 描述
│   ├── topicReframe.ts              # 提交前的 reframe 分类器
│   ├── tokenAccounting.ts           # 用量累计与 CSV 导出
│   └── imageStore.ts                # IndexedDB 头像存储（fail-safe）
│
├── utils/
│   ├── inputValidation.ts           # 客户端输入校验
│   ├── generationLog.ts             # 日志记录工具
│   └── exportResult.ts              # AnalysisResult → Markdown
│
├── data/
│   ├── announcement.ts              # 公告内容（id / title / body / cta）
│   ├── preloadedHistory.ts          # 内置示例（含 5 张本地 PNG 头像 import）
│   └── reference-avatars/           # 预置头像 PNG
│
├── public/                          # 静态资源（HDR / 字体备份等）
│
├── scripts/
│   ├── copy-spa-fallback.mjs        # 构建后把 index.html 复制为 404.html
│   ├── generate-preloaded-sample.mjs        # 重生预置示例（跑完整 pipeline，写入 data/）
│   └── regenerate-preloaded-avatars.mjs     # 单独重跑预置示例的 5 张头像
│
├── .github/workflows/deploy.yml     # GitHub Pages 自动部署
├── CHANGELOG.md
├── CONTRIBUTING.md                  # 扩展点 + 提交规范
├── DEPLOY.md                        # 部署指南（本文同步）
├── LICENSE                          # MIT
├── README.md                        # 你正在看的这份
├── package.json
└── package-lock.json
```

---

## 扩展指南

详细列表在 `CONTRIBUTING.md`。最常见的三种：

### 加一个新的分析路径（mode）

1. `types.ts` 给 `ProgramMode` 加新值。
2. `services/prompts.ts` 给 `MODE_LABELS` 加中文标签，并在 `outlineSystemPrompt` 的"可选分析路径"列表里加一行说明。
3. `components/Arena.tsx` 给 `modeIcon` 配 lucide-react 图标。
4. 如果该 mode 需要专有渲染区域（像 `seminarMatrix` / `diagnosisFrame` / `thoughtExperiment`），在 `types.ts` 加新字段，在 `Arena.tsx` 加对应 section。

### 加一个新的思想声音类型（voiceKind）

1. `types.ts` 给 `VoiceKind` 加新值。
2. `services/prompts.ts#VOICE_KIND_AVATAR_SUBJECT` 加描述，告诉头像生成器画什么。
3. `components/ThoughtVoiceCard.tsx#kindLabel` / `VOICE_KIND_SYMBOL` 加映射。

### 加一个新的预置模型

1. `vite.config.ts` 在 `define` 块加 `process.env.SOPHIA_PRESET_<NAME>_MODEL`。
2. `vite-env.d.ts` 加同名类型声明。
3. `.github/workflows/deploy.yml` 在 build env 里加 `SOPHIA_PRESET_<NAME>_MODEL`。
4. `services/modelPresets.ts` 加一个 `MODEL_PRESETS` 条目；`services/sophiaConfig.ts#ProviderId` / `presetModelFor` 也要扩展。
5. `README.md` / `DEPLOY.md` 把变量加到 GitHub Variables 表。

### 改一段内置 prompt

直接编辑 `services/prompts.ts`。Settings 的提示词面板支持运行时覆盖（写到 `sophia.settings.v1.promptOverrides`），所以可以在浏览器里实验，确认满意再改源码。

---

## 常见问题

### 部署后首页提示"未配置 API key"

确认 `SOPHIA_API_KEY` 已经写到 GitHub Secrets，再触发一次 Actions（push 一个 commit 或在 Actions 页 Re-run）。注意 Variables 和 Secrets 是两栏，key 必须放在 **Secrets**。

### 部署后页面正常加载但生成立刻报"网络错误 / Failed to fetch"

99% 是 CORS：上游 API 没把你的 GitHub Pages 域名加到 `Access-Control-Allow-Origin`。打开浏览器控制台看 Network 选项卡确认。临时方案是切换到一家支持 CORS 的 OpenAI-compatible 网关，或自己起一层 Cloudflare Workers / Vercel Function 代理。

### 改了 Settings 但下次刷新又回到默认

检查浏览器是不是处于隐身模式 / 禁用了 localStorage。Settings store 在写入失败时会在 console 打 `[sophia][config] failed to persist settings`。

### 历史里的头像加载不出来

如果是从 `localStorage` 5MB quota 满之后才生成的那几条，IndexedDB 里没存到对应 key，会 fall back 到字符占位。处理方式：在结果页该卡片底部"重新生成"，会重新生成头像并写入 IDB。

### 想换一个完全不同的 LLM 提供商

去 `/settings`，选"自定义 LLM"卡，填上 base URL / API Key / 文本模型 / 生图模型即可。改动立即对下一次生成生效。base URL 只需到 `/v1`（不要带 `/chat/completions`）。如果该 provider 不支持 `response_format: json_object`，目前会报错；可以在该 provider 里关闭 strict JSON 或自己加一层 OpenAI-compatible 适配器。

### 一次完整生成大概多少 token？

平均 25k 左右（outline 3-4k + route 2-3k + voices 5k × 2-5 + synthesis 3-4k + 头像略小）。Settings 页 Token 预算面板会按"总累计 / 25000"给一个粗略的"约相当于 N 次完整分析"的估算。

### 想给课堂上 30 个学生用，怎么做？

最稳妥的做法是：自架一层 Cloudflare Workers / Vercel Function 代理，把代理地址作为 `SOPHIA_API_BASE_URL`、`SOPHIA_API_KEY` 留空（代理那一层注入真实 key 并做限速），然后部署到 GitHub Pages 让所有人访问。这样真实 key 永远不进浏览器 bundle。

### 想批量用脚本而不是 UI 跑分析

参考 `scripts/generate-preloaded-sample.mjs`，它通过 `vite.createServer({ middlewareMode: true })` 直接 SSR 加载 `services/sophiaService.ts` 并调用 `analyzeTopic`，能在 Node 里跑完整 pipeline，把结果写回 `data/`。可以照这个套路写自己的批处理脚本。

---

## 许可证

[MIT](./LICENSE) © 2026 Sophia's Dialectic.

---

如果这个项目对你有帮助，欢迎 star、fork、提 issue 和 PR。具体协作流程见 [CONTRIBUTING.md](./CONTRIBUTING.md)，更新历史见 [CHANGELOG.md](./CHANGELOG.md)，部署详细步骤见 [DEPLOY.md](./DEPLOY.md)。
