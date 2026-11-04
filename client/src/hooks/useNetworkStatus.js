import { useState, useEffect, useCallback } from 'react';

/**
 * Tracks browser online status and backend server reachability.
 * Provides unified `isOffline` flag when either the device network is down
 * or the UziLibrary backend server is unreachable.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isServerReachable, setIsServerReachable] = useState(true);

  const checkReachability = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsServerReachable(false);
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/libraries', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const reachable = res.status < 500;
      setIsServerReachable(reachable);
      return reachable;
    } catch {
      setIsServerReachable(false);
      return false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkReachability();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsServerReachable(false);
    };

    const handleReachabilityEvent = (e) => {
      if (e.detail && typeof e.detail.reachable === 'boolean') {
        setIsServerReachable(e.detail.reachable);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('uzi_server_reachability', handleReachabilityEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('uzi_server_reachability', handleReachabilityEvent);
    };
  }, [checkReachability]);

  const isOffline = !isOnline || !isServerReachable;

  return {
    isOnline,
    isServerReachable,
    isOffline,
    checkReachability,
  };
}
