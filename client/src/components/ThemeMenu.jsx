import React, { useEffect, useRef } from 'react';
import { Palette, Check, X, Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';

const THEMES = [
  {
    id: 'default',
    titleKey: 'theme_default',
    descKey: 'theme_default_desc',
    swatchesDark: ['#0a0a0a', '#171717', '#262626', '#f59e0b'],
    swatchesLight: ['#f8fafc', '#ffffff', '#e2e8f0', '#d97706'],
    swatches: ['#0a0a0a', '#171717', '#262626', '#f59e0b'],
  },
  {
    id: 'sepia',
    titleKey: 'theme_sepia',
    descKey: 'theme_sepia_desc',
    swatchesDark: ['#19140f', '#241d16', '#342a20', '#d97706'],
    swatchesLight: ['#fbf7ee', '#f4ece1', '#e5d8c5', '#b45309'],
    swatches: ['#19140f', '#241d16', '#342a20', '#d97706'],
  },
  {
    id: 'hearth',
    titleKey: 'theme_hearth',
    descKey: 'theme_hearth_desc',
    swatchesDark: ['#170f0b', '#241610', '#362017', '#ea580c'],
    swatchesLight: ['#faf4f0', '#f5e9e2', '#e8d5cb', '#c2410c'],
    swatches: ['#170f0b', '#241610', '#362017', '#ea580c'],
  },
  {
    id: 'nordic',
    titleKey: 'theme_nordic',
    descKey: 'theme_nordic_desc',
    swatchesDark: ['#0c1411', '#131e1a', '#1c2c26', '#10b981'],
    swatchesLight: ['#f2f8f5', '#e5f2ec', '#cde4d9', '#059669'],
    swatches: ['#0c1411', '#131e1a', '#1c2c26', '#10b981'],
  },
  {
    id: 'navy',
    titleKey: 'theme_navy',
    descKey: 'theme_navy_desc',
    swatchesDark: ['#090e17', '#101726', '#1c263b', '#0ea5e9'],
    swatchesLight: ['#f0f5fa', '#e2ecf5', '#c8d9e8', '#0284c7'],
    swatches: ['#090e17', '#101726', '#1c263b', '#0ea5e9'],
  },
  {
    id: 'velvet',
    titleKey: 'theme_velvet',
    descKey: 'theme_velvet_desc',
    swatchesDark: ['#130c17', '#1e1324', '#2c1c35', '#a855f7'],
    swatchesLight: ['#f7f3f9', '#eee7f2', '#ded1e5', '#9333ea'],
    swatches: ['#130c17', '#1e1324', '#2c1c35', '#a855f7'],
  },
  {
    id: 'espresso',
    titleKey: 'theme_espresso',
    descKey: 'theme_espresso_desc',
    swatchesDark: ['#120e0b', '#1c1511', '#2a1f18', '#d97706'],
    swatchesLight: ['#f8f4f0', '#efe7e0', '#decbc0', '#b45309'],
    swatches: ['#120e0b', '#1c1511', '#2a1f18', '#d97706'],
  },
  {
    id: 'linen',
    titleKey: 'theme_linen',
    descKey: 'theme_linen_desc',
    swatchesDark: ['#141210', '#1f1b17', '#2d2822', '#d97706'],
    swatchesLight: ['#fbf8f3', '#f3ede2', '#e4dac9', '#b45309'],
    swatches: ['#fbf8f3', '#f3ede2', '#e4dac9', '#b45309'],
  },
];

export default function ThemeMenu({
  currentTheme = 'default',
  currentMode = 'dark',
  onSelectTheme,
  onSelectMode,
  onClose,
}) {
  const { t } = useI18n();
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
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
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        onTouchStart={onClose}
      />
      <div
        ref={popoverRef}
        className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-neutral-750 shadow-2xl shadow-black/90 p-3 z-50 animate-in fade-in zoom-in-95 duration-150 select-none"
      >
      {/* Popover Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-neutral-100 tracking-wider">
            {t('themesTitle')}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          aria-label={t('closeButton') || 'Close'}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-neutral-400 mt-1.5 px-0.5 leading-snug">
        {t('themesSubtitle')}
      </p>

      {/* Mode Switcher (Dark / Light) */}
      <div className="mt-2.5 p-1 rounded-xl bg-neutral-950/70 border border-neutral-800/90 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSelectMode && onSelectMode('dark')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMode === 'dark'
              ? 'bg-neutral-800 text-amber-400 shadow-sm border border-neutral-700/80 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Moon className="w-3.5 h-3.5 shrink-0" />
          <span>{t('darkMode')}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode && onSelectMode('light')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            currentMode === 'light'
              ? 'bg-neutral-800 text-amber-400 shadow-sm border border-neutral-700/80 font-bold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
        >
          <Sun className="w-3.5 h-3.5 shrink-0" />
          <span>{t('lightMode')}</span>
        </button>
      </div>

      {/* Themes List Header */}
      <div className="mt-3 mb-1 px-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          {t('themes')}
        </span>
      </div>

      {/* Themes List */}
      <div className="max-h-76 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
        {THEMES.map((theme) => {
          const isSelected = (currentTheme || 'default') === theme.id;
          const swatches = currentMode === 'light' 
            ? (theme.swatchesLight || theme.swatches) 
            : (theme.swatchesDark || theme.swatches);

          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => {
                onSelectTheme(theme.id);
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all text-left group cursor-pointer ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/40 text-neutral-100 shadow-sm'
                  : 'bg-neutral-950/40 border-neutral-800/80 hover:bg-neutral-800/70 hover:border-neutral-700 text-neutral-300 hover:text-neutral-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* 4-Color Swatch Preview */}
                <div className="flex items-center -space-x-1 shrink-0 p-1 rounded-lg bg-neutral-950/80 border border-neutral-800">
                  {swatches.map((color, idx) => (
                    <span
                      key={idx}
                      className="w-3 h-3 rounded-full border border-black/20 shadow-xs shrink-0"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="min-w-0 flex flex-col">
                  <span className="font-semibold text-xs text-neutral-200 group-hover:text-neutral-50 truncate">
                    {t(theme.titleKey)}
                  </span>
                  <span className="text-[10px] text-neutral-400 truncate">
                    {t(theme.descKey)}
                  </span>
                </div>
              </div>

              {/* Selection Checkmark */}
              <div className="shrink-0 ml-2">
                {isSelected ? (
                  <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-neutral-950 shadow-sm">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-neutral-700/80 group-hover:border-neutral-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
    </>
  );
}
