# 招标解读功能页 Implementation Plan

> **For agentic workers:** 按任务逐个执行；每任务完成后运行其验证命令再进入下一任务。步骤使用 checkbox（`- [ ]`）跟踪。执行方式：子代理逐任务驱动。

**Goal:** 侧边栏「招标解读」从占位页落地为真实功能页：新建解读入口 + 历史记录列表（localStorage 解析会话索引），历史项点击重开对应会话的解析结果页。

**Architecture:** 新增纯函数模块 `tenderParsingIndex.ts`（localStorage 索引 + LRU）与一次性信号 `tenderParsingOpenIntent.ts`（模块级 Map）→ 功能页 `TenderReadingPage.tsx` → `App.tsx` 接线（占位集合收敛 + 分支渲染 + 导航回调）→ `ChatPanel/index.tsx` 两个效应（索引写入 + 信号消费）。

**Tech Stack:** React 18 + TypeScript + Vite；i18next 双语；CSS 语义变量；node:test + esbuild。

**设计依据：** `.agents/agent-docs/designs/proposals/D-20261028-2254-tender-reading-page/design.md`（approved）。验收场景 ID：D-20261028-2254-V-01 ~ V-05。

**仓库约束（必须遵守）：**
- 颜色只用 `var(--color-*)` 语义变量，禁止写死色值。
- 新增用户可见文案 `zh.json` 与 `en.json` 双语齐全。
- 新 UI 元素加 `data-testid`，页面级前缀 `tender-reading-`。
- 禁止运行 ESLint/Prettier 等格式化与静态检查工具（`npx tsc --noEmit` 与 `npm run build` 属构建链，允许）。
- 提交信息用简洁英文 Conventional Commits，只提交本任务相关文件。
- 前端工作目录：`jiuwenswarm/channels/web/frontend`；git 命令在仓库根目录 `/Users/hezhibao/Desktop/claw/jiuwenswarm`。

---

### Task 1: 解析会话索引 + 重开信号（纯函数）+ 单测

**Files:**
- Create: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/tenderParsingIndex.ts`
- Create: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/tenderParsingOpenIntent.ts`
- Test: `jiuwenswarm/channels/web/frontend/tests/tenderParsingIndex.test.mjs`
- Modify: `jiuwenswarm/channels/web/frontend/package.json`

- [ ] **Step 1: 写失败测试**

Create `tests/tenderParsingIndex.test.mjs`：

```js
/**
 * tenderParsingIndex / tenderParsingOpenIntent 单测（设计 D-20261028-2254）：
 * 1. readTenderParsingIndex：空/坏 JSON 返回 []；按 updatedAt 倒序；非法条目被过滤。
 * 2. upsertTenderParsingIndex：新增置顶；同 sessionId 覆盖不重复；超过 500 条截断最旧。
 * 3. 重开信号：mark 后 consume 命中且仅命中一次。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

const idx = await import('../node_modules/.cache/tender-reading/tenderParsingIndex.mjs');
const intent = await import('../node_modules/.cache/tender-reading/tenderParsingOpenIntent.mjs');

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('readTenderParsingIndex returns [] for empty or corrupted storage', () => {
  const storage = makeStorage();
  assert.deepEqual(idx.readTenderParsingIndex(storage), []);
  storage.setItem('tenderParsingIndex', 'not json');
  assert.deepEqual(idx.readTenderParsingIndex(storage), []);
  storage.setItem('tenderParsingIndex', '{"a":1}');
  assert.deepEqual(idx.readTenderParsingIndex(storage), []);
});

test('readTenderParsingIndex sorts by updatedAt desc and filters invalid entries', () => {
  const storage = makeStorage();
  storage.setItem('tenderParsingIndex', JSON.stringify([
    { sessionId: 's1', fileName: 'a.docx', updatedAt: 100 },
    { sessionId: 's2', fileName: 'b.docx', updatedAt: 300 },
    { fileName: 'bad' },
    'garbage',
    { sessionId: 's3', fileName: 'c.docx', updatedAt: 200 },
  ]));
  const entries = idx.readTenderParsingIndex(storage);
  assert.deepEqual(entries.map((e) => e.sessionId), ['s2', 's3', 's1']);
});

test('upsertTenderParsingIndex dedups by sessionId and caps at 500', () => {
  const storage = makeStorage();
  idx.upsertTenderParsingIndex({ sessionId: 's1', fileName: 'a.docx', size: 10, updatedAt: 100 }, storage);
  idx.upsertTenderParsingIndex({ sessionId: 's2', fileName: 'b.docx', updatedAt: 200 }, storage);
  idx.upsertTenderParsingIndex({ sessionId: 's1', fileName: 'a2.docx', updatedAt: 300 }, storage);
  const entries = idx.readTenderParsingIndex(storage);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].sessionId, 's1');
  assert.equal(entries[0].fileName, 'a2.docx');
  for (let i = 0; i < 600; i += 1) {
    idx.upsertTenderParsingIndex({ sessionId: `bulk-${i}`, fileName: `${i}.docx`, updatedAt: 1000 + i }, storage);
  }
  const capped = idx.readTenderParsingIndex(storage);
  assert.equal(capped.length, 500);
  assert.equal(capped[0].sessionId, 'bulk-599');
});

test('tenderParsingOpenIntent is consumed exactly once', () => {
  intent.markTenderParsingOpen('s1');
  assert.equal(intent.consumeTenderParsingOpenIntent('s1'), true);
  assert.equal(intent.consumeTenderParsingOpenIntent('s1'), false);
  assert.equal(intent.consumeTenderParsingOpenIntent('nope'), false);
});
```

- [ ] **Step 2: 注册测试命令**

`package.json` scripts 在 `"test:tender-parsing-view"` 行后追加：

```json
"test:tender-reading": "esbuild src/components/ChatPanel/tenderParsingIndex.ts src/components/ChatPanel/tenderParsingOpenIntent.ts --bundle --platform=node --format=esm --packages=external --outdir=node_modules/.cache/tender-reading --out-extension:.js=.mjs && node --test tests/tenderParsingIndex.test.mjs"
```

Run: `npm run test:tender-reading`
Expected: FAIL（入口文件不存在）

- [ ] **Step 3: 实现两个模块**

Create `src/components/ChatPanel/tenderParsingIndex.ts`：

```ts
/**
 * 招标解读历史索引（设计 D-20261028-2254 D-01）：
 * localStorage 记录解析会话（sessionId → 文件信息），供 TenderReadingPage 历史列表读取。
 * 纯函数 + storage 注入，node:test 直测；任何读写异常都不阻塞主流程。
 */

export interface TenderParsingIndexEntry {
  sessionId: string;
  fileName: string;
  size?: number;
  updatedAt: number;
}

const STORAGE_KEY = 'tenderParsingIndex';
const MAX_ENTRIES = 500;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isValidEntry(item: unknown): item is TenderParsingIndexEntry {
  if (!item || typeof item !== 'object') return false;
  const entry = item as Record<string, unknown>;
  return (
    typeof entry.sessionId === 'string' &&
    typeof entry.fileName === 'string' &&
    typeof entry.updatedAt === 'number'
  );
}

export function readTenderParsingIndex(storage?: StorageLike): TenderParsingIndexEntry[] {
  const target = resolveStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function upsertTenderParsingIndex(entry: TenderParsingIndexEntry, storage?: StorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    const next = [
      entry,
      ...readTenderParsingIndex(target).filter((item) => item.sessionId !== entry.sessionId),
    ].slice(0, MAX_ENTRIES);
    target.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存储满/不可用时静默放弃，不影响解析主流程。
  }
}
```

Create `src/components/ChatPanel/tenderParsingOpenIntent.ts`：

```ts
/**
 * 招标解读历史项 → ChatPanel 的一次性"打开解析页"信号（设计 D-20261028-2254 D-02）。
 * 模块级 Map：写入后在 ChatPanel 会话效应中消费并删除；页面刷新自然失效。
 */

const pending = new Map<string, true>();

export function markTenderParsingOpen(sessionId: string): void {
  pending.set(sessionId, true);
}

export function consumeTenderParsingOpenIntent(sessionId: string): boolean {
  return pending.delete(sessionId);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:tender-reading`
Expected: PASS（4 个用例）

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/tenderParsingIndex.ts jiuwenswarm/channels/web/frontend/src/components/ChatPanel/tenderParsingOpenIntent.ts jiuwenswarm/channels/web/frontend/tests/tenderParsingIndex.test.mjs jiuwenswarm/channels/web/frontend/package.json
git commit -m "feat(web): add tender parsing session index and reopen intent"
```

---

### Task 2: i18n 文案（tenderReading.*）

**Files:**
- Modify: `jiuwenswarm/channels/web/frontend/src/i18n/locales/zh.json`
- Modify: `jiuwenswarm/channels/web/frontend/src/i18n/locales/en.json`

- [ ] **Step 1: zh.json 增加 `tenderReading` 节点**

在 `tender` 节点（brandName 等所在的对象，**不是** `chat.tenderParsing`）内追加：

```json
"readingPage": {
  "newTitle": "新建解读",
  "newDesc": "上传招标文件，自动解析项目概述、评分要求与资格要求",
  "newAction": "上传招标文件",
  "historyTitle": "历史记录",
  "historyEmpty": "暂无解读记录，上传招标文件开始第一次解读"
},
```

注意：插入位置在 `tender` 对象内既有键之后（如 `placeholderDescription` 后），保持 JSON 合法与缩进风格。页面标题复用既有 `nav.tenderReading`，不新增。

- [ ] **Step 2: en.json 同步**

```json
"readingPage": {
  "newTitle": "New Parsing",
  "newDesc": "Upload a tender file to automatically parse the project overview, scoring requirements, and qualification requirements",
  "newAction": "Upload Tender File",
  "historyTitle": "History",
  "historyEmpty": "No parsing records yet. Upload a tender file to start your first parsing."
},
```

- [ ] **Step 3: 校验**

Run: `node --test tests/i18nLocales.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/i18n/locales/zh.json jiuwenswarm/channels/web/frontend/src/i18n/locales/en.json
git commit -m "feat(web): add tender reading page i18n strings"
```

---

### Task 3: TenderReadingPage 组件 + 样式

**Files:**
- Create: `jiuwenswarm/channels/web/frontend/src/features/tender/TenderReadingPage.tsx`
- Create: `jiuwenswarm/channels/web/frontend/src/features/tender/TenderReadingPage.css`

- [ ] **Step 1: 实现组件**

Create `src/features/tender/TenderReadingPage.tsx`：

```tsx
/**
 * 招标解读功能页（设计 D-20261028-2254）：
 * 新建解读卡（跳新会话上传）+ 历史记录列表（localStorage 索引，点击重开对应会话解析页）。
 * 导航行为经 props 注入，页面本体不依赖路由实现。
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, UploadCloud } from 'lucide-react';
import { FileIcon } from '../../components/FileIcon';
import { formatRelativeTime } from '../../utils/formatters';
import {
  readTenderParsingIndex,
  type TenderParsingIndexEntry,
} from '../../components/ChatPanel/tenderParsingIndex';
import './TenderReadingPage.css';

interface TenderReadingPageProps {
  onNew: () => void;
  onOpenSession: (sessionId: string) => void;
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function TenderReadingPage({ onNew, onOpenSession }: TenderReadingPageProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TenderParsingIndexEntry[]>([]);

  useEffect(() => {
    setEntries(readTenderParsingIndex());
  }, []);

  return (
    <div className="tender-reading-page" data-testid="tender-reading-page">
      <header className="tender-reading-header">
        <h2 className="tender-reading-title">{t('nav.tenderReading')}</h2>
      </header>

      <button
        type="button"
        className="tender-reading-new"
        onClick={onNew}
        data-testid="tender-reading-new"
      >
        <UploadCloud size={22} aria-hidden="true" className="tender-reading-new__icon" />
        <span className="tender-reading-new__texts">
          <span className="tender-reading-new__title">{t('tender.readingPage.newTitle')}</span>
          <span className="tender-reading-new__desc">{t('tender.readingPage.newDesc')}</span>
        </span>
        <span className="tender-reading-new__action">{t('tender.readingPage.newAction')}</span>
      </button>

      <section className="tender-reading-history">
        <h3 className="tender-reading-history__title">{t('tender.readingPage.historyTitle')}</h3>
        {entries.length === 0 ? (
          <div className="tender-reading-empty" data-testid="tender-reading-empty">
            <FileSearch size={32} aria-hidden="true" className="tender-reading-empty__icon" />
            <p>{t('tender.readingPage.historyEmpty')}</p>
          </div>
        ) : (
          <ul className="tender-reading-list" data-testid="tender-reading-list">
            {entries.map((entry) => (
              <li key={entry.sessionId}>
                <button
                  type="button"
                  className="tender-reading-item"
                  onClick={() => onOpenSession(entry.sessionId)}
                  data-testid={`tender-reading-item-${entry.sessionId}`}
                >
                  <FileIcon fileName={entry.fileName} size={24} />
                  <span className="tender-reading-item__name" title={entry.fileName}>
                    {entry.fileName}
                  </span>
                  <span className="tender-reading-item__meta">
                    {formatFileSize(entry.size)}
                    {entry.size ? ' · ' : ''}
                    {formatRelativeTime(new Date(entry.updatedAt).toISOString())}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default TenderReadingPage;
```

创建前验证：`formatRelativeTime` 在 `src/utils/formatters.ts` 已导出（签名 `formatRelativeTime(timestamp: string): string`）；`FileIcon` 与 lucide-react 图标的导入方式参照 `TenderParsingView.tsx`。

- [ ] **Step 2: 实现样式**

Create `src/features/tender/TenderReadingPage.css`：

```css
.tender-reading-page {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 32px;
  background: var(--color-surface-page);
}

.tender-reading-header {
  margin-bottom: 16px;
}

.tender-reading-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tender-reading-new {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 560px;
  padding: 16px 18px;
  border: 1px dashed var(--color-border-default);
  border-radius: 12px;
  background: var(--color-surface-card);
  cursor: pointer;
  text-align: left;
}

.tender-reading-new:hover {
  border-color: var(--color-action-primary);
}

.tender-reading-new__icon {
  flex: 0 0 auto;
  color: var(--color-action-primary);
}

.tender-reading-new__texts {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tender-reading-new__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tender-reading-new__desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tender-reading-new__action {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--color-action-primary);
  font-weight: 500;
}

.tender-reading-history {
  margin-top: 24px;
}

.tender-reading-history__title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tender-reading-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.tender-reading-empty__icon {
  color: var(--color-text-placeholder);
}

.tender-reading-empty p {
  margin: 0;
}

.tender-reading-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
}

.tender-reading-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  background: var(--color-surface-card);
  cursor: pointer;
  text-align: left;
}

.tender-reading-item:hover {
  border-color: var(--color-action-primary);
}

.tender-reading-item__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tender-reading-item__meta {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/features/tender/TenderReadingPage.tsx jiuwenswarm/channels/web/frontend/src/features/tender/TenderReadingPage.css
git commit -m "feat(web): add tender reading page with new entry and history list"
```

---

### Task 4: App.tsx 接线 + 占位集合收敛

**Files:**
- Modify: `jiuwenswarm/channels/web/frontend/src/utils/frontendPlatform.ts`
- Modify: `jiuwenswarm/channels/web/frontend/src/App.tsx`
- Modify: `jiuwenswarm/channels/web/frontend/tests/tenderShellNav.test.mjs`

- [ ] **Step 1: 占位集合移除 tenderReading**

`src/utils/frontendPlatform.ts` 的 `TENDER_PLACEHOLDER_NAV_KEYS`（41-51 行）删除 `'tenderReading',` 一行，剩 8 项。

- [ ] **Step 2: App.tsx 渲染分支**

`src/App.tsx`：
- 导入区追加：
  ```tsx
  import { TenderReadingPage } from './features/tender/TenderReadingPage';
  import { markTenderParsingOpen } from './components/ChatPanel/tenderParsingOpenIntent';
  ```
- 在占位页分支（约 4874 行 `{TENDER_PLACEHOLDER_NAV_KEY_SET.has(activeNav) && (`）之前插入：
  ```tsx
  {activeNav === 'tenderReading' && (
    <div className="app-section">
      <TenderReadingPage
        onNew={() => requestSessionNavigation('new')}
        onOpenSession={(sessionId) => {
          const target = sessions.find((item) => item.session_id === sessionId);
          if (!target) return;
          markTenderParsingOpen(sessionId);
          requestSessionNavigation(target);
        }}
      />
    </div>
  )}
  ```
  说明：`sessions` 已有（约 821 行 `useSessionStore((s) => s.sessions)`）；`requestSessionNavigation` 约 3942 行。会话已被删除时 `target` 找不到则静默不跳转（设计 §5.8）。

- [ ] **Step 3: 更新壳结构测试**

`tests/tenderShellNav.test.mjs`：顶部注释与断言从 9 项改 8 项——`TENDER_NAV_KEYS` 数组删除 `'tenderReading'`；文件头注释同步改为"8 个占位页入口 + 招标解读为真实功能页"；若有断言"9 个入口的 nav.* 文案"保持对 8 项循环即可；新增一条断言：`frontendPlatform.ts` 的 `TENDER_PLACEHOLDER_NAV_KEYS` 不含 `tenderReading`，且 `App.tsx` 含 `activeNav === 'tenderReading'` 分支与 `<TenderReadingPage`。

- [ ] **Step 4: 验证**

Run: `npm run test:tender-shell && npx tsc --noEmit`
Expected: 全过

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/utils/frontendPlatform.ts jiuwenswarm/channels/web/frontend/src/App.tsx jiuwenswarm/channels/web/frontend/tests/tenderShellNav.test.mjs
git commit -m "feat(web): wire tender reading page into nav, dropping its placeholder"
```

---

### Task 5: ChatPanel 集成（索引写入 + 信号消费）

**Files:**
- Modify: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/index.tsx`

- [ ] **Step 1: 导入**

在既有 `import { useTenderAnalysis } from './useTenderAnalysis';` 附近追加：

```tsx
import { upsertTenderParsingIndex } from './tenderParsingIndex';
import { consumeTenderParsingOpenIntent } from './tenderParsingOpenIntent';
```

- [ ] **Step 2: 会话效应改为"先消费信号、再走切换复位"**

定位现有效应（特征：`tenderParsingPrevSessionRef`），整体替换为：

```tsx
// 历史记录重开信号优先于切换复位：命中信号说明本次会话切换的目的就是打开解析页。
const tenderParsingPrevSessionRef = useRef(activeSessionId);
useEffect(() => {
  const prev = tenderParsingPrevSessionRef.current;
  tenderParsingPrevSessionRef.current = activeSessionId;
  if (activeSessionId && activeSessionId !== NEW_CONVERSATION_ID && consumeTenderParsingOpenIntent(activeSessionId)) {
    setTenderParsingOpen(true);
    return;
  }
  if (!prev || prev === NEW_CONVERSATION_ID) return;
  if (prev !== activeSessionId) setTenderParsingOpen(false);
}, [activeSessionId]);
```

（保留原有注释"仅在既有会话之间切换时关闭解析页…"的语义，可合并注释。）

- [ ] **Step 3: 索引写入效应**

紧接其后追加：

```tsx
// 解析页真实打开且会话 id 落地后，写入招标解读历史索引（设计 D-20261028-2254 D-01）。
useEffect(() => {
  if (!tenderParsingOpen) return;
  if (!activeSessionId || activeSessionId === NEW_CONVERSATION_ID) return;
  const file = tenderAnalysis.file;
  if (!file) return;
  upsertTenderParsingIndex({
    sessionId: activeSessionId,
    fileName: file.name,
    size: file.size,
    updatedAt: Date.now(),
  });
}, [tenderParsingOpen, activeSessionId, tenderAnalysis.file]);
```

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm run build`
Expected: 零错误、构建成功

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/index.tsx
git commit -m "feat(web): record parsing sessions into reading history and consume reopen intent"
```

---

### Task 6: 结构断言 + 全量回归 + 重启

**Files:**
- Modify: `jiuwenswarm/channels/web/frontend/tests/tenderParsingView.test.mjs`

- [ ] **Step 1: 追加结构断言**

`tests/tenderParsingView.test.mjs` 末尾追加：

```js
test('ChatPanel records parsing session and consumes reopen intent', () => {
  assert.match(panel, /upsertTenderParsingIndex\(\{/);
  assert.match(panel, /consumeTenderParsingOpenIntent\(activeSessionId\)/);
  const reading = source('src/features/tender/TenderReadingPage.tsx');
  assert.ok(reading.includes('data-testid="tender-reading-page"'));
  assert.ok(reading.includes('data-testid="tender-reading-new"'));
  assert.ok(reading.includes('tender-reading-list'));
});

test('tender.readingPage.* keys exist in both zh and en', () => {
  for (const key of ['newTitle', 'newDesc', 'newAction', 'historyTitle', 'historyEmpty']) {
    assert.ok(zh.tender.readingPage[key], `zh missing tender.readingPage.${key}`);
    assert.ok(en.tender.readingPage[key], `en missing tender.readingPage.${key}`);
  }
});
```

- [ ] **Step 2: 全量回归**

Run: `npm run test:tender-parsing && npm run test:tender-parsing-view && npm run test:tender-reading && npm run test:tender-shell && node --test tests/i18nLocales.test.mjs`
Expected: 全部 PASS

- [ ] **Step 3: 构建 + 重启**

Run: `npm run build`，然后仓库根目录 `make restart-debug-fast`
Expected: 构建成功；服务输出 Web UI http://localhost:5173

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/tests/tenderParsingView.test.mjs
git commit -m "test(web): assert tender reading wiring and history i18n"
```

---

### Task 7: 人工验证（用户执行）

- [ ] 硬刷新后点侧边栏「招标解读」→ 功能页（新建卡 + 空历史态）
- [ ] 点「新建解读」→ 进入新会话；上传招标文件发送 → 解析页呈现（含结构化区块）
- [ ] 回到「招标解读」→ 历史列表出现刚才的文件（名称/大小/时间）
- [ ] 点历史项 → 跳回该会话并直接打开解析页
- [ ] 其余 8 个占位入口与聊天功能回归正常

---

## Self-Review 记录

- Spec 覆盖：I-01~I-02 → Task 1；I-06 → Task 2；I-03 → Task 3；I-04 → Task 4；I-05 → Task 5；I-07 → Task 1/4/6；V-01~V-05 → Task 4/6 自动断言 + Task 7 人工。
- 类型一致性：`TenderParsingIndexEntry`/`readTenderParsingIndex`/`upsertTenderParsingIndex`（Task 1 定义）→ Task 3/5 引用；`markTenderParsingOpen`/`consumeTenderParsingOpenIntent`（Task 1）→ Task 4/5 引用。
- 依赖顺序：1 → 3 → 4 → 5（2 与 3 可互换，1 必须先于 3/5）。
