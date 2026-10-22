import React from 'react';
import { BookOpen, Folder, FolderOpen, Plus, Settings, Tag, CloudDownload } from 'lucide-react';
import BookCard from './BookCard';
import FolderCard from './FolderCard';
import TagCard from './TagCard';
import AllBooks from './AllBooks';
import { useI18n } from '../i18n';

const matchesFolder = (shelf, query) => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return Boolean(
    (shelf.name && shelf.name.toLowerCase().includes(q)) ||
    (shelf.custom_name && shelf.custom_name.toLowerCase().includes(q)) ||
    (shelf.original_name && shelf.original_name.toLowerCase().includes(q)) ||
    (shelf.folder && shelf.folder.toLowerCase().includes(q)) ||
    (shelf.id && shelf.id.toLowerCase().includes(q))
  );
};

/**
 * Main content body for the library view.
 * Renders folder grids, tag grids, loading skeletons, AllBooks carousel,
 * the active books grid, or appropriate empty/setup prompt states.
 * Book interactions are automatically provided via BookActionsContext.
 */
export default function LibraryContent({
  selectedShelf,
  debouncedQuery,
  formatFilter,
  setFormatFilter,
  shelves = [],
  tags = [],
  books = [],
  totalBooks = 0,
  loading = false,
  navigateToShelf,
  modals,
  setSearchQuery,
  // Backwards-compatible optional prop overrides
  favoriteIds,
  openReader,
  handleOpenDetails,
  handleToggleFavorite,
  showFileExtension,
}) {
  const { t } = useI18n();

  if (selectedShelf === 'folders') {
    let displayFolders = debouncedQuery
      ? shelves.filter(s => matchesFolder(s, debouncedQuery))
      : shelves;

    if (formatFilter && formatFilter !== 'all') {
      displayFolders = displayFolders
        .map(folder => {
          const matchingBooks = books.filter(b => b.shelf === folder.id || b.folder === folder.id);
          return {
            ...folder,
            book_count: matchingBooks.length,
            _covers: matchingBooks.slice(0, 4).map(b => b.cover_url)
          };
        })
        .filter(folder => folder.book_count > 0);
    }

    if (displayFolders.length === 0) {
      return (
        <div className="text-center py-20 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-neutral-600 mb-4">
            <Folder className="w-8 h-8 text-neutral-600" />
          </div>
          <h3 className="text-base font-semibold text-neutral-300">{t('noBooksFound')}</h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            {t('noBooksDesc')}
          </p>
          {formatFilter && formatFilter !== 'all' && (
            <button
              onClick={() => setFormatFilter && setFormatFilter('all')}
              className="mt-4 px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
            >
              {t('allFormats')}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
        {displayFolders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            covers={folder._covers}
            books={books}
            onSelectFolder={(folderId) => navigateToShelf && navigateToShelf(folderId)}
            onContextMenu={modals?.openShelfContextMenu}
            className="w-full"
          />
        ))}
      </div>
    );
  }

  if (selectedShelf === 'tags') {
    let displayTags = debouncedQuery
      ? tags.filter(tg => tg.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
      : tags;

    if (formatFilter && formatFilter !== 'all') {
      displayTags = displayTags
        .map(tag => {
          const matchingBooks = books.filter(b => b.tags && b.tags.some(t => t.id === tag.id));
          return {
            ...tag,
            book_count: matchingBooks.length,
            _covers: matchingBooks.slice(0, 4).map(b => b.cover_url)
          };
        })
        .filter(tag => tag.book_count > 0);
    }

    if (displayTags.length === 0) {
      return (
        <div className="text-center py-20 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
            <Tag className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-neutral-300">
            {debouncedQuery ? t('noBooksFound') : (t('noTagsFound') || 'No tags found')}
          </h3>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            {debouncedQuery ? t('noBooksDesc') : (t('noTagsDesc') || 'Create tags to organize and categorize your books across folders.')}
          </p>
          {formatFilter && formatFilter !== 'all' ? (
            <button
              onClick={() => setFormatFilter && setFormatFilter('all')}
              className="mt-4 px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
            >
              {t('allFormats')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => modals?.openTagModal(null)}
              className="mt-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500 text-white font-medium text-xs hover:bg-indigo-600 transition shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('createNewTag')}</span>
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
        {displayTags.map((tag) => (
          <TagCard
            key={tag.id}
            tag={tag}
            covers={tag._covers}
            books={books}
            onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
            className="w-full"
          />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="w-full aspect-[1/1.45] bg-neutral-900 rounded-md animate-pulse" />
            <div className="h-3.5 bg-neutral-900 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-neutral-900 rounded w-1/2 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!selectedShelf) {
    const hasMatchingFolders = debouncedQuery
      ? shelves.some(s => matchesFolder(s, debouncedQuery))
      : shelves.length > 0;
    const hasMatchingTags = debouncedQuery
      ? tags.some(t => t.name && t.name.toLowerCase().includes(debouncedQuery.toLowerCase().trim()))
      : tags.length > 0;

    if (books.length > 0) {
      return (
        <AllBooks
          books={books}
          favoriteIds={favoriteIds}
          onSelectBook={openReader}
          onOpenDetails={handleOpenDetails}
          onContextMenu={modals?.openBookContextMenu}
          onToggleFavorite={handleToggleFavorite}
          onViewAll={() => navigateToShelf && navigateToShelf('all-books')}
          onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
          showFileExtension={showFileExtension}
        />
      );
    }

    if (hasMatchingFolders || hasMatchingTags) {
      return null;
    }
  }

  if (books.length > 0) {

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
        {books.map((book) => (
          <BookCard
            key={book.id}
            cardId={`grid-${book.id}`}
            book={book}
            isFavorite={favoriteIds !== undefined ? favoriteIds.has(book.id) : undefined}
            onSelectBook={openReader}
            onOpenDetails={handleOpenDetails}
            onContextMenu={modals?.openBookContextMenu}
            onToggleFavorite={handleToggleFavorite}
            onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
            showFileExtension={showFileExtension}
          />
        ))}
      </div>
    );
  }

  if (totalBooks === 0 && !debouncedQuery && (!formatFilter || formatFilter === 'all')) {
    return (
      <div className="text-center py-20 flex flex-col items-center justify-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-neutral-100">{t('setupPromptTitle')}</h3>
        <p className="text-xs text-neutral-400 mt-2 mb-6 leading-relaxed">
          {t('setupPromptDesc')}
        </p>
        <button
          onClick={() => modals?.setSettingsOpen(true)}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-xl shadow-amber-500/20 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>{t('configureLibrary')}</span>
        </button>
      </div>
    );
  }

  if (selectedShelf === 'downloaded') {
    return (
      <div className="text-center py-20 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
          <CloudDownload className="w-8 h-8 text-sky-400" />
        </div>
        <h3 className="text-base font-semibold text-neutral-300">
          {debouncedQuery ? t('noBooksFound') : t('noOfflineBooks')}
        </h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          {debouncedQuery ? t('noBooksDesc') : t('noOfflineBooksDesc')}
        </p>
        <div className="flex items-center gap-2 mt-4">
          {formatFilter && formatFilter !== 'all' && (
            <button
              onClick={() => setFormatFilter && setFormatFilter('all')}
              className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
            >
              {t('allFormats')}
            </button>
          )}
          {debouncedQuery && (
            <button
              onClick={() => setSearchQuery && setSearchQuery('')}
              className="px-3 py-1.5 text-xs rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition cursor-pointer"
            >
              {t('clearSearch')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-20 flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center text-neutral-600 mb-4">
        <BookOpen className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-neutral-300">{t('noBooksFound')}</h3>
      <p className="text-xs text-neutral-500 mt-1 max-w-sm">
        {t('noBooksDesc')}
      </p>
      <div className="flex items-center gap-2 mt-4">
        {formatFilter && formatFilter !== 'all' && (
          <button
            onClick={() => setFormatFilter && setFormatFilter('all')}
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
          >
            {t('allFormats')}
          </button>
        )}
        {debouncedQuery && (
          <button
            onClick={() => setSearchQuery && setSearchQuery('')}
            className="px-3 py-1.5 text-xs rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition cursor-pointer"
          >
            {t('clearSearch')}
          </button>
        )}
      </div>
    </div>
  );
}
