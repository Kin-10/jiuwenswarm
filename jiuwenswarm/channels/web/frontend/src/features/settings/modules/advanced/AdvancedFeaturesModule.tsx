import { useTranslation } from 'react-i18next';
import './AdvancedFeaturesModule.css';

const ADVANCED_ENTRIES = [
  { key: 'skills', labelKey: 'nav.skills' },
  { key: 'agents', labelKey: 'nav.agent' },
  { key: 'cron', labelKey: 'nav.cron' },
  { key: 'connectorMarket', labelKey: 'nav.connectorMarket' },
  { key: 'experiments', labelKey: 'nav.experiments' },
  { key: 'personalContext', labelKey: 'nav.personalContext' },
  { key: 'updatepanel', labelKey: 'nav.update' },
] as const;

export const ADVANCED_NAV_EVENT = 'jiuwen:advanced-nav';

export function AdvancedFeaturesModule() {
  const { t } = useTranslation();
  return (
    <div className="advanced-features" data-testid="settings-advanced-features">
      <p className="advanced-features__desc">{t('settingsPanel.advanced.description')}</p>
      <div className="advanced-features__grid">
        {ADVANCED_ENTRIES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="advanced-features__item"
            data-testid={`settings-advanced-entry-${entry.key}`}
            onClick={() => window.dispatchEvent(new CustomEvent(ADVANCED_NAV_EVENT, { detail: entry.key }))}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
