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
      const bulletKv = /^(?:\*\*(.+?)\*\*|([^：:]+?))[：:]\s*(.+)$/.exec(bullet[1].trim());
      if (bulletKv) {
        flushBullets();
        current.blocks.push({ type: 'kv', label: (bulletKv[1] ?? bulletKv[2]).trim(), value: bulletKv[3].trim() });
      } else {
        bullets.push(bullet[1].trim());
      }
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
