import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getDualPageSpread, getNextSpreadPage, getPrevSpreadPage } from '../utils/pdfPageUtils';
import { saveOfflineProgress } from '../services/offlineStorage';

/**
 * Custom hook to manage PDF page navigation, dual-page layout calculations,
 * continuous scrolling, and reading progress saving.
 */
export function usePageNavigation({
  book,
  pdfDoc,
  containerRef,
  pageRefsMap,
  onProgressUpdate,
  scaleRef,
  invertColorsRef,
  fitWidth,
  centerVerticallyRef,
  setVisiblePageNumbers,
}) {
  const [currentPage, setCurrentPage] = useState(book?.progress?.page || 1);
  const currentPageRef = useRef(book?.progress?.page || 1);
  const [totalPages, setTotalPages] = useState(book?.progress?.total_pages || 1);

  const [isDualPage, setIsDualPage] = useState(() => {
    try {
      return localStorage.getItem('reader_dual_page') === 'true';
    } catch {
      return false;
    }
  });

  const [dualCoverStandalone, setDualCoverStandalone] = useState(() => {
    try {
      return localStorage.getItem('reader_dual_cover') === 'true';
    } catch {
      return false;
    }
  });

  const [scrollMode, setScrollMode] = useState(() => {
    try {
      return localStorage.getItem('reader_scroll_mode') || 'flip'; // 'flip' | 'continuous'
    } catch {
      return 'flip';
    }
  });

  const isContinuous = scrollMode === 'continuous';

  // Format page display text (e.g., "1" or "2-3")
  const getPageDisplayText = useCallback((page) => {
    if (!isDualPage) return String(page);
    const sp = getDualPageSpread(page, totalPages, dualCoverStandalone);
    if (!sp.left && sp.right) return String(sp.right);
    if (sp.left && !sp.right) return String(sp.left);
    return `${sp.left}-${sp.right}`;
  }, [isDualPage, totalPages, dualCoverStandalone]);

  const currentDisplayText = getPageDisplayText(currentPage);
  const [pageInput, setPageInput] = useState(currentDisplayText);
  const [prevDisplayText, setPrevDisplayText] = useState(currentDisplayText);

  if (prevDisplayText !== currentDisplayText) {
    setPrevDisplayText(currentDisplayText);
    setPageInput(currentDisplayText);
  }

  // Sync ref
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Dual page spread calculation
  const spread = useMemo(() => {
    return getDualPageSpread(currentPage, totalPages, dualCoverStandalone);
  }, [currentPage, totalPages, dualCoverStandalone]);

  const allSpreads = useMemo(() => {
    if (!isDualPage || totalPages < 1) return [];
    const spreads = [];
    let p = 1;
    while (p <= totalPages) {
      const sp = getDualPageSpread(p, totalPages, dualCoverStandalone);
      spreads.push(sp);
      const nextP = getNextSpreadPage(sp.currentBase, totalPages, dualCoverStandalone);
      if (nextP <= sp.currentBase) break;
      p = nextP;
    }
    return spreads;
  }, [isDualPage, totalPages, dualCoverStandalone]);

  const hasPrev = isDualPage ? spread.currentBase > 1 : currentPage > 1;
  const hasNext = isDualPage 
    ? (dualCoverStandalone && spread.currentBase === 1 ? totalPages > 1 : spread.currentBase + 2 <= totalPages)
    : currentPage < totalPages;

  const isProgrammaticScrollRef = useRef(false);

  // Smooth scroll to target page in continuous mode
  const scrollToPageInContinuous = useCallback((p, smooth = true) => {
    isProgrammaticScrollRef.current = true;
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, smooth ? 1200 : 150);

    const scrollAction = () => {
      const container = containerRef.current;
      if (!container) return false;
      const targetBase = isDualPage 
        ? getDualPageSpread(p, totalPages, dualCoverStandalone).currentBase 
        : p;
      const el = (isDualPage ? container.querySelector(`#pdf-spread-${targetBase}`) : null) || 
        container.querySelector(`#pdf-page-${p}`);
      if (!el) return false;

      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const elTopInScroll = elRect.top - containerRect.top + container.scrollTop;

      let targetScrollTop = elTopInScroll - 16;
      if (centerVerticallyRef?.current) {
        const containerHeight = container.clientHeight;
        const elHeight = elRect.height;
        if (containerHeight > elHeight) {
          targetScrollTop = elTopInScroll - Math.round((containerHeight - elHeight) / 2);
        }
      }

      container.scrollTo({
        top: Math.max(0, Math.round(targetScrollTop)),
        behavior: smooth ? 'smooth' : 'auto'
      });
      return true;
    };

    if (!scrollAction()) {
      requestAnimationFrame(() => {
        if (!scrollAction()) {
          setTimeout(scrollAction, 40);
        }
      });
    }
  }, [containerRef, totalPages, isDualPage, dualCoverStandalone, centerVerticallyRef]);

  // Toggle dual page layout mode
  const toggleDualPage = useCallback(() => {
    setIsDualPage(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_dual_page', String(next));
      } catch {}
      if (next) {
        const sp = getDualPageSpread(currentPage, totalPages, dualCoverStandalone);
        setCurrentPage(sp.currentBase);
        setTimeout(() => fitWidth(true), 60);
        if (isContinuous) {
          const pList = [sp.currentBase];
          if (sp.left) pList.push(sp.left);
          if (sp.right) pList.push(sp.right);
          if (setVisiblePageNumbers) setVisiblePageNumbers(new Set(pList));
          setTimeout(() => {
            scrollToPageInContinuous(sp.currentBase, false);
          }, 80);
        }
      } else {
        if (isContinuous) {
          setTimeout(() => fitWidth(false), 60);
        }
      }
      return next;
    });
  }, [currentPage, totalPages, dualCoverStandalone, isContinuous, fitWidth, scrollToPageInContinuous, setVisiblePageNumbers]);

  // Toggle standalone cover in dual page mode
  const toggleDualCover = useCallback(() => {
    setDualCoverStandalone(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_dual_cover', String(next));
      } catch {}
      if (isDualPage) {
        const sp = getDualPageSpread(currentPage, totalPages, next);
        setCurrentPage(sp.currentBase);
        if (isContinuous) {
          setTimeout(() => {
            scrollToPageInContinuous(sp.currentBase, false);
          }, 80);
        }
      }
      return next;
    });
  }, [isDualPage, currentPage, totalPages, isContinuous, scrollToPageInContinuous]);

  // Toggle scroll mode between 'flip' and 'continuous'
  const toggleScrollMode = useCallback(() => {
    setScrollMode(prev => {
      const next = prev === 'continuous' ? 'flip' : 'continuous';
      try {
        localStorage.setItem('reader_scroll_mode', next);
      } catch {}
      if (next === 'continuous') {
        const pList = [currentPage];
        if (isDualPage) {
          const sp = getDualPageSpread(currentPage, totalPages, dualCoverStandalone);
          if (sp.left) pList.push(sp.left);
          if (sp.right) pList.push(sp.right);
        }
        if (setVisiblePageNumbers) setVisiblePageNumbers(new Set(pList));
        setTimeout(() => {
          scrollToPageInContinuous(currentPage, false);
        }, 60);
      }
      return next;
    });
  }, [currentPage, isDualPage, totalPages, dualCoverStandalone, scrollToPageInContinuous, setVisiblePageNumbers]);

  // Page Navigation handlers
  const goToNextPage = useCallback(() => {
    if (isContinuous) {
      if (isDualPage) {
        const nextP = getNextSpreadPage(currentPageRef.current, totalPages, dualCoverStandalone);
        currentPageRef.current = nextP;
        setCurrentPage(nextP);
        scrollToPageInContinuous(nextP);
      } else {
        const nextP = Math.min(currentPageRef.current + 1, totalPages);
        currentPageRef.current = nextP;
        setCurrentPage(nextP);
        scrollToPageInContinuous(nextP);
      }
    } else if (!isDualPage) {
      setCurrentPage(prev => (prev < totalPages ? prev + 1 : prev));
    } else {
      setCurrentPage(prev => getNextSpreadPage(prev, totalPages, dualCoverStandalone));
    }
  }, [isContinuous, totalPages, scrollToPageInContinuous, isDualPage, dualCoverStandalone]);

  const goToPrevPage = useCallback(() => {
    if (isContinuous) {
      if (isDualPage) {
        const prevP = getPrevSpreadPage(currentPageRef.current, totalPages, dualCoverStandalone);
        currentPageRef.current = prevP;
        setCurrentPage(prevP);
        scrollToPageInContinuous(prevP);
      } else {
        const prevP = Math.max(currentPageRef.current - 1, 1);
        currentPageRef.current = prevP;
        setCurrentPage(prevP);
        scrollToPageInContinuous(prevP);
      }
    } else if (!isDualPage) {
      setCurrentPage(prev => (prev > 1 ? prev - 1 : prev));
    } else {
      setCurrentPage(prev => getPrevSpreadPage(prev, totalPages, dualCoverStandalone));
    }
  }, [isContinuous, totalPages, scrollToPageInContinuous, isDualPage, dualCoverStandalone]);

  const handleLinkNavigate = useCallback((target) => {
    if (target === 'next') {
      goToNextPage();
    } else if (target === 'prev') {
      goToPrevPage();
    } else if (typeof target === 'number') {
      const targetPage = Math.min(Math.max(1, target), totalPages);
      if (isContinuous) {
        if (isDualPage) {
          const sp = getDualPageSpread(targetPage, totalPages, dualCoverStandalone);
          currentPageRef.current = sp.currentBase;
          setCurrentPage(sp.currentBase);
          scrollToPageInContinuous(targetPage);
        } else {
          currentPageRef.current = targetPage;
          setCurrentPage(targetPage);
          scrollToPageInContinuous(targetPage);
        }
      } else if (isDualPage) {
        const sp = getDualPageSpread(targetPage, totalPages, dualCoverStandalone);
        setCurrentPage(sp.currentBase);
      } else {
        setCurrentPage(targetPage);
      }
    }
  }, [isContinuous, goToNextPage, goToPrevPage, totalPages, scrollToPageInContinuous, isDualPage, dualCoverStandalone]);

  const handlePageSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    const match = pageInput.trim().match(/^\d+/);
    const num = match ? parseInt(match[0], 10) : NaN;
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      if (isContinuous) {
        if (isDualPage) {
          const sp = getDualPageSpread(num, totalPages, dualCoverStandalone);
          currentPageRef.current = sp.currentBase;
          setCurrentPage(sp.currentBase);
          scrollToPageInContinuous(num);
        } else {
          currentPageRef.current = num;
          setCurrentPage(num);
          scrollToPageInContinuous(num);
        }
      } else if (isDualPage) {
        const sp = getDualPageSpread(num, totalPages, dualCoverStandalone);
        setCurrentPage(sp.currentBase);
      } else {
        setCurrentPage(num);
      }
    } else {
      setPageInput(getPageDisplayText(currentPage));
    }
  }, [pageInput, totalPages, isContinuous, isDualPage, dualCoverStandalone, scrollToPageInContinuous, currentPage, getPageDisplayText]);

  const handlePageInputBlur = useCallback(() => {
    setPageInput(getPageDisplayText(currentPage));
  }, [currentPage, getPageDisplayText]);

  // Track active page on continuous scroll
  const scrollRafRef = useRef(null);
  const handleContinuousScroll = useCallback(() => {
    if (!isContinuous || !containerRef.current || isProgrammaticScrollRef.current) return;
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;

    if (scrollTop <= 15) {
      if (currentPageRef.current !== 1) {
        currentPageRef.current = 1;
        setCurrentPage(1);
      }
      return;
    }

    if (scrollTop + clientHeight >= scrollHeight - 20) {
      const targetLast = isDualPage 
        ? getDualPageSpread(totalPages, totalPages, dualCoverStandalone).currentBase 
        : totalPages;
      if (currentPageRef.current !== targetLast) {
        currentPageRef.current = targetLast;
        setCurrentPage(targetLast);
      }
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const probeY = containerRect.top + clientHeight * 0.5;

    let foundPage = null;
    if (pageRefsMap?.current) {
      pageRefsMap.current.forEach((el, p) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (probeY >= r.top && probeY <= r.bottom) {
          foundPage = p;
        }
      });
    }

    if (foundPage) {
      const activeBase = isDualPage 
        ? getDualPageSpread(foundPage, totalPages, dualCoverStandalone).currentBase 
        : foundPage;
      if (activeBase !== currentPageRef.current) {
        currentPageRef.current = activeBase;
        setCurrentPage(activeBase);
      }
    }
  }, [isContinuous, containerRef, totalPages, isDualPage, dualCoverStandalone, pageRefsMap]);

  const onContainerScroll = useCallback(() => {
    if (!isContinuous) return;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      handleContinuousScroll();
    });
  }, [isContinuous, handleContinuousScroll]);

  const initializeDocument = useCallback((docTotalPages, docInitialPage) => {
    setTotalPages(docTotalPages);
    const startPage = Math.min(Math.max(1, docInitialPage || 1), docTotalPages);
    setCurrentPage(startPage);
    currentPageRef.current = startPage;
  }, []);

  // Save Progress to Backend
  const onProgressUpdateRef = useRef(onProgressUpdate);
  useEffect(() => {
    onProgressUpdateRef.current = onProgressUpdate;
  }, [onProgressUpdate]);

  const saveProgress = useCallback((page, total) => {
    if (!page || !total || !book?.id) return;
    const calcPercent = Number(((page / total) * 100).toFixed(1));
    const payload = {
      book_id: book.id,
      page: page,
      total_pages: total,
      percent: calcPercent,
      zoom: scaleRef?.current || 1.2,
      invert_colors: invertColorsRef?.current || false,
    };
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
      if (onProgressUpdateRef.current && data.progress) {
        onProgressUpdateRef.current(book.id, data.progress);
      }
    })
    .catch(err => {
      console.warn('Network progress sync failed, saving offline:', err);
      saveOfflineProgress(book.id, payload).catch(e => console.error(e));
      if (onProgressUpdateRef.current) {
        onProgressUpdateRef.current(book.id, payload);
      }
    });
  }, [book, scaleRef, invertColorsRef]);

  // Persist progress to backend with debounce (only when progressed past page 1)
  useEffect(() => {
    if (!pdfDoc || totalPages < 1) return;
    if (currentPage <= 1) return;
    const timer = setTimeout(() => {
      saveProgress(currentPage, totalPages);
    }, 400);
    return () => clearTimeout(timer);
  }, [pdfDoc, currentPage, totalPages, saveProgress]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    pageInput,
    setPageInput,
    getPageDisplayText,
    isDualPage,
    setIsDualPage,
    toggleDualPage,
    dualCoverStandalone,
    setDualCoverStandalone,
    toggleDualCover,
    scrollMode,
    isContinuous,
    toggleScrollMode,
    spread,
    allSpreads,
    hasPrev,
    hasNext,
    goToNextPage,
    goToPrevPage,
    handleLinkNavigate,
    handlePageSubmit,
    handlePageInputBlur,
    scrollToPageInContinuous,
    isProgrammaticScrollRef,
    onContainerScroll,
    initializeDocument,
    saveProgress,
  };
}
