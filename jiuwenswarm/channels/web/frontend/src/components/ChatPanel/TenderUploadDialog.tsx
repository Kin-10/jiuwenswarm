import { useId, useState, type DragEvent, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { Trash2, Upload, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '../ui';
import './TenderUploadDialog.css';

export interface TenderUploadDialogFile {
  id: string;
  filename: string;
  size: number;
  status: 'uploading' | 'ready' | 'error';
}

interface TenderUploadDialogProps {
  open: boolean;
  /** 招标文件类别已挂到附件链路的 draft（上限 1 个），由 InputArea 从 attachments 推导。 */
  files: TenderUploadDialogFile[];
  formatSize: (size: number) => string;
  onClose: () => void;
  onConfirm: () => void;
  /** 点击上传区：走与 handleTenderUpload('tenderFile') 相同的选择器回退（浏览器隐藏 input / 桌面 selectLocalFiles）。 */
  onUploadClick: () => void;
  /** 拖拽落地：DataTransfer 里的 File 对象，浏览器与桌面端同一路径。 */
  onDropFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
}

type TenderUploadDialogTab = 'tender' | 'notice';

export function TenderUploadDialog({
  open,
  files,
  formatSize,
  onClose,
  onConfirm,
  onUploadClick,
  onDropFiles,
  onRemoveFile,
}: TenderUploadDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<TenderUploadDialogTab>('tender');
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    if (dropped.length) onDropFiles(dropped);
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onUploadClick();
    }
  };

  const statusLabel = (status: TenderUploadDialogFile['status']) => {
    if (status === 'uploading') return t('chat.uploading');
    if (status === 'error') return t('chat.uploadFailed');
    return t('chat.tenderUpload.dialog.statusSuccess');
  };

  return (
    <Dialog
      open={open}
      titleId={titleId}
      className="tender-upload-dialog"
      onCancel={onClose}
      onBackdropClick={onClose}
    >
      <div className="tender-upload-dialog__panel" data-testid="tender-upload-dialog">
        <header className="tender-upload-dialog__header">
          <h2 id={titleId}>{t('chat.tenderUpload.dialog.title')}</h2>
          <button
            type="button"
            className="tender-upload-dialog__close"
            aria-label={t('common.close')}
            onClick={onClose}
            data-testid="tender-upload-close"
          >
            <X aria-hidden size={20} />
          </button>
        </header>
        <div className="tender-upload-dialog__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tender'}
            className={clsx(
              'tender-upload-dialog__tab',
              activeTab === 'tender' && 'tender-upload-dialog__tab--active',
            )}
            data-testid="tender-upload-tab-tender"
            onClick={() => setActiveTab('tender')}
          >
            {t('chat.tenderUpload.dialog.tabTender')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notice'}
            className={clsx(
              'tender-upload-dialog__tab',
              activeTab === 'notice' && 'tender-upload-dialog__tab--active',
            )}
            data-testid="tender-upload-tab-notice"
            onClick={() => setActiveTab('notice')}
          >
            {t('chat.tenderUpload.dialog.tabNotice')}
          </button>
        </div>
        <div
          className={clsx(
            'tender-upload-dialog__dropzone',
            dragActive && 'tender-upload-dialog__dropzone--active',
          )}
          role="button"
          tabIndex={0}
          data-testid="tender-upload-dropzone"
          onClick={onUploadClick}
          onKeyDown={handleDropzoneKeyDown}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <Upload size={28} strokeWidth={1.8} aria-hidden="true" />
          <p className="tender-upload-dialog__drop-hint">
            {t('chat.tenderUpload.dialog.dropHint')}
            <span className="tender-upload-dialog__drop-link">
              {t('chat.tenderUpload.dialog.clickUpload')}
            </span>
          </p>
          <p className="tender-upload-dialog__constraint">{t('chat.tenderUpload.dialog.constraint')}</p>
        </div>
        <div className="tender-upload-dialog__count" data-testid="tender-upload-count">
          {t('chat.tenderUpload.dialog.uploadedCount', { n: files.length })}
        </div>
        <div className="tender-upload-dialog__list" data-testid="tender-upload-list">
          <div className="tender-upload-dialog__row tender-upload-dialog__row--head">
            <span>{t('chat.tenderUpload.dialog.colName')}</span>
            <span>{t('chat.tenderUpload.dialog.colSize')}</span>
            <span>{t('chat.tenderUpload.dialog.colStatus')}</span>
            <span />
          </div>
          {files.map((file) => (
            <div className="tender-upload-dialog__row" key={file.id} data-testid="tender-upload-item">
              <span className="tender-upload-dialog__filename" title={file.filename}>
                {file.filename}
              </span>
              <span>{formatSize(file.size)}</span>
              <span
                className={clsx(
                  'tender-upload-dialog__status',
                  `tender-upload-dialog__status--${file.status}`,
                )}
              >
                {statusLabel(file.status)}
              </span>
              <button
                type="button"
                className="tender-upload-dialog__remove"
                aria-label={t('chat.deleteAttachment')}
                data-testid="tender-upload-remove"
                onClick={() => onRemoveFile(file.id)}
              >
                <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <footer className="tender-upload-dialog__actions">
          <Button size="sm" onClick={onClose} data-testid="tender-upload-cancel">
            {t('chat.tenderUpload.dialog.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} data-testid="tender-upload-done">
            {t('chat.tenderUpload.dialog.done')}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}

export default TenderUploadDialog;
