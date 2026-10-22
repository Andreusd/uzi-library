import React, { useRef, useEffect } from 'react';
import { Check, X, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Mobile popover providing compact, touch-friendly controls
 * for sorting books and filtering by format.
 */
export default function MobileFilterPopover({
  isOpen,
  onClose,
  sortBy,
  setSortBy,
  formatFilter,
  setFormatFilter,
}) {
  const { t } = useI18n();
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClickOutside);
    }, 10);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFiltered = sortBy !== 'title_asc' || formatFilter !== 'all';

  const sortOptions = [
    { value: 'title_asc', label: t('sortNameAsc') },
    { value: 'title_desc', label: t('sortNameDesc') },
    { value: 'recent', label: t('sortRecent') },
    { value: 'size_desc', label: t('sortSizeDesc') },
  ];

  const formatOptions = [
    { value: 'all', label: t('allFormats') },
    { value: 'pdf', label: t('formatPdf') || 'PDF' },
    { value: 'epub', label: t('formatEpub') || 'EPUB' },
  ];

  const handleReset = () => {
    setSortBy?.('title_asc');
    setFormatFilter?.('all');
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        onTouchStart={onClose}
      />
      <div
        ref={popoverRef}
        className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl shadow-black/90 p-3.5 z-50 text-neutral-200 select-none backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
      >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
            {t('filterAndSort')}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-neutral-800 cursor-pointer"
              title={t('resetFilters')}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('resetFilters')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sort Section */}
      <div className="py-2.5 border-b border-neutral-800">
        <span className="text-[11px] font-medium text-neutral-400 block mb-1.5">
          {t('sortBy')}
        </span>
        <div className="space-y-1">
          {sortOptions.map((opt) => {
            const isSelected = sortBy === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortBy?.(opt.value)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-neutral-100'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Format Section */}
      <div className="pt-2.5">
        <span className="text-[11px] font-medium text-neutral-400 block mb-1.5">
          {t('filterFormat')}
        </span>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 border border-neutral-800/80 rounded-xl">
          {formatOptions.map((opt) => {
            const isSelected = formatFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormatFilter?.(opt.value)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-800 text-amber-400 shadow-sm border border-neutral-700/80'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
