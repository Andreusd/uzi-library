import { useEffect, useRef } from 'react';

/**
 * Custom hook to enable gesture navigation on mobile/touch devices:
 * - Swiping left-to-right opens the sidebar menu (or goes back to search when filter/sort is open).
 * - Swiping right-to-left closes the sidebar menu if open, toggles filter & sort when searching, or opens settings.
 *
 * @param {Object} options
 * @param {boolean} options.sidebarOpen - Current open state of sidebar
 * @param {Function} options.setSidebarOpen - Function to update sidebar state
 * @param {Function} [options.onOpenSettings] - Function to open library settings on right-to-left swipe
 * @param {boolean} [options.isSearchActive=false] - Whether search is currently active
 * @param {boolean} [options.mobileFilterOpen=false] - Whether filter & sort popover is open
 * @param {Function} [options.onToggleFilterAndSort] - Function to toggle filter & sort
 * @param {Function} [options.onBackToSearch] - Function to go back from filter & sort to search
 * @param {boolean} [options.enabled=true] - Whether gestures are active (e.g. false in Reader, desktop, or modals)
 * @param {number} [options.maxStartRatio=0.8] - Max fraction of screen width where swipe-to-open can begin
 * @param {number} [options.minSwipeDistance=50] - Minimum horizontal travel in pixels to recognize a swipe
 * @param {number} [options.maxSwipeTime=1000] - Maximum duration in ms for the swipe gesture
 */
export function useSidebarSwipe({
  sidebarOpen,
  setSidebarOpen,
  onOpenSettings,
  isSearchActive = false,
  mobileFilterOpen = false,
  onToggleFilterAndSort,
  onBackToSearch,
  enabled = true,
  maxStartRatio = 0.8,
  minSwipeDistance = 50,
  maxSwipeTime = 1000,
}) {
  const touchStartRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleTouchStart = (e) => {
      // Ignore if screen is desktop width (lg breakpoint is 1024px)
      if (window.innerWidth >= 1024) return;

      // Ignore multi-touch
      if (e.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }

      // Ignore if interaction is on form input fields
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        touchStartRef.current = null;
        return;
      }

      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;

      // Identify if touch is inside a horizontal scroll carousel
      const carousel =
        target && typeof target.closest === 'function'
          ? target.closest('.overflow-x-auto')
          : null;

      touchStartRef.current = {
        startX,
        startY,
        startTime: Date.now(),
        triggered: false,
        carousel,
        carouselStartScrollLeft: carousel ? carousel.scrollLeft : 0,
        carouselMaxScrollLeft: carousel ? carousel.scrollWidth - carousel.clientWidth : 0,
      };
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current || touchStartRef.current.triggered) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.startX;
      const deltaY = touch.clientY - touchStartRef.current.startY;
      const startX = touchStartRef.current.startX;
      const carousel = touchStartRef.current.carousel;

      // 1. Swiping left-to-right (deltaX >= minSwipeDistance)
      if (deltaX >= minSwipeDistance) {
        if (deltaX > Math.abs(deltaY) * 1.05) {
          // A) If Filter & Sort is open: left-to-right goes back to searching
          if (mobileFilterOpen && onBackToSearch) {
            touchStartRef.current.triggered = true;
            onBackToSearch();
            return;
          }

          // B) If sidebar is closed: open sidebar
          if (!sidebarOpen) {
            const allowedStartX = Math.max(window.innerWidth * maxStartRatio, 250);
            if (startX > allowedStartX) return;

            // If inside carousel with items to the left, prioritize scrolling carousel unless near left edge
            if (carousel && touchStartRef.current.carouselStartScrollLeft > 8 && startX > 45) {
              return;
            }

            touchStartRef.current.triggered = true;
            setSidebarOpen(true);
          }
        }
      }
      // 2. Swiping right-to-left (deltaX <= -minSwipeDistance)
      else if (deltaX <= -minSwipeDistance) {
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
          // A) If sidebar is open: close it
          if (sidebarOpen) {
            touchStartRef.current.triggered = true;
            setSidebarOpen(false);
          }
          // B) If searching is active (and sidebar is closed): toggle filter and sort!
          else if (isSearchActive && onToggleFilterAndSort) {
            touchStartRef.current.triggered = true;
            onToggleFilterAndSort();
          }
          // C) If sidebar is closed and not searching: open library settings
          else if (onOpenSettings) {
            const canScrollRight =
              carousel &&
              touchStartRef.current.carouselMaxScrollLeft - touchStartRef.current.carouselStartScrollLeft > 8;
            if (canScrollRight && startX < window.innerWidth - 45) {
              return;
            }

            touchStartRef.current.triggered = true;
            onOpenSettings();
          }
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return;
      if (touchStartRef.current.triggered) {
        touchStartRef.current = null;
        return;
      }

      const { startX, startY, startTime, carousel, carouselStartScrollLeft, carouselMaxScrollLeft } =
        touchStartRef.current;
      touchStartRef.current = null;

      const duration = Date.now() - startTime;
      if (duration > maxSwipeTime) return;

      const touch = e.changedTouches ? e.changedTouches[0] : null;
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) >= minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
        if (deltaX > 0) {
          if (mobileFilterOpen && onBackToSearch) {
            onBackToSearch();
            return;
          }
          if (!sidebarOpen) {
            const allowedStartX = Math.max(window.innerWidth * maxStartRatio, 250);
            if (startX > allowedStartX) return;
            if (carousel && carouselStartScrollLeft > 8 && startX > 45) return;
            setSidebarOpen(true);
          }
        } else if (deltaX < 0) {
          if (sidebarOpen) {
            setSidebarOpen(false);
          } else if (isSearchActive && onToggleFilterAndSort) {
            onToggleFilterAndSort();
          } else if (onOpenSettings) {
            const canScrollRight = carousel && carouselMaxScrollLeft - carouselStartScrollLeft > 8;
            if (canScrollRight && startX < window.innerWidth - 45) return;
            onOpenSettings();
          }
        }
      }
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    sidebarOpen,
    setSidebarOpen,
    onOpenSettings,
    isSearchActive,
    mobileFilterOpen,
    onToggleFilterAndSort,
    onBackToSearch,
    enabled,
    maxStartRatio,
    minSwipeDistance,
    maxSwipeTime,
  ]);
}
