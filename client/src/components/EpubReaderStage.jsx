import React from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Component rendering the visual viewport stage of the EPUB reader,
 * including loading spinner, error message, floating navigation buttons, and iframe mount.
 */
export default function EpubReaderStage({
  viewerRef,
  loading,
  error,
  handleClose,
  floatingButtonsEnabled,
  flipPrev,
  flipNext,
}) {
  const { t } = useI18n();

  return (
    <main className="relative flex-1 h-full flex items-center justify-center group/stage overscroll-none touch-pan-x min-w-0 overflow-hidden select-none">
      {/* Loading Spinner */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm gap-3">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-neutral-300">{t('loadingBook')}</p>
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-neutral-950 gap-4 p-6 text-center">
          <div className="p-3 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-neutral-100">{t('unableToOpenEpub')}</h3>
          <p className="text-xs text-neutral-400 max-w-md">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition cursor-pointer"
          >
            {t('backToLibrary')}
          </button>
        </div>
      )}

      {/* Floating Navigation Buttons */}
      {floatingButtonsEnabled && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              flipPrev();
            }}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-neutral-700 hover:border-amber-500/60 text-neutral-300 hover:text-white shadow-2xl flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover/stage:opacity-80 sm:hover:!opacity-100 hover:scale-110 active:scale-95 cursor-pointer select-none"
            title={t('prevPageTitle')}
            aria-label={t('prevPageTitle')}
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 text-neutral-300 hover:text-amber-400 transition-colors" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              flipNext();
            }}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-neutral-900/80 hover:bg-neutral-800 backdrop-blur-md border border-neutral-700 hover:border-amber-500/60 text-neutral-300 hover:text-white shadow-2xl flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover/stage:opacity-80 sm:hover:!opacity-100 hover:scale-110 active:scale-95 cursor-pointer select-none"
            title={t('nextPageTitle')}
            aria-label={t('nextPageTitle')}
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 text-neutral-300 hover:text-amber-400 transition-colors" />
          </button>
        </>
      )}

      {/* Expanded Document Viewport */}
      <div className="w-full h-full px-4 sm:px-12 md:px-16 lg:px-20 py-2 sm:py-3 flex flex-col items-center justify-center overflow-hidden">
        <div 
          ref={viewerRef} 
          className="flex-1 w-full h-full overflow-hidden select-none" 
        />
      </div>
    </main>
  );
}
