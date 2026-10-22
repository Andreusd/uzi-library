import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage PDF zoom level, fit-to-width calculations,
 * and automatic synchronization with localStorage & backend API.
 */
export function useZoomControls({ book, pdfDoc, containerRef, isDualPage }) {
  const getInitialZoom = useCallback(() => {
    try {
      const localZoom = localStorage.getItem(`book_zoom_${book?.id}`);
      if (localZoom) {
        const parsed = parseFloat(localZoom);
        if (!isNaN(parsed) && parsed >= 0.4 && parsed <= 3.5) {
          return parsed;
        }
      }
    } catch {}

    if (book?.progress?.zoom) {
      const z = parseFloat(book.progress.zoom);
      if (!isNaN(z) && z >= 0.4 && z <= 3.5) {
        return z;
      }
    }
    return 1.2;
  }, [book]);

  const [scale, setScale] = useState(getInitialZoom);
  const scaleRef = useRef(scale);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Fit Width calculation
  const fitWidth = useCallback((forcedDual, pageNumber = 1) => {
    if (!pdfDoc || !containerRef.current) return;
    const activeDual = forcedDual !== undefined ? forcedDual : isDualPage;
    pdfDoc.getPage(pageNumber).then(page => {
      const vp = page.getViewport({ scale: 1 });
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      const padding = isMobile ? 8 : 48;
      const containerWidth = Math.max(100, containerRef.current.clientWidth - padding);
      const targetScale = activeDual 
        ? Math.max(0.4, Math.min((containerWidth - 24) / (2 * vp.width), 2.5))
        : Math.max(0.4, Math.min(containerWidth / vp.width, 2.5));
      setScale(Number(targetScale.toFixed(2)));
    }).catch(() => {});
  }, [pdfDoc, containerRef, isDualPage]);

  const handleZoomIn = useCallback((step = 0.15) => {
    setScale(s => Math.min(3.5, Number((s + step).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback((step = 0.15) => {
    setScale(s => Math.max(0.5, Number((s - step).toFixed(2))));
  }, []);

  const handleResetZoom = useCallback((currentPage = 1) => {
    if (isDualPage) {
      fitWidth(true, currentPage);
    } else {
      setScale(1.2);
    }
  }, [isDualPage, fitWidth]);

  // Persist zoom level to localStorage and backend with debounce
  useEffect(() => {
    if (!pdfDoc || !book?.id) return;
    try {
      localStorage.setItem(`book_zoom_${book.id}`, String(scale));
    } catch {}

    const timer = setTimeout(() => {
      fetch('/api/book/zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: book.id,
          zoom: scale
        })
      }).catch(err => console.error('Failed to save zoom:', err));
    }, 500);

    return () => clearTimeout(timer);
  }, [book?.id, scale, pdfDoc]);

  return {
    scale,
    setScale,
    scaleRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    fitWidth,
  };
}
