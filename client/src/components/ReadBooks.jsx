import React, { useRef, useState } from 'react';
import { BookCheck, ChevronLeft, ChevronRight, LayoutGrid, Layers } from 'lucide-react';
import BookCard from './BookCard';
import { useI18n } from '../i18n';

/**
 * ReadBooks carousel and grid view component for finished/completed books.
 * Book interactions are provided via BookActionsContext or optional explicit props.
 */
export default function ReadBooks({ 
  books = [], 
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

  return (
    <section id="read-books-section" className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookCheck className="w-5 h-5 text-teal-400" />
          {onViewAll ? (
            <button
              onClick={onViewAll}
              className="text-base font-semibold text-neutral-100 hover:text-teal-300 transition-colors cursor-pointer text-left"
              title={t('readBooks')}
            >
              <h2>{t('readBooks')}</h2>
            </button>
          ) : (
            <h2 className="text-base font-semibold text-neutral-100">{t('readBooks')}</h2>
          )}
          <span className="text-xs text-neutral-500 font-normal">
            {books.length === 1
              ? (t('readBooksCount_one') || t('readBooksCount', { count: 1 }))
              : t('readBooksCount', { count: books.length })}
          </span>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* Toggle View (Carousel / Grid) */}
            <button
              onClick={() => setIsGridView(prev => !prev)}
              className="text-xs font-medium text-neutral-400 hover:text-teal-300 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
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

      {/* Read Books Container */}
      <div
        ref={scrollContainerRef}
        className={
          isGridView
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6'
            : 'flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pt-4 pb-4 px-4 sm:px-5 -mt-3 -mx-4 sm:-mx-5 scroll-px-4 sm:scroll-px-5'
        }
      >
        {books.map((book) => (
          <div 
            key={`read-${book.id}`} 
            className={
              !isGridView 
                ? 'w-[calc((100%-1.25rem)/2)] sm:w-[calc((100%-3rem)/3)] md:w-[calc((100%-4.5rem)/4)] lg:w-[calc((100%-6rem)/5)] xl:w-[calc((100%-7.5rem)/6)] shrink-0' 
                : 'w-full'
            }
          >
            <BookCard
              book={book}
              cardId={`read-${book.id}`}
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
