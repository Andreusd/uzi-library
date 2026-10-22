import React from 'react';
import ContinueReading from './ContinueReading';
import FavoriteBooks from './FavoriteBooks';
import ReadBooks from './ReadBooks';
import LibraryFolders from './LibraryFolders';
import LibraryTags from './LibraryTags';

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

const matchesTag = (tag, query) => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return Boolean(tag.name && tag.name.toLowerCase().includes(q));
};

const matchesBook = (book, query) => {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return Boolean(
    (book.title && book.title.toLowerCase().includes(q)) ||
    (book.author && book.author.toLowerCase().includes(q)) ||
    (book.folder_display && book.folder_display.toLowerCase().includes(q)) ||
    (book.shelf_display && book.shelf_display.toLowerCase().includes(q)) ||
    (book.tags && book.tags.some(t => t.name && t.name.toLowerCase().includes(q)))
  );
};

/**
 * Homepage carousels displayed when browsing the library root without an active shelf.
 * Renders Continue Reading, Favorite Books, Folders, and Tags carousels,
 * filtering items when search queries or format filters are active.
 * Book interactions are automatically provided via BookActionsContext.
 */
export default function LibraryHome({
  selectedShelf,
  debouncedQuery,
  formatFilter,
  continueReading = [],
  favorites = [],
  readBooks = [],
  shelves = [],
  tags = [],
  books = [],
  navigateToShelf,
  modals,
  onShelfContextMenu,
  onOpenTagManager,
  // Backwards-compatible optional prop overrides
  openReader,
  handleOpenDetails,
  handleToggleFavorite,
  showFileExtension,
}) {
  if (selectedShelf) {
    return null;
  }

  const isFormatFiltered = Boolean(formatFilter && formatFilter !== 'all');

  const displayContinueReading = React.useMemo(() => {
    if (!debouncedQuery) return continueReading;
    return continueReading.filter(book => matchesBook(book, debouncedQuery));
  }, [continueReading, debouncedQuery]);

  const displayFavorites = React.useMemo(() => {
    if (!debouncedQuery) return favorites;
    return favorites.filter(book => matchesBook(book, debouncedQuery));
  }, [favorites, debouncedQuery]);

  const displayReadBooks = React.useMemo(() => {
    if (!debouncedQuery) return readBooks;
    return readBooks.filter(book => matchesBook(book, debouncedQuery));
  }, [readBooks, debouncedQuery]);

  const displayShelves = React.useMemo(() => {
    let result = shelves;
    if (debouncedQuery) {
      result = result.filter(shelf => matchesFolder(shelf, debouncedQuery));
    }
    if (isFormatFiltered) {
      result = result
        .map(shelf => {
          const matchingBooks = books.filter(b => b.shelf === shelf.id || b.folder === shelf.id);
          return {
            ...shelf,
            book_count: matchingBooks.length,
            _covers: matchingBooks.slice(0, 4).map(b => b.cover_url)
          };
        })
        .filter(shelf => shelf.book_count > 0);
    }
    return result;
  }, [shelves, books, isFormatFiltered, debouncedQuery]);

  const displayTags = React.useMemo(() => {
    let result = tags;
    if (debouncedQuery) {
      result = result.filter(tag => matchesTag(tag, debouncedQuery));
    }
    if (isFormatFiltered) {
      result = result
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
    return result;
  }, [tags, books, isFormatFiltered, debouncedQuery]);

  const handleShelfContext = onShelfContextMenu || modals?.openShelfContextMenu;
  const handleOpenTags = onOpenTagManager || (() => modals?.openTagModal(null));

  return (
    <>
      {/* Continue Reading Shelf */}
      {displayContinueReading.length > 0 && (
        <ContinueReading 
          books={displayContinueReading} 
          onSelectBook={openReader} 
          onOpenDetails={handleOpenDetails}
          onContextMenu={modals?.openBookContextMenu}
          onViewAll={() => navigateToShelf && navigateToShelf('continue-reading')}
          onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
          showFileExtension={showFileExtension}
        />
      )}

      {/* Favorite Books Shelf */}
      {displayFavorites.length > 0 && (
        <FavoriteBooks
          books={displayFavorites}
          onSelectBook={openReader} 
          onOpenDetails={handleOpenDetails}
          onContextMenu={modals?.openBookContextMenu}
          onToggleFavorite={handleToggleFavorite}
          onViewAll={() => navigateToShelf && navigateToShelf('favorites')}
          onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
          showFileExtension={showFileExtension}
        />
      )}

      {/* Read Books Shelf */}
      {displayReadBooks.length > 0 && (
        <ReadBooks
          books={displayReadBooks}
          onSelectBook={openReader} 
          onOpenDetails={handleOpenDetails}
          onContextMenu={modals?.openBookContextMenu}
          onToggleFavorite={handleToggleFavorite}
          onViewAll={() => navigateToShelf && navigateToShelf('read-books')}
          onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
          showFileExtension={showFileExtension}
        />
      )}

      {/* Folders Carousel */}
      {displayShelves.length > 0 && (
        <LibraryFolders
          folders={displayShelves}
          books={books}
          onSelectFolder={(folderId) => navigateToShelf && navigateToShelf(folderId)}
          onContextMenu={handleShelfContext}
          onViewAll={() => navigateToShelf && navigateToShelf('folders')}
        />
      )}

      {/* Tags Carousel */}
      {displayTags.length > 0 && (
        <LibraryTags
          tags={displayTags}
          books={books}
          onSelectTag={(tg) => navigateToShelf && navigateToShelf(`tag:${tg.id}`)}
          onViewAll={() => navigateToShelf && navigateToShelf('tags')}
          onOpenTagManager={handleOpenTags}
        />
      )}
    </>
  );
}
