import { useTranslation } from 'react-i18next';
import './PlaceholderLibraryPage.css';

interface PlaceholderLibraryPageProps {
  variant: 'productLibrary' | 'qualificationLibrary';
}

export function PlaceholderLibraryPage({ variant }: PlaceholderLibraryPageProps) {
  const { t } = useTranslation();
  const titleKey =
    variant === 'productLibrary' ? 'tender.productLibraryTitle' : 'tender.qualificationLibraryTitle';
  return (
    <div className="tender-placeholder" data-testid={`tender-placeholder-${variant}`}>
      <div className="tender-placeholder__card">
        <h2 className="tender-placeholder__title">{t(titleKey)}</h2>
        <p className="tender-placeholder__description">{t('tender.placeholderDescription')}</p>
      </div>
    </div>
  );
}
