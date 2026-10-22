import React, { useState } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize2, Minimize2, Moon, Sun, ListTree,
  Heart, PanelTopClose, PanelTopOpen, Palette,
  MessageSquare, Search, Headphones, Settings, MoreVertical
} from 'lucide-react';
import { useI18n } from '../i18n';
import ReaderSettingsPopover from './ReaderSettingsPopover';
import ReaderMoreMenu from './ReaderMoreMenu';

/**
 * Dedicated top navigation and controls toolbar for the EPUB reader.
 */
export default function EpubToolbar({
  book,
  shouldShowExtension,
  theme,
  fontSize,
  pageInfo,
  pageInput,
  setPageInput,
  handlePageSubmit,
  locationInfo,
  flipPrev,
  flipNext,
  changeFontSize,
  resetFontSize,
  applyTheme,
  searchOpen,
  setSearchOpen,
  handleCloseSearch,
  ttsOpen,
  toggleTts,
  favState,
  handleFavToggle,
  commentsDrawerOpen,
  setCommentsDrawerOpen,
  annotationsCount = 0,
  tocOpen,
  setTocOpen,
  headerPinned,
  toggleHeaderPinned,
  isHeaderShowing,
  isFullscreen,
  toggleFullscreen,
  handleClose,
  onMouseEnterHeader,
  onMouseLeaveHeader,
  onTouchStartHeader,
  onTouchEndHeader,
  readerSettingsOpen,
  setReaderSettingsOpen,
  showBottomProgress,
  toggleBottomProgress,
  trackpadSwipeEnabled,
  toggleTrackpadSwipe,
  floatingButtonsEnabled,
  toggleFloatingButtons,
  upDownFlipEnabled,
  toggleUpDownFlip,
}) {
  const { t } = useI18n();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const headerTheme = {
    dark: {
      bar: 'bg-black border-neutral-900 text-neutral-200',
      title: 'text-neutral-100',
      subtitle: 'text-neutral-400',
      chapter: 'text-neutral-300',
      btn: 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white',
      btnActive: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      divider: 'bg-neutral-700',
      badge: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
      input: 'bg-neutral-950 border-neutral-700 text-neutral-200 focus:border-amber-500',
      pageSlash: 'text-neutral-400',
      percentage: 'text-amber-400',
      toolGroup: 'bg-neutral-900 border-neutral-800',
      toolBtn: 'text-neutral-400 hover:text-white hover:bg-neutral-800',
      iconBtn: 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800',
      iconBtnActive: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
    },
    sepia: {
      bar: 'bg-[#fbf0d9] border-[#e5d5b5] text-[#433422]',
      title: 'text-[#292014]',
      subtitle: 'text-[#7c6a53]',
      chapter: 'text-[#5a4833]',
      btn: 'bg-[#efe0c2] hover:bg-[#e4d2b0] text-[#433422] hover:text-[#292014] border border-[#e5d5b5]',
      btnActive: 'bg-amber-500/20 text-amber-800 border border-amber-600/40',
      divider: 'bg-[#d8c5a0]',
      badge: 'bg-[#ebd8b7] text-[#78350f] border-[#d8c5a0]',
      input: 'bg-[#fbf0d9] border-[#d8c5a0] text-[#292014] focus:border-amber-600',
      pageSlash: 'text-[#7c6a53]',
      percentage: 'text-amber-700 font-semibold',
      toolGroup: 'bg-[#efe0c2] border-[#e5d5b5]',
      toolBtn: 'text-[#5a4833] hover:text-[#292014] hover:bg-[#e4d2b0]',
      iconBtn: 'bg-[#efe0c2] border-[#e5d5b5] text-[#5a4833] hover:text-[#292014] hover:bg-[#e4d2b0]',
      iconBtnActive: 'bg-amber-500/20 border-amber-600/50 text-amber-800',
    },
    light: {
      bar: 'bg-neutral-900 border-neutral-700 text-neutral-200',
      title: 'text-neutral-100',
      subtitle: 'text-neutral-400',
      chapter: 'text-neutral-300',
      btn: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-neutral-100 border border-neutral-700',
      btnActive: 'bg-amber-500/20 text-amber-700 border border-amber-500/40',
      divider: 'bg-neutral-700',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      input: 'bg-neutral-900 border-neutral-700 text-neutral-100 focus:border-amber-500',
      pageSlash: 'text-neutral-400',
      percentage: 'text-amber-600 font-semibold',
      toolGroup: 'bg-neutral-800 border-neutral-700',
      toolBtn: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700',
      iconBtn: 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700',
      iconBtnActive: 'bg-amber-500/20 border-amber-500/50 text-amber-700',
    }
  };

  const ht = headerTheme[theme] || headerTheme.dark;

  return (
    <>
      {/* Invisible top hover zone to trigger header when hidden and unpinned */}
      {!headerPinned && !isHeaderShowing && (
        <div
          onMouseEnter={onMouseEnterHeader}
          className="fixed top-0 inset-x-0 h-4 z-40 bg-transparent pointer-events-auto"
        />
      )}
      <header
        onMouseEnter={onMouseEnterHeader}
        onMouseLeave={onMouseLeaveHeader}
        onTouchStart={onTouchStartHeader}
        onTouchEnd={onTouchEndHeader}
        className={`fixed top-0 inset-x-0 z-40 h-14 border-b px-3 sm:px-4 flex items-center justify-between select-none transition-all duration-300 ease-in-out ${
          ht.bar
        } ${
          isHeaderShowing ? 'translate-y-0 opacity-100 pointer-events-auto' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
      {/* Left: Back, TOC & Book Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial md:max-w-[calc(50%-130px)] z-10 mr-2 sm:mr-3 md:mr-0">
        <button
          onClick={handleClose}
          className={`h-7 flex items-center gap-1.5 px-2.5 rounded-lg transition text-xs font-medium shrink-0 cursor-pointer ${ht.btn}`}
          title={t('backToLibraryTitle')}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('backToLibrary')}</span>
        </button>

        {/* Toggle EPUB Table of Contents Button */}
        <button
          onClick={() => setTocOpen(prev => !prev)}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition shrink-0 cursor-pointer ${
            tocOpen ? ht.btnActive : ht.btn
          }`}
          title={tocOpen ? t('hideIndex') : t('showIndex')}
        >
          <ListTree className="w-4 h-4" />
        </button>

        <div className={`h-4 w-px mx-0.5 hidden sm:block shrink-0 ${ht.divider}`} />

        <div className="min-w-0 flex-1">
          <h1 className={`text-xs sm:text-sm font-semibold truncate ${ht.title}`} title={book?.title}>
            {book?.title}
          </h1>
          <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs truncate ${ht.subtitle}`}>
            {book?.author && <span className="text-amber-500 font-medium truncate">{book.author}</span>}
            {book?.author && <span>•</span>}
            {locationInfo?.chapter ? (
              <span className={`truncate ${ht.chapter}`} title={locationInfo.chapter}>{locationInfo.chapter}</span>
            ) : (
              <span className="truncate">{book?.shelf_display || book?.folder_display}</span>
            )}
            {shouldShowExtension && (
              <span className={`px-1 py-0.2 text-[8px] font-bold rounded uppercase shrink-0 border ${ht.badge}`}>
                EPUB
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center Page Controls - Centralized on tablet/desktop, hidden on mobile */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 z-10">
        <button
          onClick={flipPrev}
          disabled={pageInfo?.total > 0 && pageInfo?.page <= 1}
          className={`h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition cursor-pointer ${ht.btn}`}
          title={t('prevPageTitle')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <form onSubmit={handlePageSubmit} className="flex items-center text-xs font-mono">
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageSubmit}
            className={`w-14 sm:w-16 h-7 text-center py-0 rounded focus:outline-none ${ht.input}`}
          />
          {pageInfo?.total > 0 && (
            <>
              <span className={`mx-1.5 ${ht.pageSlash}`}>/</span>
              <span className={ht.pageSlash}>{pageInfo.total}</span>
            </>
          )}
        </form>

        <button
          onClick={flipNext}
          disabled={pageInfo?.total > 0 && pageInfo?.page >= pageInfo?.total}
          className={`h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition cursor-pointer ${ht.btn}`}
          title={t('nextPageTitle')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <span className={`text-xs ml-1 hidden md:inline-block ${ht.percentage}`}>
          {locationInfo?.percentage}%
        </span>
      </div>

      {/* Right: Actions (Font Scaling, Theme, Fullscreen) */}
      <div className="flex items-center gap-1 sm:gap-2 ml-auto z-10 shrink-0">
        {/* Font Size Adjustments */}
        <div className={`hidden md:flex items-center rounded-lg p-0.5 border ${ht.toolGroup}`}>
          <button
            onClick={() => changeFontSize(-10)}
            className={`p-1 rounded transition cursor-pointer ${ht.toolBtn}`}
            title={t('decreaseFontSize')}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetFontSize}
            className={`px-1.5 text-[11px] font-mono transition cursor-pointer ${
              theme === 'dark'
                ? 'text-neutral-300 hover:text-amber-400'
                : theme === 'sepia'
                ? 'text-[#433422] hover:text-amber-700'
                : 'text-neutral-200 hover:text-amber-600'
            }`}
            title={t('resetFontSize')}
          >
            {fontSize}%
          </button>
          <button
            onClick={() => changeFontSize(10)}
            className={`p-1 rounded transition cursor-pointer ${ht.toolBtn}`}
            title={t('increaseFontSize')}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reading Theme Picker (Dark, Light, Sepia) */}
        <div className={`hidden sm:flex items-center rounded-lg p-0.5 border ${ht.toolGroup}`}>
          <button
            onClick={() => applyTheme('dark')}
            className={`p-1 rounded transition cursor-pointer ${
              theme === 'dark'
                ? 'bg-neutral-800 text-amber-400'
                : theme === 'sepia'
                ? 'text-[#7c6a53] hover:text-[#292014]'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
            title={t('darkMode')}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyTheme('sepia')}
            className={`p-1 rounded transition cursor-pointer ${
              theme === 'sepia'
                ? 'bg-[#5f4b32] text-[#fbf0d9] shadow-sm'
                : theme === 'dark'
                ? 'text-neutral-400 hover:text-white'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
            title={t('sepiaMode')}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => applyTheme('light')}
            className={`p-1 rounded transition cursor-pointer ${
              theme === 'light'
                ? 'bg-neutral-900 text-amber-500 shadow-sm border border-neutral-700'
                : theme === 'sepia'
                ? 'text-[#7c6a53] hover:text-[#292014]'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
            title={t('lightMode')}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* In-Book Full-Text Search Toggle */}
        <button
          onClick={() => {
            if (searchOpen) {
              handleCloseSearch();
            } else {
              setSearchOpen(true);
            }
          }}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden sm:block ${
            searchOpen ? ht.iconBtnActive : ht.iconBtn
          }`}
          title={searchOpen ? t('searchClose') : t('searchInBook')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Read Aloud (Text-to-Speech) Toggle */}
        <button
          onClick={toggleTts}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden sm:block ${
            ttsOpen ? ht.iconBtnActive : ht.iconBtn
          }`}
          title={ttsOpen ? t('stopSpeech') : t('readAloudTitle')}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* Favorite Toggle */}
        <button
          onClick={handleFavToggle}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden sm:block ${
            favState
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-500'
              : ht.iconBtn
          }`}
          title={favState ? t('removeFromFavorites') : t('addToFavorites')}
        >
          <Heart className={`w-4 h-4 ${favState ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Comments & Highlights Drawer Toggle */}
        <button
          onClick={() => {
            setCommentsDrawerOpen(prev => !prev);
          }}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden sm:block ${
            commentsDrawerOpen ? ht.iconBtnActive : ht.iconBtn
          }`}
          title={commentsDrawerOpen ? t('hideComments') : (annotationsCount > 0 ? `${t('showComments')} (${annotationsCount})` : t('showComments'))}
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4" />
            {annotationsCount > 0 && (
              <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ${
                theme === 'dark' ? 'ring-neutral-900' : theme === 'sepia' ? 'ring-[#fbf0d9]' : 'ring-white'
              }`} />
            )}
          </div>
        </button>

        {/* Header Pin Toggle */}
        <button
          onClick={toggleHeaderPinned}
          className={`p-1.5 rounded-lg border transition-colors hidden sm:block cursor-pointer ${
            headerPinned ? ht.iconBtnActive : ht.iconBtn
          }`}
          title={headerPinned ? t('unpinHeaderTitle') : t('pinHeaderTitle')}
        >
          {headerPinned ? <PanelTopClose className="w-4 h-4" /> : <PanelTopOpen className="w-4 h-4" />}
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
            isFullscreen ? ht.iconBtnActive : ht.iconBtn
          }`}
          title={isFullscreen ? t('exitFullscreen') : t('fullscreenTitle')}
          aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreenTitle')}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Reader Settings Popover */}
        <div className="relative">
          <button
            onClick={() => setReaderSettingsOpen(prev => !prev)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              readerSettingsOpen ? ht.iconBtnActive : ht.iconBtn
            }`}
            title={t('readerSettings')}
          >
            <Settings className="w-4 h-4" />
          </button>

          <ReaderSettingsPopover
            isOpen={readerSettingsOpen}
            onClose={() => setReaderSettingsOpen(false)}
            theme={theme}
            fontSize={fontSize}
            changeFontSize={changeFontSize}
            resetFontSize={resetFontSize}
            applyTheme={applyTheme}
            showBottomProgress={showBottomProgress}
            toggleBottomProgress={toggleBottomProgress}
            trackpadSwipeEnabled={trackpadSwipeEnabled}
            toggleTrackpadSwipe={toggleTrackpadSwipe}
            floatingButtonsEnabled={floatingButtonsEnabled}
            toggleFloatingButtons={toggleFloatingButtons}
            upDownFlipEnabled={upDownFlipEnabled}
            toggleUpDownFlip={toggleUpDownFlip}
            headerPinned={headerPinned}
            toggleHeaderPinned={toggleHeaderPinned}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
          />
        </div>

        {/* Mobile More Actions Menu (Search, TTS, Fav, Comments, Pin) */}
        <div className="relative sm:hidden">
          <button
            onClick={() => setMoreMenuOpen(prev => !prev)}
            className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center cursor-pointer ${
              moreMenuOpen ? ht.iconBtnActive : ht.iconBtn
            }`}
            title={t('moreOptions') || 'Mais opções'}
            aria-label={t('moreOptions') || 'Mais opções'}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <ReaderMoreMenu
            isOpen={moreMenuOpen}
            onClose={() => setMoreMenuOpen(false)}
            theme={theme}
            onToggleSearch={() => {
              if (searchOpen) {
                handleCloseSearch();
              } else {
                setSearchOpen(true);
              }
            }}
            searchOpen={searchOpen}
            onToggleTts={toggleTts}
            ttsOpen={ttsOpen}
            onToggleFavorite={handleFavToggle}
            isFavorite={favState}
            onToggleComments={() => setCommentsDrawerOpen(prev => !prev)}
            commentsDrawerOpen={commentsDrawerOpen}
            annotationsCount={annotationsCount}
          />
        </div>
      </div>
    </header>
    </>
  );
}
