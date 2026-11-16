import { useEffect, useRef, useCallback } from 'react';
import { activityApi } from '../api';

const OFFLINE_QUEUE_KEY = 'uzi_offline_activity_queue';
const MIN_DWELL_SECONDS = 15;
const MAX_DWELL_SECONDS = 300;

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
 * Hook to track reading dwell time per page and record reading activity.
 * 
 * Rules:
 * 1. User must stay at least 15s on a page for it to be counted as read.
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
}) {
  const currentTrackerStateRef = useRef({
    page: currentPage,
    spreadPages: isDualPage && spread ? [spread.left, spread.right].filter(Boolean) : [currentPage].filter(Boolean),
    dwellStart: Date.now(),
    accumulatedMs: 0,
    isActive: typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
    lastVisibleTimestamp: Date.now(),
  });

  // Keep track of pages already recorded today for this book to avoid spamming
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

    const dwellSeconds = Math.min(MAX_DWELL_SECONDS, Math.round(totalDwellMs / 1000));

    // Must reach minimum dwell threshold (e.g., 15 seconds)
    if (dwellSeconds >= MIN_DWELL_SECONDS) {
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
  }, [bookId, enabled]);

  // Handle visibility changes (anti-AFK and background pause)
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const state = currentTrackerStateRef.current;
      const now = Date.now();

      if (document.visibilityState === 'hidden') {
        if (state.isActive) {
          state.accumulatedMs += Math.min(MAX_DWELL_SECONDS * 1000, now - state.lastVisibleTimestamp);
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
      };
    } else {
      // Same page number, but maybe spread changed
      currentTrackerStateRef.current.spreadPages = pages;
    }
  }, [currentPage, isDualPage, spread, enabled, commitDwellTime]);

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
