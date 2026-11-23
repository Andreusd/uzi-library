import React, { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Custom Floating Scroll Indicator for Chapter Scroll Mode.
 * Pinned flush to the absolute right viewport edge.
 * Dynamically tracks the epub container's scrollTop, scrollHeight, clientHeight
 * and styles thumb/track to perfectly match the current theme ('dark', 'sepia', 'light').
 */
export default function EpubChapterScrollbar({
  viewerRef,
  chapterScrollModeEnabled = false,
  theme = 'dark',
  isHeaderShowing = true,
  isFullscreen = false,
}) {
  const [scrollProgress, setScrollProgress] = useState({ topRatio: 0, heightRatio: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const hideTimerRef = useRef(null);
  const trackRef = useRef(null);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);
  const dragMaxScrollRef = useRef(0);

  const updatePosition = useCallback(() => {
    if (!viewerRef?.current || !chapterScrollModeEnabled) return;
    const scroller = viewerRef.current.querySelector('.epub-container') || viewerRef.current;
    if (!scroller) return;

    const clientHeight = scroller.clientHeight || 0;
    const scrollHeight = scroller.scrollHeight || 0;
    const scrollTop = scroller.scrollTop || 0;

    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    if (maxScroll <= 0 || clientHeight <= 0) {
      setScrollProgress({ topRatio: 0, heightRatio: 0 });
      return;
    }

    // Keep thumb sized proportional to viewport content, clamped between 32px and total height
    const heightRatio = Math.max(0.05, Math.min(1, clientHeight / scrollHeight));
    // Clamp topRatio strictly between 0 and 1 so it never disappears off the bottom
    const topRatio = Math.max(0, Math.min(1, scrollTop / maxScroll));

    setScrollProgress({ topRatio, heightRatio });
  }, [viewerRef, chapterScrollModeEnabled]);

  const handleScrollActivity = useCallback(() => {
    updatePosition();
    setIsScrolling(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 1500);
  }, [updatePosition]);

  // Hook into scroll events on the epub container and iframes
  useEffect(() => {
    if (!chapterScrollModeEnabled || !viewerRef?.current) return;

    const container = viewerRef.current;
    let registeredScroller = null;

    const attachScrollListener = () => {
      const scroller = container.querySelector('.epub-container') || container;
      if (scroller && scroller !== registeredScroller) {
        if (registeredScroller) {
          registeredScroller.removeEventListener('scroll', handleScrollActivity);
        }
        registeredScroller = scroller;
        scroller.addEventListener('scroll', handleScrollActivity, { passive: true });
        updatePosition();
      }
    };

    attachScrollListener();

    // Check periodically or on DOM mutations (when new chapter iframes load)
    let observer = null;
    if (container instanceof Node && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        attachScrollListener();
        updatePosition();
      });
      observer.observe(container, { childList: true, subtree: true });
    }
    window.addEventListener('resize', updatePosition);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (registeredScroller) {
        registeredScroller.removeEventListener('scroll', handleScrollActivity);
      }
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [chapterScrollModeEnabled, viewerRef, handleScrollActivity, updatePosition]);

  // Handle Dragging / Scrubbing the scrollbar thumb
  const handlePointerDown = (e) => {
    if (!viewerRef?.current) return;
    const scroller = viewerRef.current.querySelector('.epub-container') || viewerRef.current;
    if (!scroller || !trackRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const clientHeight = scroller.clientHeight || 0;
    const scrollHeight = scroller.scrollHeight || 0;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    if (maxScroll <= 0) return;

    setIsDragging(true);
    setIsScrolling(true);
    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = scroller.scrollTop;
    dragMaxScrollRef.current = maxScroll;

    const trackHeight = trackRef.current.clientHeight;
    const thumbHeight = Math.max(28, trackHeight * scrollProgress.heightRatio);
    const availableTrack = Math.max(1, trackHeight - thumbHeight);

    const onPointerMove = (moveEvent) => {
      moveEvent.preventDefault();
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const scrollDelta = (deltaY / availableTrack) * maxScroll;
      scroller.scrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTopRef.current + scrollDelta));
      updatePosition();
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1500);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  };

  // Only render when chapter scroll mode is active and content is actually scrollable
  if (!chapterScrollModeEnabled || scrollProgress.heightRatio <= 0 || scrollProgress.heightRatio >= 1) {
    return null;
  }

  // Color schemes matching the 3 reader themes (Dark, Sepia, Light)
  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  const thumbBg = isDark
    ? 'bg-amber-500/80 hover:bg-amber-400 active:bg-amber-400'
    : isSepia
      ? 'bg-[#a3704c]/85 hover:bg-[#8c5a36] active:bg-[#8c5a36]'
      : 'bg-neutral-600/75 hover:bg-neutral-800 active:bg-neutral-900';

  const trackBg = isDark
    ? 'bg-neutral-900/30 hover:bg-neutral-900/50'
    : isSepia
      ? 'bg-[#e8d8be]/40 hover:bg-[#dfcdb1]/60'
      : 'bg-neutral-200/40 hover:bg-neutral-300/60';

  const isVisible = isScrolling || isHovered || isDragging;

  // Adapt top / bottom track bounds according to toolbar visibility and fullscreen state
  const topClass = isHeaderShowing ? 'top-14 sm:top-16' : 'top-3';
  const bottomClass = isFullscreen ? 'bottom-3' : 'bottom-14 sm:bottom-4';

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed ${topClass} ${bottomClass} right-0.5 z-40 w-2 sm:w-2.5 transition-all duration-300 pointer-events-auto select-none rounded-full ${trackBg} ${
        isVisible ? 'opacity-100' : 'opacity-0 sm:opacity-20 hover:opacity-100'
      }`}
      aria-hidden="true"
    >
      <div
        onPointerDown={handlePointerDown}
        className={`w-full rounded-full cursor-grab active:cursor-grabbing transition-colors duration-150 shadow-sm relative ${thumbBg}`}
        style={{
          height: `${Math.max(28, scrollProgress.heightRatio * 100)}%`,
          top: `${scrollProgress.topRatio * (100 - Math.max(28, scrollProgress.heightRatio * 100))}%`,
        }}
      />
    </div>
  );
}
