/**
 * tenderAnalysisModel 纯函数单测：
 * 1. findTenderFileInfo 取最后一条 user 消息中的 document 附件。
 * 2. parseTenderAnalysisContract 校验 version/sections，非法 JSON 与缺字段返回 null。
 * 3. extractSectionsFromMarkdown 按任意 ## 二级标题通用切分（含 emoji 标题），
 *    正文原样保留为 markdown block（表格/有序列表不拆散），首个标题前的导语进 intro；
 *    无二级标题时整段落入 fallback-result 单区块。
 * 4. buildTenderAnalysisModel：契约优先；无契约走 markdown 兜底；都没有则 parsing 空态；
 *    outputs 透传 artifacts。
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

test('extractSectionsFromMarkdown splits on any h2 heading, keeps emoji titles and table markdown', () => {
  const md = [
    '已完成文件解析。以下是完整解析结果：',
    '',
    '## 📄 文件基本信息',
    '',
    '| 项目 | 内容 |',
    '|---|---|',
    '| 项目名称 | 血站试剂采购 |',
    '',
    '## ✅ 资格要求',
    '',
    '1. 满足《政府采购法》第二十二条',
    '2. 不接受联合体',
    '',
    '## ⚖️ 评审与定标规则',
    '',
    '- 最低评标价法',
  ].join('\n');
  const { intro, sections } = model.extractSectionsFromMarkdown(md);
  assert.equal(intro, '已完成文件解析。以下是完整解析结果：');
  assert.equal(sections.length, 3);
  assert.equal(sections[0].title, '📄 文件基本信息');
  assert.equal(sections[0].status, 'done');
  assert.equal(sections[0].blocks.length, 1);
  assert.equal(sections[0].blocks[0].type, 'markdown');
  assert.ok(sections[0].blocks[0].text.includes('| 项目名称 | 血站试剂采购 |'));
  assert.equal(sections[1].title, '✅ 资格要求');
  assert.ok(sections[1].blocks[0].text.includes('1. 满足《政府采购法》第二十二条'));
  assert.equal(sections[2].title, '⚖️ 评审与定标规则');
});

test('extractSectionsFromMarkdown falls back to a single section when no h2 exists', () => {
  const { intro, sections } = model.extractSectionsFromMarkdown('就是一段没有标题的解析文本。');
  assert.equal(intro, undefined);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].key, model.FALLBACK_RESULT_SECTION_KEY);
  assert.equal(sections[0].title, '');
  assert.equal(sections[0].blocks[0].text, '就是一段没有标题的解析文本。');
});

test('extractSectionsFromMarkdown returns empty for blank content', () => {
  const { intro, sections } = model.extractSectionsFromMarkdown('   \n  ');
  assert.equal(intro, undefined);
  assert.equal(sections.length, 0);
});

test('buildTenderAnalysisModel prefers contract over markdown fallback', () => {
  const contractRaw = JSON.stringify({
    version: 1,
    status: 'parsing',
    sections: [{ key: 'projectOverview', title: '项目概述', required: true, status: 'pending', blocks: [] }],
  });
  const built = model.buildTenderAnalysisModel({
    messages: [docMessage, { id: 'a1', role: 'assistant', content: '## 项目概述\n- **项目名称**：x', timestamp: '2026-10-28T10:01:00Z', isStreaming: false }],
    artifacts: [{ id: 'file:1', name: '承德招标文件_解析.md', size: 87083, downloadUrl: '/file-api/download?token=x' }],
    contractRaw,
  });
  assert.equal(built.source, 'contract');
  assert.equal(built.status, 'parsing');
  assert.equal(built.sections[0].status, 'pending');
  assert.deepEqual(built.file, { name: '承德招标文件.docx', size: 169813 });
  assert.equal(built.outputs.length, 1);
  assert.equal(built.outputs[0].name, '承德招标文件_解析.md');
});

test('buildTenderAnalysisModel falls back to settled assistant markdown with intro', () => {
  const built = model.buildTenderAnalysisModel({
    messages: [
      docMessage,
      { id: 'a1', role: 'assistant', content: '解析完成：\n## 项目概述\n- **项目名称**：血站试剂采购', timestamp: '2026-10-28T10:01:00Z', isStreaming: false },
    ],
    artifacts: [],
    contractRaw: null,
  });
  assert.equal(built.source, 'fallback');
  assert.equal(built.status, 'done');
  assert.equal(built.sections.length, 1);
  assert.equal(built.intro, '解析完成：');
  assert.deepEqual(built.outputs, []);
});

test('buildTenderAnalysisModel skips streaming messages and stays parsing when empty', () => {
  const built = model.buildTenderAnalysisModel({
    messages: [docMessage, { id: 'a1', role: 'assistant', content: '## 项目概述\n- 流式中', timestamp: '2026-10-28T10:01:00Z', isStreaming: true }],
    artifacts: [],
    contractRaw: null,
  });
  assert.equal(built.source, 'none');
  assert.equal(built.status, 'parsing');
  assert.equal(built.sections.length, 0);
});
