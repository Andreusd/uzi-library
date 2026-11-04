import React from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Floating button pill displayed after following an in-text link (e.g. footnote, citation),
 * allowing the reader to quickly jump back to where they were reading.
 */
export default function ReaderBackPill({
  target,
  onNavigateBack,
  onDismiss,
  theme = 'dark',
  className = '',
}) {
  const { t } = useI18n();

  if (!target) return null;

  const label = target.page
    ? t('backToPage', { page: target.page })
    : t('backToPreviousLocation');

  const themeClasses = {
    dark: 'bg-neutral-900/95 text-neutral-100 border-neutral-700/80 shadow-black/50 hover:border-neutral-600',
    light: 'bg-white/95 text-neutral-800 border-neutral-300/80 shadow-neutral-900/15 hover:border-neutral-400',
    sepia: 'bg-[#f4ecd8]/95 text-[#5f4b32] border-[#d8c5a0] shadow-[#5f4b32]/20 hover:border-[#c8b58e]',
  }[theme] || 'bg-neutral-900/95 text-neutral-100 border-neutral-700/80 shadow-black/50 hover:border-neutral-600';

  const dividerClass = {
    dark: 'border-neutral-700/80',
    light: 'border-neutral-300/80',
    sepia: 'border-[#d8c5a0]',
  }[theme] || 'border-neutral-700/80';

  const dismissHover = {
    dark: 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200',
    light: 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800',
    sepia: 'hover:bg-[#e9dfc6] text-[#8c7355] hover:text-[#5f4b32]',
  }[theme] || 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200';

  return (
    <div
      role="region"
      aria-label={label}
      data-testid="reader-back-pill"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center rounded-full border shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 select-none ${themeClasses} ${className}`}
    >
      <button
        type="button"
        onClick={onNavigateBack}
        data-testid="reader-back-pill-button"
        className="flex items-center gap-2 pl-4 pr-3 py-2 text-xs sm:text-sm font-medium rounded-l-full transition-colors group cursor-pointer"
        title={label}
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        <span>{label}</span>
      </button>

      <div className={`h-4 w-[1px] border-r ${dividerClass}`} />

      <button
        type="button"
        onClick={onDismiss}
        data-testid="reader-back-pill-dismiss"
        className={`p-2 pr-3 pl-2.5 rounded-r-full transition-colors cursor-pointer flex items-center justify-center ${dismissHover}`}
        title={t('dismiss')}
        aria-label={t('dismiss')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
