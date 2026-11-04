import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, Search, X, ArrowUpRight, Trash2, 
  Edit3, Check, Copy, Download, FileText, RotateCcw 
} from 'lucide-react';
import { useI18n } from '../i18n';
import { useResizableDrawer } from '../hooks/useResizableDrawer';

const COLOR_MAP = {
  yellow: { border: 'border-amber-400', badge: 'bg-amber-400/20 text-amber-300' },
  green: { border: 'border-emerald-400', badge: 'bg-emerald-400/20 text-emerald-300' },
  blue: { border: 'border-sky-400', badge: 'bg-sky-400/20 text-sky-300' },
  purple: { border: 'border-purple-400', badge: 'bg-purple-400/20 text-purple-300' },
  rose: { border: 'border-rose-400', badge: 'bg-rose-400/20 text-rose-300' },
};

export default function CommentsDrawer({
  annotations = [],
  isOpen,
  onClose,
  onJumpToAnnotation,
  onUpdateComment,
  onDeleteAnnotation,
  book = null
}) {
  const { t } = useI18n();
  const [filterQuery, setFilterQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setHasEntered(true), 350);
      return () => clearTimeout(timer);
    } else {
      setHasEntered(false);
    }
  }, [isOpen]);

  const getMarkdownContent = () => {
    const title = book?.title || t('commentsAndHighlights');
    const author = book?.author || '';
    const dateStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let md = `# 📖 ${title}\n\n`;
    if (author) {
      md += `**Author:** ${author}  \n`;
    }
    md += `**Export Date:** ${dateStr}  \n`;
    md += `**Total Highlights & Notes:** ${annotations.length}\n\n`;
    md += `---\n\n`;

    const sorted = [...annotations].sort((a, b) => {
      const pageA = typeof a.page === 'number' ? a.page : 0;
      const pageB = typeof b.page === 'number' ? b.page : 0;
      return pageA - pageB;
    });

    sorted.forEach((ann, idx) => {
      const loc = ann.chapter || (ann.page ? `Page ${ann.page}` : `Item ${idx + 1}`);
      md += `### ${loc}\n\n`;
      if (ann.text) {
        md += `> ${ann.text.split('\n').join('\n> ')}\n\n`;
      }
      if (ann.comment) {
        md += `💬 **Note:** ${ann.comment}\n\n`;
      }
      if (ann.color) {
        const colorName = ann.color.charAt(0).toUpperCase() + ann.color.slice(1);
        md += `*Highlight: ${colorName}*\n\n`;
      }
      md += `---\n\n`;
    });

    return md;
  };

  const handleCopyMarkdown = () => {
    const md = getMarkdownContent();
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadMarkdown = () => {
    const md = getMarkdownContent();
    const safeTitle = (book?.title || 'book-notes').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${safeTitle}-notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return annotations;
    return annotations.filter(a => 
      (a.text || '').toLowerCase().includes(q) || 
      (a.comment || '').toLowerCase().includes(q)
    );
  }, [annotations, filterQuery]);

  const startEdit = (ann) => {
    setEditingId(ann.id);
    setEditText(ann.comment || '');
  };

  const saveEdit = (annId) => {
    if (onUpdateComment) {
      onUpdateComment(annId, editText.trim());
    }
    setEditingId(null);
  };

  const {
    width,
    isResizing,
    isCustomWidth,
    resetWidth,
    handleMouseDown,
    handleTouchStart,
  } = useResizableDrawer({
    storageKey: 'uzi-comments-drawer-width',
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 750,
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen drag overlay to ensure smooth dragging across entire window and over iframes */}
      {isResizing && (
        <div 
          className="fixed inset-0 z-[99999] cursor-col-resize select-none bg-transparent"
          style={{ pointerEvents: 'auto' }}
        />
      )}

      {/* Backdrop - transparent click-catcher so background stays unblurred, clicking outside closes it */}
      {!isResizing && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-30 bg-transparent"
        />
      )}

      {/* Slide-out Right Sidebar Drawer - floating overlay on top of the book */}
      <aside 
        style={{ width: `${width}px` }}
        onAnimationEnd={() => setHasEntered(true)}
        className={`
          fixed top-14 bottom-0 right-0 z-40 max-w-full bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-2xl shadow-black/80
          ${!hasEntered ? 'animate-slide-in-right' : ''}
          ${isResizing ? 'transition-none select-none' : 'transition-[width] duration-200 ease-in-out'}
        `}
      >
        {/* Left Drag Handle for Resizing */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onDoubleClick={resetWidth}
          className="absolute -left-2 top-0 bottom-0 w-4 cursor-col-resize z-50 group flex items-center justify-center select-none touch-none"
          title={t('resetWidth')}
        >
          <div className={`w-[2px] h-10 rounded-full transition-all duration-150 ${
            isResizing 
              ? 'bg-amber-400 opacity-100 scale-y-125 shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
              : 'bg-neutral-700/60 group-hover:bg-amber-400 group-hover:scale-y-125'
          }`} />
        </div>

        {/* Header */}
        <div className="h-12 px-4 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/50">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-xs font-bold text-neutral-100 uppercase tracking-wider truncate">
              {t('commentsAndHighlights')}
            </h2>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-amber-500/20 text-amber-300 font-semibold">
              {annotations.length}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Reset to default width button */}
            <button
              onClick={resetWidth}
              disabled={!isCustomWidth}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isCustomWidth
                  ? 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
                  : 'text-neutral-600 opacity-30 cursor-not-allowed'
              }`}
              title={t('resetWidth')}
              aria-label={t('resetWidth')}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
              title={t('hideComments')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Export & Actions Toolbar */}
        {annotations.length > 0 && (
          <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-1.5 shrink-0">
            <span className="text-[11px] font-medium text-neutral-400 flex items-center gap-1.5 truncate">
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('exportMarkdown')}</span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer active:scale-95"
                title={t('copyMarkdown')}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300 font-semibold">{t('markdownCopied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-neutral-400" />
                    <span>{t('copyMarkdown')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="px-2 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer active:scale-95"
                title={t('downloadMarkdown')}
              >
                <Download className="w-3 h-3" />
                <span>.md</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Input */}
        {annotations.length > 0 && (
          <div className="p-2.5 border-b border-neutral-800 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder={t('filterCommentsPlaceholder')}
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Annotations List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filtered.length > 0 ? (
            filtered.map((ann) => {
              const colorInfo = COLOR_MAP[ann.color] || COLOR_MAP.yellow;
              const isEditingThis = editingId === ann.id;

              return (
                <div
                  key={ann.id}
                  className={`
                    group bg-neutral-900/70 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-750 rounded-xl p-3 text-xs transition-all shadow-xs
                    border-l-3 ${colorInfo.border}
                  `}
                >
                  {/* Top Bar: Page Badge & Jump Button */}
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => onJumpToAnnotation && onJumpToAnnotation(ann)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 hover:bg-amber-500/20 text-neutral-300 hover:text-amber-300 transition cursor-pointer max-w-[180px]"
                      title={ann.chapter ? `Jump to ${ann.chapter}` : t('jumpToPage', { page: ann.page })}
                    >
                      <span className="truncate">{ann.chapter || t('pageBadge', { page: ann.page })}</span>
                      <ArrowUpRight className="w-3 h-3 text-amber-400 shrink-0" />
                    </button>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(ann)}
                        className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                        title={t('editComment')}
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteAnnotation && onDeleteAnnotation(ann.id)}
                        className="p-1 rounded hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                        title={t('deleteComment')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Highlighted Quote snippet */}
                  <blockquote 
                    onClick={() => onJumpToAnnotation && onJumpToAnnotation(ann)}
                    className="italic text-neutral-300 line-clamp-3 mb-2 cursor-pointer hover:text-amber-200 transition-colors leading-relaxed"
                  >
                    "{ann.text}"
                  </blockquote>

                  {/* Comment Note or Editor */}
                  {isEditingThis ? (
                    <div className="space-y-1.5 mt-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            saveEdit(ann.id);
                          }
                        }}
                        placeholder={t('addCommentPlaceholder')}
                        rows={2}
                        className="w-full p-2 text-xs bg-neutral-950 border border-neutral-750 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-400 text-[11px]"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          onClick={() => saveEdit(ann.id)}
                          className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-[11px] flex items-center gap-1"
                          title={`${t('saveComment')} (Ctrl+Enter)`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('saveComment')}</span>
                        </button>
                      </div>
                    </div>
                  ) : ann.comment ? (
                    <div className="mt-2 p-2 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-start gap-1.5">
                      <MessageSquare className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-neutral-200 whitespace-pre-wrap leading-relaxed">
                        {ann.comment}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="text-center py-14 px-4 text-neutral-500 text-xs">
              <MessageSquare className="w-7 h-7 mx-auto mb-2 opacity-30 text-neutral-400" />
              <p className="font-medium text-neutral-400 mb-1">{t('noCommentsYet')}</p>
              <p className="text-[11px] text-neutral-500 max-w-xs mx-auto leading-relaxed">
                {t('noCommentsDesc')}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
