import React from 'react';
import { Plus } from 'lucide-react';
import { getTagColorConfig } from '../utils/tagColors';
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
 * Section header displaying the current shelf, folder, or tag title,
 * matching item counts or search result statistics, and action buttons.
 */
export default function ShelfHeader({
  selectedShelf,
  debouncedQuery,
  formatFilter,
  shelves,
  tags,
  books,
  totalBooks,
  isTagFilter,
  currentTagObj,
  currentShelfObj,
  onOpenTagManager,
}) {
  const { t } = useI18n();

  if (!selectedShelf) {
    return null;
  }

  const isFormatFiltered = formatFilter && formatFilter !== 'all';
  const formatBadge = isFormatFiltered ? formatFilter.toUpperCase() : null;

  return (
    <div className="flex items-center justify-between mb-6 pb-2 border-b border-neutral-800">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-neutral-100 tracking-tight flex items-center gap-2">
          {selectedShelf === 'continue-reading'
            ? t('continueReading')
            : selectedShelf === 'favorites' 
              ? t('favorites') 
              : selectedShelf === 'folders'
                ? t('folders')
                : selectedShelf === 'all-books'
                  ? t('allBooksLibrary')
                  : selectedShelf === 'tags'
                    ? t('tags')
                  : isTagFilter && currentTagObj
                    ? (
                      <>
                        <span className={`w-3 h-3 rounded-full ${getTagColorConfig(currentTagObj.color).dot} shrink-0`} />
                        <span>{currentTagObj.name}</span>
                      </>
                    )
                    : currentShelfObj 
                      ? currentShelfObj.name 
                      : t('allBooksLibrary')}
          {formatBadge && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
              {formatBadge}
            </span>
          )}
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          {debouncedQuery 
            ? t('searchResults', { 
                query: debouncedQuery, 
                count: selectedShelf === 'folders'
                  ? shelves.filter(s => matchesFolder(s, debouncedQuery)).length
                  : selectedShelf === 'tags'
                    ? tags.filter(tg => tg.name && tg.name.toLowerCase().includes(debouncedQuery.toLowerCase().trim())).length
                    : books.length 
              })
            : selectedShelf === 'folders'
              ? t('foldersCount', { count: shelves.length })
              : (selectedShelf === 'all-books' || (!selectedShelf && isFormatFiltered))
                ? t('allBooksCount', { count: isFormatFiltered ? books.length : (totalBooks || books.length) })
                : selectedShelf === 'tags'
                  ? (tags.length === 1 ? (t('tagsCount_one') || '(1 tag)') : (t('tagsCount', { count: tags.length }) || `(${tags.length} tags)`))
                : isTagFilter
                  ? t('booksTaggedCount', { count: books.length })
                  : t('booksInShelf', { count: books.length })}
        </p>
      </div>

      {selectedShelf === 'tags' && (
        <button
          type="button"
          onClick={onOpenTagManager}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('manageTags')}</span>
        </button>
      )}
    </div>
  );
}
