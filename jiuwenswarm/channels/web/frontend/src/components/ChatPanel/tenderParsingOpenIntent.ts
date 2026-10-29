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
