import React from 'react';
import { SlidersHorizontal, X, ZoomIn, ZoomOut, Moon, Sun, Palette } from 'lucide-react';
import { useI18n } from '../i18n';

function ToggleItem({
  title,
  description,
  checked,
  onChange,
  theme = 'dark',
  nested = false,
}) {
  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  const hoverBg = isDark ? 'hover:bg-neutral-800/60' : isSepia ? 'hover:bg-[#efe0c2]/60' : 'hover:bg-neutral-100';
  const titleColor = isDark
    ? 'text-neutral-100 group-hover:text-amber-300'
    : isSepia
    ? 'text-[#292014] group-hover:text-amber-700'
    : 'text-neutral-900 group-hover:text-amber-600';
  const descColor = isDark ? 'text-neutral-300' : isSepia ? 'text-[#7c6a53]' : 'text-neutral-500';
  const toggleOffBg = isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-300 border-neutral-300';

  return (
    <label className={`flex items-start justify-between gap-3 p-2.5 rounded-xl transition-colors cursor-pointer group ${nested ? 'pl-6' : ''} ${hoverBg}`}>
      <div className="min-w-0 flex-1">
        <span className={`text-xs font-semibold block transition-colors ${titleColor}`}>
          {title}
        </span>
        {description && (
          <span className={`text-[11px] leading-snug block mt-0.5 ${descColor}`}>
            {description}
          </span>
        )}
      </div>
      <div className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={onChange}
          className="sr-only peer"
        />
        <div className={`w-9 h-5 ${toggleOffBg} border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:border-amber-500`}></div>
      </div>
    </label>
  );
}

/**
 * Shared modal popover for Reader Settings in PDF and EPUB viewers.
 */
export default function ReaderSettingsPopover({
  isOpen,
  onClose,
  theme = 'dark',
  invertColors,
  // Universal settings
  showBottomProgress,
  toggleBottomProgress,
  trackpadSwipeEnabled,
  toggleTrackpadSwipe,
  floatingButtonsEnabled,
  toggleFloatingButtons,
  upDownFlipEnabled,
  toggleUpDownFlip,
  // PDF-specific settings
  centerVertically,
  toggleCenterVertically,
  isDualPage,
  toggleDualPage,
  dualCoverStandalone,
  toggleDualCover,
  bookTextureEnabled,
  toggleBookTexture,
  isContinuous,
  toggleScrollMode,
  continuousPageSpacing,
  toggleContinuousPageSpacing,
  // Header pin
  headerPinned,
  toggleHeaderPinned,
  // Fullscreen
  isFullscreen,
  toggleFullscreen,
  // Font & Theme controls (for EPUB & quick mobile access)
  fontSize,
  changeFontSize,
  resetFontSize,
  applyTheme,
  // Zoom controls (for PDF & quick mobile access)
  zoomScale,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  fitWidth,
}) {
  const { t } = useI18n();

  if (!isOpen) return null;

  // Resolve active theme string
  const resolvedTheme = typeof invertColors === 'boolean'
    ? (invertColors ? 'dark' : 'light')
    : theme;

  const isDark = resolvedTheme === 'dark';
  const isSepia = resolvedTheme === 'sepia';

  const containerTheme = isDark
    ? 'bg-neutral-900 border-neutral-700 shadow-2xl shadow-black/80 text-neutral-100'
    : isSepia
    ? 'bg-[#fbf0d9] border-[#d8c5a0] shadow-2xl shadow-neutral-900/15 text-[#292014]'
    : 'bg-white border-neutral-200 shadow-2xl shadow-neutral-900/15 text-neutral-800';

  const headerBorder = isDark ? 'border-neutral-800' : isSepia ? 'border-[#d8c5a0]' : 'border-neutral-200';
  const headerTitle = isDark ? 'text-neutral-100' : isSepia ? 'text-[#292014]' : 'text-neutral-900';
  const closeBtn = isDark
    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
    : isSepia
    ? 'text-[#7c6a53] hover:text-[#292014] hover:bg-[#efe0c2]'
    : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100';

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-transparent"
        onClick={onClose}
      />
      <div className={`absolute right-0 top-full mt-2 w-72 sm:w-80 max-h-[calc(100vh-5.5rem)] flex flex-col rounded-2xl p-3.5 z-50 text-left select-none animate-in fade-in zoom-in-95 duration-150 border ${containerTheme}`}>
        <div className={`flex items-center justify-between pb-2.5 mb-2.5 border-b shrink-0 ${headerBorder}`}>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-500" />
            <h3 className={`text-xs font-bold uppercase tracking-wider ${headerTitle}`}>
              {t('readerSettings')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-md transition cursor-pointer ${closeBtn}`}
            aria-label={t('close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-1.5 reader-settings-scroll flex-1 pr-1 overflow-y-auto">
          {/* Font Size (EPUB) */}
          {changeFontSize && (
            <div className={`p-2.5 rounded-xl border mb-2 flex items-center justify-between ${
              isDark ? 'bg-neutral-800/40 border-neutral-700/60' : isSepia ? 'bg-[#efe0c2]/40 border-[#e5d5b5]' : 'bg-neutral-100 border-neutral-200'
            }`}>
              <span className={`text-xs font-semibold ${headerTitle}`}>
                {t('fontSize') || 'Font Size'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => changeFontSize(-10)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${closeBtn}`}
                  title={t('decreaseFontSize')}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={resetFontSize}
                  className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer text-amber-500 hover:text-amber-400"
                  title={t('resetFontSize')}
                >
                  {fontSize}%
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(10)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${closeBtn}`}
                  title={t('increaseFontSize')}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Theme Selector (EPUB) */}
          {applyTheme && (
            <div className={`p-2.5 rounded-xl border mb-2 flex items-center justify-between ${
              isDark ? 'bg-neutral-800/40 border-neutral-700/60' : isSepia ? 'bg-[#efe0c2]/40 border-[#e5d5b5]' : 'bg-neutral-100 border-neutral-200'
            }`}>
              <span className={`text-xs font-semibold ${headerTitle}`}>
                {t('theme') || 'Theme'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyTheme('dark')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                    resolvedTheme === 'dark'
                      ? 'bg-neutral-800 text-amber-400 border border-amber-500/40 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{t('darkMode') || 'Dark'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTheme('sepia')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                    resolvedTheme === 'sepia'
                      ? 'bg-[#5f4b32] text-[#fbf0d9] border border-amber-600/40 shadow-sm'
                      : 'text-[#7c6a53] hover:text-[#292014]'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{t('sepiaMode') || 'Sepia'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTheme('light')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer ${
                    resolvedTheme === 'light'
                      ? 'bg-neutral-200 text-neutral-900 border border-neutral-300 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{t('lightMode') || 'Light'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Zoom (PDF) */}
          {handleZoomIn && handleZoomOut && (
            <div className={`p-2.5 rounded-xl border mb-2 flex items-center justify-between ${
              isDark ? 'bg-neutral-800/40 border-neutral-700/60' : 'bg-neutral-100 border-neutral-200'
            }`}>
              <span className={`text-xs font-semibold ${headerTitle}`}>
                {t('zoom') || 'Zoom'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleZoomOut()}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${closeBtn}`}
                  title={t('zoomOutTitle')}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                {handleResetZoom && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-0.5 text-xs font-mono font-bold rounded-lg text-amber-500 hover:text-amber-400"
                    title={t('resetWidthTitle')}
                  >
                    {zoomScale ? `${Math.round(zoomScale * 100)}%` : '100%'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleZoomIn()}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${closeBtn}`}
                  title={t('zoomInTitle')}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                {fitWidth && (
                  <button
                    type="button"
                    onClick={() => fitWidth()}
                    className="px-2 py-1 text-[11px] font-medium rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 ml-1"
                    title={t('fitWidth')}
                  >
                    {t('fitWidth')}
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Center Page Vertically (PDF) */}
          {toggleCenterVertically && (
            <ToggleItem
              title={t('centerPageVertically')}
              description={t('centerPageVerticallyDesc')}
              checked={centerVertically}
              onChange={toggleCenterVertically}
              theme={resolvedTheme}
            />
          )}

          {/* Bottom Progress Bar */}
          {toggleBottomProgress && (
            <ToggleItem
              title={t('bottomProgressBar')}
              description={t('bottomProgressBarDesc')}
              checked={showBottomProgress}
              onChange={toggleBottomProgress}
              theme={resolvedTheme}
            />
          )}

          {/* Trackpad Swipe */}
          {toggleTrackpadSwipe && (
            <ToggleItem
              title={t('trackpadSwipeNavigation')}
              description={t('trackpadSwipeDesc')}
              checked={trackpadSwipeEnabled}
              onChange={toggleTrackpadSwipe}
              theme={resolvedTheme}
            />
          )}

          {/* Floating Navigation Buttons */}
          {toggleFloatingButtons && (
            <ToggleItem
              title={t('floatingSideButtons')}
              description={t('floatingSideButtonsDesc')}
              checked={floatingButtonsEnabled}
              onChange={toggleFloatingButtons}
              theme={resolvedTheme}
            />
          )}

          {/* Up/Down Arrow Page Flip */}
          {toggleUpDownFlip && (
            <ToggleItem
              title={t('upDownPageFlip')}
              description={t('upDownPageFlipDesc')}
              checked={upDownFlipEnabled}
              onChange={toggleUpDownFlip}
              theme={resolvedTheme}
            />
          )}

          {/* Dual Page Mode (PDF) */}
          {toggleDualPage && (
            <ToggleItem
              title={t('dualPageSetting')}
              description={t('dualPageSettingDesc')}
              checked={isDualPage}
              onChange={toggleDualPage}
              theme={resolvedTheme}
            />
          )}

          {/* Dual Cover Standalone (PDF) */}
          {isDualPage && toggleDualCover && (
            <ToggleItem
              title={t('dualCoverStandalone')}
              description={t('dualCoverStandaloneDesc')}
              checked={dualCoverStandalone}
              onChange={toggleDualCover}
              theme={resolvedTheme}
              nested
            />
          )}

          {/* Paper Texture (PDF) */}
          {toggleBookTexture && (
            <ToggleItem
              title={t('bookTexture')}
              description={t('bookTextureDesc')}
              checked={bookTextureEnabled}
              onChange={toggleBookTexture}
              theme={resolvedTheme}
            />
          )}

          {/* Continuous Scroll Mode (PDF) */}
          {toggleScrollMode && (
            <ToggleItem
              title={t('verticalScrollMode')}
              description={t('verticalScrollDesc')}
              checked={isContinuous}
              onChange={toggleScrollMode}
              theme={resolvedTheme}
            />
          )}

          {/* Continuous Page Spacing (PDF) */}
          {isContinuous && toggleContinuousPageSpacing && (
            <ToggleItem
              title={t('continuousPageSpacing')}
              description={t('continuousPageSpacingDesc')}
              checked={continuousPageSpacing}
              onChange={toggleContinuousPageSpacing}
              theme={resolvedTheme}
              nested
            />
          )}

          {/* Header Pin Toggle */}
          {toggleHeaderPinned && (
            <ToggleItem
              title={t('keepHeaderPinned')}
              description={t('keepHeaderPinnedDesc')}
              checked={headerPinned}
              onChange={toggleHeaderPinned}
              theme={resolvedTheme}
            />
          )}

          {/* Fullscreen Mode */}
          {toggleFullscreen && (
            <ToggleItem
              title={t('fullscreenTitle')}
              description={t('fullscreenDesc')}
              checked={isFullscreen}
              onChange={toggleFullscreen}
              theme={resolvedTheme}
            />
          )}
        </div>
      </div>
    </>
  );
}
