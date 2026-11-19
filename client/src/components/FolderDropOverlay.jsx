import React from 'react';
import { UploadCloud, Folder } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Visual drag-and-drop overlay displayed when dragging files over a folder page.
 */
export default function FolderDropOverlay({ isDragging, folderName }) {
  const { t } = useI18n();

  if (!isDragging) return null;

  return (
    <div
      data-testid="folder-drop-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-neutral-950/80 backdrop-blur-md pointer-events-none transition-all animate-in fade-in duration-150"
    >
      <div className="border-2 border-dashed border-amber-500 bg-neutral-900/95 text-neutral-100 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-amber-500/10 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <UploadCloud className="w-8 h-8 animate-bounce" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-neutral-100">
            {t('dropBooksHere')}
          </h3>
          {folderName && (
            <p className="text-sm font-medium text-amber-400 flex items-center justify-center gap-1.5">
              <Folder className="w-4 h-4 shrink-0" />
              <span>{t('uploadToFolder', { folder: folderName })}</span>
            </p>
          )}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 text-xs text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span>{t('supportedFormatsHint')}</span>
        </div>
      </div>
    </div>
  );
}
