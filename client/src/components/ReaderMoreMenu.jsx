import React, { useRef, useEffect } from 'react';
import {
  Search,
  Headphones,
  Heart,
  MessageSquare,
  Moon,
  Sun,
} from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Compact mobile menu dropdown for secondary reader actions:
 * Search in book, Read aloud (TTS), Favorites, Comments & Highlights, and Night mode.
 */
export default function ReaderMoreMenu({
  isOpen,
  onClose,
  theme = 'dark',
  // Search
  onToggleSearch,
  searchOpen,
  // TTS
  onToggleTts,
  ttsOpen,
  // Favorites
  onToggleFavorite,
  isFavorite,
  // Comments & Highlights
  onToggleComments,
  commentsDrawerOpen,
  annotationsCount = 0,
  // Night Mode (PDF)
  onToggleInvertColors,
  invertColors,
}) {
  const { t } = useI18n();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handleClickOutside);
    }, 10);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handleClickOutside);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isDark = theme === 'dark' || invertColors;
  const isSepia = theme === 'sepia' && !invertColors;

  const containerTheme = isDark
    ? 'bg-neutral-900 border-neutral-750 text-neutral-200 shadow-black/90'
    : isSepia
    ? 'bg-[#fbf0d9] border-[#d8c5a0] text-[#292014] shadow-neutral-900/15'
    : 'bg-white border-neutral-200 text-neutral-800 shadow-neutral-900/15';

  const itemHover = isDark
    ? 'hover:bg-neutral-800/80 text-neutral-300 hover:text-amber-300'
    : isSepia
    ? 'hover:bg-[#efe0c2]/80 text-[#5a4833] hover:text-[#292014]'
    : 'hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900';

  const cleanLabel = (str) => (str ? str.replace(/\s*\([^)]*\)$/, '').trim() : '');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        onTouchStart={onClose}
      />
      <div
        ref={menuRef}
        className={`absolute right-0 top-full mt-2 w-52 border rounded-2xl shadow-2xl p-1.5 z-50 select-none backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-0.5 ${containerTheme}`}
      >
        {/* Search in Book */}
        {onToggleSearch && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleSearch();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              searchOpen ? 'bg-amber-500/15 text-amber-400' : itemHover
            }`}
          >
            <Search className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="truncate">
              {searchOpen ? cleanLabel(t('searchClose')) : cleanLabel(t('searchInBook'))}
            </span>
          </button>
        )}

        {/* Read Aloud (TTS) */}
        {onToggleTts && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleTts();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              ttsOpen ? 'bg-amber-500/15 text-amber-400' : itemHover
            }`}
          >
            <Headphones className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="truncate">
              {ttsOpen ? t('stopSpeech') : (t('readAloud') || cleanLabel(t('readAloudTitle')))}
            </span>
          </button>
        )}

        {/* Favorite Toggle */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleFavorite();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${itemHover}`}
          >
            <Heart
              className={`w-4 h-4 shrink-0 ${
                isFavorite ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'
              }`}
            />
            <span className="truncate">
              {isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
            </span>
          </button>
        )}

        {/* Comments & Highlights */}
        {onToggleComments && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleComments();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              commentsDrawerOpen ? 'bg-amber-500/15 text-amber-400' : itemHover
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MessageSquare className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="truncate">
                {commentsDrawerOpen ? t('hideComments') : (t('commentsAndHighlights') || t('showComments'))}
              </span>
            </div>
            {annotationsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 shrink-0">
                {annotationsCount}
              </span>
            )}
          </button>
        )}

        {/* Night Mode Invert (PDF) */}
        {onToggleInvertColors && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onToggleInvertColors();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${itemHover}`}
          >
            {invertColors ? (
              <>
                <Sun className="w-4 h-4 shrink-0 text-amber-400" />
                <span className="truncate">{t('lightMode') || 'Modo Claro'}</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 shrink-0 text-amber-500" />
                <span className="truncate">{cleanLabel(t('nightModeTitle'))}</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}
