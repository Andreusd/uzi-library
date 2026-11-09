import React, { useState, useEffect, useRef } from 'react';
import { FolderEdit, RotateCcw, Palette } from 'lucide-react';
import ShelfIcon from './ShelfIcon';
import { useI18n } from '../i18n';

export default function ShelfContextMenu({ 
  x, 
  y, 
  shelf, 
  onClose, 
  onOpenRename,
  onOpenIconModal,
  onResetName 
}) {
  const menuRef = useRef(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll('button:not(:disabled)') || []
        );
        if (items.length === 0) return;
        setFocusedIndex((prev) => {
          if (e.key === 'ArrowDown') {
            return (prev + 1) % items.length;
          } else {
            return (prev - 1 + items.length) % items.length;
          }
        });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll('button:not(:disabled)') || []
        );
        if (items[focusedIndex]) {
          items[focusedIndex].click();
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, focusedIndex]);

  // Apply visual focus ring when navigating with arrows
  useEffect(() => {
    if (focusedIndex >= 0 && menuRef.current) {
      const items = Array.from(
        menuRef.current.querySelectorAll('button:not(:disabled)')
      );
      items.forEach((item, idx) => {
        if (idx === focusedIndex) {
          item.classList.add('bg-amber-500/20', 'text-amber-200', 'ring-1', 'ring-amber-500/50');
          item?.scrollIntoView?.({ block: 'nearest' });
        } else {
          item.classList.remove('bg-amber-500/20', 'text-amber-200', 'ring-1', 'ring-amber-500/50');
        }
      });
    }
  }, [focusedIndex]);

  const menuWidth = 220;
  const menuHeight = 160;
  const posX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const posY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 w-56 bg-neutral-900/95 backdrop-blur-xl border border-neutral-750 rounded-xl shadow-2xl py-1.5 text-xs text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Shelf header snippet */}
      <div className="px-3 py-1.5 border-b border-neutral-800/80 mb-1">
        <p className="font-semibold text-neutral-100 truncate text-[11px] leading-tight flex items-center gap-1.5">
          <ShelfIcon icon={shelf.icon} className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{shelf.name}</span>
        </p>
        <span className="text-[10px] text-neutral-400 font-mono">
          {t('folderLabel', { folder: shelf.folder })}
        </span>
      </div>

      {/* Choose Icon Action */}
      <button
        onClick={() => {
          onClose();
          onOpenIconModal(shelf);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-amber-500/15 hover:text-amber-300 text-left transition cursor-pointer"
      >
        <Palette className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{t('chooseShelfIcon')}</span>
      </button>

      {/* Rename Action */}
      <button
        onClick={() => {
          onClose();
          onOpenRename(shelf);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-amber-500/15 hover:text-amber-300 text-left transition cursor-pointer"
      >
        <FolderEdit className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{t('renameShelfVirtual')}</span>
      </button>

      {/* Reset Name Action (if customized) */}
      {shelf.custom_name && (
        <button
          onClick={() => {
            onClose();
            onResetName(shelf);
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2.5 hover:bg-neutral-800 text-neutral-300 hover:text-neutral-100 text-left transition"
        >
          <RotateCcw className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{t('restoreOriginalName')}</span>
        </button>
      )}
    </div>
  );
}
