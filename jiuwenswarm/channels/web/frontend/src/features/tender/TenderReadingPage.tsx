/**
 * 招标解读功能页（设计 D-20261028-2254）：
 * 新建解读卡（跳新会话上传）+ 历史记录列表（localStorage 索引，点击重开对应会话解析页）。
 * 导航行为经 props 注入，页面本体不依赖路由实现。
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSearch, UploadCloud } from 'lucide-react';
import { FileIcon } from '../../components/FileIcon';
import { formatRelativeTime } from '../../utils/formatters';
import {
  readTenderParsingIndex,
  type TenderParsingIndexEntry,
} from '../../components/ChatPanel/tenderParsingIndex';
import './TenderReadingPage.css';

interface TenderReadingPageProps {
  onNew: () => void;
  onOpenSession: (sessionId: string) => void;
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function TenderReadingPage({ onNew, onOpenSession }: TenderReadingPageProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TenderParsingIndexEntry[]>([]);

  useEffect(() => {
    setEntries(readTenderParsingIndex());
  }, []);

  return (
    <div className="tender-reading-page" data-testid="tender-reading-page">
      <header className="tender-reading-header">
        <h2 className="tender-reading-title">{t('nav.tenderReading')}</h2>
      </header>

      <button
        type="button"
        className="tender-reading-new"
        onClick={onNew}
        data-testid="tender-reading-new"
      >
        <UploadCloud size={22} aria-hidden="true" className="tender-reading-new__icon" />
        <span className="tender-reading-new__texts">
          <span className="tender-reading-new__title">{t('tender.readingPage.newTitle')}</span>
          <span className="tender-reading-new__desc">{t('tender.readingPage.newDesc')}</span>
        </span>
        <span className="tender-reading-new__action">{t('tender.readingPage.newAction')}</span>
      </button>

      <section className="tender-reading-history">
        <h3 className="tender-reading-history__title">{t('tender.readingPage.historyTitle')}</h3>
        {entries.length === 0 ? (
          <div className="tender-reading-empty" data-testid="tender-reading-empty">
            <FileSearch size={32} aria-hidden="true" className="tender-reading-empty__icon" />
            <p>{t('tender.readingPage.historyEmpty')}</p>
          </div>
        ) : (
          <ul className="tender-reading-list" data-testid="tender-reading-list">
            {entries.map((entry) => (
              <li key={entry.sessionId}>
                <button
                  type="button"
                  className="tender-reading-item"
                  onClick={() => onOpenSession(entry.sessionId)}
                  data-testid={`tender-reading-item-${entry.sessionId}`}
                >
                  <FileIcon fileName={entry.fileName} size={24} />
                  <span className="tender-reading-item__name" title={entry.fileName}>
                    {entry.fileName}
                  </span>
                  <span className="tender-reading-item__meta">
                    {formatFileSize(entry.size)}
                    {entry.size ? ' · ' : ''}
                    {formatRelativeTime(new Date(entry.updatedAt).toISOString())}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default TenderReadingPage;
