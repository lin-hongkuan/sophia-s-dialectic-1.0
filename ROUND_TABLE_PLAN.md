# Roundtable Feature Plan

## 1. Product Definition

新增一个独立的「实时圆桌会谈」功能。它不是现有分析页的变体，也不复用 `AnalysisResult` 的文章型结构，而是一条新的产品线：

> 用户输入一个问题，Sophia 召集一组混合思想席位，以严肃研讨会的形式进行实时圆桌讨论。用户可以中途以主持人身份插话、点名、要求反驳、要求举例或收束。最终保存完整会谈记录。

核心目标：

- 让用户感觉自己进入了一场真实的思想圆桌，而不是阅读一篇生成文章。
- 会谈必须有主持人控场、轮次结构、回应关系和最终会议纪要。
- 每位参会者必须有头像，头像由现有 OpenAI-compatible image API 生成。
- 第一版采用 2D 会议室界面，不做 3D、语音、TTS、唇形或人物动作。

非目标：

- 不替换当前首页的完整哲学分析功能。
- 不把圆桌会谈写入现有 `sophia.history.v1` 分析历史。
- 不强制生成概念卡、路线图、关键词档案等文章型分析产物。
- 不要求会谈内容最终转换为现有 `AnalysisResult`。

## 2. Entry And Navigation

新增路由：

- `/roundtable`

新增视图：

- `roundtable`

导航栏新增入口：

- `Roundtable`

页面入口行为：

- 用户点击导航栏 `Roundtable` 进入独立页面。
- 页面顶部是圆桌主题输入区。
- 用户输入问题后点击 `召开圆桌`。
- 如果 API 未配置或离线，输入区显示不可生成状态，但允许浏览本地保存的会谈记录。

推荐路由扩展：

- `/roundtable`：新建或查看最近圆桌入口。
- `/roundtable/<sessionId>`：打开某场已保存会谈。

如果 v1 只做最小可用版本，可以先只实现 `/roundtable`，并在页面内部选择历史会谈。

## 3. Core User Experience

圆桌页面分为三种状态。

### Idle

用户尚未开始会谈。

界面包括：

- 主题输入框。
- 可选快捷问题。
- 近期会谈列表。
- 当前模型和预计成本提示。

主按钮：

- `召开圆桌`

### Seating

系统已经规划参会者，正在生成头像。

界面包括：

- 中央圆桌。
- 4 个席位占位。
- 每个席位显示状态：`规划完成`、`生成头像中`、`已入席`、`头像失败`。
- 主持人提示：`正在邀请参会者入席...`

头像策略：

- 先生成参会者身份，再并发生成头像。
- 头像全部完成或失败兜底后再正式开谈。
- 单个头像失败不阻塞会谈，用首字或抽象占位替代。

### Live Session

正式会谈进行中。

界面包括：

- 2D 圆桌会议室。
- 当前议程。
- 当前发言者高亮。
- 被回应者标记。
- 实时会谈记录。
- 底部主持人输入栏。

用户可以：

- 向全体追问。
- 点名某位回应。
- 要求某位反驳上一位。
- 要求举现实例子。
- 要求追问代价。
- 要求主持人提前收束。
- 暂停自动滚动。
- 复制或下载完整会谈记录。

## 4. Conversation Protocol

圆桌会谈不能是普通聊天流。它必须按协议推进。

### Phase 1: Planning

一次 JSON 调用生成：

- 会谈标题。
- 核心问题。
- 主持人开场草稿。
- 4 位参会者。
- 每位参会者的身份、角色、立场、风格约束和与其他席位的潜在冲突。

默认席位构成：

- 1 位真实哲学家或经典思想家。
- 1 个思想流派或理论传统。
- 1 个当代现实立场。
- 1 位怀疑者、反方或方法论批评者。

允许模型根据主题微调，但必须保持混合席位，不允许 4 个席位全是同质哲学家。

### Phase 2: Seating

为每位参会者生成头像。

头像全部完成或兜底后，写入主持人开场 turn。

### Phase 3: Opening Statements

每位参会者按主持人安排依次发言。

约束：

- 每个 turn 120-220 中文字。
- 必须表明自身立场。
- 不得总结其他人尚未说过的话。
- 不得提前给最终结论。

### Phase 4: Cross Response

每位参会者必须回应至少一位此前发言者。

约束：

- turn 必须带 `replyToParticipantId`。
- 必须引用对方观点中的一个具体主张。
- 必须说明赞同、反驳或重新界定。

### Phase 5: Focused Conflict

主持人点出一个核心分歧，并安排 2-3 位参会者围绕它交锋。

约束：

- 不追求吵架式戏剧化。
- 采用严肃研讨会语气。
- 发言必须推进分歧，而不是重复开场立场。

### Phase 6: Closing Minutes

主持人生成会议纪要。

纪要包括：

- 主要共识。
- 核心分歧。
- 每位参会者留下的最强问题。
- 用户如果继续追问，最值得追的 3 个方向。
- 一个简短的现实返回。

## 5. User Interjection Protocol

用户是主持人，不是普通聊天室观众。

主持人输入栏包含：

- 文本输入。
- 目标选择：`全体` 或某位参会者。
- 动作选择：`追问`、`反驳`、`举例`、`追问代价`、`收束会议`。

用户插话保存为 transcript turn：

```ts
type RoundtableTurnKind =
  | 'moderator'
  | 'participant'
  | 'user_interjection'
  | 'minutes';
```

插话影响规则：

- 插话进入后续 prompt context。
- 如果指定目标，下一个 participant turn 必须由目标回应。
- 如果选择 `反驳`，目标必须回应上一位发言者或用户指定对象。
- 如果选择 `举例`，下一位必须用现实例子解释。
- 如果选择 `收束会议`，系统跳过剩余普通轮次，进入 closing minutes。

用户不能直接编辑已生成发言。v1 只允许追加插话和继续生成。

## 6. Data Model

新增类型建议放在 `types/domain.ts`。

```ts
export type RoundtableSessionStatus =
  | 'idle'
  | 'planning'
  | 'seating'
  | 'running'
  | 'closing'
  | 'completed'
  | 'error'
  | 'cancelled';

export type RoundtableParticipantKind =
  | 'philosopher'
  | 'school'
  | 'position'
  | 'skeptic'
  | 'moderator';

export interface RoundtableParticipantAvatar {
  imageUrl?: string;
  prompt: string;
  model: string;
  alt: string;
  generatedAt?: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  error?: string;
}

export interface RoundtableParticipant {
  id: string;
  name: string;
  kind: RoundtableParticipantKind;
  role: string;
  stance: string;
  temperament: string;
  conflictWith?: string[];
  avatar?: RoundtableParticipantAvatar;
  status: 'planned' | 'seating' | 'present' | 'speaking' | 'silent' | 'failed';
}

export interface RoundtableTurn {
  id: string;
  phase: 'opening' | 'response' | 'conflict' | 'closing';
  kind: 'moderator' | 'participant' | 'user_interjection' | 'minutes';
  participantId?: string;
  targetParticipantId?: string;
  replyToParticipantId?: string;
  action?: 'ask' | 'rebut' | 'example' | 'cost' | 'close';
  content: string;
  status: 'queued' | 'streaming' | 'completed' | 'failed';
  createdAt: string;
  error?: string;
}

export interface RoundtableMinutes {
  consensus: string;
  disagreements: string[];
  unresolvedQuestions: string[];
  nextQuestions: string[];
  realLifeReturn: string;
}

export interface RoundtableSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  topic: string;
  title: string;
  coreQuestion: string;
  status: RoundtableSessionStatus;
  participants: RoundtableParticipant[];
  turns: RoundtableTurn[];
  minutes?: RoundtableMinutes;
  error?: string;
  metadata?: {
    tokenUsage?: TokenUsage[];
    totalTokens?: number;
    model?: string;
    avatarModel?: string;
  };
}
```

## 7. Storage

新增本地存储：

- `sophia.roundtables.v1`

建议文件：

- `services/roundtableStore.ts`

存储行为：

- localStorage 保存 lean session，不内联 base64 头像。
- IndexedDB 保存头像图片。
- 默认保存最近 10 场会谈。
- 支持导入 / 导出 JSON。
- 导出内容默认包含 transcript、minutes、participant metadata，但不包含 API key。

头像 key：

```ts
roundtable::<sessionId>::participant::<participantId>
```

可以在 `services/storage/imageStore.ts` 增加：

```ts
export const buildRoundtableAvatarKey = (sessionId: string, participantId: string): string =>
  `roundtable::${sessionId}::participant::${participantId}`;
```

## 8. Avatar Generation

圆桌头像是产品体验的一部分，必须在正式开谈前完成或兜底。

新增函数建议：

- `buildRoundtableAvatarPrompt(topic, sessionTitle, participant)`
- `generateRoundtableParticipantAvatar(topic, sessionTitle, participant)`
- `regenerateRoundtableAvatar(session, participantId)`

头像风格：

- 默认采用现有 Sophia 博物馆肖像风格。
- 真实哲学家尊重历史形象线索。
- 流派、立场、怀疑者生成象征性人物，不冒充真实人物。
- 禁止文字、水印、logo、UI 元素。

prompt 要包含：

- 用户主题。
- 会谈标题。
- 参会者姓名。
- 参会者类型。
- 角色。
- 立场。
- 性格气质。
- 是否真实历史人物。
- 统一构图要求。

失败处理：

- 单个头像失败时 participant avatar status 为 `failed`。
- UI 显示首字或抽象占位。
- 会谈仍可继续。
- 会谈完成后可手动重生头像。

并发：

- 复用现有 `avatarConcurrency` 设置。
- 不让头像请求无限并发。

## 9. Generation Service

新增服务建议：

- `services/roundtableService.ts`

核心函数：

```ts
export const planRoundtableSession(topic, callbacks): Promise<RoundtableSession>;
export const generateRoundtableAvatars(session, callbacks): Promise<RoundtableSession>;
export const runRoundtableSession(session, callbacks, control): Promise<RoundtableSession>;
export const generateNextRoundtableTurn(session, directive, callbacks): Promise<RoundtableTurn>;
export const closeRoundtableSession(session, callbacks): Promise<RoundtableSession>;
```

回调建议：

```ts
export interface RoundtableCallbacks {
  onSession?: (session: RoundtableSession) => void;
  onParticipantUpdate?: (participant: RoundtableParticipant) => void;
  onTurnStart?: (turn: RoundtableTurn) => void;
  onTurnDelta?: (turnId: string, delta: string, fullText: string) => void;
  onTurnComplete?: (turn: RoundtableTurn) => void;
  onMinutes?: (minutes: RoundtableMinutes) => void;
  onError?: (message: string) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
}
```

控制句柄：

```ts
export interface RoundtableControlHandle {
  cancel: () => void;
  pauseAfterCurrentTurn: () => void;
  interject: (input: {
    content: string;
    targetParticipantId?: string;
    action: 'ask' | 'rebut' | 'example' | 'cost' | 'close';
  }) => void;
}
```

上下文策略：

- 每个 turn 生成时，不传完整无限 transcript。
- 传最近 6-10 个 turn。
- 传一段 rolling summary。
- 传当前 phase、主持人要求和 participant identity cards。

这样可以控制 token 成本，并维持上下文连贯。

## 10. Prompting Rules

### Planning Prompt

要求模型输出 JSON：

- `title`
- `coreQuestion`
- `moderatorOpening`
- `participants`

强制规则：

- participants 只能 4 位。
- 必须混合席位。
- 每位 participant 必须有不同理论功能。
- 必须声明潜在冲突对象。
- 不允许生成无关名人。

### Turn Prompt

每个发言 turn 必须知道：

- 当前主题。
- 核心问题。
- 参会者身份卡。
- 当前 phase。
- 已有 transcript 摘要。
- 最近 turn。
- 如果有用户插话，必须回应插话。
- 如果指定 `replyToParticipantId`，必须回应对方具体观点。

输出纯文本，不要 JSON。

### Minutes Prompt

输出 JSON：

- `consensus`
- `disagreements`
- `unresolvedQuestions`
- `nextQuestions`
- `realLifeReturn`

会议纪要必须引用会谈中真实出现过的分歧，不得凭空总结。

## 11. UI Specification

新增组件建议：

- `components/RoundtablePage.tsx`
- `components/RoundtableRoom.tsx`
- `components/RoundtableSeat.tsx`
- `components/RoundtableTranscript.tsx`
- `components/RoundtableModeratorBar.tsx`
- `components/RoundtableArchive.tsx`

桌面布局：

- 左侧 60%：2D 圆桌会议室。
- 右侧 40%：实时 transcript。
- 底部 sticky：主持人输入栏。

移动布局：

- 顶部：主题 / 状态。
- 中部：横向或环形简化圆桌席位。
- 下方：transcript。
- 底部：sticky 主持人输入栏。

当前发言视觉：

- 当前 speaker 席位高亮。
- 被回应者显示 `回应 X` 标签。
- 头像下方显示状态：`入席中`、`正在发言`、`等待回应`、`已发言`。
- 当前 turn 在 transcript 中流式更新。

主持人输入栏：

- 输入框最小 44px 高触控目标。
- 目标选择使用菜单或 segmented control。
- 动作用图标 + 文本按钮。
- 发送中禁用按钮并显示 loading。

## 12. Export Format

Markdown 导出结构：

```md
# 圆桌会谈标题

## 核心问题

...

## 参会者

- A：角色与立场
- B：角色与立场

## 会谈记录

### 主持人开场

...

### 第一幕：开场陈述

**A：** ...

**B：** ...

### 第二幕：交锋回应

...

## 主持人纪要

### 共识

### 分歧

### 未解决问题

### 可以继续追问
```

复制与下载：

- 支持复制 Markdown。
- 支持下载 `.md`。
- 不包含 API 配置。
- 默认不内联头像图片。

## 13. Error Handling

Planning 失败：

- 显示错误。
- 不创建正式 session，或创建 `error` session 便于日志排查。

头像失败：

- 单个头像失败不阻塞。
- 可重试单个头像。

Turn 失败：

- 当前 turn 标记 `failed`。
- 用户可重试当前 turn。
- 如果连续失败，允许提前生成会议纪要。

用户取消：

- 当前请求 abort。
- 已生成 turns 保留。
- session 状态为 `cancelled`。

离线：

- 不允许开始新会谈。
- 允许阅读已保存会谈。

## 14. Token And Cost Controls

默认成本控制：

- 4 位参会者。
- 3 个普通轮次 + closing。
- 每个 turn 120-220 中文字。
- 最近 transcript 截断 + rolling summary。
- 头像并发遵循 `avatarConcurrency`。

后续可加设置：

- 参会人数：3 / 4 / 5。
- 会谈长度：短会 / 标准 / 深谈。
- 是否生成头像。
- 是否自动生成会议纪要。

v1 默认不暴露太多参数，只保证体验完整。

## 15. Implementation Order

建议分 6 步实现。

1. 类型与路由
   - 增加 roundtable 类型。
   - 增加 `/roundtable` 路由和导航入口。
   - 新建空页面。

2. 会谈存储
   - 新建 `roundtableStore.ts`。
   - 保存 / 读取 / 删除 / 导出会谈。
   - 增加 IndexedDB 头像 key。

3. Planning + seating
   - 实现 `planRoundtableSession`。
   - 实现圆桌席位 UI。
   - 实现头像生成与失败兜底。

4. Turn-by-turn generation
   - 实现 turn 流式生成。
   - 实现 transcript 实时更新。
   - 实现基础 3 轮协议。

5. 用户主持插话
   - 实现目标选择和动作选择。
   - 插话写入 transcript。
   - 后续 turn 必须响应插话。

6. Closing + export
   - 生成会议纪要。
   - 保存 completed session。
   - 支持复制 / 下载 Markdown。

## 16. Test Plan

单元测试：

- `/roundtable` 路由 normalize。
- planning JSON sanitize。
- participant sanitize。
- turn append 顺序稳定。
- roundtable store import/export。
- avatar key 构造稳定。

生成逻辑测试：

- planning 必须输出 4 位混合席位。
- turn prompt 包含最近 transcript 和用户插话。
- 指定 target 时下一 turn 由目标回应。
- `close` action 会进入 closing。

UI 验证：

- seating 状态能显示头像生成进度。
- 当前 speaker 高亮正确。
- transcript 流式更新不造成布局跳动。
- 移动端无横向滚动。
- 输入栏不遮挡最后一条 transcript。

构建验证：

- `npm test`
- `npm run build`

## 17. Acceptance Criteria

第一版完成标准：

- 用户能进入 `/roundtable`。
- 用户能输入主题并召开圆桌。
- 系统能规划 4 位混合席位。
- 每位参会者头像由生图 API 生成；失败时有兜底。
- 主持人开场后，参会者按轮次实时发言。
- 用户能中途插话并影响下一轮发言。
- 会谈能生成最终主持人纪要。
- 完整会谈记录能保存在本地。
- 已保存会谈能重新打开。
- 会谈记录能复制或下载 Markdown。

## 18. Key Product Principle

这个功能的成败不取决于 UI 多像一张桌子，而取决于会谈是否真的有“相互回应”。

必须优先保证：

- 参会者身份有差异。
- 发言不是孤立短文。
- 下一位能回应上一位。
- 主持人能控制节奏。
- 用户插话能改变后续走向。

只有这些成立，头像、桌面和动效才有意义。
