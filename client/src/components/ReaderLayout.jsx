import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n';
import PdfOutline from './PdfOutline';
import CommentsDrawer from './CommentsDrawer';
import BookSearchBar from './BookSearchBar';
import TtsPlayerBar from './TtsPlayerBar';
import TextSelectionMenu from './TextSelectionMenu';

/**
 * Isolated Reader layout component containing the main stage,
 * document scroll container, floating side navigation arrows, drawers,
 * search bar, TTS player bar, and bottom progress indicator.
 */
export default function ReaderLayout({
  invertColors,
  headerPinned,
  isFullscreen = false,
  toolbar,
  // Outline drawer
  hasOutline,
  outline,
  outlineOpen,
  setOutlineOpen,
  onOutlineClick,
  progressPercent,
  // Main stage scroll container
  containerRef,
  onContainerScroll,
  onTextContextMenu,
  loading,
  children,
  // Floating nav buttons
  floatingButtonsEnabled,
  hasPrev,
  hasNext,
  goToPrevPage,
  goToNextPage,
  // Comments drawer
  annotations,
  commentsDrawerOpen,
  setCommentsDrawerOpen,
  onJumpToAnnotation,
  onUpdateComment,
  onDeleteAnnotation,
  book,
  // Consolidated search & TTS controllers (optional)
  search,
  tts,
  // Legacy Search bar props
  searchOpen,
  searchQuery,
  matchesCount = { current: 0, total: 0 },
  isSearching,
  caseSensitive,
  entireWord,
  onCloseSearch,
  onSearchQueryChange,
  onFindNext,
  onFindPrev,
  onToggleCaseSensitive,
  onToggleEntireWord,
  // Legacy TTS bar props
  ttsOpen,
  setTtsOpen,
  ttsText,
  ttsMode,
  ttsPageNumber,
  totalPages,
  // Selection context menu
  selectionMenu,
  onHighlight,
  onCloseSelectionMenu,
  onReadAloud,
  // Bottom progress bar
  showBottomProgress,
}) {
  const { t } = useI18n();

  const searchController = search || {
    isOpen: searchOpen,
    searchOpen,
    query: searchQuery,
    searchQuery,
    currentIndex: matchesCount?.current ?? 0,
    totalMatches: matchesCount?.total ?? 0,
    matchesCount,
    isSearching,
    caseSensitive,
    entireWord,
    onClose: onCloseSearch,
    handleCloseSearch: onCloseSearch,
    onQueryChange: onSearchQueryChange,
    handleSearchQueryChange: onSearchQueryChange,
    onNext: onFindNext,
    handleFindNext: onFindNext,
    onPrev: onFindPrev,
    handleFindPrev: onFindPrev,
    onToggleCaseSensitive,
    handleToggleCaseSensitive: onToggleCaseSensitive,
    onToggleEntireWord,
    handleToggleEntireWord: onToggleEntireWord,
    theme: invertColors ? 'dark' : 'light',
  };

  const ttsController = tts || {
    isOpen: ttsOpen,
    ttsOpen,
    onClose: () => (setTtsOpen ? setTtsOpen(false) : null),
    text: ttsText,
    ttsText,
    mode: ttsMode,
    ttsMode,
    pageNumber: ttsPageNumber,
    ttsPageNumber,
    totalPages,
    onNextPage: goToNextPage,
    onPrevPage: goToPrevPage,
    theme: invertColors ? 'dark' : 'light',
    bookTitle: book?.title || '',
  };

  const floatingBtnClass = invertColors
    ? 'bg-neutral-900/80 hover:bg-neutral-800 border-neutral-700 hover:border-amber-500/60 text-neutral-300 hover:text-white'
    : 'bg-white/90 hover:bg-white border-neutral-300 hover:border-amber-500/60 text-neutral-700 hover:text-neutral-900 shadow-xl';

  return (
    <div className={`fixed inset-0 h-[100dvh] z-50 flex flex-col font-sans select-none overscroll-none touch-none transition-colors duration-300 ${invertColors ? 'bg-black text-neutral-200' : 'bg-white text-neutral-800'}`}>
      {/* Top Header Toolbar Slot */}
      {toolbar}

      {/* Main Reader Stage */}
      <div className={`relative flex-1 flex overflow-hidden ${invertColors ? 'bg-black' : 'bg-white'} pt-14`}>
        {/* Toggleable Left Index / Table of Contents Drawer */}
        {hasOutline && (
          <PdfOutline
            outline={outline}
            isOpen={outlineOpen}
            onClose={() => setOutlineOpen(false)}
            onItemClick={onOutlineClick}
            percentage={progressPercent}
          />
        )}

        {/* Document Area & Floating Navigation Stage */}
        <div className="relative flex-1 flex flex-col min-w-0 h-full overflow-hidden group/stage overscroll-none touch-pan-y">
          {/* Scrollable Document Container */}
          <div 
            ref={containerRef}
            tabIndex={0}
            onScroll={onContainerScroll}
            onContextMenu={onTextContextMenu}
            className={`relative flex-1 overflow-y-auto overflow-x-auto p-0 sm:p-4 md:p-6 ${
              isFullscreen ? 'pb-2 sm:pb-6' : 'pb-16 sm:pb-6'
            } focus:outline-none select-text overscroll-none touch-pan-y`}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3 text-neutral-400 select-none">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">{t('loadingBook')}</p>
              </div>
            ) : (
              children
            )}
          </div>

          {/* Floating Left Navigation Button */}
          {floatingButtonsEnabled && hasPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevPage();
              }}
              className={`absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border shadow-2xl flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover/stage:opacity-80 sm:hover:!opacity-100 hover:scale-110 active:scale-95 cursor-pointer select-none ${floatingBtnClass}`}
              title={t('prevPageTitle')}
              aria-label={t('prevPageTitle')}
            >
              <ChevronLeft className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${invertColors ? 'text-neutral-300 hover:text-amber-400' : 'text-neutral-600 hover:text-amber-600'}`} />
            </button>
          )}

          {/* Floating Right Navigation Button */}
          {floatingButtonsEnabled && hasNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNextPage();
              }}
              className={`absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full backdrop-blur-md border shadow-2xl flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover/stage:opacity-80 sm:hover:!opacity-100 hover:scale-110 active:scale-95 cursor-pointer select-none ${floatingBtnClass}`}
              title={t('nextPageTitle')}
              aria-label={t('nextPageTitle')}
            >
              <ChevronRight className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${invertColors ? 'text-neutral-300 hover:text-amber-400' : 'text-neutral-600 hover:text-amber-600'}`} />
            </button>
          )}
        </div>

        {/* Toggleable Right Comments & Highlights Drawer */}
        <CommentsDrawer
          annotations={annotations}
          isOpen={commentsDrawerOpen}
          onClose={() => setCommentsDrawerOpen(false)}
          onJumpToAnnotation={onJumpToAnnotation}
          onUpdateComment={onUpdateComment}
          onDeleteAnnotation={onDeleteAnnotation}
          book={book}
        />

        {/* Floating In-Book Search Bar */}
        <BookSearchBar
          search={searchController}
          theme={invertColors ? 'dark' : 'light'}
        />

        {/* Text-to-Speech (Read Aloud) Player Bar */}
        <TtsPlayerBar
          tts={ttsController}
          theme={invertColors ? 'dark' : 'light'}
        />
      </div>

      {/* Floating Context Menu for Text Selection */}
      {selectionMenu?.isOpen && (
        <TextSelectionMenu
          x={selectionMenu.x}
          y={selectionMenu.y}
          selectedText={selectionMenu.text}
          onHighlight={onHighlight}
          onClose={onCloseSelectionMenu}
          onReadAloud={onReadAloud}
        />
      )}

      {/* Bottom Progress Bar */}
      {showBottomProgress && (
        <div className={`h-1 w-full overflow-hidden select-none ${invertColors ? 'bg-black' : 'bg-neutral-200'}`}>
          <div 
            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
