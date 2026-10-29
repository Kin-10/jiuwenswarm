/**
 * 标书系统前端壳的结构性校验（232px 宽单列菜单栏形态）。
 *
 * 1. 侧边栏 mainNavItems 是标书域的 9 个入口，且顺序固定：
 *    标书写作 / 招标解读 / 标书查重 / 暗标清标 / 创作中心 / 资料库 / 我的标书 / 商务标助手 / 标讯商机。
 *    其中招标解读为真实功能页，其余 8 个为占位页入口。
 * 2. frontendPlatform.ts 的 TENDER_PLACEHOLDER_NAV_KEYS 是 8 个占位页入口（不含招标解读），
 *    App.tsx 用同一份 key 集合渲染 PlaceholderLibraryPage 占位页，招标解读渲染 TenderReadingPage。
 * 3. 通用 Agent 平台入口（chat/home/skills/settings/agents/connectorMarket 等）
 *    不再出现在 mainNavItems 里，避免回归把它们加回来。
 * 4. 8 个占位入口与招标解读的 nav.* 文案、底部辅助项与企业版卡片的 tender.* 文案 zh / en 均有。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');

const TENDER_NAV_KEYS = [
  'bidWriting',
  'bidDuplicateCheck',
  'bidCleaning',
  'creationCenter',
  'resourceLibrary',
  'myBids',
  'businessBidAssistant',
  'bidOpportunities',
];
const HIDDEN_NAV_KEYS = [
  'chat',
  'home',
  'skills',
  'settings',
  'agents',
  'connectorMarket',
  'experiments',
  'personalContext',
  'personalContextSettings',
  'updatepanel',
  'productLibrary',
  'qualificationLibrary',
];

const sidebar = source('src/components/SessionSidebar/index.tsx');
const mainNavItems = sidebar.slice(sidebar.indexOf('const mainNavItems'), sidebar.indexOf('export function SessionSidebar'));

test('mainNavItems keeps the nine tender entries in order (tenderReading included)', () => {
  const keys = [...mainNavItems.matchAll(/key: '([A-Za-z]+)'/g)].map((match) => match[1]);
  assert.deepEqual(keys, ['bidWriting', 'tenderReading', ...TENDER_NAV_KEYS.slice(1)]);
});

test('mainNavItems maps each tender entry to its nav.* label', () => {
  for (const key of TENDER_NAV_KEYS) {
    assert.match(mainNavItems, new RegExp(`key: '${key}', labelKey: 'nav\\.${key}'`), `${key} must use nav.${key}`);
  }
});

test('hidden legacy entries stay out of mainNavItems', () => {
  for (const key of HIDDEN_NAV_KEYS) {
    assert.doesNotMatch(mainNavItems, new RegExp(`key: '${key}'`), `${key} must stay hidden`);
  }
});

test('frontendPlatform placeholder keys stay in sync with the sidebar', () => {
  const platform = source('src/utils/frontendPlatform.ts');
  const block = platform.slice(
    platform.indexOf('TENDER_PLACEHOLDER_NAV_KEYS'),
    platform.indexOf('];', platform.indexOf('TENDER_PLACEHOLDER_NAV_KEYS')),
  );
  const keys = [...block.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
  assert.deepEqual(keys, TENDER_NAV_KEYS);
  for (const key of TENDER_NAV_KEYS) {
    assert.match(platform, new RegExp(`\\| '${key}'`), `SidebarNavKey must include ${key}`);
  }
});

test('App routes every tender placeholder nav key to PlaceholderLibraryPage', () => {
  const app = source('src/App.tsx');
  assert.match(app, /TENDER_PLACEHOLDER_NAV_KEY_SET\.has\(activeNav\)/);
  assert.match(app, /<PlaceholderLibraryPage variant=\{activeNav\} \/>/);
});

test('tender nav, aux and enterprise copy exist in both zh and en locales', () => {
  const zh = JSON.parse(source('src/i18n/locales/zh.json'));
  const en = JSON.parse(source('src/i18n/locales/en.json'));
  for (const locale of [zh, en]) {
    for (const key of [...TENDER_NAV_KEYS, 'tenderReading', 'productDocs', 'collapse']) {
      assert.equal(typeof locale.nav[key], 'string', `nav.${key} must exist`);
      assert.ok(locale.nav[key].length > 0, `nav.${key} must be non-empty`);
    }
    for (const key of ['brandName', 'enterpriseTitle', 'enterpriseDesc', 'productLibraryTitle', 'qualificationLibraryTitle', 'placeholderDescription']) {
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

test('sidebar renders brand, aux items and the enterprise card', () => {
  assert.match(sidebar, /t\('tender\.brandName'\)/);
  assert.match(sidebar, /t\('nav\.productDocs'\)/);
  assert.match(sidebar, /t\('nav\.collapse'\)/);
  assert.match(sidebar, /t\('tender\.enterpriseTitle'\)/);
  assert.match(sidebar, /t\('tender\.enterpriseDesc'\)/);
  assert.match(sidebar, /data-testid="session-sidebar-rail"/);
  assert.match(sidebar, /data-testid="session-sidebar-nav-item"/);
  assert.match(sidebar, /data-testid="session-sidebar-enterprise-card"/);
});

test('placeholder page accepts any variant string and falls back to the generic copy', () => {
  const page = source('src/features/tender/PlaceholderLibraryPage.tsx');
  assert.match(page, /variant: string/);
  for (const key of TENDER_NAV_KEYS) {
    assert.match(page, new RegExp(`${key}: 'nav\\.${key}'`), `TITLE_KEYS must map ${key}`);
  }
  assert.match(page, /'tender\.productLibraryTitle'/);
  assert.match(page, /'tender\.qualificationLibraryTitle'/);
  assert.match(page, /t\('tender\.placeholderDescription'\)/);
  assert.match(page, /data-testid=\{`tender-placeholder-\$\{variant\}`\}/);
});

test('tenderReading leaves the placeholder set and is wired to TenderReadingPage', () => {
  const platform = source('src/utils/frontendPlatform.ts');
  const block = platform.slice(
    platform.indexOf('TENDER_PLACEHOLDER_NAV_KEYS'),
    platform.indexOf('];', platform.indexOf('TENDER_PLACEHOLDER_NAV_KEYS')),
  );
  assert.doesNotMatch(block, /'tenderReading'/);
  const app = source('src/App.tsx');
  assert.match(app, /activeNav === 'tenderReading'/);
  assert.match(app, /<TenderReadingPage/);
});
