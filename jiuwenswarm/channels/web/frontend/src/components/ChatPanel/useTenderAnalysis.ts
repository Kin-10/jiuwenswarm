/**
 * 标书解析页数据源 hook（设计 D-20261028-2054 D-03）：
 * 契约产物 tender-analysis.json 优先，markdown 兜底；仅在解析页打开时拉取契约内容。
 */

import { useEffect, useMemo, useState } from 'react';
import { useChatStore } from '../../stores';
import { useSessionArtifacts } from '../ArtifactsPanel';
import { artifactDownloadUrl, artifactTextPreviewUrl } from '../ArtifactsPanel/filePreviewModel';
import {
  buildTenderAnalysisModel,
  findTenderContractArtifact,
  type TenderAnalysisModel,
} from './tenderAnalysisModel';

export function useTenderAnalysis(active: boolean): TenderAnalysisModel {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const messages = useChatStore((s) => s.runtimes[activeSessionId ?? '']?.messages ?? []);
  const artifacts = useSessionArtifacts();
  const contractArtifact = useMemo(() => findTenderContractArtifact(artifacts), [artifacts]);
  const [contractRaw, setContractRaw] = useState<string | null>(null);
  // artifact 对象随 memo 重建，用 id+timestamp 作为内容版本键避免重复拉取。
  const contractKey = contractArtifact ? `${contractArtifact.id}:${contractArtifact.timestamp ?? 0}` : '';

  useEffect(() => {
    if (!active || !contractArtifact) {
      setContractRaw(null);
      return;
    }
    const url =
      artifactTextPreviewUrl(contractArtifact, window.location.origin) ?? artifactDownloadUrl(contractArtifact);
    if (!url) {
      setContractRaw(null);
      return;
    }
    let cancelled = false;
    void fetch(url, { cache: 'no-store' })
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error(`status ${response.status}`))))
      .then((text) => {
        if (!cancelled) setContractRaw(text);
      })
      .catch(() => {
        if (!cancelled) setContractRaw(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contractKey 已涵盖 contractArtifact 的内容版本
  }, [active, contractKey]);

  return useMemo(() => buildTenderAnalysisModel({ messages, contractRaw }), [messages, contractRaw]);
}
