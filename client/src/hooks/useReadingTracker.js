import { useEffect, useRef, useCallback } from 'react';
import { activityApi } from '../api';

const OFFLINE_QUEUE_KEY = 'uzi_offline_activity_queue';

export const DEFAULT_CHARS_PER_SECOND = 30;
export const DEFAULT_MIN_FLOOR_SECONDS = 3;
export const DEFAULT_EMPTY_PAGE_FLOOR_SECONDS = 5;
export const DEFAULT_MAX_CAP_SECONDS = 45;
export const MAX_AFK_DWELL_SECONDS = 300;

/**
 * Calculates dynamic required dwell time (in seconds) based on page character count:
 * - 30 chars/second (standard fast reading speed ~300 words/min).
 * - Minimum floor: 3 seconds (dedications, titles, short epigraphs).
 * - Empty / image page floor: 5 seconds (comics, illustrations, title covers).
 * - Maximum required cap: 45 seconds (dense pages 1350+ chars don't force > 45s wait).
 */
export function calculateRequiredDwellSeconds(
  charCount,
  charsPerSecond = DEFAULT_CHARS_PER_SECOND,
  minFloor = DEFAULT_MIN_FLOOR_SECONDS,
  maxCap = DEFAULT_MAX_CAP_SECONDS,
  emptyFloor = DEFAULT_EMPTY_PAGE_FLOOR_SECONDS
) {
  if (charCount == null || charCount <= 0) {
    return emptyFloor;
  }
  const calculated = Math.round(charCount / charsPerSecond);
  return Math.min(maxCap, Math.max(minFloor, calculated));
}

/**
 * Flush any queued offline activity records to the backend.
 */
export async function flushOfflineActivityQueue() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue) || queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        await activityApi.recordActivity(item);
      } catch (err) {
        remaining.push(item);
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  } catch (e) {
    console.warn('[ReadingTracker] Error flushing offline queue:', e);
  }
}

/**
 * Hook to track reading dwell time per page and record reading activity dynamically.
 * 
 * Rules:
 * 1. User must stay at least dynamic required time on a page (based on character count: 30 chars/s, floor 3s, cap 45s).
 * 2. Capped at 5 minutes (300s) anti-AFK.
 * 3. Pauses dwell timing when tab is in background (visibilitychange).
 * 4. Queues locally when offline and syncs when back online.
 */
export function useReadingTracker({
  bookId,
  currentPage,
  totalPages = null,
  isDualPage = false,
  spread = null,
  enabled = true,
  getText = null,
  charsPerSecond = DEFAULT_CHARS_PER_SECOND,
  minFloorSeconds = DEFAULT_MIN_FLOOR_SECONDS,
  maxCapSeconds = DEFAULT_MAX_CAP_SECONDS,
  emptyPageFloorSeconds = DEFAULT_EMPTY_PAGE_FLOOR_SECONDS,
}) {
  const currentTrackerStateRef = useRef({
    page: currentPage,
    spreadPages: isDualPage && spread ? [spread.left, spread.right].filter(Boolean) : [currentPage].filter(Boolean),
    dwellStart: Date.now(),
    accumulatedMs: 0,
    isActive: typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
    lastVisibleTimestamp: Date.now(),
    charCount: null,
    requiredDwellSeconds: emptyPageFloorSeconds,
  });

  // Keep track of pages already recorded today for this book to avoid duplicates
  const recordedPagesTodayRef = useRef(new Set());

  // Helper to commit dwell time for the currently viewed page(s)
  const commitDwellTime = useCallback((reason = 'page_change') => {
    if (!enabled || !bookId) return;

    const state = currentTrackerStateRef.current;
    if (!state.page && state.spreadPages.length === 0) return;

    const now = Date.now();
    let totalDwellMs = state.accumulatedMs;
    if (state.isActive) {
      totalDwellMs += (now - state.lastVisibleTimestamp);
    }

    const dwellSeconds = Math.min(MAX_AFK_DWELL_SECONDS, Math.round(totalDwellMs / 1000));
    const requiredSeconds = state.requiredDwellSeconds ?? emptyPageFloorSeconds;

    // Must reach dynamic required dwell threshold
    if (dwellSeconds >= requiredSeconds) {
      const pagesToRecord = state.spreadPages.length > 0 ? state.spreadPages : [state.page];
      const validPages = pagesToRecord.filter((p) => typeof p === 'number' && p > 0);

      // Check if newly counted pages exist
      const unrecordedPages = validPages.filter((p) => !recordedPagesTodayRef.current.has(p));

      if (unrecordedPages.length > 0) {
        unrecordedPages.forEach((p) => recordedPagesTodayRef.current.add(p));
        const todayStr = new Date().toISOString().slice(0, 10);
        const payload = {
          book_id: bookId,
          date: todayStr,
          pages: unrecordedPages,
          reading_time_seconds: dwellSeconds,
        };

        // Attempt async save, or enqueue offline
        activityApi.recordActivity(payload).catch(() => {
          try {
            const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
            const queue = raw ? JSON.parse(raw) : [];
            queue.push(payload);
            localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
          } catch {}
        });
      }
    }
  }, [bookId, enabled, emptyPageFloorSeconds]);

  // Handle visibility changes (anti-AFK and background pause)
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const state = currentTrackerStateRef.current;
      const now = Date.now();

      if (document.visibilityState === 'hidden') {
        if (state.isActive) {
          state.accumulatedMs += Math.min(MAX_AFK_DWELL_SECONDS * 1000, now - state.lastVisibleTimestamp);
          state.isActive = false;
        }
      } else {
        state.isActive = true;
        state.lastVisibleTimestamp = now;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  // Flush offline queue on mount or when coming online
  useEffect(() => {
    if (typeof window === 'undefined') return;
    flushOfflineActivityQueue();

    const handleOnline = () => {
      flushOfflineActivityQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // When currentPage or spread changes, commit dwell for previous page and reset timer
  useEffect(() => {
    if (!enabled || !currentPage) return;

    const pages = isDualPage && spread
      ? [spread.left, spread.right].filter(Boolean)
      : [currentPage].filter(Boolean);

    const prevPage = currentTrackerStateRef.current.page;
    if (prevPage !== currentPage) {
      // User changed page - commit dwell time on previous page
      commitDwellTime('page_change');

      // Reset state for new page
      currentTrackerStateRef.current = {
        page: currentPage,
        spreadPages: pages,
        dwellStart: Date.now(),
        accumulatedMs: 0,
        isActive: document.visibilityState === 'visible',
        lastVisibleTimestamp: Date.now(),
        charCount: null,
        requiredDwellSeconds: emptyPageFloorSeconds,
      };
    } else {
      currentTrackerStateRef.current.spreadPages = pages;
    }

    // Compute dynamic character count and dwell time for the active page
    let isCancelled = false;
    const applyText = (text) => {
      const clean = (text || '').replace(/\s+/g, ' ').trim();
      const charCount = clean.length;
      const req = calculateRequiredDwellSeconds(
        charCount,
        charsPerSecond,
        minFloorSeconds,
        maxCapSeconds,
        emptyPageFloorSeconds
      );
      currentTrackerStateRef.current.charCount = charCount;
      currentTrackerStateRef.current.requiredDwellSeconds = req;
    };

    if (typeof getText === 'function') {
      try {
        const res = getText(currentPage, pages);
        if (res && typeof res.then === 'function') {
          res
            .then((text) => {
              if (isCancelled) return;
              applyText(text);
            })
            .catch(() => {
              if (isCancelled) return;
              currentTrackerStateRef.current.requiredDwellSeconds = emptyPageFloorSeconds;
            });
        } else {
          applyText(res);
        }
      } catch {
        currentTrackerStateRef.current.requiredDwellSeconds = emptyPageFloorSeconds;
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [
    currentPage,
    isDualPage,
    spread,
    enabled,
    commitDwellTime,
    getText,
    charsPerSecond,
    minFloorSeconds,
    maxCapSeconds,
    emptyPageFloorSeconds
  ]);

  // Commit on unmount / beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      commitDwellTime('unload');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      commitDwellTime('unmount');
    };
  }, [commitDwellTime]);
}
