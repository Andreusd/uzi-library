import React, { useState, useRef } from 'react';
import {
  Library, Search, Folder, Heart, Bookmark, Home,
  ChevronDown, Check, Plus, Tag, User, BookOpen
} from 'lucide-react';
import ShelfIcon from './ShelfIcon';
import AppLogo from './AppLogo';
import { useI18n } from '../i18n';
import { getTagColorConfig } from '../utils/tagColors';

export default function Sidebar({
  shelves,
  totalBooks,
  favoriteCount = 0,
  continueReadingCount = 0,
  selectedShelf,
  onSelectShelf,
  onShelfContextMenu,
  isOpen,
  onClose,
  libraries = [],
  activeLibraryId = '',
  onSwitchLibrary,
  onSelectAllLibraries,
  onOpenSettings,
  tags = [],
  onOpenTagManager,
  currentUser = '',
  highlightedMenuItemId = null,
  isFoldersOpen: propIsFoldersOpen,
  setIsFoldersOpen: propSetIsFoldersOpen,
  isTagsOpen: propIsTagsOpen,
  setIsTagsOpen: propSetIsTagsOpen,
  isLibraryDropdownOpen: propIsLibraryDropdownOpen,
  setIsLibraryDropdownOpen: propSetIsLibraryDropdownOpen,
}) {
  const [shelfFilter, setShelfFilter] = useState('');
  const [internalLibraryDropdownOpen, setInternalLibraryDropdownOpen] = useState(false);
  const libraryDropdownOpen = propIsLibraryDropdownOpen !== undefined
    ? propIsLibraryDropdownOpen
    : internalLibraryDropdownOpen;
  const setLibraryDropdownOpen = propSetIsLibraryDropdownOpen || setInternalLibraryDropdownOpen;
  const shelfFilterInputRef = useRef(null);

  const [internalFoldersOpen, setInternalFoldersOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_folders_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [internalTagsOpen, setInternalTagsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_tags_open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const isFoldersOpen = propIsFoldersOpen !== undefined ? propIsFoldersOpen : internalFoldersOpen;
  const setIsFoldersOpen = propSetIsFoldersOpen || setInternalFoldersOpen;

  const isTagsOpen = propIsTagsOpen !== undefined ? propIsTagsOpen : internalTagsOpen;
  const setIsTagsOpen = propSetIsTagsOpen || setInternalTagsOpen;

  const { t } = useI18n();

  const toggleFoldersOpen = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const next = !isFoldersOpen;
    setIsFoldersOpen(next);
    try {
      localStorage.setItem('sidebar_folders_open', String(next));
    } catch { }
  };

  const toggleTagsOpen = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const next = !isTagsOpen;
    setIsTagsOpen(next);
    try {
      localStorage.setItem('sidebar_tags_open', String(next));
    } catch { }
  };

  const activeLibrary = libraries.find(l => l.id === activeLibraryId) || libraries[0];

  const filteredShelves = shelves.filter(s =>
    s.name.toLowerCase().includes(shelfFilter.toLowerCase())
  );

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(shelfFilter.toLowerCase())
  );

  const shouldShowFolders = isFoldersOpen || Boolean(shelfFilter.trim());
  const shouldShowTags = isTagsOpen || Boolean(shelfFilter.trim());

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-all duration-300 ease-in-out shrink-0 overflow-hidden
        lg:static lg:h-screen lg:sticky lg:top-0
        ${isOpen
          ? 'w-72 translate-x-0 opacity-100'
          : 'w-72 -translate-x-full opacity-0 pointer-events-none lg:w-0 lg:border-r-0'
        }
      `}>
        {/* Inner wrapper to keep content width consistent during smooth collapse animation */}
        <div className="w-72 flex flex-col h-full shrink-0">
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/40">
            <button
              onClick={() => {
                if (onSelectAllLibraries) onSelectAllLibraries();
              }}
              className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition cursor-pointer"
              title={t('allLibraries')}
            >
              <AppLogo className="w-9 h-9" />
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-neutral-100 tracking-tight truncate">{t('appTitle')}</h1>
                <p className="text-[11px] text-neutral-400 truncate">
                  {t('shelfCount', { books: totalBooks, folders: shelves.length })}
                </p>
              </div>
            </button>
          </div>

          {/* Library Switcher Selector */}
          <div className="p-3 border-b border-neutral-800/80 bg-neutral-900/20">
            <div className="relative">
              <button
                type="button"
                data-sidebar-item="true"
                data-item-id="menu-library-select"
                data-highlighted={highlightedMenuItemId === 'menu-library-select' ? 'true' : undefined}
                tabIndex={0}
                onClick={() => setLibraryDropdownOpen(!libraryDropdownOpen)}
                className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition cursor-pointer group ${
                  highlightedMenuItemId === 'menu-library-select'
                    ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                    : 'bg-neutral-950/70 hover:bg-neutral-800/80 border-neutral-800'
                }`}
                title={activeLibrary?.path || ''}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Folder className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider leading-none mb-0.5">{t('activeLibrary')}</p>
                    <p className="text-xs font-bold text-neutral-100 truncate group-hover:text-amber-300 transition">
                      {activeLibrary?.name || 'Library'}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 shrink-0 ml-1.5 ${libraryDropdownOpen ? 'rotate-180 text-amber-400' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {libraryDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLibraryDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-neutral-900 border border-neutral-750 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
                    {/* Switch to All Libraries selection */}
                    <button
                      type="button"
                      data-sidebar-item="true"
                      data-item-id="menu-lib-all"
                      data-highlighted={highlightedMenuItemId === 'menu-lib-all' ? 'true' : undefined}
                      tabIndex={0}
                      onClick={() => {
                        setLibraryDropdownOpen(false);
                        if (onSelectAllLibraries) onSelectAllLibraries();
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition text-left cursor-pointer border-b border-neutral-800/80 ${
                        highlightedMenuItemId === 'menu-lib-all'
                          ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                          : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                      }`}
                    >
                      <Library className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-semibold text-neutral-200">{t('allLibraries')}</span>
                    </button>

                    <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                      {t('libraries')} ({libraries.length})
                    </div>
                    <div className="max-h-56 overflow-y-auto py-0.5">
                      {libraries.map((lib) => {
                        const isSelected = lib.id === activeLibraryId;
                        const isHighlighted = highlightedMenuItemId === `menu-lib-${lib.id}`;
                        return (
                          <button
                            key={lib.id}
                            type="button"
                            data-sidebar-item="true"
                            data-item-id={`menu-lib-${lib.id}`}
                            data-highlighted={isHighlighted ? 'true' : undefined}
                            tabIndex={0}
                            onClick={() => {
                              setLibraryDropdownOpen(false);
                              if (onSwitchLibrary && !isSelected) {
                                onSwitchLibrary(lib.id);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition text-left cursor-pointer ${
                              isHighlighted
                                ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                                : isSelected
                                ? 'bg-amber-500/15 text-amber-300 font-semibold'
                                : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-neutral-500'}`} />
                              <span className="truncate">{lib.name}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-neutral-800 mt-1 pt-1 px-1">
                      <button
                        type="button"
                        data-sidebar-item="true"
                        data-item-id="menu-lib-manage"
                        data-highlighted={highlightedMenuItemId === 'menu-lib-manage' ? 'true' : undefined}
                        tabIndex={0}
                        onClick={() => {
                          setLibraryDropdownOpen(false);
                          if (onOpenSettings) onOpenSettings();
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer font-medium ${
                          highlightedMenuItemId === 'menu-lib-manage'
                            ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                            : 'text-amber-400 hover:bg-amber-500/15'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('manageLibraries')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Shelf / Folder Filter Input */}
          <div className="p-3 border-b border-neutral-800">
            <div
              data-sidebar-item="true"
              data-item-id="menu-filter-shelves"
              data-highlighted={highlightedMenuItemId === 'menu-filter-shelves' ? 'true' : undefined}
              tabIndex={0}
              className={`relative rounded-lg transition-all ${
                highlightedMenuItemId === 'menu-filter-shelves'
                  ? 'ring-2 ring-amber-400 border-amber-400 shadow-md'
                  : ''
              }`}
              onClick={() => shelfFilterInputRef.current?.focus()}
            >
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                highlightedMenuItemId === 'menu-filter-shelves' ? 'text-amber-400' : 'text-neutral-500'
              }`} />
              <input
                ref={shelfFilterInputRef}
                data-shelf-filter-input="true"
                type="text"
                placeholder={t('filterShelvesPlaceholder')}
                value={shelfFilter}
                onChange={(e) => setShelfFilter(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none transition-colors ${
                  highlightedMenuItemId === 'menu-filter-shelves'
                    ? 'border-amber-400 bg-neutral-850'
                    : 'border-neutral-800 focus:border-amber-500/50'
                }`}
              />
            </div>
          </div>

          {/* Folders List */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {/* All Books Option */}
            <button
              data-sidebar-item="true"
              data-item-id="menu-home"
              data-highlighted={highlightedMenuItemId === 'menu-home' ? 'true' : undefined}
              tabIndex={0}
              onClick={() => {
                onSelectShelf(null);
              }}
              className={`
                w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all
                ${highlightedMenuItemId === 'menu-home'
                  ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                  : selectedShelf === null
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
              `}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Home className={`w-4 h-4 shrink-0 ${selectedShelf === null ? 'text-amber-400' : 'text-neutral-400'}`} />
                <span className="truncate">{t('allBooks')}</span>
              </div>
              <span className={`
                text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold
                ${selectedShelf === null ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800 text-neutral-400'}
              `}>
                {totalBooks}
              </span>
            </button>

            {/* Continue Reading Option (if any) */}
            {continueReadingCount > 0 && (
              <button
                data-sidebar-item="true"
                data-item-id="menu-continue-reading"
                data-highlighted={highlightedMenuItemId === 'menu-continue-reading' ? 'true' : undefined}
                tabIndex={0}
                onClick={() => {
                  onSelectShelf('continue-reading');
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all
                  ${highlightedMenuItemId === 'menu-continue-reading'
                    ? 'ring-2 ring-amber-400 border-amber-400 bg-emerald-500/20 text-emerald-300 shadow-md'
                    : selectedShelf === 'continue-reading'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bookmark className={`w-4 h-4 shrink-0 ${selectedShelf === 'continue-reading' ? 'fill-emerald-500 text-emerald-500' : 'text-emerald-400'}`} />
                  <span className="truncate">{t('continueReading')}</span>
                </div>
                <span className={`
                  text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold
                  ${selectedShelf === 'continue-reading' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}
                `}>
                  {continueReadingCount}
                </span>
              </button>
            )}

            {/* Favorites Option (if any) */}
            {favoriteCount > 0 && (
              <button
                data-sidebar-item="true"
                data-item-id="menu-favorites"
                data-highlighted={highlightedMenuItemId === 'menu-favorites' ? 'true' : undefined}
                tabIndex={0}
                onClick={() => {
                  onSelectShelf('favorites');
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all
                  ${highlightedMenuItemId === 'menu-favorites'
                    ? 'ring-2 ring-amber-400 border-amber-400 bg-rose-500/20 text-rose-300 shadow-md'
                    : selectedShelf === 'favorites'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Heart className={`w-4 h-4 shrink-0 ${selectedShelf === 'favorites' ? 'fill-rose-500 text-rose-500' : 'text-rose-400'}`} />
                  <span className="truncate">{t('favorites')}</span>
                </div>
                <span className={`
                  text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold
                  ${selectedShelf === 'favorites' ? 'bg-rose-500/20 text-rose-300' : 'bg-neutral-800 text-neutral-400'}
                `}>
                  {favoriteCount}
                </span>
              </button>
            )}

            {/* Folders Dedicated Page Option & Collapsible Individual Folders */}
            {shelves.length > 0 && (
              <div>
                <div
                  data-sidebar-item="true"
                  data-item-id="menu-folders"
                  data-highlighted={highlightedMenuItemId === 'menu-folders' ? 'true' : undefined}
                  tabIndex={0}
                  onClick={() => {
                    onSelectShelf('folders');
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer
                    ${highlightedMenuItemId === 'menu-folders'
                      ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                      : selectedShelf === 'folders'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={toggleFoldersOpen}
                      className="p-1 -ml-1 rounded hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                      title={shouldShowFolders ? t('collapseAll') : t('expandAll')}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${shouldShowFolders ? '' : '-rotate-90'
                          }`}
                      />
                    </button>
                    <Folder className={`w-4 h-4 shrink-0 ${selectedShelf === 'folders' ? 'text-amber-400' : 'text-neutral-400'}`} />
                    <span className="truncate">{t('folders')}</span>
                  </div>

                  <span className={`
                    text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold shrink-0 ml-2
                    ${selectedShelf === 'folders' ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800 text-neutral-400'}
                  `}>
                    {shelves.length}
                  </span>
                </div>

                {/* Collapsible Children: Individual Folders */}
                {shouldShowFolders && (
                  <div className="mt-1 pl-3 border-l border-neutral-800 ml-4 space-y-0.5">
                    {filteredShelves.map((s) => {
                      const isSelected = selectedShelf === s.id;
                      const isItemHighlighted = highlightedMenuItemId === `menu-folder-${s.id}`;
                      return (
                        <button
                          key={s.id}
                          data-sidebar-item="true"
                          data-item-id={`menu-folder-${s.id}`}
                          data-highlighted={isItemHighlighted ? 'true' : undefined}
                          tabIndex={0}
                          onClick={() => {
                            onSelectShelf(s.id);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (onShelfContextMenu) {
                              onShelfContextMenu(e, s);
                            }
                          }}
                          className={`
                            w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                            ${isItemHighlighted
                              ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                              : isSelected
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
                          `}
                          title={s.custom_name ? `${s.name} (${t('originalFolderLabel', { folder: s.folder })})` : s.name}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ShelfIcon icon={s.icon} className={`w-3.5 h-3.5 shrink-0 ${isSelected || isItemHighlighted ? 'text-amber-400' : 'text-neutral-400'}`} />
                            <span className="truncate text-left">{s.name}</span>
                          </div>
                          <div className="flex items-center shrink-0 ml-2">
                            <span className={`
                              text-[10px] px-1.5 py-0.2 rounded font-mono
                              ${isSelected || isItemHighlighted ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800/80 text-neutral-400'}
                            `}>
                              {s.book_count}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tags Dedicated Page Option & Collapsible Individual Tags */}
            <div>
              <div
                data-sidebar-item="true"
                data-item-id="menu-tags"
                data-highlighted={highlightedMenuItemId === 'menu-tags' ? 'true' : undefined}
                tabIndex={0}
                onClick={() => {
                  onSelectShelf('tags');
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer
                  ${highlightedMenuItemId === 'menu-tags'
                    ? 'ring-2 ring-amber-400 border-amber-400 bg-indigo-500/20 text-indigo-300 shadow-md'
                    : selectedShelf === 'tags'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={toggleTagsOpen}
                    className="p-1 -ml-1 rounded hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                    title={shouldShowTags ? t('collapseAll') : t('expandAll')}
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${shouldShowTags ? '' : '-rotate-90'
                        }`}
                    />
                  </button>
                  <Tag className={`w-4 h-4 shrink-0 ${selectedShelf === 'tags' ? 'text-indigo-400' : 'text-neutral-400'}`} />
                  <span className="truncate">{t('tags')}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {onOpenTagManager && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTagManager();
                      }}
                      className="p-1 rounded text-neutral-400 hover:text-indigo-400 hover:bg-neutral-700/60 transition cursor-pointer"
                      title={t('manageTags')}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className={`
                    text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold
                    ${selectedShelf === 'tags' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-neutral-800 text-neutral-400'}
                  `}>
                    {tags.length}
                  </span>
                </div>
              </div>

              {/* Collapsible Children: Individual Tags */}
              {shouldShowTags && (
                <div className="mt-1 pl-3 border-l border-neutral-800 ml-4 space-y-0.5">
                  {filteredTags.map((tg) => {
                    const tagShelfKey = `tag:${tg.id}`;
                    const isSelected = selectedShelf === tagShelfKey;
                    const isItemHighlighted = highlightedMenuItemId === `menu-tag-${tg.id}`;
                    const cfg = getTagColorConfig(tg.color);

                    return (
                      <button
                        key={tg.id}
                        data-sidebar-item="true"
                        data-item-id={`menu-tag-${tg.id}`}
                        data-highlighted={isItemHighlighted ? 'true' : undefined}
                        tabIndex={0}
                        onClick={() => {
                          onSelectShelf(tagShelfKey);
                        }}
                        className={`
                          w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                          ${isItemHighlighted
                            ? 'ring-2 ring-amber-400 border-amber-400 bg-indigo-500/20 text-indigo-300 shadow-md'
                            : isSelected
                            ? `${cfg.activeBg} border`
                            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
                        `}
                        title={tg.name}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0`} />
                          <span className="truncate text-left">{tg.name}</span>
                        </div>
                        <div className="flex items-center shrink-0 ml-2">
                          <span className={`
                            text-[10px] px-1.5 py-0.2 rounded font-mono
                            ${isSelected || isItemHighlighted ? cfg.badge : 'bg-neutral-800/80 text-neutral-400'}
                          `}>
                            {tg.book_count || 0}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* All Books Dedicated Page Option */}
            <button
              data-sidebar-item="true"
              data-item-id="menu-all-books"
              data-highlighted={highlightedMenuItemId === 'menu-all-books' ? 'true' : undefined}
              tabIndex={0}
              onClick={() => {
                onSelectShelf('all-books');
              }}
              className={`
                w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${highlightedMenuItemId === 'menu-all-books'
                  ? 'ring-2 ring-amber-400 border-amber-400 bg-sky-500/20 text-sky-300 shadow-md'
                  : selectedShelf === 'all-books'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
              `}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <BookOpen className={`w-4 h-4 shrink-0 ${selectedShelf === 'all-books' ? 'text-sky-400 fill-sky-400/20' : 'text-neutral-400'}`} />
                <span className="truncate">{t('allBooksLibrary')}</span>
              </div>
              <span className={`
                text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold
                ${selectedShelf === 'all-books' ? 'bg-sky-500/20 text-sky-300' : 'bg-neutral-800 text-neutral-400'}
              `}>
                {totalBooks}
              </span>
            </button>
          </nav>
        </div>

        {/* User Profile Footer (Read-Only) */}
        {currentUser && (
          <div className="p-3 border-t border-neutral-800 bg-neutral-900/60 shrink-0">
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-neutral-950/80 border border-neutral-800/80">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    {t('whoIsReading')}
                  </span>
                  <span className="text-xs font-bold text-neutral-200 block truncate" title={currentUser}>
                    {currentUser}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onSelectAllLibraries}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer shrink-0 hover:underline px-1.5 py-0.5"
                title={t('changeUserAtHome')}
              >
                {t('changeUser')}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
