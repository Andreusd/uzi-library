import React, { useState, useEffect } from 'react';
import { 
  X, BookOpen, Heart, 
  Tag, Copy, Check, FileText, Clock, 
  Folder, Layers, MessageSquare,
  CloudDownload, Download, Loader2, CheckCircle2
} from 'lucide-react';
import { useI18n } from '../i18n';
import { getTagColorConfig } from '../utils/tagColors';
import { isBookOffline, saveBookOffline, removeBookOffline } from '../services/offlineStorage';

export default function BookDetailsModal({
  isOpen,
  onClose,
  book,
  isFavorite,
  onOpenReader,
  onToggleFavorite,
  onMarkStatus,
  onManageTags,
  onSelectTag,
  _showFileExtension
}) {
  const { t } = useI18n();
  const [prevBook, setPrevBook] = useState(book);
  const [details, setDetails] = useState(book);
  const [copied, setCopied] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);

  if (book !== prevBook) {
    setPrevBook(book);
    setDetails(book);
  }

  useEffect(() => {
    let active = true;
    if (book?.id) {
      isBookOffline(book.id).then((saved) => {
        if (active) setIsOffline(saved);
      });
    }
    return () => { active = false; };
  }, [book?.id]);

  useEffect(() => {
    if (!isOpen || !book?.id) return;

    let active = true;
    fetch(`/api/book/${book.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch book details');
        return res.json();
      })
      .then(data => {
        if (active) setDetails(data);
      })
      .catch(err => {
        console.error('Error fetching book details:', err);
      });

    return () => { active = false; };
  }, [isOpen, book?.id]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !details) return null;

  const isFav = isFavorite !== undefined ? isFavorite : Boolean(details.is_favorite);
  const isEpub = details.format === 'epub' || details.filename?.toLowerCase().endsWith('.epub');
  const progress = details.progress || { page: 1, total_pages: details.total_pages || 1, percent: 0 };
  const calcPercent = (progress.total_pages > 1 && progress.page > 0 && !progress.cfi)
    ? Math.round((progress.page / progress.total_pages) * 100)
    : Math.round(progress.percent || 0);
  const percent = Math.min(100, Math.max(0, calcPercent));
  const isFinished = progress.status === 'completed' || percent >= 100;
  const isStarted = !isFinished && (progress.status === 'in_progress' || (progress.page && progress.page > 1) || (progress.percent && progress.percent > 0) || progress.cfi);
  const totalPages = details.total_pages || progress.total_pages || (isEpub ? 0 : 1);

  const handleCopyPath = () => {
    if (details.path) {
      navigator.clipboard.writeText(details.path).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleToggleOffline = async () => {
    if (!details?.id || isSavingOffline) return;
    if (isOffline) {
      try {
        await removeBookOffline(details.id);
        setIsOffline(false);
      } catch (err) {
        console.error('Failed to remove book offline:', err);
      }
    } else {
      setIsSavingOffline(true);
      try {
        await saveBookOffline(details);
        setIsOffline(true);
      } catch (err) {
        console.error('Failed to save book offline:', err);
      } finally {
        setIsSavingOffline(false);
      }
    }
  };

  const formatDate = (val) => {
    if (!val) return null;
    try {
      if (typeof val === 'number') {
        return new Date(val * 1000).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      return new Date(val).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150 text-neutral-100">
        
        {/* Top Header */}
        <div className="h-14 px-5 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 truncate">
                {t('bookDetails')}
              </h2>
              <p className="text-[11px] text-neutral-400 truncate">
                {details.shelf_display || details.folder_display}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
            title={t('cancel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Main Top Overview (Cover + Primary Info) */}
          <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            
            {/* Book Cover Card */}
            <div className="shrink-0 w-36 sm:w-44 flex flex-col items-center">
              <div className="relative w-full aspect-[1/1.45] rounded-lg overflow-hidden bg-neutral-950 border border-neutral-800 shadow-xl book-cover-container">
                <img 
                  src={details.cover_url} 
                  alt={details.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-y-0 left-0 w-3.5 book-spine-highlight pointer-events-none" />

                {/* Format Badge */}
                <div className="absolute bottom-2 right-2">
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded backdrop-blur-md border uppercase shadow-md ${
                    isEpub 
                      ? 'bg-indigo-950/85 border-indigo-500/50 text-indigo-300' 
                      : 'bg-rose-950/85 border-rose-500/50 text-rose-300'
                  }`}>
                    {isEpub ? 'EPUB' : 'PDF'}
                  </span>
                </div>
              </div>

              {/* Primary Action Buttons under Cover */}
              <div className="w-full mt-3 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenReader) onOpenReader(details);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t('readNow')}</span>
                </button>

                <div className="flex items-center gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => onToggleFavorite && onToggleFavorite(details)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer ${
                      isFav 
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400' 
                        : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300 hover:text-rose-400 hover:bg-neutral-800'
                    }`}
                    title={isFav ? t('removeFromFavorites') : t('addToFavorites')}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span className="truncate">{isFav ? t('favorites') : t('addToFavorites')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onManageTags && onManageTags(details)}
                    className="p-1.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 transition cursor-pointer"
                    title={t('manageTags')}
                  >
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Offline Availability Toggle */}
                <button
                  type="button"
                  onClick={handleToggleOffline}
                  disabled={isSavingOffline}
                  className={`w-full py-1.5 px-2 rounded-lg border text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    isOffline
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                      : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300 hover:text-sky-300 hover:bg-neutral-800'
                  }`}
                >
                  {isSavingOffline ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      <span className="text-amber-400">{t('downloadingOffline')}</span>
                    </>
                  ) : isOffline ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('removeOffline')}</span>
                    </>
                  ) : (
                    <>
                      <CloudDownload className="w-3.5 h-3.5 text-sky-400" />
                      <span>{t('saveOffline')}</span>
                    </>
                  )}
                </button>

                {/* Direct File Download */}
                {details?.id && (
                  <a
                    href={`/api/book-file/${encodeURIComponent(details.id)}`}
                    download={details.filename || `${details.title}.${details.format || 'epub'}`}
                    className="w-full py-1.5 px-2 rounded-lg border border-neutral-700/60 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{t('downloadFile')}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Book Meta & Reading Status Column */}
            <div className="flex-1 min-w-0 space-y-4 text-left">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-800 border border-neutral-700/70 text-amber-400">
                    <Folder className="w-3 h-3 text-amber-500" />
                    <span>{details.shelf_display || details.folder_display}</span>
                  </span>

                  {details.publisher && (
                    <span className="text-[11px] text-neutral-400">
                      • {details.publisher}
                    </span>
                  )}
                </div>

                <h1 className="text-lg sm:text-xl font-bold text-neutral-100 leading-snug break-words">
                  {details.title}
                </h1>

                {details.author ? (
                  <p className="text-sm font-medium text-amber-400/90 mt-1">
                    {details.author}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500 italic mt-0.5">
                    {t('authorUnknown') || 'Unknown Author'}
                  </p>
                )}
              </div>

              {/* Tags Section */}
              {details.tags && details.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {details.tags.map((tg) => {
                    const cfg = getTagColorConfig(tg.color);
                    return (
                      <span
                        key={tg.id}
                        onClick={() => {
                          onClose();
                          if (onSelectTag) onSelectTag(tg);
                        }}
                        className={`text-xs px-2 py-0.5 rounded-lg font-medium border ${cfg.badge} hover:brightness-125 transition cursor-pointer`}
                      >
                        #{tg.name}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Reading Progress Card */}
              <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('readingStats')}</span>
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                    isFinished 
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                      : isStarted 
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                  }`}>
                    {isFinished ? t('completed') : isStarted ? t('inProgress') : t('notStarted')}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${isFinished ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span>
                      {isEpub 
                        ? `${percent}% ${t('completed').toLowerCase()}`
                        : progress.page > 0 
                        ? `${t('pageBadge', { page: progress.page })} / ${totalPages > 1 ? totalPages : '?'}`
                        : t('neverRead')
                      }
                    </span>
                    <span className="font-mono font-medium text-neutral-300">{percent}%</span>
                  </div>
                </div>

                {/* Last Read Date & Status Actions */}
                <div className="pt-2 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {progress.updated_at 
                      ? `${t('lastRead')}: ${formatDate(progress.updated_at)}`
                      : t('neverRead')
                    }
                  </span>

                  {/* Mark status toggle button */}
                  {onMarkStatus && (
                    <button
                      type="button"
                      onClick={() => onMarkStatus(details, isFinished ? 'not_started' : 'completed')}
                      className="hover:text-amber-400 underline transition cursor-pointer"
                    >
                      {isFinished ? t('markNotStarted') : t('markCompleted')}
                    </button>
                  )}
                </div>
              </div>

              {/* Technical / File Information Card */}
              <div className="p-3.5 rounded-xl bg-neutral-950/50 border border-neutral-800/80 space-y-2">
                <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('fileInfo')}</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">{t('format')}</span>
                    <span className="font-medium text-neutral-200 uppercase">{details.format}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">{t('fileSize')}</span>
                    <span className="font-medium text-neutral-200">{details.size_formatted}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block uppercase tracking-wider">{t('totalPages')}</span>
                    <span className="font-medium text-neutral-200">{totalPages > 1 ? totalPages : (isEpub ? 'ePub Flow' : '1')}</span>
                  </div>
                </div>

                {/* File Path row with 1-click copy */}
                <div className="pt-2 border-t border-neutral-850 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-neutral-400 truncate max-w-[80%]" title={details.path}>
                    {details.path}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPath}
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-neutral-100 transition shrink-0 cursor-pointer"
                    title={t('copyFilePath')}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Synopsis & Overview Section */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('synopsis')}</span>
            </h3>

            {details.description ? (
              <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {details.description}
              </p>
            ) : (
              <p className="text-xs text-neutral-500 italic">
                {t('noSynopsis')}
              </p>
            )}
          </div>

          {/* Annotations & Notes Summary */}
          {details.annotations_count > 0 && (
            <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/80 space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('notesAndHighlights')}</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                  {details.annotations_count}
                </span>
              </div>

              {/* Show preview of first 2 annotations if available */}
              {details.annotations && details.annotations.length > 0 && (
                <div className="space-y-2 mt-2">
                  {details.annotations.slice(0, 2).map((ann) => (
                    <div 
                      key={ann.id} 
                      className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span>{ann.chapter || t('pageBadge', { page: ann.page })}</span>
                        <span className="capitalize">{ann.color}</span>
                      </div>
                      <blockquote className="italic text-neutral-300 line-clamp-2">
                        "{ann.text}"
                      </blockquote>
                      {ann.comment && (
                        <p className="text-amber-300/90 text-[11px]">
                          💬 {ann.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
