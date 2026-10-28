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
