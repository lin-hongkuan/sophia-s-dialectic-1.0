## 摘要

<!-- 这次 PR 做了什么、为什么。一两句即可。 -->

## 改动类型

- [ ] feat：新功能
- [ ] fix：bug 修复
- [ ] refactor：重构（无行为变化）
- [ ] perf：性能改进
- [ ] docs：文档
- [ ] chore：工程杂项
- [ ] test：测试

## 关联 issue

<!-- 形如 Closes #123 / Refs #456。无可写"无"。 -->

## 自测清单

- [ ] `npm test` 通过
- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 通过
- [ ] 本地 dev 启动后，关键路径手验通过：
  - [ ] 首页输入并提交，正常进入生成（含 reframe 流程）
  - [ ] 生成日志面板从 outline 起累积，时间戳与阶段标记正确
  - [ ] 历史页能看到刚生成的条目
  - [ ] 设置页切换模型 / 修改提示词 / 测试连接均生效
- [ ] 涉及 prompt 改动时，跑过一次完整生成并肉眼验证输出
- [ ] 涉及部署 harness 时，已同步 README / DEPLOY / GitHub Variables 文档
- [ ] 没有把真实 API key 放入提交（包括 `.env.local`、截图、日志）

## 截图 / 日志（可选）

<!-- UI 改动建议附前后对比截图；prompt 改动建议附生成结果片段。 -->
