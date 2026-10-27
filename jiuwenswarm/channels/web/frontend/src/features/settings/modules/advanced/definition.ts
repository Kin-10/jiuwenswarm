import { settingsNavigationIcons } from '../../../../assets/settings';
import type { SettingsModuleDefinition } from '../../registry/types';
import { AdvancedFeaturesModule } from './AdvancedFeaturesModule';

/**
 * Advanced features module — entry links to features hidden from the main nav.
 * Single section + single custom item, mirroring the personalContext module.
 */
export const advancedModule: SettingsModuleDefinition = {
  id: 'advanced',
  titleKey: 'settingsPanel.categories.advanced',
  icon: settingsNavigationIcons.general,
  sections: [
    {
      id: 'advanced',
      items: [{ id: 'advanced-features', component: 'custom', render: AdvancedFeaturesModule }],
    },
  ],
};
