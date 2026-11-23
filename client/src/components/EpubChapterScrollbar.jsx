import React, { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Modern floating scrollbar indicator for Chapter Scroll Mode.
 * Designed after macOS / iOS / modern browser overlay scrollbars:
 * - Subtle, sleek, rounded pill thumb (width 4px idle / 6px active/hover)
 * - Translucent neutral track on hover/drag
 * - Auto-fades smoothly when idle
 * - Smooth CSS transitions and precise drag tracking
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

    // Keep thumb sized proportional to viewport content, minimum 36px
    const minHeightRatio = Math.max(0.05, 36 / Math.max(1, clientHeight));
    const heightRatio = Math.max(minHeightRatio, Math.min(1, clientHeight / scrollHeight));
    // Clamp topRatio strictly between 0 and 1
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
    }, 1200);
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
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', updatePosition);
    };
  }, [viewerRef, chapterScrollModeEnabled, handleScrollActivity, updatePosition]);

  // Mouse drag support for the custom scrollbar thumb
  const handlePointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const scroller = viewerRef.current?.querySelector('.epub-container') || viewerRef.current;
    if (!scroller || !trackRef.current) return;

    setIsDragging(true);
    setIsScrolling(true);
    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = scroller.scrollTop || 0;

    const maxScroll = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
    dragMaxScrollRef.current = maxScroll;

    const trackHeight = trackRef.current.clientHeight;
    const thumbHeight = Math.max(36, trackHeight * scrollProgress.heightRatio);
    const availableTrack = Math.max(1, trackHeight - thumbHeight);

    const onPointerMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const scrollDelta = (deltaY / availableTrack) * dragMaxScrollRef.current;
      scroller.scrollTop = Math.max(
        0,
        Math.min(dragMaxScrollRef.current, dragStartScrollTopRef.current + scrollDelta)
      );
      updatePosition();
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 1200);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
  };

  if (!chapterScrollModeEnabled || scrollProgress.heightRatio <= 0 || scrollProgress.heightRatio >= 1) {
    return null;
  }

  const isDark = theme === 'dark';
  const isSepia = theme === 'sepia';

  // Natural theme palettes: subtle translucent neutral/amber tones that blend into UI
  const thumbColor = isDark
    ? 'bg-neutral-400/50 hover:bg-neutral-300/80 active:bg-amber-400/90'
    : isSepia
      ? 'bg-[#8c6b4f]/45 hover:bg-[#725239]/70 active:bg-[#5e412a]/90'
      : 'bg-neutral-500/40 hover:bg-neutral-700/70 active:bg-neutral-800/90';

  const trackBg = (isHovered || isDragging)
    ? isDark
      ? 'bg-white/[0.04]'
      : isSepia
        ? 'bg-[#5e412a]/[0.05]'
        : 'bg-black/[0.04]'
    : 'bg-transparent';

  const isVisible = isScrolling || isHovered || isDragging;
  const isInteracting = isHovered || isDragging;

  const topClass = isHeaderShowing ? 'top-14 sm:top-16' : 'top-3';
  const bottomClass = isFullscreen ? 'bottom-3' : 'bottom-14 sm:bottom-4';

  const thumbHeightPercent = Math.max(5, scrollProgress.heightRatio * 100);
  const thumbTopPercent = scrollProgress.topRatio * (100 - thumbHeightPercent);

  return (
    <div
      ref={trackRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed ${topClass} ${bottomClass} right-1 z-40 transition-all duration-300 pointer-events-auto select-none rounded-full flex justify-center py-1 ${trackBg} ${
        isInteracting ? 'w-2.5' : 'w-1.5'
      } ${isVisible ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
      aria-hidden="true"
    >
      <div
        onPointerDown={handlePointerDown}
        className={`rounded-full cursor-grab active:cursor-grabbing transition-all duration-150 backdrop-blur-[2px] absolute ${
          isInteracting ? 'w-2' : 'w-1'
        } ${thumbColor}`}
        style={{
          height: `${thumbHeightPercent}%`,
          top: `${thumbTopPercent}%`,
        }}
      />
    </div>
  );
}