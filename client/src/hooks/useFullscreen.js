import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to monitor and toggle browser fullscreen state,
 * with cross-browser support for mobile (WebKit / Safari / Chrome)
 * and smart automatic fullscreen recovery upon returning from background/app-switching.
 */
export function useFullscreen() {
  const getFullscreenElement = () => {
    if (typeof document === 'undefined') return null;
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null
    );
  };

  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof window !== 'undefined' && window.AndroidApp?.isFullscreen) {
      try {
        return Boolean(window.AndroidApp.isFullscreen());
      } catch {}
    }
    return Boolean(getFullscreenElement());
  });
  const isFullscreenRef = useRef(isFullscreen);
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  // Flag indicating whether we should attempt to restore fullscreen on the next user gesture
  const pendingFullscreenRestoreRef = useRef(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(getFullscreenElement());
      setIsFullscreen(active);

      // If fullscreen was exited while the page was actively visible and focused,
      // it means the user explicitly exited (e.g. Esc or browser back gesture).
      if (!active && typeof document !== 'undefined' && document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus())) {
        pendingFullscreenRestoreRef.current = false;
      }
    };

    const handleAndroidFullscreenChange = (e) => {
      if (e?.detail && typeof e.detail.isFullscreen === 'boolean') {
        setIsFullscreen(e.detail.isFullscreen);
      } else if (typeof window !== 'undefined' && window.AndroidApp?.isFullscreen) {
        try {
          setIsFullscreen(Boolean(window.AndroidApp.isFullscreen()));
        } catch {}
      }
    };

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    events.forEach(evt => document.addEventListener(evt, handleFullscreenChange));
    window.addEventListener('uzi-fullscreen-change', handleAndroidFullscreenChange);

    return () => {
      events.forEach(evt => document.removeEventListener(evt, handleFullscreenChange));
      window.removeEventListener('uzi-fullscreen-change', handleAndroidFullscreenChange);
    };
  }, []);

  const requestFullscreenInternal = useCallback(() => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement;
    const req =
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen;

    if (req) {
      try {
        let res;
        try {
          res = req.call(docEl, { navigationUI: 'hide' });
        } catch {
          res = req.call(docEl);
        }
        if (res && res.then) {
          res.then(() => {
            pendingFullscreenRestoreRef.current = false;
          }).catch(() => {
            // If gesture was rejected on this event phase, leave pending flag armed for next touch event
          });
        } else {
          pendingFullscreenRestoreRef.current = false;
        }
      } catch {}
    }
  }, []);

  const restoreFullscreenOnUserGesture = useCallback(() => {
    if (!pendingFullscreenRestoreRef.current || getFullscreenElement()) return;
    requestFullscreenInternal();
  }, [requestFullscreenInternal]);

  // Track app switching / backgrounding (visibilitychange, pagehide, blur)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleAppBackground = () => {
      // If fullscreen is currently active (or was active right before minimizing)
      if (Boolean(getFullscreenElement()) || isFullscreenRef.current) {
        pendingFullscreenRestoreRef.current = true;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAppBackground();
      }
    };

    const onUserInteraction = () => {
      if (pendingFullscreenRestoreRef.current && !getFullscreenElement()) {
        restoreFullscreenOnUserGesture();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleAppBackground);
    window.addEventListener('blur', handleAppBackground);

    // Listen to user touch/click gestures in capture phase to restore fullscreen on first touch
    window.addEventListener('touchstart', onUserInteraction, { capture: true, passive: true });
    window.addEventListener('touchend', onUserInteraction, { capture: true, passive: true });
    window.addEventListener('pointerdown', onUserInteraction, { capture: true, passive: true });
    window.addEventListener('click', onUserInteraction, { capture: true, passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleAppBackground);
      window.removeEventListener('blur', handleAppBackground);

      window.removeEventListener('touchstart', onUserInteraction, { capture: true });
      window.removeEventListener('touchend', onUserInteraction, { capture: true });
      window.removeEventListener('pointerdown', onUserInteraction, { capture: true });
      window.removeEventListener('click', onUserInteraction, { capture: true });
    };
  }, [restoreFullscreenOnUserGesture]);

  const toggleFullscreen = useCallback(() => {
    if (typeof window !== 'undefined' && window.AndroidApp?.toggleFullscreen) {
      try {
        window.AndroidApp.toggleFullscreen();
        return;
      } catch (err) {
        console.warn('AndroidApp.toggleFullscreen failed, falling back to browser API:', err);
      }
    }

    if (typeof document === 'undefined') return;

    const fsElement = getFullscreenElement();
    const docEl = document.documentElement;

    if (!fsElement) {
      pendingFullscreenRestoreRef.current = false;
      requestFullscreenInternal();
    } else {
      pendingFullscreenRestoreRef.current = false;
      const exitFs =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;

      if (exitFs) {
        try {
          const res = exitFs.call(document);
          if (res && res.catch) {
            res.catch((err) => console.warn('Failed to exit fullscreen mode:', err));
          }
        } catch (err) {
          console.warn('Exit fullscreen failed:', err);
        }
      }
    }
  }, [requestFullscreenInternal]);

  return { isFullscreen, toggleFullscreen, restoreFullscreenOnUserGesture };
}
