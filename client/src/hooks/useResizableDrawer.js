import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to manage right-anchored resizable drawer sidebars.
 * Provides smooth dragging, touch support, persistence, window bounds constraints,
 * and quick-reset to default width.
 * Prevents child iframes from capturing mouse events during drag.
 */
export function useResizableDrawer({
  storageKey,
  defaultWidth = 380,
  minWidth = 260,
  maxWidth = 900,
}) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth) {
          const maxAllowed = Math.min(maxWidth, window.innerWidth - 20);
          return Math.max(minWidth, Math.min(parsed, maxAllowed));
        }
      }
    } catch {
      // ignore
    }
    return defaultWidth;
  });

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const currentWidthRef = useRef(width);

  // Keep ref synchronized with state
  useEffect(() => {
    currentWidthRef.current = width;
  }, [width]);

  const isCustomWidth = Math.abs(width - defaultWidth) > 6;

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth);
    currentWidthRef.current = defaultWidth;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [defaultWidth, storageKey]);

  const handleStartResize = useCallback((clientX) => {
    setIsResizing(true);
    startXRef.current = clientX;
    startWidthRef.current = currentWidthRef.current;
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handleStartResize(e.clientX);
  }, [handleStartResize]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      handleStartResize(e.touches[0].clientX);
    }
  }, [handleStartResize]);

  useEffect(() => {
    if (!isResizing) return;

    // Critical fix: disable pointer-events on all iframes (EPUB readers, PDFs, widgets)
    // so they do not swallow mousemove/mouseup events when dragging left over the book area!
    const iframes = Array.from(document.querySelectorAll('iframe'));
    const previousPointers = iframes.map((iframe) => iframe.style.pointerEvents);
    iframes.forEach((iframe) => {
      iframe.style.pointerEvents = 'none';
    });

    const handleMouseMove = (e) => {
      const delta = startXRef.current - e.clientX;
      const newWidth = startWidthRef.current + delta;
      const maxAllowed = Math.min(maxWidth, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 20);
      const clamped = Math.max(minWidth, Math.min(newWidth, maxAllowed));
      setWidth(clamped);
      currentWidthRef.current = clamped;
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 1) {
        const delta = startXRef.current - e.touches[0].clientX;
        const newWidth = startWidthRef.current + delta;
        const maxAllowed = Math.min(maxWidth, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 20);
        const clamped = Math.max(minWidth, Math.min(newWidth, maxAllowed));
        setWidth(clamped);
        currentWidthRef.current = clamped;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        if (Math.abs(currentWidthRef.current - defaultWidth) > 6) {
          localStorage.setItem(storageKey, currentWidthRef.current.toString());
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchcancel', handleMouseUp);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      // Restore iframe pointer-events
      iframes.forEach((iframe, i) => {
        iframe.style.pointerEvents = previousPointers[i] || '';
      });

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchcancel', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, minWidth, maxWidth, defaultWidth, storageKey]);

  // Adjust gracefully when window is resized below current drawer width
  useEffect(() => {
    const handleWindowResize = () => {
      setWidth((cur) => {
        const maxAllowed = Math.min(maxWidth, window.innerWidth - 20);
        if (cur > maxAllowed) return Math.max(minWidth, maxAllowed);
        return cur;
      });
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [minWidth, maxWidth]);

  return {
    width,
    isResizing,
    isCustomWidth,
    resetWidth,
    handleMouseDown,
    handleTouchStart,
  };
}

export default useResizableDrawer;
