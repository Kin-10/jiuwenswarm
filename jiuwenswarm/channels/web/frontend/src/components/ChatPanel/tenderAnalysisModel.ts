/**
 * 标书解析结果页的纯数据模型层（设计 D-20261028-2054）：
 * - 契约通道：agent 产物 tender-analysis.json（version 1）。
 * - 兜底通道：最终助手消息按任意 markdown 二级标题切区块，正文原样保留
 *   （表格/有序列表/加粗等由 MarkdownRenderer 呈现）；无标题时整段单区块兜底。
 * 零 React 依赖，便于 node:test 直测。
 */

import type { Message } from '../../types';
import type { ArtifactItem } from '../ArtifactsPanel/artifactCollection';

export type TenderSectionStatus = 'pending' | 'done' | 'error';
export type TenderParsingStatus = 'parsing' | 'done' | 'error';
export type TenderBlockType = 'heading' | 'kv' | 'bullets' | 'paragraph' | 'markdown';

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

/** agent 产出的可下载文件（如完整解析 md），供解析页产物区展示。 */
export interface TenderOutputFile {
  id: string;
  name: string;
  size?: number;
  downloadUrl?: string;
  path?: string;
}

export interface TenderAnalysisModel {
  file: TenderFileInfo | null;
  status: TenderParsingStatus;
  /** 兜底通道中首个二级标题前的导语（如“已完成解析，结果如下”）。 */
  intro?: string;
  sections: TenderAnalysisSection[];
  outputs: TenderOutputFile[];
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

const VALID_BLOCK_TYPES = new Set<TenderBlockType>(['heading', 'kv', 'bullets', 'paragraph', 'markdown']);

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

/**
 * 兜底通道：按任意 markdown 二级标题（## xxx）切分区块，标题原文保留（含 emoji），
 * 区块正文原样保留为单个 markdown block（表格/有序列表/加粗由渲染层呈现）。
 * 无二级标题但有正文时，整体放入 key='fallback-result' 的单区块（标题留空，由视图层配 i18n 文案）。
 */
export const FALLBACK_RESULT_SECTION_KEY = 'fallback-result';

export function extractSectionsFromMarkdown(content: string): {
  intro?: string;
  sections: TenderAnalysisSection[];
} {
  const sections: TenderAnalysisSection[] = [];
  const introLines: string[] = [];
  let title: string | null = null;
  let body: string[] = [];

  const flush = () => {
    if (title !== null) {
      const markdown = body.join('\n').trim();
      if (markdown) {
        sections.push({
          key: `sec-${sections.length}`,
          title,
          required: false,
          status: 'done',
          blocks: [{ type: 'markdown', text: markdown }],
        });
      }
    }
    title = null;
    body = [];
  };

  for (const line of content.split('\n')) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      flush();
      title = h2[1].replace(/\*/g, '').trim();
      continue;
    }
    if (title === null) {
      introLines.push(line);
    } else {
      body.push(line);
    }
  }
  flush();

  const intro = introLines.join('\n').trim();
  if (!sections.length && content.trim()) {
    return {
      sections: [
        {
          key: FALLBACK_RESULT_SECTION_KEY,
          title: '',
          required: false,
          status: 'done',
          blocks: [{ type: 'markdown', text: content.trim() }],
        },
      ],
    };
  }
  return { intro: intro || undefined, sections };
}

export function buildTenderAnalysisModel(input: {
  messages: Message[];
  artifacts: ArtifactItem[];
  contractRaw: string | null;
}): TenderAnalysisModel {
  const fallbackFile = findTenderFileInfo(input.messages);
  const outputs: TenderOutputFile[] = input.artifacts.map((artifact) => ({
    id: artifact.id,
    name: artifact.name,
    size: artifact.size,
    downloadUrl: artifact.downloadUrl,
    path: artifact.path,
  }));
  if (input.contractRaw) {
    const contract = parseTenderAnalysisContract(input.contractRaw);
    if (contract) {
      return {
        file: contract.file ?? fallbackFile,
        status: contract.status,
        sections: contract.sections,
        outputs,
        source: 'contract',
      };
    }
  }
  const lastSettledAssistant = [...input.messages]
    .reverse()
    .find((m) => m.role === 'assistant' && !m.isStreaming && m.content.trim());
  const { intro, sections } = lastSettledAssistant
    ? extractSectionsFromMarkdown(lastSettledAssistant.content)
    : { sections: [] as TenderAnalysisSection[] };
  if (sections.length) {
    return { file: fallbackFile, status: 'done', intro, sections, outputs, source: 'fallback' };
  }
  return { file: fallbackFile, status: 'parsing', sections: [], outputs, source: 'none' };
}
