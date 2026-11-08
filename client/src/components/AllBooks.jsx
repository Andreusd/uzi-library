import React, { useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, LayoutGrid, Layers } from 'lucide-react';
import BookCard from './BookCard';
import { useI18n } from '../i18n';

/**
 * AllBooks carousel and grid view component.
 * Book interactions are provided via BookActionsContext or optional explicit props.
 */
function AllBooks({
  books = [],
  favoriteIds,
  onSelectBook,
  onOpenDetails,
  onContextMenu,
  onToggleFavorite,
  onViewAll,
  onSelectTag,
  showFileExtension
}) {
  const { t } = useI18n();
  const scrollContainerRef = useRef(null);
  const [isGridView, setIsGridView] = useState(false);

  if (!books || books.length === 0) return null;

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = Math.max(200, Math.floor(scrollContainerRef.current.clientWidth * 0.75));
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const showControls = books.length > 2;

  const isFavoriteBook = (bookId) => {
    if (favoriteIds === undefined) return undefined;
    if (favoriteIds instanceof Set) {
      return favoriteIds.has(bookId);
    }
    if (Array.isArray(favoriteIds)) {
      return favoriteIds.includes(bookId);
    }
    return Boolean(favoriteIds?.[bookId]);
  };

  return (
    <section className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-500 fill-sky-500 shrink-0" />
          {onViewAll ? (
            <button
              onClick={onViewAll}
              className="text-base font-semibold text-neutral-100 hover:text-sky-400 transition-colors cursor-pointer text-left"
              title={t('allBooksLibrary')}
            >
              <h2>{t('allBooksLibrary')}</h2>
            </button>
          ) : (
            <h2 className="text-base font-semibold text-neutral-100">{t('allBooksLibrary')}</h2>
          )}
          <span className="text-xs text-neutral-500 font-normal">
            {t('allBooksCount', { count: books.length })}
          </span>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* Toggle View (Carousel / Grid) */}
            <button
              onClick={() => setIsGridView(prev => !prev)}
              className="text-xs font-medium text-neutral-400 hover:text-sky-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
              title={isGridView ? t('showCarousel') : t('viewAll')}
            >
              {isGridView ? (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t('showCarousel')}</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t('viewAll')}</span>
                </>
              )}
            </button>

            {/* Scroll Navigation Buttons (Only in carousel mode) */}
            {!isGridView && (
              <div className="flex items-center gap-1 pl-1 border-l border-neutral-800">
                <button
                  onClick={() => scroll('left')}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                  aria-label={t('scrollLeft')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => scroll('right')}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                  aria-label={t('scrollRight')}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Books Container */}
      <div
        ref={scrollContainerRef}
        className={
          isGridView
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8 4xl:grid-cols-10 5xl:grid-cols-12 gap-5 sm:gap-6'
            : 'flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pt-4 pb-4 px-4 sm:px-5 -mt-3 -mx-4 sm:-mx-5 scroll-px-4 sm:scroll-px-5'
        }
      >
        {books.map((book) => (
          <div
            key={`all-${book.id}`}
            className={
              !isGridView
                ? 'w-[calc((100%-1.25rem)/2)] sm:w-[calc((100%-3rem)/3)] md:w-[calc((100%-4.5rem)/4)] lg:w-[calc((100%-6rem)/5)] xl:w-[calc((100%-7.5rem)/6)] 2xl:w-[calc((100%-9rem)/7)] 3xl:w-[calc((100%-10.5rem)/8)] 4xl:w-[calc((100%-13.5rem)/10)] 5xl:w-[calc((100%-16.5rem)/12)] shrink-0'
                : 'w-full'
            }
          >
            <BookCard
              book={book}
              cardId={`all-${book.id}`}
              isFavorite={isFavoriteBook(book.id)}
              onSelectBook={onSelectBook}
              onOpenDetails={onOpenDetails}
              onContextMenu={onContextMenu}
              onToggleFavorite={onToggleFavorite}
              onSelectTag={onSelectTag}
              showFileExtension={showFileExtension}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export default React.memo(AllBooks);
