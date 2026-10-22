import React, { useRef, useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import LibrarySelector from './components/LibrarySelector';
import Reader from './components/Reader';
import ReaderTransition from './components/ReaderTransition';
import AppModals from './components/AppModals';
import AppNavbar from './components/AppNavbar';
import ShelfHeader from './components/ShelfHeader';
import LibraryHome from './components/LibraryHome';
import LibraryContent from './components/LibraryContent';
import { BookActionsProvider } from './contexts/BookActionsContext.jsx';
import { useI18n } from './i18n';
import { useSettings } from './hooks/useSettings';
import { useBookModals } from './hooks/useBookModals';
import { useLibraryRouter } from './hooks/useLibraryRouter';
import { useLibraryData } from './hooks/useLibraryData';
import { useLibraryKeyboardNavigation } from './hooks/useLibraryKeyboardNavigation';

/**
 * Root Application Component.
 * Composes global settings, library data state, navigation, modals, and views.
 * Supplies book interaction actions via BookActionsProvider to eliminate prop drilling.
 */
export default function App() {
  const { t } = useI18n();
  const {
    theme,
    setTheme,
    mode,
    setMode,
    showFileExtension,
    bookAnimations,
    sidebarOpen,
    toggleSidebar,
    setSidebarOpen,
    currentUser,
    setCurrentUser,
  } = useSettings();

  const modals = useBookModals();
  const router = useLibraryRouter();

  const libraryData = useLibraryData({ setCurrentUser, modals, router });
  const {
    shelves,
    totalBooks,
    libraries,
    activeLibraryId,
    selectedShelf,
    books,
    continueReading,
    favorites,
    readBooks,
    favoriteIds,
    tags,
    offlineBooksCount,
    loading,
    debouncedQuery,
    formatFilter,
    setFormatFilter,
    activeBook,
    routeLoading,
    currentShelfObj,
    isTagFilter,
    currentTagObj,
    selectLibrary,
    selectAllLibraries,
    switchLibrary,
    navigateToShelf,
    openReader,
    closeReader,
    handleToggleFavorite,
    handleProgressUpdate,
    handleUserChange,
  } = libraryData;

  const [isTransitionActive, setIsTransitionActive] = useState(false);
  const isReaderActive = Boolean(activeBook || isTransitionActive);

  const searchInputRef = useRef(null);

  const [isFoldersOpen, setIsFoldersOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_folders_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isTagsOpen, setIsTagsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_tags_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleSetFoldersOpen = useCallback((val) => {
    setIsFoldersOpen((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('sidebar_folders_open', String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSetTagsOpen = useCallback((val) => {
    setIsTagsOpen((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('sidebar_tags_open', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isLibraryDropdownOpen, setIsLibraryDropdownOpen] = useState(false);

  const keyboardNav = useLibraryKeyboardNavigation({
    isReaderActive,
    modals,
    libraryData,
    openReader,
    closeReader,
    activeBook,
    selectedShelf,
    debouncedQuery,
    sidebarOpen,
    setSidebarOpen,
    searchInputRef,
    isFoldersOpen,
    setIsFoldersOpen: handleSetFoldersOpen,
    isTagsOpen,
    setIsTagsOpen: handleSetTagsOpen,
    isLibraryDropdownOpen,
    setIsLibraryDropdownOpen,
    activeLibraryId,
    onSelectShelf: (id) => {
      navigateToShelf(id);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    },
  });

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isReaderActive) {
        if (e.key === 'Backspace') {
          const target = e.target;
          const isInput =
            target &&
            (target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.isContentEditable ||
              target.getAttribute?.('contenteditable') === 'true');
          if (!isInput) {
            e.preventDefault();
            closeReader();
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReaderActive, toggleSidebar, closeReader]);

  const handleOpenDetails = useCallback((book) => {
    modals.openDetailsModal(book);
  }, [modals]);

  const selectTagAction = useCallback((tg) => {
    if (tg?.id) {
      navigateToShelf(`tag:${tg.id}`);
    }
  }, [navigateToShelf]);

  // When no active library is selected or no user is set, display Library Selection screen
  if (!activeLibraryId || !currentUser) {
    return (
      <>
        <LibrarySelector
          libraries={libraries}
          onSelectLibrary={selectLibrary}
          onOpenSettings={() => modals.setSettingsOpen(true)}
          onAddNewLibrary={() => modals.setSettingsOpen(true)}
          currentUser={currentUser}
          onUserChange={handleUserChange}
        />

        <AppModals modals={modals} libraryData={libraryData} />
      </>
    );
  }

  return (
    <BookActionsProvider
      openReader={openReader}
      openDetails={handleOpenDetails}
      openContextMenu={modals.openBookContextMenu}
      toggleFavorite={handleToggleFavorite}
      selectTag={selectTagAction}
      favoriteIds={favoriteIds}
      showFileExtension={showFileExtension}
      highlightedCardId={keyboardNav.highlightedCardId}
      setHighlightedCardId={keyboardNav.setHighlightedCardId}
    >
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <Sidebar
          shelves={shelves}
          totalBooks={totalBooks}
          favoriteCount={favorites.length}
          continueReadingCount={continueReading.length}
          readCount={readBooks.length}
          downloadedCount={offlineBooksCount}
          selectedShelf={selectedShelf}
          onSelectShelf={(id) => {
            navigateToShelf(id);
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          onShelfContextMenu={modals.openShelfContextMenu}
          isOpen={!isReaderActive && sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          libraries={libraries}
          activeLibraryId={activeLibraryId}
          onSwitchLibrary={switchLibrary}
          onSelectAllLibraries={selectAllLibraries}
          onOpenSettings={() => modals.setSettingsOpen(true)}
          tags={tags}
          onOpenTagManager={() => modals.openTagModal(null)}
          currentUser={currentUser}
          highlightedMenuItemId={keyboardNav.highlightedMenuItemId}
          isFoldersOpen={isFoldersOpen}
          setIsFoldersOpen={handleSetFoldersOpen}
          isTagsOpen={isTagsOpen}
          setIsTagsOpen={handleSetTagsOpen}
          isLibraryDropdownOpen={isLibraryDropdownOpen}
          setIsLibraryDropdownOpen={setIsLibraryDropdownOpen}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <AppNavbar
            libraryData={libraryData}
            modals={modals}
            searchInputRef={searchInputRef}
          />

          {/* Books Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto relative z-0">
            <LibraryHome
              selectedShelf={selectedShelf}
              debouncedQuery={debouncedQuery}
              formatFilter={formatFilter}
              continueReading={continueReading}
              favorites={favorites}
              readBooks={readBooks}
              shelves={shelves}
              tags={tags}
              books={books}
              navigateToShelf={navigateToShelf}
              modals={modals}
            />

            <ShelfHeader
              selectedShelf={selectedShelf}
              debouncedQuery={debouncedQuery}
              formatFilter={formatFilter}
              shelves={shelves}
              tags={tags}
              books={books}
              totalBooks={totalBooks}
              isTagFilter={isTagFilter}
              currentTagObj={currentTagObj}
              currentShelfObj={currentShelfObj}
              onOpenTagManager={() => modals.openTagModal(null)}
            />

            <LibraryContent
              selectedShelf={selectedShelf}
              debouncedQuery={debouncedQuery}
              formatFilter={formatFilter}
              setFormatFilter={setFormatFilter}
              shelves={shelves}
              tags={tags}
              books={books}
              totalBooks={totalBooks}
              loading={loading}
              navigateToShelf={navigateToShelf}
              modals={modals}
              setSearchQuery={libraryData.setSearchQuery}
            />
          </main>
        </div>

        {/* Route Loading Fullscreen State */}
        {routeLoading && !isReaderActive && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 gap-3 select-none">
            <div className="w-9 h-9 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-neutral-300">{t('loadingBook')}</p>
          </div>
        )}

        {/* Embedded Fullscreen Reader with Zoom Transitions */}
        <ReaderTransition
          book={activeBook}
          enabled={bookAnimations}
          onClose={closeReader}
          onTransitionStateChange={setIsTransitionActive}
        >
          {(transitionBook, handleClose) => (
            <Reader
              book={transitionBook}
              isFavorite={favoriteIds.has(transitionBook.id)}
              onClose={handleClose}
              onProgressUpdate={handleProgressUpdate}
              onToggleFavorite={handleToggleFavorite}
              showFileExtension={showFileExtension}
              theme={theme}
              onThemeChange={setTheme}
              mode={mode}
              onModeChange={setMode}
            />
          )}
        </ReaderTransition>

        {/* Encapsulated Modals and Context Menus */}
        <AppModals modals={modals} libraryData={libraryData} />
      </div>
    </BookActionsProvider>
  );
}
