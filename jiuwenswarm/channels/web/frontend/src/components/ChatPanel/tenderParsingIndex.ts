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
