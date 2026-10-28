/**
 * 标书解析结果页（设计 D-20261028-2054）：
 * 头部（标题+说明+返回对话）→ 方式卡×2 + 历史记录占位 → 文件卡 → 结果区块双栏 → 底部向导按钮。
 * 数据只读，来自 useTenderAnalysis；删除文件卡仅重置页面态（onReset 由父组件处理）。
 */

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  History,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { FileIcon } from '../FileIcon';
import type { TenderAnalysisModel, TenderAnalysisSection } from './tenderAnalysisModel';
import './TenderParsingView.css';

interface TenderParsingViewProps {
  model: TenderAnalysisModel;
  onBack: () => void;
  onReset: () => void;
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function SectionCard({ section }: { section: TenderAnalysisSection }) {
  const { t } = useTranslation();
  return (
    <section
      className="tender-parsing-section"
      data-testid={`chat-tender-parsing-section-${section.key}`}
      data-status={section.status}
    >
      <header className="tender-parsing-section__header">
        <h3 className="tender-parsing-section__title">
          {section.title}
          {section.required && <span className="tender-parsing-required">{t('chat.tenderParsing.requiredMark')}</span>}
        </h3>
        {section.status === 'done' && (
          <CheckCircle2 size={20} className="tender-parsing-section__check" aria-hidden="true" />
        )}
      </header>
      <div className="tender-parsing-section__body">
        {section.status === 'pending' && (
          <div className="tender-parsing-section__skeleton" data-testid={`chat-tender-parsing-skeleton-${section.key}`}>
            <span />
            <span />
            <span />
          </div>
        )}
        {section.blocks.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <h4 key={index} className="tender-parsing-block-heading">
                {block.text}
              </h4>
            );
          }
          if (block.type === 'kv') {
            return (
              <p key={index} className="tender-parsing-block-kv">
                <strong>{block.label}：</strong>
                {block.value}
              </p>
            );
          }
          if (block.type === 'bullets') {
            return (
              <ul key={index} className="tender-parsing-block-bullets">
                {(block.items ?? []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="tender-parsing-block-paragraph">
              {block.text}
            </p>
          );
        })}
      </div>
    </section>
  );
}

export function TenderParsingView({ model, onBack, onReset }: TenderParsingViewProps) {
  const { t } = useTranslation();
  const parsing = model.status === 'parsing';
  const statusKey =
    model.status === 'done' ? 'statusDone' : model.status === 'error' ? 'statusError' : 'statusParsing';

  return (
    <div className="tender-parsing-view" data-testid="chat-tender-parsing-view">
      <header className="tender-parsing-header">
        <div className="tender-parsing-header__titles">
          <h2 className="tender-parsing-title">
            {t('chat.tenderParsing.title')}
            <span className="tender-parsing-required">{t('chat.tenderParsing.requiredMark')}</span>
          </h2>
          <p className="tender-parsing-subtitle">{t('chat.tenderParsing.subtitle')}</p>
        </div>
        <button
          type="button"
          className="tender-parsing-back"
          onClick={onBack}
          data-testid="chat-tender-parsing-back"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t('chat.tenderParsing.backToChat')}
        </button>
      </header>

      <div className="tender-parsing-methods">
        <div
          className="tender-parsing-method tender-parsing-method--active"
          data-testid="chat-tender-parsing-method-auto"
        >
          <UploadCloud size={20} aria-hidden="true" className="tender-parsing-method__icon" />
          <div className="tender-parsing-method__texts">
            <p className="tender-parsing-method__title">{t('chat.tenderParsing.autoTitle')}</p>
            <p className="tender-parsing-method__desc">{t('chat.tenderParsing.autoDesc')}</p>
            <p className="tender-parsing-method__formats">{t('chat.tenderParsing.autoFormats')}</p>
          </div>
          <span className="tender-parsing-method__history" data-testid="chat-tender-parsing-history">
            <History size={14} aria-hidden="true" />
            {t('chat.tenderParsing.history')}
          </span>
        </div>
        <div
          className="tender-parsing-method tender-parsing-method--disabled"
          title={t('chat.tenderParsing.pasteComingSoon')}
          data-testid="chat-tender-parsing-method-paste"
        >
          <ClipboardPaste size={20} aria-hidden="true" className="tender-parsing-method__icon" />
          <div className="tender-parsing-method__texts">
            <p className="tender-parsing-method__title">{t('chat.tenderParsing.pasteTitle')}</p>
            <p className="tender-parsing-method__desc">{t('chat.tenderParsing.pasteDesc')}</p>
          </div>
        </div>
      </div>

      {model.file && (
        <div className="tender-parsing-file" data-testid="chat-tender-parsing-file">
          <FileIcon fileName={model.file.name} size={28} />
          <div className="tender-parsing-file__meta">
            <p className="tender-parsing-file__name" title={model.file.name}>
              {model.file.name}
            </p>
            {formatFileSize(model.file.size) && (
              <p className="tender-parsing-file__size">{formatFileSize(model.file.size)}</p>
            )}
          </div>
          <span
            className={clsx('tender-parsing-file__status', `tender-parsing-file__status--${model.status}`)}
            data-testid="chat-tender-parsing-file-status"
          >
            {t(`chat.tenderParsing.${statusKey}`)}
          </span>
          <button
            type="button"
            className="tender-parsing-file__remove"
            aria-label={t('chat.tenderParsing.removeFile')}
            onClick={onReset}
            data-testid="chat-tender-parsing-file-remove"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {model.sections.length > 0 ? (
        <div className="tender-parsing-sections" data-testid="chat-tender-parsing-sections">
          {model.sections.map((section) => (
            <SectionCard key={section.key} section={section} />
          ))}
        </div>
      ) : (
        <p className="tender-parsing-empty" data-testid="chat-tender-parsing-empty">
          {t('chat.tenderParsing.emptyResult')}
        </p>
      )}

      <footer className="tender-parsing-footer">
        <button
          type="button"
          className="tender-parsing-step tender-parsing-step--prev"
          onClick={onBack}
          data-testid="chat-tender-parsing-prev"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t('chat.tenderParsing.prevStep')}
        </button>
        <button
          type="button"
          className="tender-parsing-step tender-parsing-step--next"
          disabled
          title={t('chat.tenderParsing.nextComingSoon')}
          data-testid="chat-tender-parsing-next"
        >
          {t('chat.tenderParsing.nextStep')}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </footer>

      {parsing && (
        <div className="tender-parsing-loading" data-testid="chat-tender-parsing-loading">
          <Loader2 size={14} className="tender-parsing-loading__spinner" aria-hidden="true" />
          {t('chat.tenderParsing.analyzing')}
        </div>
      )}
    </div>
  );
}

export default TenderParsingView;
