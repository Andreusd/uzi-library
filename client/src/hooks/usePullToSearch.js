import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to detect when a user pulls down from the top of the library page,
 * triggering the search books function.
 *
 * @param {Object} options
 * @param {Function} options.onTriggerSearch - Callback to trigger search
 * @param {boolean} [options.enabled=true] - Whether the gesture is active
 * @param {number} [options.threshold=65] - Distance in px to trigger search on release
 * @param {number} [options.maxPull=110] - Max visual pull distance in px
 */
export function usePullToSearch({
  onTriggerSearch,
  enabled = true,
  threshold = 65,
  maxPull = 110,
}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isThresholdReached, setIsThresholdReached] = useState(false);

  const touchStateRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    currentPull: 0,
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setPullDistance(0);
      setIsPulling(false);
      setIsThresholdReached(false);
      return;
    }

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) {
        touchStateRef.current.active = false;
        return;
      }

      // Only allow pull-down when page is scrolled to the top
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollY > 5) {
        touchStateRef.current.active = false;
        return;
      }

      // Ignore touches on interactive form elements
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        touchStateRef.current.active = false;
        return;
      }

      const touch = e.touches[0];
      touchStateRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        currentPull: 0,
      };
    };

    const handleTouchMove = (e) => {
      if (!touchStateRef.current.active || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStateRef.current.startX;
      const deltaY = touch.clientY - touchStateRef.current.startY;

      // If scrolling up, or if horizontal movement dominates (e.g. sidebar swipe), cancel
      if (deltaY < 0 || Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        if (touchStateRef.current.currentPull > 0) {
          touchStateRef.current.currentPull = 0;
          setPullDistance(0);
          setIsPulling(false);
          setIsThresholdReached(false);
        }
        touchStateRef.current.active = false;
        return;
      }

      // Verify we are still near the top
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollY > 5) {
        touchStateRef.current.active = false;
        setPullDistance(0);
        setIsPulling(false);
        setIsThresholdReached(false);
        return;
      }

      // Dampen the pull distance (rubber-band resistance)
      const damped = Math.min(maxPull, deltaY * 0.45);
      touchStateRef.current.currentPull = damped;

      setPullDistance(damped);
      setIsPulling(damped > 0);
      setIsThresholdReached(damped >= threshold);
    };

    const handleTouchEnd = () => {
      if (!touchStateRef.current.active) return;
      const reached = touchStateRef.current.currentPull >= threshold;

      touchStateRef.current.active = false;
      touchStateRef.current.currentPull = 0;

      setPullDistance(0);
      setIsPulling(false);
      setIsThresholdReached(false);

      if (reached) {
        onTriggerSearch?.();
      }
    };

    const handleTouchCancel = () => {
      touchStateRef.current.active = false;
      touchStateRef.current.currentPull = 0;
      setPullDistance(0);
      setIsPulling(false);
      setIsThresholdReached(false);
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
  }, [enabled, onTriggerSearch, threshold, maxPull]);

  return {
    pullDistance,
    isPulling,
    isThresholdReached,
  };
}
