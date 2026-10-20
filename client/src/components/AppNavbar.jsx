import React, { useState, useRef } from 'react';
import {
  Search, X, BookOpen,
  PanelLeftClose, PanelLeftOpen,
  Settings, Heart, Bookmark, Maximize2, Minimize2, Library, Folder, Tag, Palette
} from 'lucide-react';
import ShelfIcon from './ShelfIcon';
import ThemeMenu from './ThemeMenu';
import { getTagColorConfig } from '../utils/tagColors';
import { useI18n } from '../i18n';
import { useSettings } from '../hooks/useSettings';
import { useFullscreen } from '../hooks/useFullscreen';

/**
 * Top navigation header bar for the digital library application.
 * Contains breadcrumbs, search, sort options, theme switch, fullscreen toggle, and settings.
 * Pulls global settings and fullscreen state from hooks, and library state from libraryData.
 */
export default function AppNavbar({
  libraryData,
  modals,
  searchInputRef,
  // Backwards-compatible prop overrides
  sidebarOpen: propSidebarOpen,
  toggleSidebar: propToggleSidebar,
  selectAllLibraries: propSelectAllLibraries,
  navigateToShelf: propNavigateToShelf,
  selectedShelf: propSelectedShelf,
  activeLibraryId: propActiveLibraryId,
  activeLibraryObj: propActiveLibraryObj,
  isTagFilter: propIsTagFilter,
  currentTagObj: propCurrentTagObj,
  currentShelfObj: propCurrentShelfObj,
  searchQuery: propSearchQuery,
  setSearchQuery: propSetSearchQuery,
  sortBy: propSortBy,
  setSortBy: propSetSortBy,
  formatFilter: propFormatFilter,
  setFormatFilter: propSetFormatFilter,
  isFullscreen: propIsFullscreen,
  toggleFullscreen: propToggleFullscreen,
  theme: propTheme,
  setTheme: propSetTheme,
  mode: propMode,
  setMode: propSetMode,
}) {
  const { t } = useI18n();
  const settings = useSettings();
  const fullscreen = useFullscreen();

  const internalInputRef = useRef(null);
  const effectiveInputRef = searchInputRef || internalInputRef;

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const sidebarOpen = propSidebarOpen !== undefined ? propSidebarOpen : settings.sidebarOpen;
  const toggleSidebar = propToggleSidebar || settings.toggleSidebar;
  const theme = propTheme !== undefined ? propTheme : settings.theme;
  const setTheme = propSetTheme || settings.setTheme;
  const mode = propMode !== undefined ? propMode : settings.mode;
  const setMode = propSetMode || settings.setMode;

  const isFullscreen = propIsFullscreen !== undefined ? propIsFullscreen : fullscreen.isFullscreen;
  const toggleFullscreen = propToggleFullscreen || fullscreen.toggleFullscreen;

  const selectedShelf = propSelectedShelf !== undefined ? propSelectedShelf : libraryData?.selectedShelf;
  const activeLibraryId = propActiveLibraryId !== undefined ? propActiveLibraryId : libraryData?.activeLibraryId;
  const activeLibraryObj = propActiveLibraryObj !== undefined ? propActiveLibraryObj : libraryData?.activeLibraryObj;
  const isTagFilter = propIsTagFilter !== undefined ? propIsTagFilter : libraryData?.isTagFilter;
  const currentTagObj = propCurrentTagObj !== undefined ? propCurrentTagObj : libraryData?.currentTagObj;
  const currentShelfObj = propCurrentShelfObj !== undefined ? propCurrentShelfObj : libraryData?.currentShelfObj;
  const searchQuery = propSearchQuery !== undefined ? propSearchQuery : (libraryData?.searchQuery || '');
  const setSearchQuery = propSetSearchQuery || libraryData?.setSearchQuery;
  const sortBy = propSortBy !== undefined ? propSortBy : (libraryData?.sortBy || 'title_asc');
  const setSortBy = propSetSortBy || libraryData?.setSortBy;
  const formatFilter = propFormatFilter !== undefined ? propFormatFilter : (libraryData?.formatFilter || 'all');
  const setFormatFilter = propSetFormatFilter || libraryData?.setFormatFilter;
  const selectAllLibraries = propSelectAllLibraries || libraryData?.selectAllLibraries;
  const navigateToShelf = propNavigateToShelf || libraryData?.navigateToShelf;

  const isExpanded = isSearchOpen || Boolean(searchQuery);

  return (
    <header className="h-16 px-4 sm:px-6 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-30 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggleSidebar}
          className={`p-2 rounded-lg transition-colors border ${
            sidebarOpen 
              ? 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800' 
              : 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
          }`}
          title={sidebarOpen ? t('collapseSidebar') : t('expandSidebar')}
        >
          {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
        </button>

        {/* Breadcrumb / Current Shelf Title */}
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm sm:text-base font-bold text-neutral-100 truncate flex items-center gap-1.5">
            <button
              onClick={selectAllLibraries}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
              title={t('allLibraries')}
            >
              <Library className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="hidden sm:inline font-medium text-xs sm:text-sm">{t('backToLibraries')}</span>
            </button>
            <span className="text-neutral-600">/</span>

            <button
              onClick={() => navigateToShelf && navigateToShelf(null)}
              className={`flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer truncate ${
                !selectedShelf ? 'text-neutral-100' : 'text-neutral-400'
              }`}
              title={activeLibraryObj?.name || activeLibraryId}
            >
              <span className="font-semibold text-xs sm:text-sm truncate">
                {activeLibraryObj?.name || t('allBooks')}
              </span>
            </button>

            {selectedShelf && (
              <>
                <span className="text-neutral-600">/</span>
                <span className="truncate flex items-center gap-1.5 text-neutral-100 text-xs sm:text-sm">
                  {selectedShelf === 'continue-reading' ? (
                    <>
                      <Bookmark className="w-4 h-4 text-emerald-500 fill-emerald-500 shrink-0" />
                      <span>{t('continueReading')}</span>
                    </>
                  ) : selectedShelf === 'favorites' ? (
                    <>
                      <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
                      <span>{t('favorites')}</span>
                    </>
                  ) : selectedShelf === 'folders' ? (
                    <>
                      <Folder className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                      <span>{t('folders')}</span>
                    </>
                  ) : selectedShelf === 'all-books' ? (
                    <>
                      <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>{t('allBooksLibrary')}</span>
                    </>
                  ) : selectedShelf === 'tags' ? (
                    <>
                      <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>{t('tags')}</span>
                    </>
                  ) : isTagFilter ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigateToShelf && navigateToShelf('tags')}
                        className="hover:text-indigo-400 transition-colors flex items-center gap-1 text-neutral-400 cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>{t('tags')}</span>
                      </button>
                      <span className="text-neutral-600">/</span>
                      {currentTagObj ? (
                        <span className={`w-2.5 h-2.5 rounded-full ${getTagColorConfig(currentTagObj.color).dot} shrink-0`} />
                      ) : null}
                      <span>{currentTagObj ? currentTagObj.name : t('tagFilter')}</span>
                    </>
                  ) : (
                    <>
                      {currentShelfObj ? (
                        <ShelfIcon icon={currentShelfObj.icon} className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : null}
                      <span>{currentShelfObj ? currentShelfObj.name : selectedShelf}</span>
                    </>
                  )}
                </span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Action Controls: Search, Sort Selector, Format/Type Filter, Fullscreen & Settings */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Minimized Expandable Search Bar */}
        <div className="relative flex items-center">
          <div
            className={`relative flex items-center transition-all duration-200 ease-in-out ${
              isExpanded
                ? 'w-44 sm:w-60 md:w-72'
                : 'w-8 h-8'
            }`}
          >
            <input
              ref={effectiveInputRef}
              type="text"
              placeholder={isExpanded ? (t('searchPlaceholderShort') || "Search books... (/)") : ''}
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => {
                if (!searchQuery) setIsSearchOpen(false);
              }}
              onChange={(e) => setSearchQuery && setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  if (searchQuery) setSearchQuery && setSearchQuery('');
                  setIsSearchOpen(false);
                  effectiveInputRef.current?.blur();
                }
              }}
              className={`w-full py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all ${
                isExpanded
                  ? 'pl-8 pr-7 opacity-100 cursor-text shadow-inner'
                  : 'pl-8 pr-0 opacity-0 pointer-events-none cursor-pointer'
              }`}
              title={!isExpanded ? `${t('searchPlaceholder')} (/)` : undefined}
            />

            {/* Minimized Search Trigger Button */}
            {!isExpanded ? (
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(true);
                  effectiveInputRef.current?.focus();
                }}
                className="absolute inset-0 w-full h-full rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-amber-500/30 flex items-center justify-center transition shadow-sm cursor-pointer group"
                title={`${t('searchPlaceholder')} (/)`}
                aria-label={t('searchPlaceholder')}
              >
                <Search className="w-4 h-4" />
              </button>
            ) : (
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none z-10" />
            )}

            {/* Clear / Close Button when expanded */}
            {isExpanded && (
              <button
                type="button"
                onClick={() => {
                  if (searchQuery) setSearchQuery && setSearchQuery('');
                  setIsSearchOpen(false);
                  effectiveInputRef.current?.blur();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-0.5 rounded cursor-pointer z-10"
                title={searchQuery ? (t('clearSearch') || 'Clear') : (t('collapseSearch') || 'Close')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Name Ordering (Sort Selector) */}
        <div className="relative flex items-center">
          <select
            value={sortBy}
            onChange={(e) => setSortBy && setSortBy(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg px-2 sm:px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60 cursor-pointer"
            title={t('sortBy') || 'Sort order'}
          >
            <option value="title_asc">{t('sortNameAsc')}</option>
            <option value="title_desc">{t('sortNameDesc')}</option>
            <option value="size_desc">{t('sortSizeDesc')}</option>
            <option value="recent">{t('sortRecent')}</option>
          </select>
        </div>

        {/* Format / Type Filter next to Name Ordering */}
        <div className="relative flex items-center">
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter && setFormatFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs rounded-lg px-2 sm:px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60 cursor-pointer"
            title={t('filterFormat') || 'Filter by format'}
          >
            <option value="all">{t('allFormats') || 'All Formats'}</option>
            <option value="pdf">{t('formatPdf') || 'PDF'}</option>
            <option value="epub">{t('formatEpub') || 'EPUB'}</option>
          </select>
        </div>

        {/* Toggle Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-amber-500/30 transition shadow-sm cursor-pointer"
          title={t('fullscreenTitle')}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Themes Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => modals?.setThemeMenuOpen(prev => !prev)}
            className={`p-1.5 rounded-lg border transition shadow-sm cursor-pointer ${
              modals?.themeMenuOpen 
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-amber-500/30'
            }`}
            title={t('themes')}
            aria-label={t('themes')}
          >
            <Palette className="w-4 h-4" />
          </button>

          {modals?.themeMenuOpen && (
            <ThemeMenu
              currentTheme={theme}
              currentMode={mode}
              onSelectTheme={setTheme}
              onSelectMode={setMode}
              onClose={() => modals.setThemeMenuOpen(false)}
            />
          )}
        </div>

        {/* Settings Button */}
        <button
          onClick={() => modals?.setSettingsOpen(true)}
          className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-amber-500/30 transition shadow-sm cursor-pointer"
          title={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
