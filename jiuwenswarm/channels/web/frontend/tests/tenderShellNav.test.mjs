/**
 * 标书系统前端壳的结构性校验。
 *
 * 1. 侧边栏 mainNavItems 只保留标书域的六个入口，且顺序固定：
 *    首页 / 标书工作区 / 企业产品库 / 企业资信库 / 技能 / 设置。
 * 2. 被隐藏的入口（agents、connectorMarket、experiments、personalContext、updatepanel 等）
 *    不再出现在 mainNavItems 里，避免回归把它们加回来。
 * 3. 产品库 / 资信库占位页按 variant 映射到 tender.* 文案键，zh / en 均有对应文案。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');

const TENDER_NAV_KEYS = ['home', 'chat', 'productLibrary', 'qualificationLibrary', 'skills', 'settings'];
const HIDDEN_NAV_KEYS = ['agents', 'connectorMarket', 'experiments', 'personalContext', 'personalContextSettings', 'updatepanel'];

const sidebar = source('src/components/SessionSidebar/index.tsx');
const mainNavItems = sidebar.slice(sidebar.indexOf('const mainNavItems'), sidebar.indexOf('export function SessionSidebar'));

test('mainNavItems keeps exactly the six tender entries in order', () => {
  const keys = [...mainNavItems.matchAll(/key: '([A-Za-z]+)'/g)].map((match) => match[1]);
  assert.deepEqual(keys, TENDER_NAV_KEYS);
});

test('mainNavItems maps tender entries to their i18n labels', () => {
  assert.match(mainNavItems, /key: 'home', labelKey: 'nav\.home'/);
  assert.match(mainNavItems, /key: 'chat', labelKey: 'nav\.work'/);
  assert.match(mainNavItems, /key: 'productLibrary', labelKey: 'nav\.productLibrary'/);
  assert.match(mainNavItems, /key: 'qualificationLibrary', labelKey: 'nav\.qualificationLibrary'/);
});

test('hidden legacy entries stay out of mainNavItems', () => {
  for (const key of HIDDEN_NAV_KEYS) {
    assert.doesNotMatch(mainNavItems, new RegExp(`key: '${key}'`), `${key} must stay hidden`);
  }
});

test('tender nav and welcome copy exist in both zh and en locales', () => {
  const zh = JSON.parse(source('src/i18n/locales/zh.json'));
  const en = JSON.parse(source('src/i18n/locales/en.json'));
  for (const locale of [zh, en]) {
    for (const key of ['home', 'work', 'productLibrary', 'qualificationLibrary']) {
      assert.equal(typeof locale.nav[key], 'string', `nav.${key} must exist`);
      assert.ok(locale.nav[key].length > 0, `nav.${key} must be non-empty`);
    }
    for (const key of ['productLibraryTitle', 'qualificationLibraryTitle', 'placeholderDescription']) {
      assert.equal(typeof locale.tender[key], 'string', `tender.${key} must exist`);
      assert.ok(locale.tender[key].length > 0, `tender.${key} must be non-empty`);
    }
    assert.ok(locale.chat.welcomeHeading.length > 0, 'chat.welcomeHeading must be non-empty');
  }
  assert.equal(zh.nav.work, '标书工作区');
  assert.equal(en.nav.work, 'Bid Workspace');
  assert.equal(zh.chat.welcomeHeading, '你好，这里是AI标书系统');
  assert.equal(en.chat.welcomeHeading, 'Hi, this is the AI Bid System.');
});

test('placeholder library page binds each variant to its tender title', () => {
  const page = source('src/features/tender/PlaceholderLibraryPage.tsx');
  assert.match(page, /variant: 'productLibrary' \| 'qualificationLibrary'/);
  assert.match(page, /'tender\.productLibraryTitle'/);
  assert.match(page, /'tender\.qualificationLibraryTitle'/);
  assert.match(page, /t\('tender\.placeholderDescription'\)/);
  assert.match(page, /data-testid=\{`tender-placeholder-\$\{variant\}`\}/);
});
