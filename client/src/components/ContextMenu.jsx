import React, { useEffect, useRef, useState } from 'react';
import { 
  BookOpen, Heart, RotateCcw, CheckCircle2, 
  Copy, Check, Tag, Info, Download,
  CloudDownload, CheckCircle, Loader2
} from 'lucide-react';
import { useI18n } from '../i18n';
import { isBookOffline, saveBookOffline, removeBookOffline } from '../services/offlineStorage';

export default function ContextMenu({ 
  x, 
  y, 
  book, 
  isFavorite,
  onClose, 
  onOpenReader, 
  onOpenDetails,
  onMarkStatus,
  onToggleFavorite,
  onManageTags
}) {
  const menuRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let active = true;
    if (book?.id) {
      isBookOffline(book.id).then((saved) => {
        if (active) setIsOffline(saved);
      });
    }
    return () => {
      active = false;
    };
  }, [book?.id]);

  // Close on outside click or scroll or escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Adjust coordinates to ensure the menu stays within viewport boundaries
  const menuWidth = 230;
  const menuHeight = 410;
  const posX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const posY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  const handleToggleOffline = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!book?.id || isSavingOffline) return;

    if (isOffline) {
      try {
        await removeBookOffline(book.id);
        setIsOffline(false);
      } catch (err) {
        console.error('Failed to remove book offline:', err);
      }
    } else {
      setIsSavingOffline(true);
      try {
        await saveBookOffline(book);
        setIsOffline(true);
      } catch (err) {
        console.error('Failed to save book offline:', err);
      } finally {
        setIsSavingOffline(false);
      }
    }
  };

  const handleCopyPath = () => {
    if (book?.path) {
      navigator.clipboard.writeText(book.path).then(() => {
        setCopied(true);
        setTimeout(() => {
          onClose();
        }, 800);
      });
    }
  };

  const isFav = isFavorite !== undefined ? isFavorite : Boolean(book?.is_favorite);
  const isCompleted = Boolean(
    book?.progress?.status === 'completed' || 
    (book?.progress?.percent && book.progress.percent >= 100)
  );
  const isEpub = Boolean(
    book?.format === 'epub' || 
    book?.filename?.toLowerCase().endsWith('.epub') || 
    book?.progress?.cfi
  );
  const hasReadingProgress = Boolean(
    book?.progress && (
      book.progress.status === 'in_progress' ||
      Boolean(book.progress.cfi) ||
      (book.progress.percent && book.progress.percent > 0) ||
      (!isEpub && book.progress.page && book.progress.page > 1)
    )
  );
  const isNotStarted = !isCompleted && !hasReadingProgress;

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 w-[230px] bg-neutral-900 border border-neutral-750 rounded-xl shadow-2xl py-1.5 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md select-none"
    >
      {/* Header with truncated title */}
      <div className="px-3 py-1.5 border-b border-neutral-800">
        <p className="font-semibold text-neutral-100 truncate text-[11px]" title={book.title}>
          {book.title}
        </p>
        <span className="text-[10px] text-amber-500 font-medium">{book.shelf_display}</span>
      </div>

      {/* Primary Actions */}
      <button
        onClick={() => {
          onOpenReader(book);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-amber-500/15 hover:text-amber-300 text-left transition"
      >
        <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{t('readNow')}</span>
      </button>

      <button
        onClick={() => {
          if (onToggleFavorite) onToggleFavorite(book);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-left transition"
      >
        <Heart className={`w-4 h-4 shrink-0 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'}`} />
        <span>{isFav ? t('removeFromFavorites') : t('addToFavorites')}</span>
      </button>

      <button
        onClick={() => {
          if (onOpenDetails) onOpenDetails(book);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-left transition"
      >
        <Info className="w-4 h-4 text-sky-400 shrink-0" />
        <span>{t('viewDetails')}</span>
      </button>

      <button
        onClick={() => {
          if (onManageTags) onManageTags(book);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-left transition"
      >
        <Tag className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{t('manageTags')}</span>
      </button>

      <div className="my-1 border-t border-neutral-800" />

      {/* Status Toggles */}
      <button
        onClick={() => {
          onMarkStatus(book, 'not_started');
          onClose();
        }}
        disabled={isNotStarted}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent text-left transition"
      >
        <RotateCcw className="w-4 h-4 text-sky-400 shrink-0" />
        <span>{t('markNotStarted')}</span>
      </button>

      <button
        onClick={() => {
          onMarkStatus(book, 'completed');
          onClose();
        }}
        disabled={isCompleted}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent text-left transition"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>{t('markCompleted')}</span>
      </button>

      <div className="my-1 border-t border-neutral-800" />

      {/* Copy Path Action */}
      <button
        onClick={handleCopyPath}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-left transition cursor-pointer"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-medium">{t('pathCopied')}</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-neutral-400 shrink-0" />
            <span>{t('copyFilePath')}</span>
          </>
        )}
      </button>

      {/* Download File Action */}
      {book?.id && (
        <a
          href={`/api/book-file/${encodeURIComponent(book.id)}`}
          download={book.filename || `${book.title}.${book.format || 'epub'}`}
          onClick={() => onClose()}
          className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-left transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>{t('downloadFile')}</span>
        </a>
      )}

      {/* Offline Storage Toggle */}
      {book?.id && (
        <button
          onClick={handleToggleOffline}
          disabled={isSavingOffline}
          className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 disabled:opacity-50 text-left transition cursor-pointer"
        >
          {isSavingOffline ? (
            <>
              <Loader2 className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
              <span className="text-amber-400">{t('downloadingOffline')}</span>
            </>
          ) : isOffline ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t('removeOffline')}</span>
            </>
          ) : (
            <>
              <CloudDownload className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{t('saveOffline')}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
