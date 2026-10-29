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
