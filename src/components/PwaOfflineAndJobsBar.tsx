import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Database, CloudUpload, CheckCircle2 } from 'lucide-react';
import { fetchLazyPyqPack } from '../services/workspaceService';

export interface PwaOfflineAndJobsBarProps {
  pendingSyncCount?: number;
  onOpenAdminConsole?: () => void;
  onOpenAdminQuestionBank?: () => void;
}

export const PwaOfflineAndJobsBar: React.FC<PwaOfflineAndJobsBarProps> = ({
  pendingSyncCount = 0,
  onOpenAdminConsole,
  onOpenAdminQuestionBank,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [swReady, setSwReady] = useState<boolean>(false);
  const [cachedPacksCount, setCachedPacksCount] = useState<number>(0);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    }

    // Pre-warm lazy PYQ packs into offline cache
    Promise.all([
      fetchLazyPyqPack('jee-main-shifts').catch(() => null),
      fetchLazyPyqPack('jee-advanced-papers').catch(() => null),
    ]).then((results) => {
      setCachedPacksCount(results.filter(Boolean).length);
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 h-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span>{isOnline ? 'Cloud Sync Connected' : 'Offline Mode Active'}</span>
        </span>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-500">
          <Database className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            Offline PYQ Packs Cached: {cachedPacksCount}/2 {swReady ? '• SW Ready' : ''}
          </span>
        </span>

        <span className="hidden md:inline-flex items-center gap-1.5 text-slate-500">
          {pendingSyncCount > 0 ? (
            <>
              <CloudUpload className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>{pendingSyncCount} Background Sync Job(s)</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>58 NTA Chapters &amp; Telemetry Synced</span>
            </>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {onOpenAdminQuestionBank && (
          <button
            type="button"
            onClick={onOpenAdminQuestionBank}
            className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-600 cursor-pointer"
          >
            PYQ Bank Inspector
          </button>
        )}
        {onOpenAdminConsole && (
          <button
            type="button"
            onClick={onOpenAdminConsole}
            className="text-[10px] font-extrabold text-slate-500 hover:text-indigo-600 cursor-pointer"
          >
            Commercial Scale Console
          </button>
        )}
      </div>
    </div>
  );
};
