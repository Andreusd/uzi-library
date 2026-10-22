import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to monitor and toggle browser fullscreen state,
 * with cross-browser support for mobile (WebKit / Safari / Chrome).
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

  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(getFullscreenElement()));

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange'
    ];

    events.forEach(evt => document.addEventListener(evt, handleFullscreenChange));
    return () => {
      events.forEach(evt => document.removeEventListener(evt, handleFullscreenChange));
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;

    const fsElement = getFullscreenElement();
    const docEl = document.documentElement;

    if (!fsElement) {
      const requestFs =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (requestFs) {
        try {
          let res;
          try {
            res = requestFs.call(docEl, { navigationUI: 'hide' });
          } catch {
            res = requestFs.call(docEl);
          }
          if (res && res.catch) {
            res.catch((err) => console.warn('Failed to enter fullscreen mode:', err));
          }
        } catch (err) {
          console.warn('Fullscreen call failed:', err);
        }
      }
    } else {
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
  }, []);

  return { isFullscreen, toggleFullscreen };
}
