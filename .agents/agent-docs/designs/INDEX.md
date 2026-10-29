---
title: 设计文档索引
author: hezhibao
author_email: zhibaohe@hotmail.com
generated: true
---

<!-- 本文件由 .agents/skills/jw-design/scripts/generate_index.py 自动生成，请勿手改。重新生成：python .agents/skills/jw-design/scripts/generate_index.py -->
<!-- generated-at: 2026-10-29T10:17+08:00 -->

# 设计文档索引 (INDEX)

> 开发前 7 · 开发中 0 · 开发后 3 · 已否决 0

按模块目录分组，组内按生命周期展示；跨模块设计在各相关模块下列出，全局统计按文档去重。

## 模块目录

| 模块 | 设计数 |
|---|---|
| [agent_teams](#module-1) | 1 |
| [agent_teams/workflow](#module-2) | 3 |
| [jiuwenswarm](#module-3) | 3 |
| [jiuwenswarm/channels/web/frontend](#module-4) | 5 |
| [jiuwenswarm/gateway/channel_manager/web](#module-5) | 1 |
| [jiuwenswarm/observability](#module-6) | 1 |

<a id="module-1"></a>

## agent_teams

### 开发前 (proposals)

| ID | 标题 | 状态 | 作者 | 领域 | 更新日期 |
|---|---|---|---|---|---|
| [SDD-0029](proposals/SDD-0029-team-session-runtime-integration/design.md) | Team 模式接入统一 Session Runtime | draft | @zhanglongmin | core | 2026-10-09 |

<a id="module-2"></a>

## agent_teams/workflow

### 开发后 (archive)

| ID | 标题 | 状态 | 作者 | 领域 | 更新日期 |
|---|---|---|---|---|---|
| [SDD-0009](archive/SDD-0009-jiuwen-tui-swarmflow-human-session-adaptation/design.md) | jiuwen TUI 适配 SwarmFlow 三算子（human / human_session / agent_session） | shipped | @chenchunzhou | core | 2026-07-28 |
| [SDD-0010](archive/SDD-0010-jiuwen-tui-nested-workflow-and-budget-observability/design.md) | jiuwen TUI 嵌套 Workflow 与 Budget 可观测性 | shipped | @chenchunzhou | observability | 2026-08-06 |
| [SDD-0028](archive/SDD-0028-swarmflow-verify-fork-observability/design.md) | swarmflow verify / fork 可观测与前端呈现 | shipped | @xiajing | observability | 2026-09-29 |

<a id="module-3"></a>

## jiuwenswarm

### 开发后 (archive)

| ID | 标题 | 状态 | 作者 | 领域 | 更新日期 |
|---|---|---|---|---|---|
| [SDD-0009](archive/SDD-0009-jiuwen-tui-swarmflow-human-session-adaptation/design.md) | jiuwen TUI 适配 SwarmFlow 三算子（human / human_session / agent_session） | shipped | @chenchunzhou | core | 2026-07-28 |
| [SDD-0010](archive/SDD-0010-jiuwen-tui-nested-workflow-and-budget-observability/design.md) | jiuwen TUI 嵌套 Workflow 与 Budget 可观测性 | shipped | @chenchunzhou | observability | 2026-08-06 |
| [SDD-0028](archive/SDD-0028-swarmflow-verify-fork-observability/design.md) | swarmflow verify / fork 可观测与前端呈现 | shipped | @xiajing | observability | 2026-09-29 |

<a id="module-4"></a>

## jiuwenswarm/channels/web/frontend

### 开发前 (proposals)

| ID | 标题 | 状态 | 作者 | 领域 | 更新日期 |
|---|---|---|---|---|---|
| [SDD-0026](proposals/SDD-0026-trajectory-observability-web-ui/design.md) | 轨迹观测前端：单 Agent、Subagent 与 Team 多 Agent 轨迹 UI | draft | @alan_cheng | observability | 2026-09-15 |
| [D-20261027-2218-tender-document-frontend-rework](proposals/D-20261027-2218-tender-document-frontend-rework/design.md) | 标书系统前端壳改造设计方案：侧边栏结构与首页背景网格 | approved | hezhibao | core | 2026-10-27 |
| [D-20261028-1949-tender-inline-process-workspace](proposals/D-20261028-1949-tender-inline-process-workspace/design.md) | 标书解析过程信息内嵌设计方案：进度/素材/参考/产物并入对话主区 | approved | hezhibao | core | 2026-10-28 |
| [D-20261028-2054-tender-parsing-result-page](proposals/D-20261028-2054-tender-parsing-result-page/design.md) | 标书解析结果页设计方案：聊天发起、专门页面呈现结构化解析结果 | approved | hezhibao | core | 2026-10-28 |
| [D-20261028-2254-tender-reading-page](proposals/D-20261028-2254-tender-reading-page/design.md) | 招标解读功能页设计方案：入口接线、历史记录与解析会话索引 | approved | hezhibao | core | 2026-10-28 |

<a id="module-5"></a>

## jiuwenswarm/gateway/channel_manager/web

### 开发前 (proposals)

| ID | 标题 | 状态 | 作者 | 领域 | 更新日期 |
|---|---|---|---|---|---|
| [SDD-0025](proposals/SDD-0025-trajectory-session-store-and-serving/design.md) | 轨迹数据面：会话级 SQLite 存储、实时变更提示与读取 API | draft | @alan_cheng | observability | 2026-09-15 |

<a id="module-6"></a>

## jiuwenswarm/observability

### 开发前 (proposals)

| ID | 标题 | 状态 | 作者 | 领域 | 更新日期 |
|---|---|---|---|---|---|
| [SDD-0025](proposals/SDD-0025-trajectory-session-store-and-serving/design.md) | 轨迹数据面：会话级 SQLite 存储、实时变更提示与读取 API | draft | @alan_cheng | observability | 2026-09-15 |
