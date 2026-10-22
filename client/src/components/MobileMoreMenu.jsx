import React, { useRef, useEffect } from 'react';
import { Palette, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Compact dropdown menu on mobile for secondary actions:
 * Fullscreen toggle, Themes selection, and App Settings.
 */
export default function MobileMoreMenu({
  isOpen,
  onClose,
  onOpenTheme,
  onOpenSettings,
  isFullscreen,
  toggleFullscreen,
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
        className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl shadow-black/90 p-1.5 z-50 text-neutral-200 select-none backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
      >
        {toggleFullscreen && (
          <button
            type="button"
            onClick={() => {
              onClose();
              toggleFullscreen?.();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/80 transition-colors cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{t('exitFullscreen')}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{t('fullscreenTitle')}</span>
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenTheme?.();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/80 transition-colors cursor-pointer"
        >
          <Palette className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{t('themes')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSettings?.();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/80 transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>{t('settings')}</span>
        </button>
      </div>
    </>
  );
}
