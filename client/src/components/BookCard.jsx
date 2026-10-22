import React, { useState } from 'react';
import { BookOpen, CheckCircle, Heart, Info, CloudDownload } from 'lucide-react';
import { useI18n } from '../i18n';
import { useBookActions } from '../hooks/useBookActions';
import { getTagColorConfig } from '../utils/tagColors';

export default function BookCard({ 
  book, 
  cardId,
  isFavorite, 
  isHighlighted: propIsHighlighted,
  onSelectBook, 
  onOpenDetails, 
  onContextMenu, 
  onToggleFavorite, 
  onSelectTag, 
  showFileExtension 
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { t } = useI18n();
  const actions = useBookActions();

  const selectBook = onSelectBook || actions.openReader;
  const openDetails = onOpenDetails || actions.openDetails;
  const contextMenu = onContextMenu || actions.openContextMenu;
  const toggleFav = onToggleFavorite || actions.toggleFavorite;
  const selectTag = onSelectTag || actions.selectTag;

  const effectiveCardId = cardId || (book?.id ? `book-${book.id}` : null);
  const isHighlighted = propIsHighlighted !== undefined
    ? propIsHighlighted
    : Boolean(
        actions.highlightedCardId &&
        (actions.highlightedCardId === effectiveCardId ||
         (!cardId && actions.highlightedCardId === book?.id) ||
         actions.highlightedCardId === `book-${book?.id}`)
      );

  const isFav = isFavorite !== undefined 
    ? isFavorite 
    : (actions.isFavorite && book ? actions.isFavorite(book.id) : Boolean(book?.is_favorite));

  const isEpub = book.format === 'epub' || book.filename?.toLowerCase().endsWith('.epub');
  const isPdf = book.format === 'pdf' || book.filename?.toLowerCase().endsWith('.pdf') || !isEpub;
  const shouldShowExtension = showFileExtension !== undefined 
    ? Boolean(showFileExtension) 
    : (actions.showFileExtension !== undefined 
        ? actions.showFileExtension 
        : (() => {
            try {
              return localStorage.getItem('show_file_extension') !== 'false';
            } catch {
              return true;
            }
          })());

  const isFinished = Boolean(book.progress && (book.progress.percent >= 100 || book.progress.status === 'completed'));
  const hasReadingProgress = Boolean(
    book.progress && (
      book.progress.status === 'in_progress' ||
      Boolean(book.progress.cfi) ||
      (book.progress.percent && book.progress.percent > 0) ||
      (!isEpub && book.progress.page && book.progress.page > 1)
    )
  );
  const isNotStarted = !isFinished && !hasReadingProgress;
  const hasProgress = !isNotStarted && (hasReadingProgress || isFinished);
  const calcPercent = (book.progress?.total_pages > 1 && book.progress?.page > 0 && !book.progress?.cfi)
    ? Math.round((book.progress.page / book.progress.total_pages) * 100)
    : (book.progress?.percent !== undefined ? Math.round(book.progress.percent) : 0);
  const percent = Math.min(100, Math.max(0, calcPercent));

  const handleContextMenu = (e) => {
    if (contextMenu) {
      e.preventDefault();
      contextMenu(e, book);
    }
  };

  const handleClick = (e) => {
    const coverEl = e.currentTarget.querySelector('.book-cover-container') || e.currentTarget;
    const rect = coverEl.getBoundingClientRect();
    const originRect = {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
    };
    selectBook(book, originRect);
  };

  return (
    <div 
      data-book-id={book?.id}
      data-card-id={effectiveCardId}
      data-book-card="true"
      data-nav-card="true"
      data-highlighted={isHighlighted ? "true" : undefined}
      tabIndex={0}
      role="button"
      aria-label={book?.title}
      aria-selected={isHighlighted}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`book-card group cursor-pointer flex flex-col items-center select-none text-left transition-transform duration-200 focus:outline-none scroll-mt-24 ${
        isHighlighted ? 'scale-[1.03] z-10' : ''
      }`}
    >
      {/* 3D Cover Wrapper */}
      <div className={`relative w-full aspect-[1/1.45] rounded-md overflow-hidden bg-neutral-900 border shadow-md book-cover-container transition-all duration-200 ${
        isHighlighted
          ? 'border-amber-400 ring-4 ring-amber-400/90 ring-offset-2 ring-offset-neutral-950 shadow-2xl shadow-amber-500/40 -translate-y-1'
          : 'border-neutral-800/80 group-hover:border-neutral-700'
      }`}>
        
        {/* Skeleton loading animation */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-neutral-800 animate-pulse flex flex-col items-center justify-center p-4 text-center">
            <BookOpen className="w-8 h-8 text-neutral-600 mb-2" />
            <span className="text-[11px] text-neutral-500 line-clamp-3">{book.title}</span>
          </div>
        )}

        {/* Cover Image */}
        {!imageError ? (
          <img 
            src={book.cover_url} 
            alt={book.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900 p-4 flex flex-col justify-between border-l-4 border-amber-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500/80">{book.shelf_display || book.folder_display}</span>
            <p className="text-xs font-bold text-neutral-200 line-clamp-4 leading-snug">{book.title}</p>
            <span className="text-[10px] text-neutral-500">{book.size_formatted}</span>
          </div>
        )}

        {/* Realistic Left Book Spine Highlight / Shadow Overlay */}
        <div className="absolute inset-y-0 left-0 w-4 book-spine-highlight pointer-events-none" />

        {/* Favorite Toggle Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (toggleFav) toggleFav(book);
          }}
          className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-md transition-all duration-200 z-20 cursor-pointer ${
            isFav 
              ? 'bg-neutral-900/90 text-rose-500 border border-rose-500/40 opacity-100 shadow-lg hover:scale-110' 
              : 'bg-neutral-900/80 text-neutral-400 hover:text-rose-400 hover:scale-110 border border-neutral-700/50 opacity-0 group-hover:opacity-100 shadow-md'
          }`}
          title={isFav ? t('removeFromFavorites') : t('addToFavorites')}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>

        {/* Reading Progress Badge / Ribbon */}
        {hasProgress && (
          <div className={`absolute top-2 right-2 bg-neutral-900/90 backdrop-blur-md border text-[10px] font-medium px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 ${
            isFinished ? 'border-emerald-500/50 text-emerald-300' : 'border-amber-500/30 text-amber-300'
          }`}>
            {isFinished ? (
              <>
                <CheckCircle className="w-3 h-3 text-emerald-400" />
                <span>{t('completed')}</span>
              </>
            ) : isEpub ? (
              <>
                <span>{percent}%</span>
              </>
            ) : (
              <>
                <span>{t('pageBadge', { page: book.progress.page })}</span>
                <span className="text-neutral-500">•</span>
                <span>{percent}%</span>
              </>
            )}
          </div>
        )}

        {/* Offline Saved Indicator Badge */}
        {book.is_offline && (
          <div 
            className="absolute bottom-2 left-2 p-1 rounded-md bg-neutral-900/90 backdrop-blur-md border border-sky-500/40 text-sky-400 shadow-md z-10"
            title={t('offlineBadge')}
          >
            <CloudDownload className="w-3 h-3" />
          </div>
        )}

        {/* Quick Hover Action Buttons */}
        <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-end justify-between p-2.5 pointer-events-none ${
          isHighlighted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
          {openDetails && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDetails(book);
              }}
              className="p-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-sky-300 border border-neutral-750 shadow-lg pointer-events-auto transition cursor-pointer active:scale-95"
              title={t('viewDetails')}
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold transition flex items-center gap-1 shadow-lg ml-auto pointer-events-auto">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('readButton')}</span>
          </div>
        </div>

        {/* Format Badge (EPUB / PDF) in Lower Right Corner of Cover */}
        {shouldShowExtension && (
          <div className="absolute bottom-2 right-2 z-10 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
            {isEpub && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-neutral-950/85 backdrop-blur-md border border-indigo-500/50 text-indigo-300 shadow-md uppercase">
                EPUB
              </span>
            )}
            {isPdf && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded bg-neutral-950/85 backdrop-blur-md border border-rose-500/50 text-rose-300 shadow-md uppercase">
                PDF
              </span>
            )}
          </div>
        )}

        {/* Subtle Bottom Reading Progress Bar */}
        {hasProgress && !isFinished && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-neutral-900/80">
            <div 
              className="h-full bg-amber-400"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Book Metadata Under Cover */}
      <div className="w-full mt-2.5 px-0.5">
        <h3 
          className={`text-xs font-medium transition-colors line-clamp-2 leading-snug ${
            isHighlighted ? 'text-amber-400 font-semibold' : 'text-neutral-200 group-hover:text-amber-400'
          }`}
          title={book.title}
        >
          {book.title}
        </h3>
        {book.author && (
          <p className="text-[11px] text-neutral-400 truncate mt-0.5" title={book.author}>
            {book.author}
          </p>
        )}

        {/* Virtual Tags Badges */}
        {book.tags && book.tags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {book.tags.slice(0, 2).map((tg) => {
              const cfg = getTagColorConfig(tg.color);
              return (
                <span
                  key={tg.id}
                  onClick={(e) => {
                    if (selectTag) {
                      e.stopPropagation();
                      selectTag(tg);
                    }
                  }}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium border ${cfg.badge} truncate max-w-[90px] hover:brightness-125 transition cursor-pointer`}
                  title={tg.name}
                >
                  {tg.name}
                </span>
              );
            })}
            {book.tags.length > 2 && (
              <span 
                className="text-[9px] px-1 py-0.5 rounded-md font-mono text-neutral-400 bg-neutral-900 border border-neutral-800"
                title={book.tags.slice(2).map(tg => tg.name).join(', ')}
              >
                +{book.tags.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-1 text-[11px] text-neutral-500">
          <span className="truncate max-w-[70%]">{book.shelf_display || book.folder_display}</span>
          <span className="shrink-0">{book.size_formatted}</span>
        </div>
      </div>
    </div>
  );
}
