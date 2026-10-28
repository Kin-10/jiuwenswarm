import { useTranslation } from 'react-i18next';
import './PlaceholderLibraryPage.css';

interface PlaceholderLibraryPageProps {
  /** 占位页标识：命中 TITLE_KEYS 时用对应标题，未命中回退通用占位文案。 */
  variant: string;
}

const TITLE_KEYS: Record<string, string> = {
  productLibrary: 'tender.productLibraryTitle',
  qualificationLibrary: 'tender.qualificationLibraryTitle',
  bidWriting: 'nav.bidWriting',
  tenderReading: 'nav.tenderReading',
  bidDuplicateCheck: 'nav.bidDuplicateCheck',
  bidCleaning: 'nav.bidCleaning',
  creationCenter: 'nav.creationCenter',
  resourceLibrary: 'nav.resourceLibrary',
  myBids: 'nav.myBids',
  businessBidAssistant: 'nav.businessBidAssistant',
  bidOpportunities: 'nav.bidOpportunities',
};

export function PlaceholderLibraryPage({ variant }: PlaceholderLibraryPageProps) {
  const { t } = useTranslation();
  const titleKey = TITLE_KEYS[variant];
  return (
    <div className="tender-placeholder" data-testid={`tender-placeholder-${variant}`}>
      <div className="tender-placeholder__card">
        <h2 className="tender-placeholder__title">{titleKey ? t(titleKey) : t('tender.placeholderDescription')}</h2>
        <p className="tender-placeholder__description">{t('tender.placeholderDescription')}</p>
      </div>
    </div>
  );
}
