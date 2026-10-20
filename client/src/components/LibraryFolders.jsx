import React, { useRef, useState } from 'react';
import { Folder, ChevronLeft, ChevronRight, LayoutGrid, Layers } from 'lucide-react';
import FolderCard from './FolderCard';
import { getFolderCovers } from '../utils/folderUtils';
import { useI18n } from '../i18n';

export default function LibraryFolders({
  folders = [],
  books = [],
  onSelectFolder,
  onContextMenu,
  onViewAll
}) {
  const { t } = useI18n();
  const scrollContainerRef = useRef(null);
  const [isGridView, setIsGridView] = useState(false);

  if (!folders || folders.length === 0) return null;

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = Math.max(200, Math.floor(scrollContainerRef.current.clientWidth * 0.75));
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const showControls = folders.length > 2;

  return (
    <section className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-amber-500 fill-amber-500" />
          {onViewAll ? (
            <button
              onClick={onViewAll}
              className="text-base font-semibold text-neutral-100 hover:text-amber-400 transition-colors cursor-pointer text-left"
              title={t('folders')}
            >
              <h2>{t('folders')}</h2>
            </button>
          ) : (
            <h2 className="text-base font-semibold text-neutral-100">{t('folders')}</h2>
          )}
          <span className="text-xs text-neutral-500 font-normal">
            {t('foldersCount', { count: folders.length })}
          </span>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* Toggle View (Carousel / Grid) */}
            <button
              onClick={() => setIsGridView(prev => !prev)}
              className="text-xs font-medium text-neutral-400 hover:text-amber-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer"
              title={isGridView ? t('collapseFolders') : t('viewAllFolders')}
            >
              {isGridView ? (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t('collapseFolders')}</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t('viewAllFolders')}</span>
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

      {/* Folders Container */}
      <div
        ref={scrollContainerRef}
        className={
          isGridView
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6'
            : 'flex gap-5 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pt-4 pb-4 px-4 sm:px-5 -mt-3 -mx-4 sm:-mx-5 scroll-px-4 sm:scroll-px-5'
        }
      >
        {folders.map((folder) => {
          const covers = folder._covers !== undefined ? folder._covers : getFolderCovers(folder, books);

          return (
            <div
              key={folder.id}
              className={
                !isGridView
                  ? 'w-[calc((100%-1.25rem)/2)] sm:w-[calc((100%-3rem)/3)] md:w-[calc((100%-4.5rem)/4)] lg:w-[calc((100%-6rem)/5)] xl:w-[calc((100%-7.5rem)/6)] shrink-0'
                  : 'w-full'
              }
            >
              <FolderCard
                folder={folder}
                covers={covers}
                onSelectFolder={onSelectFolder}
                onContextMenu={onContextMenu}
                className="w-full h-full"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
