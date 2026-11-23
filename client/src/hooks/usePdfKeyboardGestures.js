import { useEffect, useRef } from 'react';
import { isLikelyTrackpad } from '../utils/trackpadUtils';

/**
 * Hook encapsulating keyboard shortcuts and wheel/trackpad gestures for PDF Reader.
 */
export function usePdfKeyboardGestures({
  containerRef,
  nav,
  zoom,
  search,
  tts,
  onClose,
  upDownFlipEnabled = false,
  handleTrackpadWheel,
}) {
  const lastWheelTimeRef = useRef(0);
  const isTrackpadGestureRef = useRef(false);
  const resetTrackpadGestureTimerRef = useRef(null);

  // Keyboard navigation & smart scrolling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const container = containerRef.current;
      const isScrollable = container && container.scrollHeight > container.clientHeight + 10;

      if (e.key === 'ArrowRight') {
        nav.goToNextPage();
      } else if (e.key === 'ArrowLeft') {
        nav.goToPrevPage();
      } else if (e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        if (isScrollable) {
          const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 30;
          if (atBottom) {
            nav.goToNextPage();
          } else {
            container.scrollBy({ top: container.clientHeight * 0.8, behavior: 'smooth' });
          }
        } else {
          nav.goToNextPage();
        }
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        if (isScrollable) {
          const atTop = container.scrollTop <= 2;
          if (atTop) {
            nav.goToPrevPage();
          } else {
            container.scrollBy({ top: -container.clientHeight * 0.8, behavior: 'smooth' });
          }
        } else {
          nav.goToPrevPage();
        }
      } else if (e.key === 'ArrowDown') {
        if (isScrollable) {
          const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
          if (atBottom && upDownFlipEnabled) {
            nav.goToNextPage();
          } else {
            container.scrollBy({ top: 120, behavior: 'smooth' });
          }
        } else if (upDownFlipEnabled) {
          nav.goToNextPage();
        }
      } else if (e.key === 'ArrowUp') {
        if (isScrollable) {
          const atTop = container.scrollTop <= 10;
          if (atTop && upDownFlipEnabled) {
            nav.goToPrevPage();
          } else {
            container.scrollBy({ top: -120, behavior: 'smooth' });
          }
        } else if (upDownFlipEnabled) {
          nav.goToPrevPage();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        search.openSearch();
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        tts.toggleTts();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (tts.ttsOpen) {
          tts.setTtsOpen(false);
          return;
        }
        if (search.searchOpen) {
          search.handleCloseSearch();
          return;
        }
        if (onClose) onClose();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.key === 'Add')) {
        e.preventDefault();
        zoom.handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === 'Subtract')) {
        e.preventDefault();
        zoom.handleZoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        zoom.handleResetZoom(nav.currentPage);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nav, search, tts, zoom, onClose, upDownFlipEnabled, containerRef]);

  // Native wheel listener for gestures, edge-flipping, and Ctrl+Wheel PDF zoom
  const { isContinuous, goToNextPage, goToPrevPage } = nav;

  useEffect(() => {
    const handleNativeWheel = (e) => {
      // 1. Ctrl + Scroll Wheel (or Touchpad pinch gesture) -> Zoom PDF viewer
      if (e.ctrlKey || e.metaKey) {
        if (e.cancelable) e.preventDefault();
        if (e.deltaY < 0) {
          zoom.handleZoomIn();
        } else if (e.deltaY > 0) {
          zoom.handleZoomOut();
        }
        return;
      }

      // Do not intercept wheel when interacting with scrollable drawers, menus, or header
      if (e.target && typeof e.target.closest === 'function') {
        if (e.target.closest('aside, header, [role="dialog"]')) {
          return;
        }
      }

      // 2. Two-finger horizontal trackpad swipe to flip pages
      if (handleTrackpadWheel) {
        const handled = handleTrackpadWheel(e, containerRef.current);
        if (handled) return;
      }

      const container = containerRef.current;
      if (!container) return;

      // Trackpad vs mouse wheel distinction
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

      // 3. Normal Wheel on non-scrollable page to flip pages (flip mode only)
      if (!isContinuous) {
        // Two-finger swiping up and down on dual or single page mode should NOT pass the page, only left and right!
        if (isFromTrackpad) {
          if (e.cancelable) e.preventDefault();
          return;
        }

        const isScrollable = container.scrollHeight > container.clientHeight + 10;
        if (!isScrollable) {
          const now = Date.now();
          if (now - lastWheelTimeRef.current < 450) return;

          if (e.deltaY > 25) {
            lastWheelTimeRef.current = now;
            goToNextPage();
          } else if (e.deltaY < -25) {
            lastWheelTimeRef.current = now;
            goToPrevPage();
          }
        }
      }
    };

    window.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleNativeWheel);
      if (resetTrackpadGestureTimerRef.current) {
        clearTimeout(resetTrackpadGestureTimerRef.current);
      }
    };
  }, [handleTrackpadWheel, isContinuous, goToNextPage, goToPrevPage, zoom, containerRef]);
}
