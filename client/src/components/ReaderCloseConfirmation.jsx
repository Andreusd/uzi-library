import React from 'react';
import { ArrowDown, X } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Floating prompt notification displayed when the user slides up-to-down inside the reader,
 * asking them to slide again to confirm closing the book.
 */
export default function ReaderCloseConfirmation({
  isOpen,
  onDismiss,
  theme = 'dark',
  isHeaderShowing = false,
}) {
  const { t } = useI18n();

  if (!isOpen) return null;

  const themeClasses = {
    dark: 'bg-neutral-900/95 text-neutral-100 border-neutral-750 shadow-black/70',
    light: 'bg-white/95 text-neutral-800 border-neutral-300/90 shadow-neutral-900/20',
    sepia: 'bg-[#f4ecd8]/95 text-[#5f4b32] border-[#d8c5a0] shadow-[#5f4b32]/25',
    nord: 'bg-[#2e3440]/95 text-[#eceff4] border-[#434c5e] shadow-black/70',
    midnight: 'bg-[#0f172a]/95 text-[#f8fafc] border-[#1e293b] shadow-black/80',
    solarized: 'bg-[#fdf6e3]/95 text-[#586e75] border-[#eee8d5] shadow-neutral-900/15',
    linen: 'bg-[#f3ede2]/95 text-[#2d2822] border-[#e4dac9] shadow-neutral-900/15',
  }[theme] || 'bg-neutral-900/95 text-neutral-100 border-neutral-750 shadow-black/70';

  const topClass = isHeaderShowing ? 'top-16 sm:top-18' : 'top-5';

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reader-close-confirmation"
      className={`fixed ${topClass} left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-2xl backdrop-blur-xl select-none transition-all duration-200 animate-in fade-in slide-in-from-top-3 ${themeClasses}`}
    >
      <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
        <ArrowDown className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
      </div>
      <span className="text-xs sm:text-sm font-semibold tracking-wide whitespace-nowrap">
        {t('slideAgainToClose') || 'Slide down again to close book'}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 p-0.5 rounded-full text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 transition cursor-pointer"
          aria-label={t('dismiss') || 'Dismiss'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
