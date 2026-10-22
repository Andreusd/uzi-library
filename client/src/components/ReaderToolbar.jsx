import React, { useState } from 'react';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, Moon, Sun, ListTree,
  MessageSquare, Heart, Settings, MoreVertical,
  RotateCcw, StretchHorizontal,
  Search, Headphones
} from 'lucide-react';
import { useI18n } from '../i18n';
import ReaderSettingsPopover from './ReaderSettingsPopover';
import ReaderMoreMenu from './ReaderMoreMenu';

/**
 * Isolated Reader Toolbar component containing all navigation,
 * zoom, search, TTS, display mode, and settings toggles.
 */
export default function ReaderToolbar({
  book,
  shouldShowExtension,
  onClose,
  hasOutline,
  outlineOpen,
  setOutlineOpen,
  hasPrev,
  hasNext,
  goToPrevPage,
  goToNextPage,
  pageInput,
  setPageInput,
  handlePageSubmit,
  handlePageInputBlur,
  totalPages,
  progressPercent,
  zoomScale,
  handleZoomIn,
  handleZoomOut,
  handleResetZoom,
  fitWidth,
  searchOpen,
  onToggleSearch,
  ttsOpen,
  toggleTts,
  invertColors,
  onToggleInvertColors,
  favState,
  handleToggleFav,
  commentsDrawerOpen,
  setCommentsDrawerOpen,
  annotationsCount = 0,
  isFullscreen,
  toggleFullscreen,
  readerSettingsOpen,
  setReaderSettingsOpen,
  // Reader settings options
  centerVertically,
  toggleCenterVertically,
  showBottomProgress,
  toggleBottomProgress,
  trackpadSwipeEnabled,
  setTrackpadSwipeEnabled,
  floatingButtonsEnabled,
  setFloatingButtonsEnabled,
  upDownFlipEnabled,
  setUpDownFlipEnabled,
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
  // Header visibility & hover handlers
  isHeaderShowing,
  headerPinned,
  toggleHeaderPinned,
  onMouseEnterHeader,
  onMouseLeaveHeader,
  onTouchStartHeader,
  onTouchEndHeader,
}) {
  const { t } = useI18n();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const btnClass = invertColors 
    ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white' 
    : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-neutral-100 border border-neutral-700';

  const btnActiveClass = invertColors 
    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
    : 'bg-amber-500/20 text-amber-700 border border-amber-500/40';

  const dividerClass = 'bg-neutral-700';
  const textTitleClass = 'text-neutral-100';
  const textSubClass = 'text-neutral-400';
  const inputClass = invertColors 
    ? 'bg-neutral-950 border-neutral-700 text-neutral-200 focus:border-amber-500' 
    : 'bg-neutral-900 border-neutral-700 text-neutral-100 focus:border-amber-500';
  const pageSlashClass = 'text-neutral-400';
  const percentClass = invertColors ? 'text-amber-400' : 'text-amber-600 font-semibold';
  const badgeClass = invertColors 
    ? 'bg-rose-950 text-rose-300 border-rose-500/40' 
    : 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <>
      {/* Invisible top hover zone to trigger header when hidden and unpinned */}
      {!headerPinned && !isHeaderShowing && (
        <div 
          onMouseEnter={onMouseEnterHeader}
          className="fixed top-0 left-0 right-0 h-4 z-40 bg-transparent pointer-events-auto"
        />
      )}
      <header 
        onMouseEnter={onMouseEnterHeader}
        onMouseLeave={onMouseLeaveHeader}
        onTouchStart={onTouchStartHeader}
        onTouchEnd={onTouchEndHeader}
      className={`fixed top-0 left-0 right-0 z-40 h-14 border-b flex items-center px-3 sm:px-4 transition-all duration-300 select-none ${
        invertColors 
          ? 'bg-neutral-900/95 border-neutral-800 backdrop-blur shadow-md' 
          : 'bg-neutral-900/95 border-neutral-700 backdrop-blur shadow-sm'
      } ${
        headerPinned 
          ? 'translate-y-0 opacity-100' 
          : `${
              isHeaderShowing
                ? 'translate-y-0 opacity-100 pointer-events-auto' 
                : '-translate-y-full opacity-0 pointer-events-none'
            }`
      }`}
    >
      {/* Left: Navigation & Book Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial md:max-w-[calc(50%-130px)] z-10 mr-2 sm:mr-3 md:mr-0">
        <button 
          onClick={onClose}
          className={`h-7 flex items-center gap-1.5 px-2.5 rounded-lg transition text-xs font-medium shrink-0 cursor-pointer ${btnClass}`}
          title={t('backToLibraryTitle')}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t('backToLibrary')}</span>
        </button>

        {/* Toggle PDF Index / Table of Contents Button (if available) */}
        {hasOutline && (
          <button
            onClick={() => setOutlineOpen(prev => !prev)}
            className={`h-7 w-7 flex items-center justify-center rounded-lg transition shrink-0 cursor-pointer ${
              outlineOpen ? btnActiveClass : btnClass
            }`}
            title={outlineOpen ? t('hideIndex') : t('showIndex')}
          >
            <ListTree className="w-4 h-4" />
          </button>
        )}
        
        <div className={`h-4 w-px mx-0.5 hidden sm:block shrink-0 ${dividerClass}`} />

        <div className="min-w-0 flex-1">
          <h1 className={`text-sm font-semibold truncate ${textTitleClass}`} title={book?.title}>
            {book?.title}
          </h1>
          <div className={`flex items-center gap-1.5 text-xs truncate ${textSubClass}`}>
            <span className="truncate">{book?.shelf_display} • {book?.size_formatted}</span>
            {shouldShowExtension && (
              <span className={`px-1 py-0.2 text-[8px] font-bold rounded uppercase shrink-0 border ${badgeClass}`}>
                PDF
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center Page Controls - Centralized on tablet/desktop, hidden on mobile */}
      <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 z-10">
        <button 
          onClick={goToPrevPage}
          disabled={!hasPrev}
          className={`h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition cursor-pointer ${btnClass}`}
          title={t('prevPageTitle')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <form onSubmit={handlePageSubmit} className="flex items-center text-xs font-mono">
          <input 
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageInputBlur}
            className={`w-14 sm:w-16 h-7 text-center py-0 rounded focus:outline-none ${inputClass}`}
          />
          <span className={`mx-1.5 ${pageSlashClass}`}>/</span>
          <span className={pageSlashClass}>{totalPages}</span>
        </form>

        <button 
          onClick={goToNextPage}
          disabled={!hasNext}
          className={`h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition cursor-pointer ${btnClass}`}
          title={t('nextPageTitle')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <span className={`text-xs ml-1 hidden md:inline-block ${percentClass}`}>
          {progressPercent}%
        </span>
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-1.5 ml-auto z-10 shrink-0">
        {/* Zoom controls */}
        <button 
          onClick={() => handleZoomOut()}
          className={`h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer hidden sm:inline-flex ${btnClass}`}
          title={t('zoomOutTitle')}
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <button 
          onClick={handleResetZoom}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition cursor-pointer hidden sm:inline-flex ${btnClass}`}
          title={t('resetWidthTitle')}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button 
          onClick={() => fitWidth()}
          className={`h-7 w-7 flex items-center justify-center rounded-lg transition cursor-pointer hidden sm:inline-flex ${btnClass}`}
          title={t('fitWidth')}
        >
          <StretchHorizontal className="w-4 h-4" />
        </button>

        <button 
          onClick={() => handleZoomIn()}
          className={`h-7 w-7 items-center justify-center rounded-lg transition cursor-pointer hidden sm:inline-flex ${btnClass}`}
          title={t('zoomInTitle')}
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className={`h-4 w-px mx-1 hidden sm:block ${dividerClass}`} />

        {/* In-Book Full-Text Search Toggle */}
        <button 
          onClick={onToggleSearch}
          className={`h-7 w-7 items-center justify-center rounded-lg transition shrink-0 cursor-pointer hidden sm:flex ${
            searchOpen ? btnActiveClass : btnClass
          }`}
          title={searchOpen ? t('searchClose') : t('searchInBook')}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Read Aloud (Text-to-Speech) Toggle */}
        <button 
          onClick={toggleTts}
          className={`h-7 w-7 items-center justify-center rounded-lg transition shrink-0 cursor-pointer hidden sm:flex ${
            ttsOpen ? btnActiveClass : btnClass
          }`}
          title={ttsOpen ? t('stopSpeech') : t('readAloudTitle')}
        >
          <Headphones className="w-4 h-4" />
        </button>

        {/* Invert Dark / Light */}
        <button 
          onClick={onToggleInvertColors}
          className={`h-7 w-7 items-center justify-center rounded-lg transition shrink-0 cursor-pointer hidden sm:flex ${
            invertColors ? btnActiveClass : btnClass
          }`}
          title={t('nightModeTitle')}
        >
          {invertColors ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Favorite Toggle */}
        <button 
          onClick={handleToggleFav}
          className={`h-7 w-7 items-center justify-center rounded-lg transition shrink-0 cursor-pointer hidden sm:flex ${
            favState 
              ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' 
              : btnClass
          }`}
          title={favState ? t('removeFromFavorites') : t('addToFavorites')}
        >
          <Heart className={`w-4 h-4 ${favState ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Comments & Highlights Drawer Toggle */}
        <button 
          onClick={() => setCommentsDrawerOpen(prev => !prev)}
          className={`h-7 w-7 items-center justify-center rounded-lg transition shrink-0 cursor-pointer hidden sm:flex ${
            commentsDrawerOpen ? btnActiveClass : btnClass
          }`}
          title={commentsDrawerOpen ? t('hideComments') : (annotationsCount > 0 ? `${t('showComments')} (${annotationsCount})` : t('showComments'))}
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button 
          onClick={toggleFullscreen}
          className={`h-7 w-7 flex items-center justify-center rounded-lg border transition cursor-pointer ${
            isFullscreen ? btnActiveClass : btnClass
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
            className={`h-7 w-7 flex items-center justify-center rounded-lg transition shrink-0 cursor-pointer ${
              readerSettingsOpen ? btnActiveClass : btnClass
            }`}
            title={t('readerSettings')}
          >
            <Settings className="w-4 h-4" />
          </button>

          <ReaderSettingsPopover
            isOpen={readerSettingsOpen}
            onClose={() => setReaderSettingsOpen(false)}
            invertColors={invertColors}
            zoomScale={zoomScale}
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleResetZoom={handleResetZoom}
            fitWidth={fitWidth}
            centerVertically={centerVertically}
            toggleCenterVertically={toggleCenterVertically}
            showBottomProgress={showBottomProgress}
            toggleBottomProgress={toggleBottomProgress}
            trackpadSwipeEnabled={trackpadSwipeEnabled}
            toggleTrackpadSwipe={() => {
              setTrackpadSwipeEnabled((prev) => {
                const next = !prev;
                try { localStorage.setItem('reader_trackpad_swipe', String(next)); } catch {}
                return next;
              });
            }}
            floatingButtonsEnabled={floatingButtonsEnabled}
            toggleFloatingButtons={() => {
              setFloatingButtonsEnabled((prev) => {
                const next = !prev;
                try { localStorage.setItem('reader_floating_buttons', String(next)); } catch {}
                return next;
              });
            }}
            upDownFlipEnabled={upDownFlipEnabled}
            toggleUpDownFlip={() => {
              setUpDownFlipEnabled((prev) => {
                const next = !prev;
                try { localStorage.setItem('reader_up_down_flip', String(next)); } catch {}
                return next;
              });
            }}
            isDualPage={isDualPage}
            toggleDualPage={toggleDualPage}
            dualCoverStandalone={dualCoverStandalone}
            toggleDualCover={toggleDualCover}
            bookTextureEnabled={bookTextureEnabled}
            toggleBookTexture={toggleBookTexture}
            isContinuous={isContinuous}
            toggleScrollMode={toggleScrollMode}
            continuousPageSpacing={continuousPageSpacing}
            toggleContinuousPageSpacing={toggleContinuousPageSpacing}
            headerPinned={headerPinned}
            toggleHeaderPinned={toggleHeaderPinned}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
          />
        </div>

        {/* Mobile More Actions Menu (Search, TTS, Invert, Fav, Comments, Pin) */}
        <div className="relative sm:hidden">
          <button 
            onClick={() => setMoreMenuOpen(prev => !prev)}
            className={`h-7 w-7 flex items-center justify-center rounded-lg transition shrink-0 cursor-pointer ${
              moreMenuOpen ? btnActiveClass : btnClass
            }`}
            title={t('moreOptions') || 'Mais opções'}
            aria-label={t('moreOptions') || 'Mais opções'}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <ReaderMoreMenu
            isOpen={moreMenuOpen}
            onClose={() => setMoreMenuOpen(false)}
            theme={invertColors ? 'dark' : 'light'}
            invertColors={invertColors}
            onToggleSearch={onToggleSearch}
            searchOpen={searchOpen}
            onToggleTts={toggleTts}
            ttsOpen={ttsOpen}
            onToggleFavorite={handleToggleFav}
            isFavorite={favState}
            onToggleComments={() => setCommentsDrawerOpen(prev => !prev)}
            commentsDrawerOpen={commentsDrawerOpen}
            annotationsCount={annotationsCount}
            onToggleInvertColors={onToggleInvertColors}
            onToggleHeaderPinned={toggleHeaderPinned}
            headerPinned={headerPinned}
          />
        </div>
      </div>
    </header>
    </>
  );
}
