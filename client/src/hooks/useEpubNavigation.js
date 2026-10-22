import { useState, useRef, useEffect, useCallback } from 'react';
import { EpubCFI } from 'epubjs';
import { applyThemeToDoc } from '../utils/epubThemeUtils';

/**
 * Hook for managing EPUB navigation, keyboard shortcuts, wheel/touch gestures,
 * and header auto-hide behavior.
 */
export function useEpubNavigation({
  renditionRef,
  viewerRef,
  themeRef,
  tocOpen,
  setTocOpen,
  commentsDrawerOpen,
  setCommentsDrawerOpen,
  searchOpen,
  setSearchOpen,
  handleCloseSearch,
  ttsOpen,
  setTtsOpen,
  toggleTts,
  selectionMenu,
  setSelectionMenu,
  toggleFullscreen,
  cycleTheme,
  handleClose: propHandleClose,
  onClose: propOnClose,
}) {
  const handleClose = propHandleClose || propOnClose;
  const isNavigatingRef = useRef(false);
  const lastSwipeTimeRef = useRef(0);
  const accumulatedDeltaXRef = useRef(0);
  const clearSwipeTimerRef = useRef(null);
  const lastProcessedWheelEventRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchStartTimeRef = useRef(0);

  const handleTouchStartRef = useRef(null);
  const handleTouchEndRef = useRef(null);
  const handleNativeWheelRef = useRef(null);
  const attachListenersToIframeRef = useRef(null);
  const handleKeyDownRef = useRef(null);
  const handleIframeMouseMoveRef = useRef(null);

  // Reader Settings toggles
  const [readerSettingsOpen, setReaderSettingsOpen] = useState(false);
  const readerSettingsOpenRef = useRef(false);
  useEffect(() => {
    readerSettingsOpenRef.current = readerSettingsOpen;
  }, [readerSettingsOpen]);

  const [showBottomProgress, setShowBottomProgress] = useState(() => {
    try {
      return localStorage.getItem('reader_bottom_progress') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleBottomProgress = useCallback(() => {
    setShowBottomProgress(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_bottom_progress', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [trackpadSwipeEnabled, setTrackpadSwipeEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_trackpad_swipe') !== 'false';
    } catch {
      return true;
    }
  });
  const trackpadSwipeEnabledRef = useRef(trackpadSwipeEnabled);
  useEffect(() => {
    trackpadSwipeEnabledRef.current = trackpadSwipeEnabled;
  }, [trackpadSwipeEnabled]);

  const toggleTrackpadSwipe = useCallback(() => {
    setTrackpadSwipeEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_trackpad_swipe', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [floatingButtonsEnabled, setFloatingButtonsEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_floating_buttons') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleFloatingButtons = useCallback(() => {
    setFloatingButtonsEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_floating_buttons', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [upDownFlipEnabled, setUpDownFlipEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_up_down_flip') === 'true'; // false by default
    } catch {
      return false;
    }
  });
  const upDownFlipEnabledRef = useRef(upDownFlipEnabled);
  useEffect(() => {
    upDownFlipEnabledRef.current = upDownFlipEnabled;
  }, [upDownFlipEnabled]);

  const toggleUpDownFlip = useCallback(() => {
    setUpDownFlipEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_up_down_flip', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Header auto-hide & pinned state
  const [headerPinned, setHeaderPinned] = useState(() => {
    try {
      const saved = localStorage.getItem('reader_header_pinned');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const isHeaderVisibleRef = useRef(true);
  const hideTimerRef = useRef(null);
  const isMouseOverHeaderRef = useRef(false);
  const tocOpenRef = useRef(tocOpen);
  const commentsDrawerOpenRef = useRef(commentsDrawerOpen);
  const searchOpenRef = useRef(searchOpen);
  const ttsOpenRef = useRef(ttsOpen);

  useEffect(() => {
    isHeaderVisibleRef.current = isHeaderVisible;
  }, [isHeaderVisible]);

  useEffect(() => {
    tocOpenRef.current = tocOpen;
  }, [tocOpen]);

  useEffect(() => {
    commentsDrawerOpenRef.current = commentsDrawerOpen;
  }, [commentsDrawerOpen]);

  useEffect(() => {
    searchOpenRef.current = searchOpen;
  }, [searchOpen]);

  useEffect(() => {
    ttsOpenRef.current = ttsOpen;
  }, [ttsOpen]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const isAnyDrawerOpen = useCallback(() => (
    Boolean(
      tocOpenRef.current ||
      commentsDrawerOpenRef.current ||
      searchOpenRef.current ||
      ttsOpenRef.current ||
      readerSettingsOpenRef.current
    )
  ), []);

  const startHideTimer = useCallback((delay = 3000, reset = false) => {
    if (hideTimerRef.current && !reset) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      if (
        isMouseOverHeaderRef.current ||
        isAnyDrawerOpen()
      ) {
        return;
      }
      setIsHeaderVisible(false);
      isHeaderVisibleRef.current = false;
      hideTimerRef.current = null;
    }, delay);
  }, [clearHideTimer, isAnyDrawerOpen]);

  const showHeader = useCallback(() => {
    clearHideTimer();
    setIsHeaderVisible(true);
    isHeaderVisibleRef.current = true;
    if (!headerPinned) {
      startHideTimer(3500, true);
    }
  }, [clearHideTimer, headerPinned, startHideTimer]);

  const toggleHeaderPinned = useCallback(() => {
    setHeaderPinned(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_header_pinned', String(next));
      } catch {}
      if (next) {
        clearHideTimer();
        setIsHeaderVisible(true);
        isHeaderVisibleRef.current = true;
      } else {
        showHeader();
        if (!isMouseOverHeaderRef.current) {
          startHideTimer(3000, true);
        }
      }
      return next;
    });
  }, [clearHideTimer, showHeader, startHideTimer]);

  const onMouseEnterHeader = useCallback((e) => {
    if (!e || e.pointerType === 'mouse' || (!('touches' in e) && !('pointerType' in e))) {
      isMouseOverHeaderRef.current = true;
    }
    clearHideTimer();
  }, [clearHideTimer]);

  const onMouseLeaveHeader = useCallback(() => {
    isMouseOverHeaderRef.current = false;
    if (!headerPinned) {
      startHideTimer(2000, true);
    }
  }, [headerPinned, startHideTimer]);

  const onTouchStartHeader = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const onTouchEndHeader = useCallback(() => {
    isMouseOverHeaderRef.current = false;
    if (!headerPinned && !isAnyDrawerOpen()) {
      startHideTimer(3000, true);
    }
  }, [headerPinned, isAnyDrawerOpen, startHideTimer]);

  useEffect(() => {
    if (headerPinned) {
      clearHideTimer();
      return;
    }

    if (!isMouseOverHeaderRef.current) {
      startHideTimer(3000, true);
    }

    const handleMouseMove = (e) => {
      if (e.clientY <= 56) {
        showHeader();
      } else {
        if (isHeaderVisibleRef.current && !isMouseOverHeaderRef.current && !isAnyDrawerOpen()) {
          startHideTimer(3000, false);
        }
      }
    };

    const handleTouchStart = (e) => {
      const touch = e.touches?.[0];
      if (touch && touch.clientY <= 56) {
        showHeader();
      } else {
        isMouseOverHeaderRef.current = false;
        if (isHeaderVisibleRef.current && !headerPinned && !isAnyDrawerOpen()) {
          startHideTimer(2500, true);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      clearHideTimer();
    };
  }, [headerPinned, showHeader, startHideTimer, clearHideTimer, isAnyDrawerOpen]);

  // When drawers close, auto-hide header after delay if unpinned
  useEffect(() => {
    if (!headerPinned && !isAnyDrawerOpen() && isHeaderVisibleRef.current) {
      startHideTimer(2500, true);
    }
  }, [tocOpen, commentsDrawerOpen, searchOpen, ttsOpen, readerSettingsOpen, headerPinned, isAnyDrawerOpen, startHideTimer]);

  // Page flip controls
  const flipNext = useCallback(() => {
    if (isNavigatingRef.current || !renditionRef?.current) return;
    isNavigatingRef.current = true;
    try {
      const p = renditionRef.current.next();
      if (p && typeof p.then === 'function') {
        p.finally(() => {
          setTimeout(() => {
            isNavigatingRef.current = false;
          }, 180);
        });
      } else {
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, 250);
      }
    } catch {
      isNavigatingRef.current = false;
    }
  }, [renditionRef]);

  const flipPrev = useCallback(() => {
    if (isNavigatingRef.current || !renditionRef?.current) return;
    isNavigatingRef.current = true;
    try {
      const p = renditionRef.current.prev();
      if (p && typeof p.then === 'function') {
        p.finally(() => {
          setTimeout(() => {
            isNavigatingRef.current = false;
          }, 180);
        });
      } else {
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, 250);
      }
    } catch {
      isNavigatingRef.current = false;
    }
  }, [renditionRef]);

  // Gesture handling: Two-finger trackpad horizontal swipe & vertical wheel
  const handleNativeWheel = useCallback((e) => {
    if (lastProcessedWheelEventRef.current === e) return;
    lastProcessedWheelEventRef.current = e;

    if (e.target && typeof e.target.closest === 'function') {
      if (e.target.closest('.overflow-y-auto') || e.target.closest('[role="dialog"]') || e.target.closest('header')) {
        return;
      }
    }

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    const now = Date.now();

    if (absX > absY && absX > 2) {
      if (!trackpadSwipeEnabledRef.current) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();

      if (now - lastSwipeTimeRef.current > 450 && !isNavigatingRef.current) {
        accumulatedDeltaXRef.current += e.deltaX;

        if (clearSwipeTimerRef.current) clearTimeout(clearSwipeTimerRef.current);
        clearSwipeTimerRef.current = setTimeout(() => {
          accumulatedDeltaXRef.current = 0;
        }, 150);

        if (Math.abs(accumulatedDeltaXRef.current) > 42) {
          lastSwipeTimeRef.current = now;
          const dir = accumulatedDeltaXRef.current;
          accumulatedDeltaXRef.current = 0;
          if (dir > 0) {
            flipNext();
          } else {
            flipPrev();
          }
        }
      }
      return;
    }

    if (absY >= absX) {
      if (e.cancelable) e.preventDefault();
      return;
    }
  }, [flipNext, flipPrev]);

  useEffect(() => {
    handleNativeWheelRef.current = handleNativeWheel;
  }, [handleNativeWheel]);

  // Touch swipe
  const handleTouchStart = useCallback((e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchStartTimeRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    handleTouchStartRef.current = handleTouchStart;
  }, [handleTouchStart]);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStartXRef.current || !e.changedTouches || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const diffX = touchEndX - startX;
    const diffY = touchEndY - startY;
    const duration = Date.now() - touchStartTimeRef.current;

    touchStartXRef.current = 0;
    touchStartYRef.current = 0;

    // Never intercept touches that originated on the header, buttons, drawers, or interactive elements
    if (
      startY <= 60 ||
      e.target?.closest?.('header') ||
      e.target?.closest?.('button') ||
      e.target?.closest?.('aside') ||
      e.target?.closest?.('nav') ||
      e.target?.closest?.('[role="dialog"]')
    ) {
      return;
    }

    const anyOpen = isAnyDrawerOpen();

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && duration < 600) {
      if (diffX < 0) {
        flipNext();
      } else {
        flipPrev();
      }
      // When flipping pages on mobile, hide the header if unpinned
      if (!headerPinned && !anyOpen) {
        setIsHeaderVisible(false);
        isHeaderVisibleRef.current = false;
        clearHideTimer();
      }
    } else if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15 && duration < 350) {
      // Single tap on page
      if (anyOpen) {
        if (readerSettingsOpenRef.current) {
          setReaderSettingsOpen(false);
        }
        return;
      }

      if (isHeaderVisibleRef.current) {
        if (!headerPinned) {
          setIsHeaderVisible(false);
          isHeaderVisibleRef.current = false;
          clearHideTimer();
        }
      } else {
        showHeader();
      }
    }
  }, [flipNext, flipPrev, headerPinned, isAnyDrawerOpen, showHeader, clearHideTimer, setReaderSettingsOpen]);

  useEffect(() => {
    handleTouchEndRef.current = handleTouchEnd;
  }, [handleTouchEnd]);

  const handleIframeMouseMove = useCallback((e, contents) => {
    if (headerPinned) return;
    const iframe = contents?.document?.defaultView?.frameElement || viewerRef?.current?.querySelector('iframe');
    const iframeRect = iframe ? iframe.getBoundingClientRect() : { top: 56 };
    const windowClientY = iframeRect.top + e.clientY;

    if (windowClientY <= 56) {
      showHeader();
    } else {
      if (
        isHeaderVisibleRef.current &&
        !isMouseOverHeaderRef.current &&
        !tocOpenRef.current &&
        !commentsDrawerOpenRef.current &&
        !searchOpenRef.current &&
        !ttsOpenRef.current &&
        !readerSettingsOpenRef.current
      ) {
        startHideTimer(3000, false);
      }
    }
  }, [headerPinned, showHeader, startHideTimer, viewerRef]);

  useEffect(() => {
    handleIframeMouseMoveRef.current = handleIframeMouseMove;
  }, [handleIframeMouseMove]);

  // Helper to attach wheel, touch, and interaction listeners to an EPUB iframe
  const attachListenersToIframe = useCallback((doc, win, contents = null) => {
    if (!doc && !win) return;
    const targetDoc = doc || win?.document;
    const targetWin = win || doc?.defaultView;
    if (!targetDoc || !targetWin) return;

    // Apply active theme immediately
    applyThemeToDoc(targetDoc, themeRef.current);

    if (targetDoc._hasEpubListenersAttached) return;
    targetDoc._hasEpubListenersAttached = true;

    try {
      if (targetDoc.documentElement) {
        targetDoc.documentElement.style.overscrollBehavior = 'none';
      }
      if (targetDoc.body) {
        targetDoc.body.style.overscrollBehavior = 'none';
      }
    } catch {}

    const onWheel = (e) => {
      handleNativeWheelRef.current?.(e);
    };

    targetWin.addEventListener('wheel', onWheel, { passive: false, capture: true });
    targetDoc.addEventListener('wheel', onWheel, { passive: false, capture: true });
    targetWin.addEventListener('wheel', onWheel, { passive: false, capture: false });
    targetDoc.addEventListener('wheel', onWheel, { passive: false, capture: false });

    const onTouchStart = (e) => {
      handleTouchStartRef.current?.(e);
      isMouseOverHeaderRef.current = false;
      const touch = e.touches?.[0];
      if (touch) {
        const iframe = targetDoc.defaultView?.frameElement || viewerRef?.current?.querySelector('iframe');
        const iframeRect = iframe ? iframe.getBoundingClientRect() : { top: 56 };
        const windowTouchY = iframeRect.top + touch.clientY;
        if (windowTouchY <= 56) {
          showHeader();
        } else {
          if (isHeaderVisibleRef.current && !headerPinned && !isAnyDrawerOpen()) {
            startHideTimer(2500, true);
          }
        }
      }
    };

    const onTouchEnd = (e) => {
      handleTouchEndRef.current?.(e);
    };

    targetWin.addEventListener('touchstart', onTouchStart, { passive: true });
    targetDoc.addEventListener('touchstart', onTouchStart, { passive: true });
    targetWin.addEventListener('touchend', onTouchEnd, { passive: true });
    targetDoc.addEventListener('touchend', onTouchEnd, { passive: true });

    targetDoc.addEventListener('mousemove', (e) => {
      handleIframeMouseMoveRef.current?.(e, contents);
    });

    targetDoc.addEventListener('contextmenu', (e) => {
      const selection = targetWin.getSelection();
      const text = selection ? selection.toString().trim() : '';
      if (!text || selection.rangeCount === 0) return;

      const isTouchOrMobile = typeof window !== 'undefined' && (
        'ontouchstart' in window || 
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || 
        window.innerWidth < 768
      );

      const range = selection.getRangeAt(0);
      const clientRects = Array.from(range.getClientRects());
      const isInside = isTouchOrMobile || clientRects.length === 0 || clientRects.some(r => 
        e.clientX >= r.left - 12 && 
        e.clientX <= r.right + 12 && 
        e.clientY >= r.top - 8 && 
        e.clientY <= r.bottom + 8
      );
      if (!isInside) return;

      e.preventDefault();
      const iframe = targetDoc.defaultView?.frameElement || viewerRef?.current?.querySelector('iframe');
      const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
      let cfiRange = null;
      try {
        const cfiBase = contents?.cfiBase || contents?.section?.cfiBase;
        if (cfiBase) {
          cfiRange = new EpubCFI(range, cfiBase).toString();
        }
      } catch {}

      const rangeRect = range.getBoundingClientRect();
      const posX = (isTouchOrMobile || !e.clientX)
        ? (iframeRect.left + rangeRect.left + rangeRect.width / 2)
        : (iframeRect.left + e.clientX);
      const posY = (isTouchOrMobile || !e.clientY)
        ? (iframeRect.top + rangeRect.top)
        : (iframeRect.top + e.clientY);

      setSelectionMenu(prev => ({
        isOpen: true,
        x: posX,
        y: posY,
        text,
        cfi: cfiRange || prev.cfi
      }));
    });

    targetDoc.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        setSelectionMenu(prev => prev.isOpen ? { isOpen: false, x: 0, y: 0, text: '', cfi: null } : prev);
      }
    });

    // Mobile selection listener to automatically show highlight/note menu
    const handleSelectionChange = () => {
      const isTouchOrMobile = typeof window !== 'undefined' && (
        'ontouchstart' in window || 
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) || 
        window.innerWidth < 768
      );
      if (!isTouchOrMobile) return;

      setTimeout(() => {
        const selection = targetWin.getSelection();
        const text = selection ? selection.toString().trim() : '';
        if (!text || selection.rangeCount === 0) return;

        try {
          const range = selection.getRangeAt(0);
          const rangeRect = range.getBoundingClientRect();
          if (rangeRect.width === 0 && rangeRect.height === 0) return;

          const iframe = targetDoc.defaultView?.frameElement || viewerRef?.current?.querySelector('iframe');
          const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
          let cfiRange = null;
          try {
            const cfiBase = contents?.cfiBase || contents?.section?.cfiBase;
            if (cfiBase) {
              cfiRange = new EpubCFI(range, cfiBase).toString();
            }
          } catch {}

          const posX = iframeRect.left + rangeRect.left + (rangeRect.width / 2);
          const posY = iframeRect.top + rangeRect.top;

          setSelectionMenu(prev => ({
            isOpen: true,
            x: posX,
            y: posY,
            text,
            cfi: cfiRange || prev.cfi
          }));
        } catch {}
      }, 150);
    };

    targetDoc.addEventListener('selectionchange', handleSelectionChange);
  }, [showHeader, themeRef, viewerRef, setSelectionMenu]);

  useEffect(() => {
    attachListenersToIframeRef.current = attachListenersToIframe;
  }, [attachListenersToIframe]);

  // Window gesture listeners
  useEffect(() => {
    const onWheel = (e) => handleNativeWheel(e);
    const onTouchStart = (e) => handleTouchStart(e);
    const onTouchEnd = (e) => handleTouchEnd(e);

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleNativeWheel, handleTouchStart, handleTouchEnd]);

  // Keydown listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchOpen(true);
        showHeader();
        return;
      }

      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        toggleTts();
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (upDownFlipEnabledRef.current && e.key === 'ArrowDown')) {
        e.preventDefault();
        flipNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (upDownFlipEnabledRef.current && e.key === 'ArrowUp')) {
        e.preventDefault();
        flipPrev();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (readerSettingsOpenRef.current) {
          setReaderSettingsOpen(false);
        } else if (ttsOpenRef.current) {
          setTtsOpen(false);
        } else if (searchOpenRef.current) {
          handleCloseSearch();
        } else if (selectionMenu?.isOpen) {
          setSelectionMenu({ isOpen: false, x: 0, y: 0, text: '', cfi: null });
        } else if (commentsDrawerOpen) {
          setCommentsDrawerOpen(false);
        } else if (tocOpen) {
          setTocOpen(false);
        } else if (handleClose) {
          handleClose();
        }
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        cycleTheme();
      }
    };

    handleKeyDownRef.current = handleKeyDown;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commentsDrawerOpen,
    tocOpen,
    selectionMenu?.isOpen,
    handleClose,
    flipNext,
    flipPrev,
    showHeader,
    handleCloseSearch,
    toggleTts,
    toggleFullscreen,
    cycleTheme,
    setSearchOpen,
    setTtsOpen,
    setSelectionMenu,
    setCommentsDrawerOpen,
    setTocOpen,
  ]);

  const isHeaderShowing =
    headerPinned ||
    isHeaderVisible ||
    tocOpen ||
    commentsDrawerOpen ||
    searchOpen ||
    ttsOpen ||
    readerSettingsOpen;

  return {
    flipNext,
    flipPrev,
    headerPinned,
    isHeaderVisible,
    isHeaderShowing,
    showHeader,
    toggleHeaderPinned,
    onMouseEnterHeader,
    onMouseLeaveHeader,
    onTouchStartHeader,
    onTouchEndHeader,
    attachListenersToIframe,
    attachListenersToIframeRef,
    // Settings
    readerSettingsOpen,
    setReaderSettingsOpen,
    showBottomProgress,
    toggleBottomProgress,
    trackpadSwipeEnabled,
    toggleTrackpadSwipe,
    floatingButtonsEnabled,
    toggleFloatingButtons,
    upDownFlipEnabled,
    toggleUpDownFlip,
    // Internal refs
    handleNativeWheelRef,
    handleTouchStartRef,
    handleTouchEndRef,
    handleIframeMouseMoveRef,
    handleKeyDownRef,
  };
}
