export type FrontendPlatform = 'web' | 'harmony';

export type SidebarNavKey =
  | 'chat'
  | 'skills'
  | 'agents'
  | 'design'
  | 'connectorMarket'
  | 'sessions'
  | 'cron'
  | 'personalContext'
  | 'personalContextSettings'
  | 'settings'
  | 'updatepanel'
  | 'experiments'
  | 'home'
  | 'productLibrary'
  | 'qualificationLibrary'
  | 'tenderWrite'
  | 'tenderRead'
  | 'dupCheck'
  | 'blindClean'
  | 'creativeCenter'
  | 'library'
  | 'myBids'
  | 'businessBid'
  | 'bidNews'
  | 'bidWriting'
  | 'tenderReading'
  | 'bidDuplicateCheck'
  | 'bidCleaning'
  | 'creationCenter'
  | 'resourceLibrary'
  | 'businessBidAssistant'
  | 'bidOpportunities';

/**
 * 标书域主导航（宽单列侧边栏）的 8 个占位页入口；招标解读已是真实功能页，不在此集合。
 * SessionSidebar 主导航与 App 主区占位页分支共用同一份顺序。
 */
export const TENDER_PLACEHOLDER_NAV_KEYS: readonly SidebarNavKey[] = [
  'bidWriting',
  'bidDuplicateCheck',
  'bidCleaning',
  'creationCenter',
  'resourceLibrary',
  'myBids',
  'businessBidAssistant',
  'bidOpportunities',
];

export const DEFAULT_FRONTEND_PLATFORM: FrontendPlatform = 'web';

const PLATFORM_ALIASES: Record<string, FrontendPlatform | null> = {
  web: 'web',
  desktop: 'web',
  harmony: 'harmony',
  openharmony: 'harmony',
  default: null,
  production: null,
  development: null,
  test: null,
};

const HIDDEN_NAV_ITEMS_BY_PLATFORM: Record<FrontendPlatform, readonly SidebarNavKey[]> = {
  web: [
    'sessions',
    'agents',
    'connectorMarket',
    'experiments',
    'personalContext',
    'personalContextSettings',
    'updatepanel',
  ],
  harmony: [
    'sessions',
    'updatepanel',
    'connectorMarket',
    'experiments',
    'agents',
    'personalContext',
    'personalContextSettings',
  ],
};

export function normalizeFrontendPlatform(value: unknown): FrontendPlatform | null {
  const key = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  return PLATFORM_ALIASES[key] ?? null;
}

export function resolveFrontendPlatform(...sources: unknown[]): FrontendPlatform {
  for (const source of sources) {
    const platform = normalizeFrontendPlatform(source);
    if (platform) return platform;
  }
  return DEFAULT_FRONTEND_PLATFORM;
}

export function getHiddenNavItemsForPlatform(platform: FrontendPlatform): SidebarNavKey[] {
  return [...HIDDEN_NAV_ITEMS_BY_PLATFORM[platform]];
}

declare global {
  interface Window {
    __JIWEN_PLATFORM__?: string;
  }
}
