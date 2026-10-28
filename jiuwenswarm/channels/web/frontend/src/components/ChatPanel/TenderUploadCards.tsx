import clsx from 'clsx';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './TenderUploadCards.css';

export type TenderUploadCategory = 'tenderFile' | 'listFile' | 'relatedCase' | 'other';

export type TenderUploadCategoryFiles = Record<TenderUploadCategory, string | null>;

export const EMPTY_TENDER_CATEGORY_FILES: TenderUploadCategoryFiles = {
  tenderFile: null,
  listFile: null,
  relatedCase: null,
  other: null,
};

const CATEGORY_ORDER: TenderUploadCategory[] = ['tenderFile', 'listFile', 'relatedCase', 'other'];

const CATEGORY_LABEL_KEYS: Record<TenderUploadCategory, string> = {
  tenderFile: 'chat.tenderUpload.tenderFile',
  listFile: 'chat.tenderUpload.listFile',
  relatedCase: 'chat.tenderUpload.relatedCase',
  other: 'chat.tenderUpload.other',
};

interface TenderUploadCardsProps {
  categories: TenderUploadCategoryFiles;
  onUpload: (category: TenderUploadCategory) => void;
  onRemove: (category: TenderUploadCategory) => void;
  disabled?: boolean;
}

export function TenderUploadCards({ categories, onUpload, onRemove, disabled = false }: TenderUploadCardsProps) {
  const { t } = useTranslation();
  return (
    <div className="tender-upload-cards" data-testid="chat-tender-upload-cards">
      {CATEGORY_ORDER.map((category) => {
        const filename = categories[category];
        const required = category === 'tenderFile';
        const isTall = category === 'tenderFile' || category === 'listFile';
        return (
          <div
            key={category}
            className={clsx(
              'tender-upload-card',
              `tender-upload-card--${category}`,
              isTall ? 'tender-upload-card--tall' : 'tender-upload-card--short',
              filename ? 'tender-upload-card--filled' : 'tender-upload-card--empty',
              disabled && 'tender-upload-card--disabled',
            )}
            data-testid={`chat-tender-upload-${category}`}
          >
            {required && (
              <span className="tender-upload-card-badge" data-testid="chat-tender-upload-required">
                {t('chat.tenderUpload.required')}
              </span>
            )}
            {filename ? (
              <>
                <span className="tender-upload-card-filename" title={filename}>
                  {filename}
                </span>
                <button
                  type="button"
                  className="tender-upload-card-remove"
                  aria-label={t('chat.deleteAttachment')}
                  disabled={disabled}
                  data-testid={`chat-tender-upload-remove-${category}`}
                  onClick={() => onRemove(category)}
                >
                  <X size={12} strokeWidth={2} aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="tender-upload-card-add"
                disabled={disabled}
                onClick={() => onUpload(category)}
              >
                <Plus size={14} strokeWidth={2} aria-hidden="true" />
                <span>{t(CATEGORY_LABEL_KEYS[category])}</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TenderUploadCards;
