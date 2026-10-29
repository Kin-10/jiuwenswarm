# 标书解析结果页 Implementation Plan

> **For agentic workers:** 按任务逐个执行；每任务完成后运行其验证命令再进入下一任务。步骤使用 checkbox（`- [ ]`）跟踪。执行方式：子代理逐任务驱动（用户已确认的执行模式）。

**Goal:** 对话框上传招标文件（document 附件）并发送后，主区切换为专门解析页（文件卡 + 项目概述/评分要求等结构化区块 + 绿勾完成态 + 上一步/下一步占位），解析执行复用现有 agent 链路，前端消费契约产物或 markdown 兜底抽取。

**Architecture:** 新增纯函数模块 `tenderAnalysisModel.ts`（契约解析 + markdown 兜底抽取 + 模型组装，零依赖 React）→ React hook `useTenderAnalysis.ts`（订阅 chatStore 消息 + artifacts，拉取 `tender-analysis.json` 契约产物）→ 展示组件 `TenderParsingView.tsx`（参考智标AI招标解读页布局）→ `ChatPanel/index.tsx` 触发钩子 + 消息流互斥渲染（`display:none` 保挂载）。

**Tech Stack:** React 18 + TypeScript + Vite；i18next 双语；CSS 语义变量 `var(--color-*)`；node:test + esbuild 前端测试。

**设计依据：** `.agents/agent-docs/designs/proposals/D-20261028-2054-tender-parsing-result-page/design.md`（approved）。验收场景 ID：D-20261028-2054-V-01 ~ V-07。

**仓库约束（必须遵守）：**
- 颜色只用 `var(--color-*)` 语义变量，禁止写死色值。
- 新增用户可见文案 `zh.json` 与 `en.json` 双语齐全。
- 新 UI 元素加 `data-testid`，前缀 `chat-tender-parsing-`。
- 本地禁止运行格式化与静态检查工具（ESLint/Prettier/Ruff 等）；保持修改处现有风格。
- 提交信息用简洁英文 Conventional Commits，只提交本任务相关文件。
- 前端工作目录：`jiuwenswarm/channels/web/frontend`。

---

### Task 1: tenderAnalysisModel 纯函数模块 + 单测

**Files:**
- Create: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/tenderAnalysisModel.ts`
- Test: `jiuwenswarm/channels/web/frontend/tests/tenderAnalysisModel.test.mjs`
- Modify: `jiuwenswarm/channels/web/frontend/package.json`（加 test script）

- [ ] **Step 1: 写失败测试**

Create `tests/tenderAnalysisModel.test.mjs`：

```js
/**
 * tenderAnalysisModel 纯函数单测：
 * 1. findTenderFileInfo 取最后一条 user 消息中的 document 附件。
 * 2. parseTenderAnalysisContract 校验 version/sections，非法 JSON 与缺字段返回 null。
 * 3. extractSectionsFromMarkdown 按已知标题集映射区块，kv/bullets/heading/paragraph 正确转换。
 * 4. buildTenderAnalysisModel：契约优先；无契约走 markdown 兜底；都没有则 parsing 空态。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

const model = await import(
  '../node_modules/.cache/tender-parsing/tenderAnalysisModel.mjs'
);

const docMessage = {
  id: 'u1',
  role: 'user',
  content: '解析这份招标文件',
  timestamp: '2026-10-28T10:00:00Z',
  mediaItems: [
    { type: 'image', mimeType: 'image/png', filename: 'a.png' },
    { type: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: '承德招标文件.docx', sizeBytes: 169813 },
  ],
};

test('findTenderFileInfo returns the latest user document attachment', () => {
  const info = model.findTenderFileInfo([docMessage]);
  assert.deepEqual(info, { name: '承德招标文件.docx', size: 169813 });
  assert.equal(model.findTenderFileInfo([]), null);
  assert.equal(model.findTenderFileInfo([{ ...docMessage, mediaItems: [{ type: 'image', mimeType: 'image/png', filename: 'a.png' }] }]), null);
});

test('parseTenderAnalysisContract accepts a valid contract', () => {
  const raw = JSON.stringify({
    version: 1,
    file: { name: 'a.docx', size: 10 },
    status: 'done',
    sections: [
      {
        key: 'projectOverview',
        title: '项目概述',
        required: true,
        status: 'done',
        blocks: [
          { type: 'heading', text: '项目基础信息' },
          { type: 'kv', label: '项目名称', value: '血站试剂采购' },
          { type: 'bullets', items: ['共100盒'] },
        ],
      },
    ],
  });
  const parsed = model.parseTenderAnalysisContract(raw);
  assert.equal(parsed.status, 'done');
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.sections[0].status, 'done');
  assert.equal(parsed.sections[0].blocks[1].label, '项目名称');
});

test('parseTenderAnalysisContract rejects invalid payloads', () => {
  assert.equal(model.parseTenderAnalysisContract('not json'), null);
  assert.equal(model.parseTenderAnalysisContract('{"version":2,"sections":[]}'), null);
  assert.equal(model.parseTenderAnalysisContract('{"version":1,"sections":[]}'), null);
});

test('extractSectionsFromMarkdown maps known headings to sections', () => {
  const md = [
    '好的，解析结果如下：',
    '## 项目概述',
    '### 项目基础信息',
    '- **项目名称**：血站试剂采购',
    '- **项目编号**：HBHJ2410-CD-014',
    '采购货物清单：',
    '- 试剂盒 100 盒',
    '## 技术部分评分要求',
    '- 分值：/',
    '- 检测方法为PCR荧光法',
    '## 致谢',
    '- 与本解析无关',
  ].join('\n');
  const sections = model.extractSectionsFromMarkdown(md);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].key, 'projectOverview');
  assert.deepEqual(
    sections[0].blocks.filter((b) => b.type === 'kv').map((b) => b.label),
    ['项目名称', '项目编号'],
  );
  assert.equal(sections[1].key, 'techScoring');
  assert.ok(sections[1].blocks.some((b) => b.type === 'bullets' && b.items.includes('检测方法为PCR荧光法')));
});

test('buildTenderAnalysisModel prefers contract over markdown fallback', () => {
  const contractRaw = JSON.stringify({
    version: 1,
    status: 'parsing',
    sections: [{ key: 'projectOverview', title: '项目概述', required: true, status: 'pending', blocks: [] }],
  });
  const built = model.buildTenderAnalysisModel({
    messages: [docMessage, { id: 'a1', role: 'assistant', content: '## 项目概述\n- **项目名称**：x', timestamp: '2026-10-28T10:01:00Z', isStreaming: false }],
    contractRaw,
  });
  assert.equal(built.source, 'contract');
  assert.equal(built.status, 'parsing');
  assert.equal(built.sections[0].status, 'pending');
  assert.deepEqual(built.file, { name: '承德招标文件.docx', size: 169813 });
});

test('buildTenderAnalysisModel falls back to settled assistant markdown', () => {
  const built = model.buildTenderAnalysisModel({
    messages: [
      docMessage,
      { id: 'a1', role: 'assistant', content: '## 项目概述\n- **项目名称**：血站试剂采购', timestamp: '2026-10-28T10:01:00Z', isStreaming: false },
    ],
    contractRaw: null,
  });
  assert.equal(built.source, 'fallback');
  assert.equal(built.status, 'done');
  assert.equal(built.sections.length, 1);
});

test('buildTenderAnalysisModel skips streaming messages and stays parsing when empty', () => {
  const built = model.buildTenderAnalysisModel({
    messages: [docMessage, { id: 'a1', role: 'assistant', content: '## 项目概述\n- 流式中', timestamp: '2026-10-28T10:01:00Z', isStreaming: true }],
    contractRaw: null,
  });
  assert.equal(built.source, 'none');
  assert.equal(built.status, 'parsing');
  assert.equal(built.sections.length, 0);
});
```

- [ ] **Step 2: 注册测试命令并确认失败**

Modify `package.json` scripts（与既有 test:tender-shell 并列）：

```json
"test:tender-shell": "node --test tests/tenderShellNav.test.mjs",
"test:tender-parsing": "esbuild src/components/ChatPanel/tenderAnalysisModel.ts --bundle --platform=node --format=esm --packages=external --outfile=node_modules/.cache/tender-parsing/tenderAnalysisModel.mjs && node --test tests/tenderAnalysisModel.test.mjs"
```

Run（frontend 目录）: `npm run test:tender-parsing`
Expected: FAIL（esbuild 报错，tenderAnalysisModel.ts 不存在）

- [ ] **Step 3: 实现纯函数模块**

Create `src/components/ChatPanel/tenderAnalysisModel.ts`：

```ts
/**
 * 标书解析结果页的纯数据模型层（设计 D-20261028-2054）：
 * - 契约通道：agent 产物 tender-analysis.json（version 1）。
 * - 兜底通道：最终助手消息的 markdown 已知标题集抽取。
 * 零 React 依赖，便于 node:test 直测。
 */

import type { Message } from '../../types';
import type { ArtifactItem } from '../ArtifactsPanel/artifactCollection';

export type TenderSectionStatus = 'pending' | 'done' | 'error';
export type TenderParsingStatus = 'parsing' | 'done' | 'error';
export type TenderBlockType = 'heading' | 'kv' | 'bullets' | 'paragraph';

export interface TenderAnalysisBlock {
  type: TenderBlockType;
  text?: string;
  label?: string;
  value?: string;
  items?: string[];
}

export interface TenderAnalysisSection {
  key: string;
  title: string;
  required: boolean;
  status: TenderSectionStatus;
  blocks: TenderAnalysisBlock[];
}

export interface TenderFileInfo {
  name: string;
  size?: number;
}

export interface TenderAnalysisModel {
  file: TenderFileInfo | null;
  status: TenderParsingStatus;
  sections: TenderAnalysisSection[];
  source: 'contract' | 'fallback' | 'none';
}

export const TENDER_ANALYSIS_ARTIFACT_NAME = 'tender-analysis.json';

export function findTenderFileInfo(messages: Message[]): TenderFileInfo | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user' || !message.mediaItems) continue;
    const doc = message.mediaItems.find((item) => item.type === 'document');
    if (doc) {
      return { name: doc.displayName || doc.filename, size: doc.sizeBytes ?? doc.size_bytes };
    }
  }
  return null;
}

export function findTenderContractArtifact(artifacts: ArtifactItem[]): ArtifactItem | null {
  return artifacts.find((item) => item.name === TENDER_ANALYSIS_ARTIFACT_NAME && (item.downloadUrl || item.path)) ?? null;
}

const VALID_BLOCK_TYPES = new Set<TenderBlockType>(['heading', 'kv', 'bullets', 'paragraph']);

export function parseTenderAnalysisContract(
  raw: string,
): { status: TenderParsingStatus; file?: TenderFileInfo; sections: TenderAnalysisSection[] } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const candidate = data as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.sections)) return null;
  const status: TenderParsingStatus =
    candidate.status === 'done' || candidate.status === 'error' ? candidate.status : 'parsing';
  const sections: TenderAnalysisSection[] = [];
  for (const rawSection of candidate.sections) {
    if (!rawSection || typeof rawSection !== 'object') continue;
    const s = rawSection as Record<string, unknown>;
    if (typeof s.key !== 'string' || typeof s.title !== 'string') continue;
    const blocks: TenderAnalysisBlock[] = [];
    if (Array.isArray(s.blocks)) {
      for (const rawBlock of s.blocks) {
        if (!rawBlock || typeof rawBlock !== 'object') continue;
        const b = rawBlock as Record<string, unknown>;
        if (typeof b.type !== 'string' || !VALID_BLOCK_TYPES.has(b.type as TenderBlockType)) continue;
        blocks.push({
          type: b.type as TenderBlockType,
          text: typeof b.text === 'string' ? b.text : undefined,
          label: typeof b.label === 'string' ? b.label : undefined,
          value: typeof b.value === 'string' ? b.value : undefined,
          items: Array.isArray(b.items) ? b.items.filter((x): x is string => typeof x === 'string') : undefined,
        });
      }
    }
    sections.push({
      key: s.key,
      title: s.title,
      required: s.required !== false,
      status: s.status === 'done' || s.status === 'error' ? s.status : 'pending',
      blocks,
    });
  }
  if (!sections.length) return null;
  let file: TenderFileInfo | undefined;
  if (candidate.file && typeof candidate.file === 'object') {
    const f = candidate.file as Record<string, unknown>;
    if (typeof f.name === 'string') {
      file = { name: f.name, size: typeof f.size === 'number' ? f.size : undefined };
    }
  }
  return { status, file, sections };
}

/** 兜底通道可识别的 markdown 二级标题集（含常见别名）。 */
const SECTION_DEFS: Array<{ key: string; title: string; patterns: RegExp[] }> = [
  { key: 'projectOverview', title: '项目概述', patterns: [/^项目概述$/, /^项目概览$/, /^项目信息$/, /^项目基础信息$/] },
  { key: 'techScoring', title: '技术部分评分要求', patterns: [/^技术部分评分要求$/, /^技术评分要求$/, /^评分要求$/, /^技术部分$/] },
  { key: 'businessScoring', title: '商务部分评分要求', patterns: [/^商务部分评分要求$/, /^商务评分要求$/, /^商务部分$/] },
  { key: 'qualification', title: '资格要求', patterns: [/^资格要求$/, /^资格性审查$/, /^投标人资格要求$/] },
];

export function extractSectionsFromMarkdown(content: string): TenderAnalysisSection[] {
  const sections: TenderAnalysisSection[] = [];
  let current: TenderAnalysisSection | null = null;
  let bullets: string[] = [];

  const flushBullets = () => {
    if (current && bullets.length) {
      current.blocks.push({ type: 'bullets', items: [...bullets] });
    }
    bullets = [];
  };
  const flushSection = () => {
    flushBullets();
    if (current && current.blocks.length) {
      current.status = 'done';
      sections.push(current);
    }
    current = null;
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      flushSection();
      const heading = h2[1].replace(/\*/g, '').trim();
      const def = SECTION_DEFS.find((d) => d.patterns.some((p) => p.test(heading)));
      current = def ? { key: def.key, title: def.title, required: true, status: 'pending', blocks: [] } : null;
      continue;
    }
    if (!current) continue;
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      flushBullets();
      current.blocks.push({ type: 'heading', text: h3[1].trim() });
      continue;
    }
    const bullet = /^(?:[-*•])\s+(.+)$/.exec(line.trim());
    if (bullet) {
      bullets.push(bullet[1].trim());
      continue;
    }
    const kv = /^(?:\*\*(.+?)\*\*|([^：:]+?))[：:]\s*(.+)$/.exec(line.trim());
    if (kv) {
      flushBullets();
      current.blocks.push({ type: 'kv', label: (kv[1] ?? kv[2]).trim(), value: kv[3].trim() });
      continue;
    }
    if (line.trim()) {
      flushBullets();
      current.blocks.push({ type: 'paragraph', text: line.trim() });
    }
  }
  flushSection();
  return sections;
}

export function buildTenderAnalysisModel(input: {
  messages: Message[];
  contractRaw: string | null;
}): TenderAnalysisModel {
  const fallbackFile = findTenderFileInfo(input.messages);
  if (input.contractRaw) {
    const contract = parseTenderAnalysisContract(input.contractRaw);
    if (contract) {
      return { file: contract.file ?? fallbackFile, status: contract.status, sections: contract.sections, source: 'contract' };
    }
  }
  const lastSettledAssistant = [...input.messages]
    .reverse()
    .find((m) => m.role === 'assistant' && !m.isStreaming && m.content.trim());
  const sections = lastSettledAssistant ? extractSectionsFromMarkdown(lastSettledAssistant.content) : [];
  if (sections.length) {
    return { file: fallbackFile, status: 'done', sections, source: 'fallback' };
  }
  return { file: fallbackFile, status: 'parsing', sections: [], source: 'none' };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:tender-parsing`
Expected: PASS（7 个用例全过）

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/tenderAnalysisModel.ts jiuwenswarm/channels/web/frontend/tests/tenderAnalysisModel.test.mjs jiuwenswarm/channels/web/frontend/package.json
git commit -m "feat(web): add tender analysis model with contract parsing and markdown fallback"
```

---

### Task 2: i18n 文案（zh/en）

**Files:**
- Modify: `jiuwenswarm/channels/web/frontend/src/i18n/locales/zh.json`
- Modify: `jiuwenswarm/channels/web/frontend/src/i18n/locales/en.json`

- [ ] **Step 1: zh.json 增加 `chat.tenderParsing` 节点**

在 `chat` 对象内（建议紧跟既有 `welcomeHeadingSuffix` 之后，保持字母/语义聚类风格与文件现状一致）插入：

```json
"tenderParsing": {
  "title": "招标文件解析",
  "subtitle": "以下两种方式任选一种",
  "requiredMark": "*",
  "autoTitle": "招标文件自动解析",
  "autoDesc": "自动解析招标文件，总结项目概述、评分要求",
  "autoFormats": "文件格式：doc、docx、pdf(不支持扫描版pdf)",
  "pasteTitle": "粘贴项目信息解析",
  "pasteDesc": "手动粘贴项目概述、评分要求",
  "pasteComingSoon": "敬请期待",
  "history": "历史记录",
  "statusParsing": "解析中",
  "statusDone": "解析完成",
  "statusError": "解析失败",
  "analyzing": "AI分析中，请稍候…",
  "emptyResult": "等待解析产出…",
  "prevStep": "上一步",
  "nextStep": "下一步",
  "nextComingSoon": "后续步骤规划中",
  "backToChat": "返回对话",
  "removeFile": "删除文件"
},
```

- [ ] **Step 2: en.json 同步英文**

```json
"tenderParsing": {
  "title": "Tender Document Parsing",
  "subtitle": "Choose either method",
  "requiredMark": "*",
  "autoTitle": "Auto Parse Tender File",
  "autoDesc": "Automatically parses the tender file and summarizes the project overview and scoring requirements",
  "autoFormats": "Formats: doc, docx, pdf (scanned PDFs not supported)",
  "pasteTitle": "Paste Project Info",
  "pasteDesc": "Manually paste the project overview and scoring requirements",
  "pasteComingSoon": "Coming soon",
  "history": "History",
  "statusParsing": "Parsing",
  "statusDone": "Completed",
  "statusError": "Failed",
  "analyzing": "AI is analyzing, please wait…",
  "emptyResult": "Waiting for parsing output…",
  "prevStep": "Previous",
  "nextStep": "Next",
  "nextComingSoon": "More steps coming soon",
  "backToChat": "Back to chat",
  "removeFile": "Remove file"
},
```

- [ ] **Step 3: 校验 JSON 合法且双语键对齐**

Run: `node --test tests/i18nLocales.test.mjs`（若该测试覆盖键对齐；否则 `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json'));JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json'))"`）
Expected: PASS / 无输出错误

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/i18n/locales/zh.json jiuwenswarm/channels/web/frontend/src/i18n/locales/en.json
git commit -m "feat(web): add tender parsing view i18n strings"
```

---

### Task 3: useTenderAnalysis hook

**Files:**
- Create: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/useTenderAnalysis.ts`

- [ ] **Step 1: 实现 hook**

```ts
/**
 * 标书解析页数据源 hook（设计 D-20261028-2054 D-03）：
 * 契约产物 tender-analysis.json 优先，markdown 兜底；仅在解析页打开时拉取契约内容。
 */

import { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '../../stores';
import { useSessionArtifacts } from '../ArtifactsPanel';
import { artifactDownloadUrl, artifactTextPreviewUrl } from '../ArtifactsPanel/filePreviewModel';
import {
  buildTenderAnalysisModel,
  findTenderContractArtifact,
  type TenderAnalysisModel,
} from './tenderAnalysisModel';

export function useTenderAnalysis(active: boolean): TenderAnalysisModel {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const messages = useChatStore((s) => s.runtimes[activeSessionId ?? '']?.messages ?? []);
  const artifacts = useSessionArtifacts();
  const contractArtifact = useMemo(() => findTenderContractArtifact(artifacts), [artifacts]);
  const [contractRaw, setContractRaw] = useState<string | null>(null);
  // artifact 对象随 memo 重建，用 id+timestamp 作为内容版本键避免重复拉取。
  const contractKey = contractArtifact ? `${contractArtifact.id}:${contractArtifact.timestamp ?? 0}` : '';

  useEffect(() => {
    if (!active || !contractArtifact) {
      setContractRaw(null);
      return;
    }
    const url =
      artifactTextPreviewUrl(contractArtifact, window.location.origin) ?? artifactDownloadUrl(contractArtifact);
    if (!url) {
      setContractRaw(null);
      return;
    }
    let cancelled = false;
    void fetch(url, { cache: 'no-store' })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`status ${response.status}`))))
      .then((text) => {
        if (!cancelled) setContractRaw(text);
      })
      .catch(() => {
        if (!cancelled) setContractRaw(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contractKey 已涵盖 contractArtifact 的内容版本
  }, [active, contractKey]);

  return useMemo(() => buildTenderAnalysisModel({ messages, contractRaw }), [messages, contractRaw]);
}
```

注意：仓库禁止本地跑 ESLint，但行内 eslint-disable 注释沿用既有代码风格（若 `ChatPanel` 其他 hook 有类似注释则保留，否则删除该注释行）。执行者先 grep `eslint-disable-next-line react-hooks/exhaustive-deps` 确认先例再决定保留与否。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`（frontend 目录；该命令是构建的一部分，非静态检查禁令范围）
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/useTenderAnalysis.ts
git commit -m "feat(web): add useTenderAnalysis hook consuming contract artifact with markdown fallback"
```

---

### Task 4: TenderParsingView 组件 + 样式

**Files:**
- Create: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/TenderParsingView.tsx`
- Create: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/TenderParsingView.css`

- [ ] **Step 1: 实现组件**

Create `src/components/ChatPanel/TenderParsingView.tsx`：

```tsx
/**
 * 标书解析结果页（设计 D-20261028-2054）：
 * 头部（标题+说明+返回对话）→ 方式卡×2 + 历史记录占位 → 文件卡 → 结果区块双栏 → 底部向导按钮。
 * 数据只读，来自 useTenderAnalysis；删除文件卡仅重置页面态（onReset 由父组件处理）。
 */

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  History,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { FileIcon } from '../FileIcon';
import type { TenderAnalysisModel, TenderAnalysisSection } from './tenderAnalysisModel';
import './TenderParsingView.css';

interface TenderParsingViewProps {
  model: TenderAnalysisModel;
  onBack: () => void;
  onReset: () => void;
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function SectionCard({ section }: { section: TenderAnalysisSection }) {
  const { t } = useTranslation();
  return (
    <section
      className="tender-parsing-section"
      data-testid={`chat-tender-parsing-section-${section.key}`}
      data-status={section.status}
    >
      <header className="tender-parsing-section__header">
        <h3 className="tender-parsing-section__title">
          {section.title}
          {section.required && <span className="tender-parsing-required">{t('chat.tenderParsing.requiredMark')}</span>}
        </h3>
        {section.status === 'done' && (
          <CheckCircle2 size={20} className="tender-parsing-section__check" aria-hidden="true" />
        )}
      </header>
      <div className="tender-parsing-section__body">
        {section.status === 'pending' && (
          <div className="tender-parsing-section__skeleton" data-testid={`chat-tender-parsing-skeleton-${section.key}`}>
            <span />
            <span />
            <span />
          </div>
        )}
        {section.blocks.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <h4 key={index} className="tender-parsing-block-heading">
                {block.text}
              </h4>
            );
          }
          if (block.type === 'kv') {
            return (
              <p key={index} className="tender-parsing-block-kv">
                <strong>{block.label}：</strong>
                {block.value}
              </p>
            );
          }
          if (block.type === 'bullets') {
            return (
              <ul key={index} className="tender-parsing-block-bullets">
                {(block.items ?? []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="tender-parsing-block-paragraph">
              {block.text}
            </p>
          );
        })}
      </div>
    </section>
  );
}

export function TenderParsingView({ model, onBack, onReset }: TenderParsingViewProps) {
  const { t } = useTranslation();
  const parsing = model.status === 'parsing';
  const statusKey =
    model.status === 'done' ? 'statusDone' : model.status === 'error' ? 'statusError' : 'statusParsing';

  return (
    <div className="tender-parsing-view" data-testid="chat-tender-parsing-view">
      <header className="tender-parsing-header">
        <div className="tender-parsing-header__titles">
          <h2 className="tender-parsing-title">
            {t('chat.tenderParsing.title')}
            <span className="tender-parsing-required">{t('chat.tenderParsing.requiredMark')}</span>
          </h2>
          <p className="tender-parsing-subtitle">{t('chat.tenderParsing.subtitle')}</p>
        </div>
        <button
          type="button"
          className="tender-parsing-back"
          onClick={onBack}
          data-testid="chat-tender-parsing-back"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t('chat.tenderParsing.backToChat')}
        </button>
      </header>

      <div className="tender-parsing-methods">
        <div
          className="tender-parsing-method tender-parsing-method--active"
          data-testid="chat-tender-parsing-method-auto"
        >
          <UploadCloud size={20} aria-hidden="true" className="tender-parsing-method__icon" />
          <div className="tender-parsing-method__texts">
            <p className="tender-parsing-method__title">{t('chat.tenderParsing.autoTitle')}</p>
            <p className="tender-parsing-method__desc">{t('chat.tenderParsing.autoDesc')}</p>
            <p className="tender-parsing-method__formats">{t('chat.tenderParsing.autoFormats')}</p>
          </div>
          <span className="tender-parsing-method__history" data-testid="chat-tender-parsing-history">
            <History size={14} aria-hidden="true" />
            {t('chat.tenderParsing.history')}
          </span>
        </div>
        <div
          className="tender-parsing-method tender-parsing-method--disabled"
          title={t('chat.tenderParsing.pasteComingSoon')}
          data-testid="chat-tender-parsing-method-paste"
        >
          <ClipboardPaste size={20} aria-hidden="true" className="tender-parsing-method__icon" />
          <div className="tender-parsing-method__texts">
            <p className="tender-parsing-method__title">{t('chat.tenderParsing.pasteTitle')}</p>
            <p className="tender-parsing-method__desc">{t('chat.tenderParsing.pasteDesc')}</p>
          </div>
        </div>
      </div>

      {model.file && (
        <div className="tender-parsing-file" data-testid="chat-tender-parsing-file">
          <FileIcon fileName={model.file.name} size={28} />
          <div className="tender-parsing-file__meta">
            <p className="tender-parsing-file__name" title={model.file.name}>
              {model.file.name}
            </p>
            {formatFileSize(model.file.size) && (
              <p className="tender-parsing-file__size">{formatFileSize(model.file.size)}</p>
            )}
          </div>
          <span
            className={clsx('tender-parsing-file__status', `tender-parsing-file__status--${model.status}`)}
            data-testid="chat-tender-parsing-file-status"
          >
            {t(`chat.tenderParsing.${statusKey}`)}
          </span>
          <button
            type="button"
            className="tender-parsing-file__remove"
            aria-label={t('chat.tenderParsing.removeFile')}
            onClick={onReset}
            data-testid="chat-tender-parsing-file-remove"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {model.sections.length > 0 ? (
        <div className="tender-parsing-sections" data-testid="chat-tender-parsing-sections">
          {model.sections.map((section) => (
            <SectionCard key={section.key} section={section} />
          ))}
        </div>
      ) : (
        <p className="tender-parsing-empty" data-testid="chat-tender-parsing-empty">
          {t('chat.tenderParsing.emptyResult')}
        </p>
      )}

      <footer className="tender-parsing-footer">
        <button
          type="button"
          className="tender-parsing-step tender-parsing-step--prev"
          onClick={onBack}
          data-testid="chat-tender-parsing-prev"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t('chat.tenderParsing.prevStep')}
        </button>
        <button
          type="button"
          className="tender-parsing-step tender-parsing-step--next"
          disabled
          title={t('chat.tenderParsing.nextComingSoon')}
          data-testid="chat-tender-parsing-next"
        >
          {t('chat.tenderParsing.nextStep')}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </footer>

      {parsing && (
        <div className="tender-parsing-loading" data-testid="chat-tender-parsing-loading">
          <Loader2 size={14} className="tender-parsing-loading__spinner" aria-hidden="true" />
          {t('chat.tenderParsing.analyzing')}
        </div>
      )}
    </div>
  );
}

export default TenderParsingView;
```

- [ ] **Step 2: 实现样式**

Create `src/components/ChatPanel/TenderParsingView.css`（颜色全部语义变量）：

```css
.tender-parsing-view {
  position: relative;
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 32px;
  background: var(--color-surface-page);
}

.tender-parsing-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.tender-parsing-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tender-parsing-required {
  margin-left: 2px;
  color: var(--color-feedback-danger);
}

.tender-parsing-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.tender-parsing-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--color-border-default);
  border-radius: 8px;
  background: var(--color-surface-card);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.tender-parsing-back:hover {
  color: var(--color-text-primary);
}

.tender-parsing-methods {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.tender-parsing-method {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 280px;
  padding: 14px 16px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  background: var(--color-surface-card);
}

.tender-parsing-method--active {
  border-color: var(--color-action-primary);
  background: var(--color-action-primary-subtle);
}

.tender-parsing-method--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tender-parsing-method__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--color-action-primary);
}

.tender-parsing-method__texts {
  min-width: 0;
}

.tender-parsing-method__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tender-parsing-method__desc,
.tender-parsing-method__formats {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.tender-parsing-method__history {
  position: absolute;
  top: 10px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--color-text-link);
  cursor: default;
}

.tender-parsing-file {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  background: var(--color-surface-card);
}

.tender-parsing-file__meta {
  min-width: 0;
  flex: 1 1 auto;
}

.tender-parsing-file__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tender-parsing-file__size {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tender-parsing-file__status {
  flex: 0 0 auto;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 20px;
}

.tender-parsing-file__status--parsing {
  color: var(--color-action-primary);
  background: var(--color-action-primary-subtle);
}

.tender-parsing-file__status--done {
  color: var(--color-feedback-success);
  background: var(--color-feedback-success-subtle);
}

.tender-parsing-file__status--error {
  color: var(--color-feedback-danger);
  background: var(--color-feedback-danger-subtle);
}

.tender-parsing-file__remove {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.tender-parsing-file__remove:hover {
  color: var(--color-feedback-danger);
  background: var(--color-surface-hover);
}

.tender-parsing-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 960px) {
  .tender-parsing-sections {
    grid-template-columns: 1fr;
  }
}

.tender-parsing-section {
  position: relative;
  padding: 16px 18px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  background: var(--color-surface-card);
}

.tender-parsing-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tender-parsing-section__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tender-parsing-section__check {
  color: var(--color-feedback-success);
}

.tender-parsing-section__body {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--color-text-primary);
}

.tender-parsing-block-heading {
  margin: 10px 0 4px;
  font-size: 13px;
  font-weight: 600;
}

.tender-parsing-block-kv {
  margin: 2px 0;
}

.tender-parsing-block-kv strong {
  font-weight: 600;
}

.tender-parsing-block-bullets {
  margin: 4px 0;
  padding-left: 18px;
}

.tender-parsing-block-paragraph {
  margin: 4px 0;
  color: var(--color-text-secondary);
}

.tender-parsing-section__skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tender-parsing-section__skeleton span {
  height: 12px;
  border-radius: 6px;
  background: var(--color-surface-muted);
}

.tender-parsing-section__skeleton span:nth-child(2) {
  width: 82%;
}

.tender-parsing-section__skeleton span:nth-child(3) {
  width: 64%;
}

.tender-parsing-empty {
  margin: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.tender-parsing-footer {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.tender-parsing-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 120px;
  justify-content: center;
  padding: 8px 20px;
  border-radius: 999px;
  font-size: 14px;
  cursor: pointer;
}

.tender-parsing-step--prev {
  border: 1px solid var(--color-action-primary);
  background: var(--color-surface-card);
  color: var(--color-action-primary);
}

.tender-parsing-step--next {
  border: none;
  background: var(--color-action-primary);
  color: var(--color-action-primary-text);
}

.tender-parsing-step--next:disabled {
  background: var(--color-action-primary-disabled-surface);
  cursor: not-allowed;
}

.tender-parsing-loading {
  position: sticky;
  bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: fit-content;
  margin: 16px auto 0;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tender-parsing-loading__spinner {
  animation: tender-parsing-spin 1s linear infinite;
}

@keyframes tender-parsing-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增错误

- [ ] **Step 4: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/TenderParsingView.tsx jiuwenswarm/channels/web/frontend/src/components/ChatPanel/TenderParsingView.css
git commit -m "feat(web): add tender parsing view component with section cards and wizard footer"
```

---

### Task 5: ChatPanel 集成（触发 + 互斥渲染）

**Files:**
- Modify: `jiuwenswarm/channels/web/frontend/src/components/ChatPanel/index.tsx`

- [ ] **Step 1: 加 state 与 import**

在 `ChatPanel/index.tsx` 顶部导入区追加（与相邻 import 同风格）：

```tsx
import { TenderParsingView } from './TenderParsingView';
import { useTenderAnalysis } from './useTenderAnalysis';
```

在组件内 state 区（如 `const [humanShareOpen, setHumanShareOpen] = useState(false);` 附近）加：

```tsx
// 标书解析页：提交含 document 附件的消息后，主区从消息流切换为解析结果页（设计 D-20261028-2054）。
const [tenderParsingOpen, setTenderParsingOpen] = useState(false);
const tenderAnalysis = useTenderAnalysis(tenderParsingOpen);
```

- [ ] **Step 2: 提交触发钩子**

在 `handleSendMessage`（`ChatPanel/index.tsx:2258`）函数体最前面加：

```tsx
if (mediaItems?.some((item) => item.type === 'document')) {
  setTenderParsingOpen(true);
}
```

- [ ] **Step 3: 消息流互斥渲染**

找到消息滚动容器（`ChatPanel/index.tsx:2779-2786`，`ref={scrollContainerRef}`、`data-testid="chat-panel-scroll"`），将其改为保挂载隐藏，并在其后渲染解析页：

```tsx
<div
  ref={scrollContainerRef}
  className="chat-scroll flex-1 overflow-y-auto"
  data-timeline-scroll-root
  data-testid="chat-panel-scroll"
  onScroll={handleScroll}
  onWheel={handleWheel}
  style={tenderParsingOpen ? { display: 'none' } : undefined}
>
```

紧接该容器 `</div>` 之后、`.chat-compose` 之前（保持与消息流同一层级）插入：

```tsx
{tenderParsingOpen && (
  <TenderParsingView
    model={tenderAnalysis}
    onBack={() => setTenderParsingOpen(false)}
    onReset={() => setTenderParsingOpen(false)}
  />
)}
```

注意：`.chat-compose`（输入框）保持渲染——解析页打开时用户仍可继续输入追问；再次发送含 document 附件的消息会保持解析页打开并自动重置为新文件的解析态（Task 1 的 `findTenderFileInfo` 取最后一条 user 文档消息，天然重置）。

- [ ] **Step 4: 会话切换时关闭解析页**

找到 ChatPanel 内处理会话切换复位的 `useEffect`（搜索 `activeSessionId` 相关复位逻辑，如 `setHumanShareOpen(false)` 所在 effect），在其中加：

```tsx
setTenderParsingOpen(false);
```

若不存在现成的复位 effect，则新增：

```tsx
useEffect(() => {
  setTenderParsingOpen(false);
}, [activeSessionId]);
```

- [ ] **Step 5: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 无错误，构建成功

- [ ] **Step 6: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/src/components/ChatPanel/index.tsx
git commit -m "feat(web): switch main area to tender parsing view on document submit"
```

---

### Task 6: 结构性回归测试 + 构建 + 重启验证

**Files:**
- Test: `jiuwenswarm/channels/web/frontend/tests/tenderParsingView.test.mjs`
- Modify: `jiuwenswarm/channels/web/frontend/package.json`

- [ ] **Step 1: 结构性测试**

Create `tests/tenderParsingView.test.mjs`（沿用 tenderShellNav.test.mjs 的源码结构断言模式）：

```js
/**
 * 标书解析结果页的结构性校验（设计 D-20261028-2054）：
 * 1. TenderParsingView 渲染头部/方式卡/文件卡/区块/向导按钮/加载浮层，testid 前缀 chat-tender-parsing-。
 * 2. ChatPanel/index.tsx 在提交含 document 附件时打开解析页，消息流容器保挂载隐藏。
 * 3. chat.tenderParsing.* 文案 zh / en 键齐全。
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');

const view = source('src/components/ChatPanel/TenderParsingView.tsx');
const panel = source('src/components/ChatPanel/index.tsx');
const zh = JSON.parse(source('src/i18n/locales/zh.json'));
const en = JSON.parse(source('src/i18n/locales/en.json'));

const REQUIRED_TESTIDS = [
  'chat-tender-parsing-view',
  'chat-tender-parsing-back',
  'chat-tender-parsing-method-auto',
  'chat-tender-parsing-method-paste',
  'chat-tender-parsing-history',
  'chat-tender-parsing-file',
  'chat-tender-parsing-file-status',
  'chat-tender-parsing-file-remove',
  'chat-tender-parsing-sections',
  'chat-tender-parsing-prev',
  'chat-tender-parsing-next',
  'chat-tender-parsing-loading',
];

test('TenderParsingView renders all required regions with testids', () => {
  for (const id of REQUIRED_TESTIDS) {
    assert.ok(view.includes(`data-testid="${id}"`), `${id} missing`);
  }
});

test('ChatPanel opens parsing view on document submit and keeps message list mounted', () => {
  assert.match(panel, /item\.type === 'document'[\s\S]{0,200}setTenderParsingOpen\(true\)/);
  assert.match(panel, /tenderParsingOpen \? \{ display: 'none' \} : undefined/);
  assert.match(panel, /<TenderParsingView/);
});

const I18N_KEYS = [
  'title', 'subtitle', 'requiredMark', 'autoTitle', 'autoDesc', 'autoFormats',
  'pasteTitle', 'pasteDesc', 'pasteComingSoon', 'history', 'statusParsing',
  'statusDone', 'statusError', 'analyzing', 'emptyResult', 'prevStep',
  'nextStep', 'nextComingSoon', 'backToChat', 'removeFile',
];

test('chat.tenderParsing.* keys exist in both zh and en', () => {
  for (const key of I18N_KEYS) {
    assert.ok(zh.chat.tenderParsing[key], `zh missing ${key}`);
    assert.ok(en.chat.tenderParsing[key], `en missing ${key}`);
  }
});
```

package.json scripts 追加：

```json
"test:tender-parsing-view": "node --test tests/tenderParsingView.test.mjs"
```

- [ ] **Step 2: 运行全部相关测试**

Run: `npm run test:tender-parsing && npm run test:tender-parsing-view && npm run test:tender-shell && node --test tests/i18nLocales.test.mjs`
Expected: 全部 PASS

- [ ] **Step 3: 构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 4: 重启调试服务**

Run（仓库根目录）: `make restart-debug-fast`
Expected: 服务重启，Web UI http://localhost:5173

- [ ] **Step 5: Commit**

```bash
git add jiuwenswarm/channels/web/frontend/tests/tenderParsingView.test.mjs jiuwenswarm/channels/web/frontend/package.json
git commit -m "test(web): add tender parsing view structural assertions"
```

---

### Task 7: 人工验证（V-06 端到端）

- [ ] **Step 1: 打开 http://localhost:5173，欢迎页上传一份 docx/pdf 招标文件并发送**
  Expected: 主区切换为解析页；文件卡显示文件名/大小/解析中徽章；底部"AI分析中"浮层
- [ ] **Step 2: 等待解析完成**
  Expected: 徽章转"解析完成"；若 agent 产出含已知 markdown 标题则区块呈现；否则显示"等待解析产出…"空态（不报错）
- [ ] **Step 3: 点「返回对话」再触发一次含附件发送**
  Expected: 消息流原状（滚动/草稿保留）；再次进入解析页为新文件解析态
- [ ] **Step 4: 纯文字消息发送**
  Expected: 不进入解析页，维持聊天流（V-01）
- [ ] **Step 5: 记录真实解析产出格式**
  把 agent 最终消息/产物格式记录下来（是否含已知标题、是否有 tender-analysis.json 产物），作为契约对齐依据（设计 §9.1 风险跟踪）

---

## Self-Review 记录

- Spec 覆盖：D-20261028-2054 §6.1 实施项 I-01~I-05 → Task 1/3/4/5；i18n I-04 → Task 2；验证 V-01~V-07 → Task 1（V-04/V-05）、Task 6（V-01 结构断言 + 回归）、Task 7（V-02/V-03/V-06 人工）。
- Q1（区块集不硬编码）：契约与兜底均支持任意/已知区块数组，Task 1 实现体现。
- Q2（删除文件卡语义）：TenderParsingView `onReset` 仅关闭解析页返回对话，不动会话附件与历史消息（倾向项，实施即按此落地）。
- 类型一致性：`TenderAnalysisModel`/`TenderAnalysisSection`/`findTenderContractArtifact`/`buildTenderAnalysisModel` 在 Task 1 定义，Task 3/4 引用同名同签名。
