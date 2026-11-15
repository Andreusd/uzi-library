import { useEffect, useRef } from 'react';

/**
 * Custom hook to enable opening the sidebar with a swipe from the left edge to the right,
 * and closing the sidebar with a swipe from right to left on mobile/touch devices.
 *
 * @param {Object} options
 * @param {boolean} options.sidebarOpen - Current open state of sidebar
 * @param {Function} options.setSidebarOpen - Function to update sidebar state
 * @param {boolean} [options.enabled=true] - Whether gestures are active (e.g. false in Reader, desktop, or modals)
 * @param {number} [options.edgeThreshold=35] - Maximum starting clientX in pixels to initiate open gesture
 * @param {number} [options.minSwipeDistance=50] - Minimum horizontal travel in pixels to recognize a swipe
 * @param {number} [options.maxSwipeTime=600] - Maximum duration in ms for the swipe gesture
 */
export function useSidebarSwipe({
  sidebarOpen,
  setSidebarOpen,
  enabled = true,
  edgeThreshold = 35,
  minSwipeDistance = 50,
  maxSwipeTime = 600,
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

      // If sidebar is currently closed, only activate when touch begins near the left edge
      if (!sidebarOpen && startX > edgeThreshold) {
        touchStartRef.current = null;
        return;
      }

      touchStartRef.current = {
        startX,
        startY,
        startTime: Date.now(),
        isPotentialSwipe: true,
      };
    };

    const handleTouchMove = (e) => {
      if (!touchStartRef.current || !touchStartRef.current.isPotentialSwipe) return;
      if (e.touches.length !== 1) {
        touchStartRef.current.isPotentialSwipe = false;
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.startX;
      const deltaY = touch.clientY - touchStartRef.current.startY;

      // If vertical movement clearly dominates early on, cancel to allow smooth native vertical scrolling
      if (Math.abs(deltaY) > 25 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        touchStartRef.current.isPotentialSwipe = false;
      }
    };

    const handleTouchEnd = (e) => {
      if (!touchStartRef.current || !touchStartRef.current.isPotentialSwipe) {
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

      // Ensure horizontal intent dominates vertical movement
      if (Math.abs(deltaX) < minSwipeDistance || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
        return;
      }

      // 1. Opening: swipe from left to right (deltaX > 0) when closed
      if (!sidebarOpen && deltaX > 0) {
        setSidebarOpen(true);
      }
      // 2. Closing: swipe from right to left (deltaX < 0) when open
      else if (sidebarOpen && deltaX < 0) {
        setSidebarOpen(false);
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
  }, [sidebarOpen, setSidebarOpen, enabled, edgeThreshold, minSwipeDistance, maxSwipeTime]);
}
