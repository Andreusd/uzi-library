import { useEffect, useRef } from 'react';

/**
 * Custom hook to enable opening the sidebar with a swipe from left to right,
 * and closing the sidebar with a swipe from right to left on mobile/touch devices.
 *
 * @param {Object} options
 * @param {boolean} options.sidebarOpen - Current open state of sidebar
 * @param {Function} options.setSidebarOpen - Function to update sidebar state
 * @param {boolean} [options.enabled=true] - Whether gestures are active (e.g. false in Reader, desktop, or modals)
 * @param {number} [options.maxStartRatio=0.8] - Max fraction of screen width where swipe-to-open can begin
 * @param {number} [options.minSwipeDistance=50] - Minimum horizontal travel in pixels to recognize a swipe
 * @param {number} [options.maxSwipeTime=1000] - Maximum duration in ms for the swipe gesture
 */
export function useSidebarSwipe({
  sidebarOpen,
  setSidebarOpen,
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

      // If sidebar is closed: allow swipe starting anywhere across the left 80% of the screen
      const allowedStartX = Math.max(window.innerWidth * maxStartRatio, 250);
      if (!sidebarOpen && startX > allowedStartX) {
        touchStartRef.current = null;
        return;
      }

      // If touch begins inside a horizontal carousel, allow the carousel to scroll horizontally
      // unless touch is near the very edge (<= 45px)
      if (
        !sidebarOpen &&
        target &&
        typeof target.closest === 'function' &&
        target.closest('.overflow-x-auto') &&
        startX > 45
      ) {
        touchStartRef.current = null;
        return;
      }

      touchStartRef.current = {
        startX,
        startY,
        startTime: Date.now(),
        triggered: false,
      };
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current || touchStartRef.current.triggered) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.startX;
      const deltaY = touch.clientY - touchStartRef.current.startY;

      // 1. Opening: swipe from left to right (deltaX >= minSwipeDistance)
      if (!sidebarOpen && deltaX >= minSwipeDistance) {
        if (deltaX > Math.abs(deltaY) * 1.05) {
          touchStartRef.current.triggered = true;
          setSidebarOpen(true);
        }
      }
      // 2. Closing: swipe from right to left (deltaX <= -minSwipeDistance) when open
      else if (sidebarOpen && deltaX <= -minSwipeDistance) {
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
          touchStartRef.current.triggered = true;
          setSidebarOpen(false);
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current) return;
      if (touchStartRef.current.triggered) {
        touchStartRef.current = null;
        return;
      }

      const { startX, startY, startTime } = touchStartRef.current;
      touchStartRef.current = null;

      const duration = Date.now() - startTime;
      if (duration > maxSwipeTime) return;

      const touch = e.changedTouches ? e.changedTouches[0] : null;
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      // Check if horizontal intent clearly dominated vertical
      if (Math.abs(deltaX) >= minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.05) {
        if (!sidebarOpen && deltaX > 0) {
          setSidebarOpen(true);
        } else if (sidebarOpen && deltaX < 0) {
          setSidebarOpen(false);
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
  }, [sidebarOpen, setSidebarOpen, enabled, maxStartRatio, minSwipeDistance, maxSwipeTime]);
}
