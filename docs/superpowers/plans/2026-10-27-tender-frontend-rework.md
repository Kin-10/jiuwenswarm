# 标书系统前端壳改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 JiuwenSwarm Web 前端改造为标书系统壳——左侧边栏按标书域重组（A 方案），首页欢迎页叠加 C+D 网格背景，欢迎语改标书域文案，新增企业产品库/资信库占位页。

**Architecture:** 纯前端壳改造，零后端/对话/解析逻辑改动。侧边栏一级入口经 `mainNavItems` 重排并复用现有 key；页面切换沿用 `App.tsx` 的 `activeNav` state + 条件渲染；网格为纯 CSS 渐变叠加，颜色经主题语义变量；占位页为无数据空态组件。

**Tech Stack:** React 18 + TypeScript + Vite；i18next（zh/en 双语）；CSS（主题变量 `var(--color-*)`）；Node 测试运行器 + esbuild。

**关联设计：** `.agents/agent-docs/designs/proposals/D-20261027-2218-tender-document-frontend-rework/design.md`（approved）

**前端工作目录：** 以下 `<fe>` 均指 `jiuwenswarm/channels/web/frontend`。

**仓库约束：** 不运行格式化与静态检查工具；新增用户可见文案必须 zh/en 双语；颜色不写死、用语义变量；改动只加/改 `data-testid` 不动其他属性。

---

### Task 1: 侧边栏 key 类型与平台隐藏配置

**Files:**
- Modify: `<fe>/src/utils/frontendPlatform.ts:3-15, 30-33`
- Test: `<fe>/tests/frontendPlatform.test.mjs`（既有，跑通即可）

- [ ] **Step 1: 扩展 SidebarNavKey 与隐藏配置**

在 `SidebarNavKey` 联合类型末尾（`'experiments'` 之后）追加三个新 key，并在 `HIDDEN_NAV_ITEMS_BY_PLATFORM.web` 与 `.harmony` 数组中加入需隐藏的现有入口（agents/connectorMarket/experiments/personalContext/personalContextSettings/updatepanel）：

```typescript
export type SidebarNavKey =
  | 'chat'
  | 'skills'
  | 'agents'
  | 'design'
  | 'connectorMarket'
  | 'sessions'
  | 'cron'
  | 'personalContext'
  | 'personalContextSettings'
  | 'settings'
  | 'updatepanel'
  | 'experiments'
  | 'home'
  | 'productLibrary'
  | 'qualificationLibrary';
```

```typescript
const HIDDEN_NAV_ITEMS_BY_PLATFORM: Record<FrontendPlatform, readonly SidebarNavKey[]> = {
  web: ['sessions', 'agents', 'connectorMarket', 'experiments', 'personalContext', 'personalContextSettings', 'updatepanel'],
  harmony: ['sessions', 'updatepanel', 'connectorMarket', 'experiments', 'agents', 'personalContext', 'personalContextSettings'],
};
```

- [ ] **Step 2: 跑既有测试确认类型不破**

Run: `cd <fe> && npm run test:frontend-platform`
Expected: PASS（既有断言不破）

- [ ] **Step 3: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/utils/frontendPlatform.ts
git commit -m "feat(web): add tender nav keys and hide non-tender entries"
```

---

### Task 2: 主题网格与光晕语义变量

**Files:**
- Modify: `<fe>/src/styles/themes/default/light.css`（在 Surfaces 区块尾部，约 42 行后追加）

- [ ] **Step 1: 新增两个按用途命名的变量**

在 `--color-surface-shell: #f3f3f3;`（第 42 行）之后追加：

```css
  /* 标书首页背景网格 */
  --color-grid-line: #e5e7eb;
  --color-grid-glow: rgba(99, 102, 241, 0.12);
```

- [ ] **Step 2: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/styles/themes/default/light.css
git commit -m "feat(web): add grid line and glow semantic color tokens"
```

---

### Task 3: 欢迎页网格背景（C+D）与欢迎语

**Files:**
- Modify: `<fe>/src/components/ChatPanel/ChatPanel.css:4205-4214`
- Modify: `<fe>/src/i18n/locales/zh.json:1627`、`en.json:1643`

- [ ] **Step 1: `.chat-welcome` 叠加网格 + 光晕，新增 `::before` 粗网格渐隐层**

将 `.chat-welcome` 改为（保留既有 flex 布局，追加 background 与 `::before`）：

```css
.chat-welcome {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 2rem 1.5rem 6rem 1.5rem;
  background-image:
    radial-gradient(ellipse 60% 50% at 50% 0%, var(--color-grid-glow), transparent 70%),
    linear-gradient(var(--color-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid-line) 1px, transparent 1px);
  background-size: 100% 100%, 24px 24px, 24px 24px;
}

.chat-welcome::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--color-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid-line) 1px, transparent 1px);
  background-size: 48px 48px;
  -webkit-mask-image: radial-gradient(ellipse 70% 80% at 50% 45%, transparent 30%, #000 100%);
  mask-image: radial-gradient(ellipse 70% 80% at 50% 45%, transparent 30%, #000 100%);
  pointer-events: none;
}
```

（`.chat-welcome` 已有 `position: relative`，无需重复声明；以上为完整目标块，直接替换原块。）

- [ ] **Step 2: 欢迎语改标书域文案（双语）**

`zh.json:1627` 的 `chat.welcomeHeading` 改为：

```json
"welcomeHeading": "你好，这里是AI标书系统",
```

`en.json:1643` 的 `chat.welcomeHeading` 改为：

```json
"welcomeHeading": "Hi, this is the AI Bid System.",
```

- [ ] **Step 3: 视觉走查**

Run: `cd <fe> && npm run dev`（或复用已起的服务），打开无会话首页
Expected: 欢迎页显示细网格 + 粗网格中心渐隐 + 顶部光晕；欢迎语为标书域文案

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/ChatPanel.css jiuwenswarm/channels/web/frontend/src/i18n/locales/zh.json jiuwenswarm/channels/web/frontend/src/i18n/locales/en.json
git commit -m "feat(web): tender welcome grid background and heading"
```

---

### Task 4: i18n 标书域导航与占位页文案（双语）

**Files:**
- Modify: `<fe>/src/i18n/locales/zh.json`、`en.json`（`nav` 节点 + 新增 `tender` 节点）

- [ ] **Step 1: zh.json `nav` 节点补/改 key**

在 `nav` 节点（zh.json:45-60）中：新增 `home`、`productLibrary`、`qualificationLibrary`；将 `work` 改为「标书工作区」（`chat` key 复用为标书工作区语义）：

```json
  "nav": {
    "home": "首页",
    "chat": "标书工作区",
    "work": "标书工作区",
    "productLibrary": "企业产品库",
    "qualificationLibrary": "企业资信库",
    "skills": "技能",
    "settings": "设置",
    ...
  },
```

（保留其余既有 key 不动；`work` 是 `chat` 实际使用的 labelKey，故 `nav.work` 改为「标书工作区」。）

- [ ] **Step 2: zh.json 新增 `tender` 节点（占位页文案）**

在 `zh.json` 顶层新增：

```json
  "tender": {
    "productLibraryTitle": "企业产品库",
    "qualificationLibraryTitle": "企业资信库",
    "placeholderDescription": "功能规划中，敬请期待。",
    "recycleBin": "回收站"
  },
```

- [ ] **Step 3: en.json 同步**

`en.json` `nav` 节点：`"home": "Home"`、`"chat": "Bid Workspace"`、`"work": "Bid Workspace"`、`"productLibrary": "Product Library"`、`"qualificationLibrary": "Qualification Library"`。顶层新增：

```json
  "tender": {
    "productLibraryTitle": "Product Library",
    "qualificationLibraryTitle": "Qualification Library",
    "placeholderDescription": "Coming soon.",
    "recycleBin": "Recycle Bin"
  },
```

- [ ] **Step 4: i18n 完整性测试**

Run: `cd <fe> && npm run test:i18n-locales`
Expected: PASS（双语 key 对齐）

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/i18n/locales/zh.json jiuwenswarm/channels/web/frontend/src/i18n/locales/en.json
git commit -m "feat(web): tender nav and placeholder i18n (zh/en)"
```

---

### Task 5: 占位页组件

**Files:**
- Create: `<fe>/src/features/tender/PlaceholderLibraryPage.tsx`
- Create: `<fe>/src/features/tender/PlaceholderLibraryPage.css`

- [ ] **Step 1: 写占位页组件**

`PlaceholderLibraryPage.tsx`：

```tsx
import { useTranslation } from 'react-i18next';
import './PlaceholderLibraryPage.css';

interface PlaceholderLibraryPageProps {
  variant: 'productLibrary' | 'qualificationLibrary';
}

export function PlaceholderLibraryPage({ variant }: PlaceholderLibraryPageProps) {
  const { t } = useTranslation();
  const titleKey =
    variant === 'productLibrary' ? 'tender.productLibraryTitle' : 'tender.qualificationLibraryTitle';
  return (
    <div className="tender-placeholder" data-testid={`tender-placeholder-${variant}`}>
      <div className="tender-placeholder__card">
        <h2 className="tender-placeholder__title">{t(titleKey)}</h2>
        <p className="tender-placeholder__description">{t('tender.placeholderDescription')}</p>
      </div>
    </div>
  );
}
```

`PlaceholderLibraryPage.css`：

```css
.tender-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.tender-placeholder__card {
  text-align: center;
}

.tender-placeholder__title {
  color: var(--color-text-primary);
}

.tender-placeholder__description {
  color: var(--color-text-secondary);
}
```

（若 `--color-text-primary/secondary` 变量名不符，以 `light.css` 实际文本色变量为准。）

- [ ] **Step 2: 类型与构建校验**

Run: `cd <fe> && npx tsc --noEmit`
Expected: 无新增类型错误

- [ ] **Step 3: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/features/tender/
git commit -m "feat(web): tender placeholder library page"
```

---

### Task 6: 侧边栏入口重排

**Files:**
- Modify: `<fe>/src/components/SessionSidebar/index.tsx:86-95`
- Create: `<fe>/src/assets/sidebar/home.svg`、`library.svg`（两个新图标）

- [ ] **Step 1: 新增两个 SVG 图标（currentColor）**

`home.svg` 与 `library.svg` 各为单色 `fill="currentColor"` 的简洁图标（首页=房子、库=文件夹/书）。以 `?react` 导入。

- [ ] **Step 2: `mainNavItems` 重排为标书域**

```tsx
const mainNavItems: NavItem[] = [
  { key: 'home', labelKey: 'nav.home', icon: <HomeIcon aria-hidden /> },
  { key: 'chat', labelKey: 'nav.work', icon: <WorkIcon aria-hidden /> },
  { key: 'productLibrary', labelKey: 'nav.productLibrary', icon: <LibraryIcon aria-hidden /> },
  { key: 'qualificationLibrary', labelKey: 'nav.qualificationLibrary', icon: <LibraryIcon aria-hidden /> },
  { key: 'skills', labelKey: 'nav.skills', icon: <SkillDesignIcon aria-hidden /> },
  { key: 'settings', labelKey: 'nav.settings', icon: <SettingsIcon aria-hidden /> },
];
```

（agents/connectorMarket/experiments/personalContext/updatepanel 已由 Task 1 的 hiddenNavItems 隐藏；列表列「回收站」入口复用归档视图，见 Task 7 说明。）

- [ ] **Step 3: 手测侧边栏**

Run: `npm run dev` 打开应用
Expected: 一级图标列显示 首页/标书工作区/企业产品库/企业资信库/技能/设置

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/SessionSidebar/index.tsx jiuwenswarm/channels/web/frontend/src/assets/sidebar/
git commit -m "feat(web): reorder sidebar to tender domain entries"
```

---

### Task 7: App.tsx 新分支与首页导航

**Files:**
- Modify: `<fe>/src/App.tsx`（新增条件渲染分支、`home` 导航映射、占位页导入）

- [ ] **Step 1: 导入占位页**

顶部导入区追加：

```tsx
import { PlaceholderLibraryPage } from './features/tender/PlaceholderLibraryPage';
```

- [ ] **Step 2: `home` 导航映射到欢迎页**

`handleNavigate`（3984-4027）中，`home` 语义 = 回到无会话聊天首页：在 `setActiveNav(nav)` 前，将 `home` 归一为 `chat` 并触发新会话/清空会话选择（复用 `requestSessionNavigation('new')` 或既有重置逻辑）。最小实现：在 `handleNavItemClick`/`handleNavigate` 入口把 `nav === 'home'` 映射为 `'chat'` 并导航到 `new`。

- [ ] **Step 3: 新增占位页条件渲染分支**

在主区（参考 4801-4825 行既有分支模式）追加：

```tsx
        {activeNav === 'productLibrary' && (
          <div className="app-section">
            <PlaceholderLibraryPage variant="productLibrary" />
          </div>
        )}
        {activeNav === 'qualificationLibrary' && (
          <div className="app-section">
            <PlaceholderLibraryPage variant="qualificationLibrary" />
          </div>
        )}
```

- [ ] **Step 4: 类型与手测**

Run: `cd <fe> && npx tsc --noEmit && npm run dev`
Expected: 点击新入口切换到占位页；点「首页」回到欢迎页

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/App.tsx
git commit -m "feat(web): wire tender placeholder pages and home nav"
```

---

### Task 8: 测试适配与回归

**Files:**
- Modify: `<fe>/tests/`（受侧边栏/文案影响的既有断言）

- [ ] **Step 1: 适配受影响的测试**

侧边栏结构、导航文案、欢迎语相关断言更新为新口径；为占位页与侧边栏新结构补最小测试（遵循既有 esbuild + node --test 范式）。

- [ ] **Step 2: 跑相关测试集**

Run: `cd <fe> && npm run test:i18n-locales && npm run test:frontend-platform && npm run test:secondary-sidebar && npm run test:sidebar-model`
Expected: 全绿

- [ ] **Step 3: 全量构建**

Run: `cd <fe> && npm run build`
Expected: `tsc && vite build` 通过

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/tests
git commit -m "test(web): adapt tender shell tests"
```

---

## Self-Review 记录

- Spec 覆盖：D-01 侧边栏（Task 1/4/6）、D-02 网格（Task 2/3）、D-03 占位页（Task 5/7）、D-04 欢迎语（Task 3）、i18n（Task 4）、测试回归（Task 8）。已覆盖。
- 类型一致性：`home/productLibrary/qualificationLibrary` 三个 key 在 Task 1/4/6/7 一致；`PlaceholderLibraryPage` 的 `variant` 命名一致。
- 待澄清（不阻塞，实施时按现状微调）：图标 SVG 具体路径以 `src/assets/sidebar/` 现有命名习惯为准；`--color-text-*` 变量名以 `light.css` 实际为准；「回收站」入口在列表列复用归档视图，属 `ConversationSidebar.tsx` 的轻量入口新增（若实施时发现归档视图入口结构复杂，降级为列表列顶部一个「回收站」筛选入口）。
