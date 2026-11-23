import { useState, useRef, useEffect, useCallback } from 'react';
import { EpubCFI } from 'epubjs';
import { applyThemeToDoc } from '../utils/epubThemeUtils';
import { normalizeRangeToTextNodes, sanitizeCfiRange } from '../utils/epubLocationUtils';
import { isLikelyTrackpad } from '../utils/trackpadUtils';

/**
 * Hook for managing EPUB navigation, keyboard shortcuts, wheel/touch gestures,
 * and header auto-hide behavior.
 */
export function useEpubNavigation({
  renditionRef,
  viewerRef,
  themeRef,
  fontFamilyRef,
  tocOpen,
  setTocOpen,
  commentsDrawerOpen,
  setCommentsDrawerOpen,
  copilotDrawerOpen = false,
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
  const lastWheelFlipTimeRef = useRef(0);
  const accumulatedDeltaYRef = useRef(0);
  const clearWheelTimerRef = useRef(null);
  const lastBoundaryFlipTimeRef = useRef(0);
  const accumulatedBoundaryDeltaRef = useRef(0);
  const clearBoundaryTimerRef = useRef(null);
  const lastProcessedWheelEventRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const touchLastYRef = useRef(null);
  const touchStartTimeRef = useRef(0);
  const touchHistoryRef = useRef([]);
  const inertiaRafIdRef = useRef(null);
  const activeScrollerRef = useRef(null);
  const isDraggingChapterScrollRef = useRef(false);
  const lastProcessedTouchMoveRef = useRef(null);
  const isTrackpadGestureRef = useRef(false);
  const resetTrackpadGestureTimerRef = useRef(null);

  const stopInertiaGlide = useCallback(() => {
    if (inertiaRafIdRef.current) {
      cancelAnimationFrame(inertiaRafIdRef.current);
      inertiaRafIdRef.current = null;
    }
  }, []);

  const handleTouchStartRef = useRef(null);
  const handleTouchMoveRef = useRef(null);
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

  const [showChapterProgress, setShowChapterProgress] = useState(() => {
    try {
      return localStorage.getItem('reader_bottom_chapter_progress') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleChapterProgress = useCallback(() => {
    setShowChapterProgress(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_bottom_chapter_progress', String(next));
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

  const [mouseWheelFlipEnabled, setMouseWheelFlipEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_mouse_wheel_flip') !== 'false'; // default true
    } catch {
      return true;
    }
  });
  const mouseWheelFlipEnabledRef = useRef(mouseWheelFlipEnabled);
  useEffect(() => {
    mouseWheelFlipEnabledRef.current = mouseWheelFlipEnabled;
  }, [mouseWheelFlipEnabled]);

  const toggleMouseWheelFlip = useCallback(() => {
    setMouseWheelFlipEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_mouse_wheel_flip', String(next));
      } catch {}
      return next;
    });
  }, []);

  // EPUB Reading Mode: 'dual' (Dual Page) | 'single' (Single Page) | 'chapterScroll' (Chapter Scroll)
  const [epubReadingMode, setEpubReadingMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('reader_epub_reading_mode');
      if (savedMode === 'single' || savedMode === 'chapterScroll' || savedMode === 'dual') {
        return savedMode;
      }
      if (localStorage.getItem('reader_chapter_scroll_mode') === 'true') {
        return 'chapterScroll';
      }
      if (localStorage.getItem('reader_epub_single_page') === 'true') {
        return 'single';
      }
      return 'dual'; // default
    } catch {
      return 'dual';
    }
  });

  const epubReadingModeRef = useRef(epubReadingMode);
  const chapterScrollModeEnabled = epubReadingMode === 'chapterScroll';
  const singlePageEnabled = epubReadingMode === 'single';

  const chapterScrollModeEnabledRef = useRef(chapterScrollModeEnabled);
  const singlePageEnabledRef = useRef(singlePageEnabled);

  useEffect(() => {
    epubReadingModeRef.current = epubReadingMode;
    chapterScrollModeEnabledRef.current = epubReadingMode === 'chapterScroll';
    singlePageEnabledRef.current = epubReadingMode === 'single';
  }, [epubReadingMode]);

  const changeEpubReadingMode = useCallback((newMode) => {
    if (!['dual', 'single', 'chapterScroll'].includes(newMode)) return;
    setEpubReadingMode(newMode);
    try {
      localStorage.setItem('reader_epub_reading_mode', newMode);
      localStorage.setItem('reader_chapter_scroll_mode', String(newMode === 'chapterScroll'));
      localStorage.setItem('reader_epub_single_page', String(newMode === 'single'));
    } catch {}
  }, []);

  const toggleChapterScrollMode = useCallback(() => {
    setEpubReadingMode(prev => {
      const next = prev === 'chapterScroll' ? 'dual' : 'chapterScroll';
      try {
        localStorage.setItem('reader_epub_reading_mode', next);
        localStorage.setItem('reader_chapter_scroll_mode', String(next === 'chapterScroll'));
        localStorage.setItem('reader_epub_single_page', String(next === 'single'));
      } catch {}
      return next;
    });
  }, []);

  const toggleSinglePage = useCallback(() => {
    setEpubReadingMode(prev => {
      const next = prev === 'single' ? 'dual' : 'single';
      try {
        localStorage.setItem('reader_epub_reading_mode', next);
        localStorage.setItem('reader_chapter_scroll_mode', String(next === 'chapterScroll'));
        localStorage.setItem('reader_epub_single_page', String(next === 'single'));
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
  const copilotDrawerOpenRef = useRef(copilotDrawerOpen);
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
    copilotDrawerOpenRef.current = copilotDrawerOpen;
  }, [copilotDrawerOpen]);

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
      copilotDrawerOpenRef.current ||
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
  }, [tocOpen, commentsDrawerOpen, copilotDrawerOpen, searchOpen, ttsOpen, readerSettingsOpen, headerPinned, isAnyDrawerOpen, startHideTimer]);

  // Helper to locate active vertical scroll container in chapter scroll mode
  const getChapterScrollContainer = useCallback(() => {
    if (!viewerRef?.current) return null;
    const epubContainer = viewerRef.current.querySelector('.epub-container');
    if (epubContainer) return epubContainer;
    return viewerRef.current;
  }, [viewerRef]);

  // Section helpers for chapter navigation
  const getPrevSection = useCallback(() => {
    if (!renditionRef?.current) return null;
    const rendition = renditionRef.current;
    const currentSection = rendition.manager?.views?.first?.()?.section ||
                           rendition.views?.first?.()?.section;
    if (currentSection && typeof currentSection.prev === 'function') {
      const prev = currentSection.prev();
      if (prev) return prev;
    }
    const loc = rendition.location || (typeof rendition.currentLocation === 'function' ? rendition.currentLocation() : null);
    const index = loc?.start?.index;
    if (typeof index === 'number' && rendition.book?.spine) {
      if (typeof rendition.book.spine.prev === 'function') {
        const prev = rendition.book.spine.prev(index);
        if (prev) return prev;
      }
      if (index > 0 && typeof rendition.book.spine.get === 'function') {
        return rendition.book.spine.get(index - 1);
      }
    }
    return null;
  }, [renditionRef]);

  const getNextSection = useCallback(() => {
    if (!renditionRef?.current) return null;
    const rendition = renditionRef.current;
    const currentSection = rendition.manager?.views?.first?.()?.section ||
                           rendition.views?.first?.()?.section;
    if (currentSection && typeof currentSection.next === 'function') {
      const next = currentSection.next();
      if (next) return next;
    }
    const loc = rendition.location || (typeof rendition.currentLocation === 'function' ? rendition.currentLocation() : null);
    const index = loc?.start?.index;
    if (typeof index === 'number' && rendition.book?.spine) {
      if (typeof rendition.book.spine.next === 'function') {
        const next = rendition.book.spine.next(index);
        if (next) return next;
      }
      if (typeof rendition.book.spine.get === 'function') {
        return rendition.book.spine.get(index + 1);
      }
    }
    return null;
  }, [renditionRef]);

  // Page flip controls
  const flipNext = useCallback(() => {
    if (isNavigatingRef.current || !renditionRef?.current) return;
    isNavigatingRef.current = true;
    try {
      if (chapterScrollModeEnabledRef.current) {
        stopInertiaGlide();
        const nextSection = getNextSection();
        let p;
        if (nextSection && nextSection.href && typeof renditionRef.current.display === 'function') {
          p = renditionRef.current.display(nextSection.href);
        } else {
          p = renditionRef.current.next();
        }
        const forceTop = () => {
          const scroller = getChapterScrollContainer();
          if (scroller) scroller.scrollTop = 0;
        };
        forceTop();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            forceTop();
            requestAnimationFrame(forceTop);
            setTimeout(forceTop, 50);
            setTimeout(forceTop, 150);
          }).finally(() => {
            setTimeout(() => {
              forceTop();
              isNavigatingRef.current = false;
            }, 180);
          });
        } else {
          setTimeout(() => {
            forceTop();
            isNavigatingRef.current = false;
          }, 250);
        }
        return;
      }

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
  }, [renditionRef, getNextSection, getChapterScrollContainer, stopInertiaGlide]);

  const flipPrev = useCallback(() => {
    if (isNavigatingRef.current || !renditionRef?.current) return;
    isNavigatingRef.current = true;
    try {
      if (chapterScrollModeEnabledRef.current) {
        stopInertiaGlide();
        const prevSection = getPrevSection();
        let p;
        if (prevSection && prevSection.href && typeof renditionRef.current.display === 'function') {
          p = renditionRef.current.display(prevSection.href);
        } else {
          p = renditionRef.current.prev();
        }
        const forceTop = () => {
          const scroller = getChapterScrollContainer();
          if (scroller) scroller.scrollTop = 0;
        };
        forceTop();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            forceTop();
            requestAnimationFrame(forceTop);
            setTimeout(forceTop, 50);
            setTimeout(forceTop, 150);
          }).finally(() => {
            setTimeout(() => {
              forceTop();
              isNavigatingRef.current = false;
            }, 180);
          });
        } else {
          setTimeout(() => {
            forceTop();
            isNavigatingRef.current = false;
          }, 250);
        }
        return;
      }

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
  }, [renditionRef, getPrevSection, getChapterScrollContainer, stopInertiaGlide]);

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

    // Differentiate trackpad vs physical mouse wheel
    const isTrackpad = isLikelyTrackpad(e);
    if (isTrackpad) {
      isTrackpadGestureRef.current = true;
    }
    if (resetTrackpadGestureTimerRef.current) {
      clearTimeout(resetTrackpadGestureTimerRef.current);
    }
    resetTrackpadGestureTimerRef.current = setTimeout(() => {
      isTrackpadGestureRef.current = false;
    }, 300);

    const isFromTrackpad = isTrackpad || isTrackpadGestureRef.current;

    if (absX > absY && absX > 2) {
      isTrackpadGestureRef.current = true;
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

    if (absY >= absX && absY > 2) {
      // In chapter scroll mode, vertical wheel / two-finger trackpad swipe strictly scrolls the chapter content.
      // Reaching the top or bottom of the chapter should NOT flip pages/chapters. Only left/right swiping flips chapters.
      if (chapterScrollModeEnabledRef.current) {
        stopInertiaGlide();
        const scroller = getChapterScrollContainer();
        if (scroller) {
          let delta = e.deltaY;
          if (e.deltaMode === 1) {
            delta *= 24;
          } else if (e.deltaMode === 2) {
            delta *= (scroller.clientHeight || 400);
          }

          const maxScroll = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
          const currentScroll = scroller.scrollTop || 0;
          scroller.scrollTop = Math.max(0, Math.min(maxScroll, currentScroll + delta));
        }
        if (e.cancelable) e.preventDefault();
        return;
      }

      // In dual or single page mode:
      // Two-finger swiping up and down on trackpad should NOT pass the page, only left and right!
      if (isFromTrackpad) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (!mouseWheelFlipEnabledRef.current) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (e.cancelable) e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();

      if (now - lastWheelFlipTimeRef.current > 350 && !isNavigatingRef.current) {
        let delta = e.deltaY;
        if (e.deltaMode === 1) {
          delta *= 24;
        }
        accumulatedDeltaYRef.current += delta;

        if (clearWheelTimerRef.current) clearTimeout(clearWheelTimerRef.current);
        clearWheelTimerRef.current = setTimeout(() => {
          accumulatedDeltaYRef.current = 0;
        }, 150);

        if (Math.abs(accumulatedDeltaYRef.current) >= 30) {
          lastWheelFlipTimeRef.current = now;
          const dir = accumulatedDeltaYRef.current;
          accumulatedDeltaYRef.current = 0;
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
      if (!chapterScrollModeEnabledRef.current && e.cancelable) e.preventDefault();
      return;
    }
  }, [flipNext, flipPrev, getChapterScrollContainer]);

  useEffect(() => {
    handleNativeWheelRef.current = handleNativeWheel;
  }, [handleNativeWheel]);

  // Close confirmation state for slide up-to-down gesture
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const closeConfirmOpenRef = useRef(false);
  const closeConfirmTimerRef = useRef(null);

  const dismissCloseConfirm = useCallback(() => {
    if (closeConfirmTimerRef.current) {
      clearTimeout(closeConfirmTimerRef.current);
      closeConfirmTimerRef.current = null;
    }
    closeConfirmOpenRef.current = false;
    setCloseConfirmOpen(false);
  }, []);

  const handleSlideDown = useCallback(() => {
    if (closeConfirmOpenRef.current) {
      // Second slide: close the book!
      dismissCloseConfirm();
      if (handleClose) {
        handleClose();
      }
    } else {
      // First slide: activate confirmation prompt for 3 seconds
      closeConfirmOpenRef.current = true;
      setCloseConfirmOpen(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch {}
      }
      if (closeConfirmTimerRef.current) {
        clearTimeout(closeConfirmTimerRef.current);
      }
      closeConfirmTimerRef.current = setTimeout(() => {
        closeConfirmOpenRef.current = false;
        setCloseConfirmOpen(false);
        closeConfirmTimerRef.current = null;
      }, 3000);
    }
  }, [dismissCloseConfirm, handleClose]);

  useEffect(() => {
    return () => {
      stopInertiaGlide();
      if (closeConfirmTimerRef.current) {
        clearTimeout(closeConfirmTimerRef.current);
      }
      if (clearWheelTimerRef.current) {
        clearTimeout(clearWheelTimerRef.current);
      }
      if (clearSwipeTimerRef.current) {
        clearTimeout(clearSwipeTimerRef.current);
      }
      if (clearBoundaryTimerRef.current) {
        clearTimeout(clearBoundaryTimerRef.current);
      }
      if (resetTrackpadGestureTimerRef.current) {
        clearTimeout(resetTrackpadGestureTimerRef.current);
      }
    };
  }, [stopInertiaGlide]);

  const handleTouchStart = useCallback((e) => {
    stopInertiaGlide();
    if (
      e.target?.closest?.('header') ||
      e.target?.closest?.('aside') ||
      e.target?.closest?.('nav') ||
      e.target?.closest?.('[role="dialog"]') ||
      e.target?.closest?.('[data-reader-settings]') ||
      e.target?.closest?.('[data-popover]') ||
      e.target?.closest?.('label') ||
      e.target?.closest?.('input') ||
      e.target?.closest?.('button')
    ) {
      return;
    }
    if (e.touches && e.touches.length === 1) {
      const touch = e.touches[0];
      const touchX = (touch.screenX !== undefined && touch.screenX !== 0) ? touch.screenX : touch.clientX;
      const touchY = (touch.screenY !== undefined && touch.screenY !== 0) ? touch.screenY : touch.clientY;

      touchStartXRef.current = touchX;
      touchStartYRef.current = touchY;
      touchLastYRef.current = touchY;
      touchStartTimeRef.current = Date.now();
      touchHistoryRef.current = [{ y: touchY, t: Date.now() }];
      isDraggingChapterScrollRef.current = false;
      activeScrollerRef.current = getChapterScrollContainer();
    }
  }, [stopInertiaGlide, getChapterScrollContainer]);

  useEffect(() => {
    handleTouchStartRef.current = handleTouchStart;
  }, [handleTouchStart]);

  const handleTouchMove = useCallback((e) => {
    if (lastProcessedTouchMoveRef.current === e) return;
    lastProcessedTouchMoveRef.current = e;

    if (!chapterScrollModeEnabledRef.current) return;
    if (
      e.target?.closest?.('header') ||
      e.target?.closest?.('aside') ||
      e.target?.closest?.('nav') ||
      e.target?.closest?.('[role="dialog"]') ||
      e.target?.closest?.('[data-reader-settings]') ||
      e.target?.closest?.('[data-popover]') ||
      e.target?.closest?.('label') ||
      e.target?.closest?.('input') ||
      e.target?.closest?.('button')
    ) {
      return;
    }
    if (e.touches && e.touches.length === 1 && touchLastYRef.current !== null) {
      const touch = e.touches[0];
      const touchY = (touch.screenY !== undefined && touch.screenY !== 0) ? touch.screenY : touch.clientY;
      const deltaY = touchLastYRef.current - touchY;

      // When the finger is held still or moved < 0.5px, avoid micro-jitter
      if (Math.abs(deltaY) < 0.5) {
        if (e.cancelable && isDraggingChapterScrollRef.current) {
          e.preventDefault();
        }
        return;
      }

      touchLastYRef.current = touchY;

      const now = Date.now();
      const recent = touchHistoryRef.current.filter(p => now - p.t < 120);
      recent.push({ y: touchY, t: now });
      touchHistoryRef.current = recent;

      const scroller = activeScrollerRef.current || getChapterScrollContainer();
      if (scroller) {
        scroller.scrollTop += deltaY;
        isDraggingChapterScrollRef.current = true;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
    }
  }, [getChapterScrollContainer]);

  useEffect(() => {
    handleTouchMoveRef.current = handleTouchMove;
  }, [handleTouchMove]);

  const handleTouchEnd = useCallback((e) => {
    const scroller = activeScrollerRef.current || getChapterScrollContainer();
    activeScrollerRef.current = null;
    touchLastYRef.current = null;

    if (chapterScrollModeEnabledRef.current && isDraggingChapterScrollRef.current && scroller) {
      const now = Date.now();
      const samples = touchHistoryRef.current.filter(p => now - p.t < 120);
      if (samples.length >= 2) {
        const first = samples[0];
        const last = samples[samples.length - 1];
        const dt = Math.max(1, last.t - first.t);
        const dy = last.y - first.y;

        // Velocity in px/ms: negative dy means finger moved UP, so content scrolls DOWN (+scrollTop)
        const v_px_ms = -dy / dt;

        if (Math.abs(v_px_ms) > 0.12) {
          let velocity = v_px_ms * 16; // px per frame
          const maxVelocity = 45;
          if (Math.abs(velocity) > maxVelocity) {
            velocity = Math.sign(velocity) * maxVelocity;
          }

          const friction = 0.95;
          const minSpeed = 0.3;

          const runInertia = () => {
            const currentScroller = getChapterScrollContainer();
            if (!currentScroller) {
              inertiaRafIdRef.current = null;
              return;
            }

            currentScroller.scrollTop += velocity;
            velocity *= friction;

            const maxScroll = Math.max(0, (currentScroller.scrollHeight || 0) - (currentScroller.clientHeight || 0));
            const currentScroll = currentScroller.scrollTop || 0;

            if ((currentScroll <= 0 && velocity < 0) || (currentScroll >= maxScroll && velocity > 0)) {
              inertiaRafIdRef.current = null;
              return;
            }

            if (Math.abs(velocity) < minSpeed) {
              inertiaRafIdRef.current = null;
              return;
            }

            inertiaRafIdRef.current = requestAnimationFrame(runInertia);
          };

          inertiaRafIdRef.current = requestAnimationFrame(runInertia);
        }
      }
    }
    touchHistoryRef.current = [];
    isDraggingChapterScrollRef.current = false;

    if (!touchStartXRef.current || !e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const touchEndX = (touch.screenX !== undefined && touch.screenX !== 0) ? touch.screenX : touch.clientX;
    const touchEndY = (touch.screenY !== undefined && touch.screenY !== 0) ? touch.screenY : touch.clientY;
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    const diffX = touchEndX - startX;
    const diffY = touchEndY - startY;
    const duration = Date.now() - touchStartTimeRef.current;

    touchStartXRef.current = 0;
    touchStartYRef.current = 0;

    // Never intercept touches that originated on buttons, drawers, dialogs, or popover controls
    if (
      e.target?.closest?.('button') ||
      e.target?.closest?.('aside') ||
      e.target?.closest?.('nav') ||
      e.target?.closest?.('[role="dialog"]') ||
      e.target?.closest?.('[data-reader-settings]') ||
      e.target?.closest?.('[data-popover]') ||
      e.target?.closest?.('[data-popover-backdrop]') ||
      e.target?.closest?.('label') ||
      e.target?.closest?.('input')
    ) {
      return;
    }

    const anyOpen = isAnyDrawerOpen();
    if (anyOpen) {
      if (readerSettingsOpenRef.current) {
        setReaderSettingsOpen(false);
      }
      return;
    }

    // Check if text is currently selected
    const hasSelection = () => {
      try {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return true;
        const iframe = viewerRef?.current?.querySelector('iframe');
        const iframeSel = iframe?.contentWindow?.getSelection();
        if (iframeSel && !iframeSel.isCollapsed && iframeSel.toString().trim().length > 0) return true;
      } catch {}
      return false;
    };

    if (selectionMenu?.isOpen || hasSelection()) {
      return;
    }

    // 1. Sliding UP TO DOWN: diffY >= 50, predominantly vertical, duration < 800ms
    if (!chapterScrollModeEnabledRef.current && diffY >= 50 && diffY > Math.abs(diffX) * 1.2 && duration < 800) {
      handleSlideDown();
      return;
    }

    // If starting on visible header and not sliding down, don't trigger horizontal flip or tap
    if (startY <= 60 && isHeaderVisibleRef.current) {
      return;
    }

    // 2. Horizontal swipe: page navigation
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && duration < 600) {
      dismissCloseConfirm();
      if (diffX < 0) {
        flipNext();
      } else {
        flipPrev();
      }
      // When flipping pages on mobile, hide the header if unpinned
      if (!headerPinned) {
        setIsHeaderVisible(false);
        isHeaderVisibleRef.current = false;
        clearHideTimer();
      }
    } else if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15 && duration < 350) {
      // 3. Single tap on page
      dismissCloseConfirm();
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
  }, [
    flipNext,
    flipPrev,
    headerPinned,
    isAnyDrawerOpen,
    showHeader,
    clearHideTimer,
    setReaderSettingsOpen,
    selectionMenu?.isOpen,
    handleSlideDown,
    dismissCloseConfirm,
    viewerRef,
  ]);

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

  // Helper to resolve an accurate CFI range from a DOM range and document context
  const resolveCfiFromRange = useCallback((range, targetDoc, targetWin, fallbackContents = null, selectedText = '') => {
    if (!range) return null;

    // Normalize Element-node endpoints to TextNode endpoints to avoid epub.js 1-character bug (/1:0,/1:1)
    const normRange = normalizeRangeToTextNodes(range, targetDoc) || range;

    // 1. Try from active Contents instances via rendition
    try {
      const contentsList = renditionRef?.current?.getContents() || [];
      const found = contentsList.find(c => c?.document === targetDoc || c?.window === targetWin) || contentsList[0];
      if (found && typeof found.cfiFromRange === 'function') {
        const cfi = found.cfiFromRange(normRange);
        if (cfi) return sanitizeCfiRange(cfi, selectedText);
      }
    } catch {}

    // 2. Try from fallbackContents / section / manager views
    try {
      const views = renditionRef?.current?.manager?.views || [];
      const v = views.find(view => view?.document === targetDoc || view?.window === targetWin) || views[0];
      const cfiBase = fallbackContents?.cfiBase || fallbackContents?.section?.cfiBase || v?.contents?.cfiBase || v?.section?.cfiBase;
      if (cfiBase) {
        const cfi = new EpubCFI(normRange, cfiBase).toString();
        if (cfi) return sanitizeCfiRange(cfi, selectedText);
      }
    } catch {}

    // 3. Try from book spine / currentLocation
    try {
      const book = renditionRef?.current?.book;
      const currLoc = renditionRef?.current?.currentLocation();
      const href = currLoc?.start?.href;
      if (book?.spine && href) {
        const section = book.spine.get(href);
        if (section?.cfiBase) {
          const cfi = new EpubCFI(normRange, section.cfiBase).toString();
          if (cfi) return sanitizeCfiRange(cfi, selectedText);
        }
      }
    } catch {}

    return null;
  }, [renditionRef]);

  // Helper to attach wheel, touch, and interaction listeners to an EPUB iframe
  const attachListenersToIframe = useCallback((doc, win, contents = null) => {
    if (!doc && !win) return;
    const targetDoc = doc || win?.document;
    const targetWin = win || doc?.defaultView;
    if (!targetDoc || !targetWin) return;

    if (contents) {
      targetDoc._epubContents = contents;
    }

    // Apply active theme immediately
    applyThemeToDoc(targetDoc, themeRef.current, fontFamilyRef?.current || 'default');

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

    const onTouchMove = (e) => {
      handleTouchMoveRef.current?.(e);
    };

    targetDoc.addEventListener('touchstart', onTouchStart, { passive: true });
    targetDoc.addEventListener('touchmove', onTouchMove, { passive: false });
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
      const docContents = targetDoc._epubContents || contents;
      const cfiRange = resolveCfiFromRange(range, targetDoc, targetWin, docContents, text);

      const rangeRect = range.getBoundingClientRect();
      const posX = (isTouchOrMobile || !e.clientX)
        ? (iframeRect.left + rangeRect.left + rangeRect.width / 2)
        : (iframeRect.left + e.clientX);
      const posY = (isTouchOrMobile || !e.clientY)
        ? (iframeRect.top + rangeRect.top)
        : (iframeRect.top + e.clientY);

      setSelectionMenu(prev => {
        // Never reuse prev.cfi if the selected text does not match prev.text!
        const matchingPrevCfi = (prev.text && prev.text.trim() === text) ? prev.cfi : null;
        return {
          isOpen: true,
          x: posX,
          y: posY,
          text,
          cfi: cfiRange || matchingPrevCfi
        };
      });
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
          const docContents = targetDoc._epubContents || contents;
          const cfiRange = resolveCfiFromRange(range, targetDoc, targetWin, docContents, text);

          const posX = iframeRect.left + rangeRect.left + (rangeRect.width / 2);
          const posY = iframeRect.top + rangeRect.top;

          setSelectionMenu(prev => {
            const matchingPrevCfi = (prev.text && prev.text.trim() === text) ? prev.cfi : null;
            return {
              isOpen: true,
              x: posX,
              y: posY,
              text,
              cfi: cfiRange || matchingPrevCfi
            };
          });
        } catch {}
      }, 150);
    };

    targetDoc.addEventListener('selectionchange', handleSelectionChange);
  }, [showHeader, themeRef, fontFamilyRef, viewerRef, setSelectionMenu, resolveCfiFromRange]);

  useEffect(() => {
    attachListenersToIframeRef.current = attachListenersToIframe;
  }, [attachListenersToIframe]);

  // Window gesture listeners
  useEffect(() => {
    const onWheel = (e) => handleNativeWheel(e);
    const onTouchStart = (e) => handleTouchStart(e);
    const onTouchMove = (e) => handleTouchMove(e);
    const onTouchEnd = (e) => handleTouchEnd(e);

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleNativeWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

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

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (chapterScrollModeEnabledRef.current && upDownFlipEnabledRef.current && e.key === 'ArrowDown')) {
        e.preventDefault();
        flipNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (chapterScrollModeEnabledRef.current && upDownFlipEnabledRef.current && e.key === 'ArrowUp')) {
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

    // Register Android Back navigation handler for Reader
    window.__uziReaderBack = () => {
      if (readerSettingsOpenRef.current) {
        setReaderSettingsOpen(false);
        return true;
      }
      if (ttsOpenRef.current) {
        setTtsOpen(false);
        return true;
      }
      if (searchOpenRef.current) {
        handleCloseSearch();
        return true;
      }
      if (selectionMenu?.isOpen) {
        setSelectionMenu({ isOpen: false, x: 0, y: 0, text: '', cfi: null });
        return true;
      }
      if (commentsDrawerOpen) {
        setCommentsDrawerOpen(false);
        return true;
      }
      if (tocOpen) {
        setTocOpen(false);
        return true;
      }
      if (handleClose) {
        handleClose();
        return true;
      }
      return false;
    };

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      delete window.__uziReaderBack;
    };
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
    copilotDrawerOpen ||
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
    // Close confirmation on slide down
    closeConfirmOpen,
    dismissCloseConfirm,
    // Settings
    readerSettingsOpen,
    setReaderSettingsOpen,
    showBottomProgress,
    toggleBottomProgress,
    showChapterProgress,
    toggleChapterProgress,
    trackpadSwipeEnabled,
    toggleTrackpadSwipe,
    floatingButtonsEnabled,
    toggleFloatingButtons,
    upDownFlipEnabled,
    toggleUpDownFlip,
    mouseWheelFlipEnabled,
    toggleMouseWheelFlip,
    chapterScrollModeEnabled,
    toggleChapterScrollMode,
    singlePageEnabled,
    toggleSinglePage,
    epubReadingMode,
    changeEpubReadingMode,
    // Internal refs
    handleNativeWheelRef,
    handleTouchStartRef,
    handleTouchMoveRef,
    handleTouchEndRef,
    handleIframeMouseMoveRef,
    handleKeyDownRef,
  };
}
