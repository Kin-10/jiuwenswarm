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
  'nextStep', 'nextComingSoon', 'backToChat', 'removeFile', 'resultTitle', 'outputsTitle',
];

test('chat.tenderParsing.* keys exist in both zh and en', () => {
  for (const key of I18N_KEYS) {
    assert.ok(zh.chat.tenderParsing[key], `zh missing ${key}`);
    assert.ok(en.chat.tenderParsing[key], `en missing ${key}`);
  }
});
