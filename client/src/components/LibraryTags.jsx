import React, { useRef, useState } from 'react';
import { Tag, ChevronLeft, ChevronRight, LayoutGrid, Layers, Plus } from 'lucide-react';
import TagCard from './TagCard';
import { getTagCovers } from '../utils/tagColors';
import { useI18n } from '../i18n';

export default function LibraryTags({
  tags = [],
  books = [],
  onSelectTag,
  onViewAll,
  onOpenTagManager
}) {
  const { t } = useI18n();
  const scrollContainerRef = useRef(null);
  const [isGridView, setIsGridView] = useState(false);

  if (!tags || tags.length === 0) return null;

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = Math.max(200, Math.floor(scrollContainerRef.current.clientWidth * 0.75));
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const showControls = tags.length > 2;

  return (
    <section className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
          {onViewAll ? (
            <button
              onClick={onViewAll}
              className="text-base font-semibold text-neutral-100 hover:text-indigo-400 transition-colors cursor-pointer text-left"
              title={t('tags')}
            >
              <h2>{t('tags')}</h2>
            </button>
          ) : (
            <h2 className="text-base font-semibold text-neutral-100">{t('tags')}</h2>
          )}
          <span className="text-xs text-neutral-500 font-normal">
            {tags.length === 1
              ? (t('tagsCount_one') || '(1 tag)')
              : (t('tagsCount', { count: tags.length }) || `(${tags.length} tags)`)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTagManager && (
            <button
              type="button"
              onClick={onOpenTagManager}
              className="text-xs font-medium text-neutral-400 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
              title={t('manageTags')}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('manageTags')}</span>
            </button>
          )}

          {showControls && (
            <>
              {/* Toggle View (Carousel / Grid) */}
              <button
                onClick={() => setIsGridView(prev => !prev)}
                className="text-xs font-medium text-neutral-400 hover:text-indigo-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
                title={isGridView ? (t('showCarousel') || 'Show carousel') : (t('viewAll') || 'View all')}
              >
                {isGridView ? (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{t('showCarousel') || 'Show carousel'}</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{t('viewAll') || 'View all'}</span>
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
            </>
          )}
        </div>
      </div>

      {/* Tags Container */}
      <div
        ref={scrollContainerRef}
        className={
          isGridView
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6'
            : 'flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pt-4 pb-4 px-4 sm:px-5 -mt-3 -mx-4 sm:-mx-5 scroll-px-4 sm:scroll-px-5'
        }
      >
        {tags.map((tag) => {
          const covers = tag._covers !== undefined ? tag._covers : getTagCovers(tag, books);

          return (
            <div
              key={tag.id}
              className={
                !isGridView
                  ? 'w-[calc((100%-1.25rem)/2)] sm:w-[calc((100%-3rem)/3)] md:w-[calc((100%-4.5rem)/4)] lg:w-[calc((100%-6rem)/5)] xl:w-[calc((100%-7.5rem)/6)] shrink-0'
                  : 'w-full'
              }
            >
              <TagCard
                tag={tag}
                covers={covers}
                books={books}
                onSelectTag={onSelectTag}
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
