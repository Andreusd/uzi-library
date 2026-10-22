import React, { useState, useEffect, useRef, useCallback } from 'react';
import ePub from 'epubjs';
import CommentsDrawer from './CommentsDrawer';
import TextSelectionMenu from './TextSelectionMenu';
import BookSearchBar from './BookSearchBar';
import TtsPlayerBar from './TtsPlayerBar';
import PdfOutline from './PdfOutline';
import EpubToolbar from './EpubToolbar';
import EpubReaderStage from './EpubReaderStage';
import { useFullscreen } from '../hooks/useFullscreen';
import { useEpubTheme } from '../hooks/useEpubTheme';
import { useEpubSearch } from '../hooks/useEpubSearch';
import { useEpubTts } from '../hooks/useEpubTts';
import { useEpubAnnotations } from '../hooks/useEpubAnnotations';
import { useEpubNavigation } from '../hooks/useEpubNavigation';
import {
  findChapterLabel,
  getInitialCfi,
  getInitialPercent,
  getInitialPage,
  getInitialTotalPages,
} from '../utils/epubLocationUtils';

/**
 * Universal EPUB Reader component orchestrating epub.js rendering,
 * navigation, theme application, full-text search, TTS, and annotations.
 */
export default function EpubViewer({
  book,
  onClose,
  onProgressUpdate,
  onToggleFavorite,
  isFavorite,
  showFileExtension,
  mode,
  onModeChange,
}) {

  const shouldShowExtension = showFileExtension !== undefined 
    ? Boolean(showFileExtension) 
    : (() => {
        try {
          return localStorage.getItem('show_file_extension') !== 'false';
        } catch {
          return true;
        }
      })();

  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const bookPropRef = useRef(book);
  useEffect(() => {
    bookPropRef.current = book;
  }, [book]);

  const renditionRef = useRef(null);
  const tocRef = useRef([]);
  const saveTimeoutRef = useRef(null);

  const [favState, setFavState] = useState(isFavorite !== undefined ? isFavorite : Boolean(book.is_favorite));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toc, setToc] = useState([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [renditionReady, setRenditionReady] = useState(false);

  const [prevBookId, setPrevBookId] = useState(book.id);
  if (book.id !== prevBookId) {
    setPrevBookId(book.id);
    setLoading(true);
    setError(null);
  }

  const [prevIsFavorite, setPrevIsFavorite] = useState(isFavorite);
  if (isFavorite !== prevIsFavorite) {
    setPrevIsFavorite(isFavorite);
    if (isFavorite !== undefined) {
      setFavState(isFavorite);
    }
  }

  const initialCfi = getInitialCfi(book);
  const initialPercent = getInitialPercent(book);
  const initialCfiRef = useRef(initialCfi);
  const initialPercentRef = useRef(initialPercent);
  const isInitialRelocationRef = useRef(true);

  // Reading location & chapter
  const [locationInfo, setLocationInfo] = useState(() => ({
    cfi: initialCfi,
    percentage: Math.round(initialPercent),
    chapter: ''
  }));

  // Reading page information
  const [pageInfo, setPageInfo] = useState(() => ({
    page: getInitialPage(book),
    total: getInitialTotalPages(book)
  }));
  const [pageInput, setPageInput] = useState(() => String(getInitialPage(book)));

  const isLocationsReadyRef = useRef(false);
  const locationInfoRef = useRef(locationInfo);
  const pageInfoRef = useRef(pageInfo);

  useEffect(() => {
    locationInfoRef.current = locationInfo;
  }, [locationInfo]);

  useEffect(() => {
    pageInfoRef.current = pageInfo;
  }, [pageInfo]);

  // Handle Page Jump
  const handlePageSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetPage = parseInt(pageInput, 10);
    if (isNaN(targetPage) || !renditionRef.current) return;

    if (
      isLocationsReadyRef.current &&
      bookRef.current?.locations &&
      bookRef.current.locations.total > 0 &&
      typeof bookRef.current.locations.length === 'function' &&
      bookRef.current.locations.length() > 0
    ) {
      const total = bookRef.current.locations.length();
      const clamped = Math.min(Math.max(1, targetPage), total);
      try {
        const targetCfi = bookRef.current.locations.cfiFromLocation(clamped - 1);
        if (targetCfi) {
          renditionRef.current.display(targetCfi);
          setPageInput(String(clamped));
          return;
        }
      } catch (err) {
        console.warn('Failed to jump to page in EPUB via location:', err);
      }
    }

    if (pageInfo.total > 1) {
      const clamped = Math.min(Math.max(1, targetPage), pageInfo.total);
      const pct = (clamped - 1) / (pageInfo.total || 1);
      try {
        if (bookRef.current?.locations && typeof bookRef.current.locations.cfiFromPercentage === 'function') {
          const targetCfi = bookRef.current.locations.cfiFromPercentage(pct);
          if (targetCfi) {
            renditionRef.current.display(targetCfi);
            setPageInput(String(clamped));
            return;
          }
        }
      } catch {}

      const spineItems = bookRef.current?.spine?.items || [];
      if (spineItems.length > 0) {
        const targetSpineIdx = Math.min(spineItems.length - 1, Math.round(pct * (spineItems.length - 1)));
        const section = spineItems[targetSpineIdx];
        if (section?.href) {
          renditionRef.current.display(section.href);
          setPageInput(String(clamped));
        }
      }
    }
  };

  // Fullscreen
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Subsystem Hook 1: Theme & Font
  const themeSystem = useEpubTheme({
    book,
    mode,
    onModeChange,
    renditionRef,
    viewerRef,
  });

  // Subsystem Hook 2: Full-Text Search
  const searchSystem = useEpubSearch({
    bookRef,
    renditionRef,
  });

  // Subsystem Hook 3: Text-to-Speech
  const ttsSystem = useEpubTts({
    renditionRef,
    pageInfo,
    locationInfo,
  });

  // Subsystem Hook 4: Annotations & Highlights
  const annotationsSystem = useEpubAnnotations({
    book,
    renditionRef,
    renditionReady,
    viewerRef,
    locationInfo,
  });

  // Handle Close & Flush Progress
  const handleClose = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const cfi = locationInfo.cfi;
    const percent = locationInfo.percentage;
    let computedPage = pageInfo.page || 1;
    if (cfi && typeof cfi === 'string') {
      const match = cfi.match(/\/6\/(\d+)!/);
      if (match) {
        const spineIndex = Math.max(0, Math.floor(parseInt(match[1], 10) / 2) - 1);
        computedPage = spineIndex + 1;
      }
    }

    const totalPages = pageInfo.total > 0 ? pageInfo.total : 100;
    const payload = {
      book_id: book.id,
      page: computedPage,
      total_pages: totalPages,
      percent: percent,
      cfi: cfi || undefined,
    };

    try {
      if (cfi) localStorage.setItem(`book_cfi_${book.id}`, cfi);
      localStorage.setItem(`book_percent_${book.id}`, String(percent));
      localStorage.setItem(`book_page_${book.id}`, String(computedPage));
      localStorage.setItem(`book_total_pages_${book.id}`, String(totalPages));
    } catch {}

    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(err => console.error('Failed to flush EPUB progress on exit:', err));

    if (onProgressUpdate) {
      onProgressUpdate(book.id, payload);
    }

    onClose();
  }, [book.id, locationInfo.cfi, locationInfo.percentage, pageInfo.page, pageInfo.total, onClose, onProgressUpdate]);

  // Subsystem Hook 5: Navigation, Gestures & Header Auto-Hide
  const navSystem = useEpubNavigation({
    renditionRef,
    viewerRef,
    themeRef: themeSystem.themeRef,
    tocOpen,
    setTocOpen,
    commentsDrawerOpen: annotationsSystem.commentsDrawerOpen,
    setCommentsDrawerOpen: annotationsSystem.setCommentsDrawerOpen,
    searchOpen: searchSystem.searchOpen,
    setSearchOpen: searchSystem.setSearchOpen,
    handleCloseSearch: searchSystem.handleCloseSearch,
    ttsOpen: ttsSystem.ttsOpen,
    setTtsOpen: ttsSystem.setTtsOpen,
    toggleTts: ttsSystem.toggleTts,
    selectionMenu: annotationsSystem.selectionMenu,
    setSelectionMenu: annotationsSystem.setSelectionMenu,
    toggleFullscreen,
    cycleTheme: themeSystem.cycleTheme,
    handleClose,
  });

  const { themeRef, fontSizeRef } = themeSystem;
  const { setSelectionMenu } = annotationsSystem;
  const { attachListenersToIframeRef, handleKeyDownRef } = navSystem;

  // Debounced progress saver
  const saveProgressDebounced = useCallback((cfi, percent, page, total) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      let computedPage = page || 1;
      if (cfi && typeof cfi === 'string') {
        const match = cfi.match(/\/6\/(\d+)!/);
        if (match) {
          const spineIndex = Math.max(0, Math.floor(parseInt(match[1], 10) / 2) - 1);
          computedPage = spineIndex + 1;
        }
      }

      const totalPages = (typeof total === 'number' && total > 0) ? total : 100;
      let finalPercent = typeof percent === 'number' ? percent : Math.round((computedPage / totalPages) * 100);
      if (finalPercent > 0 && finalPercent < 0.5) finalPercent = 1;

      try {
        if (cfi) localStorage.setItem(`book_cfi_${book.id}`, cfi);
        localStorage.setItem(`book_percent_${book.id}`, String(finalPercent));
        localStorage.setItem(`book_page_${book.id}`, String(computedPage));
        localStorage.setItem(`book_total_pages_${book.id}`, String(totalPages));
      } catch {}

      const payload = {
        book_id: book.id,
        page: computedPage,
        total_pages: totalPages,
        percent: finalPercent,
        cfi: cfi || undefined,
      };

      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => console.error('Failed to save EPUB progress:', err));

      if (onProgressUpdate) {
        onProgressUpdate(book.id, payload);
      }
    }, 400);
  }, [book.id, onProgressUpdate]);

  const saveProgressDebouncedRef = useRef(saveProgressDebounced);
  useEffect(() => {
    saveProgressDebouncedRef.current = saveProgressDebounced;
  }, [saveProgressDebounced]);

  // Resize and overscroll cleanup
  useEffect(() => {
    const handleResize = () => {
      if (renditionRef.current) {
        try {
          renditionRef.current.resize();
        } catch {}
      }
    };
    window.addEventListener('resize', handleResize);
    // Trigger resize smoothly when entering or exiting fullscreen
    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, []);

  // Initialize EPUB.js Book and Rendition
  useEffect(() => {
    let isCancelled = false;
    let domObserver = null;

    async function initEpub() {
      try {
        const bookUrl = `/api/epub/${encodeURIComponent(book.id)}.epub`;
        const res = await fetch(bookUrl);
        if (!res.ok) {
          throw new Error(`Failed to load book file (HTTP ${res.status})`);
        }
        const arrayBuffer = await res.arrayBuffer();
        if (isCancelled) return;

        const epubBook = ePub(arrayBuffer);
        bookRef.current = epubBook;

        if (!viewerRef.current || isCancelled) return;

        viewerRef.current.innerHTML = '';

        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 640;
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: isMobileScreen ? 'none' : 'auto',
          gap: 0
        });
        renditionRef.current = rendition;

        // Apply active theme & font size
        rendition.themes.select(themeRef.current);
        rendition.themes.fontSize(`${fontSizeRef.current}%`);

        // Register content hooks
        rendition.hooks.content.register((contents) => {
          attachListenersToIframeRef.current?.(contents.document, contents.window, contents);

          try {
            contents.addStylesheetCss(`
              html, body {
                margin: 0 !important;
                padding: 0 !important;
              }
              *, *::before, *::after {
                box-sizing: border-box !important;
              }
              #book-content, #sbo-rt-content, .epub-container {
                margin: 0 !important;
                padding: 0 !important;
                max-width: 100% !important;
              }
              .hl-annotation, .epubjs-hl, [ref="hl-annotation"] {
                cursor: pointer !important;
                transition: fill-opacity 0.15s ease;
              }
              .hl-annotation:hover, .epubjs-hl:hover, [ref="hl-annotation"]:hover {
                fill-opacity: 0.55 !important;
              }
              .epub-search-match-selected {
                fill: #f59e0b !important;
                fill-opacity: 0.65 !important;
              }
              math,
              #sbo-rt-content math,
              div[data-type="equation"] math,
              div.equation math,
              .equation math,
              math[display="block"] {
                font-size: 1.15em !important;
                max-width: 100% !important;
                line-height: normal !important;
              }
              math[display="inline"],
              p math,
              li math {
                font-size: 1em !important;
              }
              div[data-type="equation"],
              div.equation,
              div.informalequation {
                max-width: 100% !important;
                overflow-x: auto !important;
              }
            `);
          } catch {}
        });

        // Initial display
        const startCfi = initialCfiRef.current;
        try {
          if (startCfi) {
            await rendition.display(startCfi);
          } else {
            await rendition.display();
          }
        } catch (displayErr) {
          console.warn('Initial CFI display failed, falling back to beginning:', displayErr);
          try {
            await rendition.display();
          } catch {}
        }

        try {
          rendition.getContents().forEach(c => {
            if (c?.document) attachListenersToIframeRef.current?.(c.document, c.window, c);
          });
          const iframes = viewerRef.current?.querySelectorAll('iframe') || [];
          iframes.forEach(iframe => {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            const win = iframe.contentWindow;
            if (doc && win) attachListenersToIframeRef.current?.(doc, win);
          });
        } catch {}

        if (viewerRef.current) {
          domObserver = new MutationObserver(() => {
            const iframes = viewerRef.current?.querySelectorAll('iframe') || [];
            iframes.forEach(iframe => {
              try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                const win = iframe.contentWindow;
                if (doc && win) {
                  attachListenersToIframeRef.current?.(doc, win);
                }
              } catch {}
            });
          });
          domObserver.observe(viewerRef.current, { childList: true, subtree: true });
        }

        if (!isCancelled) {
          setLoading(false);
          setRenditionReady(true);
        }

        // Percentage helper
        const getAccuratePercentage = (location, cfi, curPage = null, totalPages = null) => {
          // 1. If locations are generated, use location percentage directly
          if (
            isLocationsReadyRef.current &&
            epubBook.locations &&
            epubBook.locations.total > 0 &&
            typeof epubBook.locations.length === 'function' &&
            epubBook.locations.length() > 0
          ) {
            try {
              const locPct = epubBook.locations.percentageFromCfi(cfi);
              if (typeof locPct === 'number' && !isNaN(locPct) && locPct >= 0) {
                return Math.min(100, Math.max(0, Math.round(locPct * 100)));
              }
            } catch {}

            if (curPage !== null && totalPages && totalPages > 0) {
              return Math.min(100, Math.max(0, Math.round((curPage / totalPages) * 100)));
            }
          }

          // 2. Spine/chapter-based percentage as fallback when locations aren't ready
          const spineItems = epubBook.spine?.items || [];
          const totalSpine = spineItems.length;
          let spineIndex = location?.start?.index;

          if (spineIndex === undefined && cfi) {
            const match = cfi.match(/\/6\/(\d+)!/);
            if (match) {
              const childNum = parseInt(match[1], 10);
              spineIndex = Math.max(0, Math.floor(childNum / 2) - 1);
            }
          }

          if (totalSpine > 0 && spineIndex !== undefined && spineIndex >= 0) {
            const displayed = location?.start?.displayed;
            let intraFraction = 0;
            if (displayed && displayed.total > 1 && displayed.page > 0) {
              intraFraction = (displayed.page - 1) / displayed.total;
            }
            const fraction = (spineIndex + intraFraction) / totalSpine;
            return Math.min(100, Math.max(0, Math.round(fraction * 100)));
          }

          if (location?.start?.percentage !== undefined && typeof location.start.percentage === 'number' && !isNaN(location.start.percentage) && location.start.percentage > 0) {
            return Math.min(100, Math.max(0, Math.round(location.start.percentage * 100)));
          }

          if (locationInfoRef.current?.percentage > 0) {
            return locationInfoRef.current.percentage;
          }

          if (initialPercentRef.current > 0) {
            return Math.round(initialPercentRef.current);
          }

          return 0;
        };

        // Generate location numbers in background
        epubBook.ready.then(() => {
          try {
            const cached = localStorage.getItem(`book_locations_${book.id}`);
            if (cached) {
              epubBook.locations.load(cached);
              if (epubBook.locations && epubBook.locations.total > 0) {
                isLocationsReadyRef.current = true;
              }
              return;
            }
          } catch {}

          if (epubBook.locations) {
            epubBook.locations.pause = 10;
          }

          return epubBook.locations.generate(1600);
        }).then(() => {
          if (isCancelled) return;
          const totalLocs = (epubBook.locations && typeof epubBook.locations.length === 'function')
            ? epubBook.locations.length()
            : 0;

          if (totalLocs > 0 && epubBook.locations?.total > 0) {
            isLocationsReadyRef.current = true;
            try {
              localStorage.setItem(`book_locations_${book.id}`, epubBook.locations.save());
              localStorage.setItem(`book_total_pages_${book.id}`, String(totalLocs));
            } catch {}
          }

          if (!startCfi && initialPercentRef.current > 0 && isInitialRelocationRef.current) {
            try {
              const targetCfi = epubBook.locations.cfiFromPercentage(initialPercentRef.current / 100);
              if (targetCfi) {
                rendition.display(targetCfi);
              }
            } catch (e) {
              console.warn('Locations percent jump notice:', e);
            }
          }

          const currentCfi = rendition.currentLocation()?.start?.cfi || startCfi;

          let curPage = 1;
          if (currentCfi && totalLocs > 0) {
            try {
              const loc = epubBook.locations.locationFromCfi(currentCfi);
              if (typeof loc === 'number' && !isNaN(loc) && loc >= 0) {
                curPage = Math.min(totalLocs, loc + 1);
              }
            } catch {}
          }

          const pct = getAccuratePercentage(rendition.currentLocation(), currentCfi, curPage, totalLocs);

          if (totalLocs > 0 && isLocationsReadyRef.current) {
            setPageInfo({ page: curPage, total: totalLocs });
            setPageInput(String(curPage));
            try {
              localStorage.setItem(`book_page_${book.id}`, String(curPage));
            } catch {}
          }

          if (currentCfi && pct > 0) {
            setLocationInfo(prev => ({ ...prev, percentage: pct }));
            saveProgressDebouncedRef.current(currentCfi, pct, curPage, totalLocs);
          }
        }).catch(e => {
          console.warn('Locations generation notice:', e);
        });

        // Load TOC
        epubBook.loaded.navigation.then(nav => {
          if (!isCancelled) {
            const items = nav.toc || [];
            setToc(items);
            tocRef.current = items;
          }
        }).catch(e => {
          console.warn('Navigation TOC notice:', e);
        });

        // Selection tracking (save selection state without opening menu by default; menu opens on right-click)
        rendition.on('selected', (cfiRange, contents) => {
          if (!cfiRange || !contents || !contents.window) return;
          const selection = contents.window.getSelection();
          const text = selection ? selection.toString().trim() : '';
          if (!text || selection.rangeCount === 0) return;

          setSelectionMenu(prev => ({
            ...prev,
            isOpen: false,
            text,
            cfi: cfiRange
          }));
        });

        // Rendered view hook
        rendition.on('rendered', (_section, view) => {
          if (view?.document) {
            attachListenersToIframeRef.current?.(view.document, view.window, view);
          }
        });

        // Location changes
        rendition.on('relocated', (location) => {
          if (isCancelled || !location || !location.start) return;

          try {
            const iframes = viewerRef.current?.querySelectorAll('iframe') || [];
            iframes.forEach(iframe => {
              const doc = iframe.contentDocument || iframe.contentWindow?.document;
              const win = iframe.contentWindow;
              if (doc && win) attachListenersToIframeRef.current?.(doc, win);
            });
          } catch {}

          const cfi = location.start.cfi;
          const chapterName = findChapterLabel(tocRef.current, location.start.href);

          let spineIndex = location.start.index;
          if (spineIndex === undefined && cfi) {
            const match = cfi.match(/\/6\/(\d+)!/);
            if (match) {
              spineIndex = Math.max(0, Math.floor(parseInt(match[1], 10) / 2) - 1);
            }
          }

          let curPage = null;
          let totalPages = null;

          if (isLocationsReadyRef.current && epubBook.locations && epubBook.locations.total > 0 && typeof epubBook.locations.length === 'function' && epubBook.locations.length() > 0) {
            totalPages = epubBook.locations.length();
            try {
              const loc = epubBook.locations.locationFromCfi(cfi);
              if (typeof loc === 'number' && !isNaN(loc) && loc >= 0) {
                curPage = Math.min(totalPages, loc + 1);
              }
            } catch {}
          }

          const pct = getAccuratePercentage(location, cfi, curPage, totalPages);

          setLocationInfo({
            cfi: cfi,
            percentage: pct,
            chapter: chapterName
          });

          const totalSpine = epubBook.spine?.items?.length || 0;
          const fallbackTotal = (pageInfoRef.current?.total > 0)
            ? pageInfoRef.current.total
            : (getInitialTotalPages(bookPropRef.current) || totalSpine || 100);

          if (totalPages === null || totalPages <= 0) {
            totalPages = fallbackTotal;
          }

          if (curPage === null) {
            curPage = Math.max(1, Math.min(totalPages, Math.round((pct / 100) * totalPages)));
          }

          setPageInfo({
            page: curPage,
            total: totalPages
          });
          setPageInput(String(curPage));

          try {
            localStorage.setItem(`book_cfi_${book.id}`, cfi);
            if (pct > 0 || (spineIndex === 0 && pct === 0)) {
              localStorage.setItem(`book_percent_${book.id}`, String(pct));
              localStorage.setItem(`book_page_${book.id}`, String(curPage));
              if (totalPages > 0) {
                localStorage.setItem(`book_total_pages_${book.id}`, String(totalPages));
              }
            }
          } catch {}

          if (isInitialRelocationRef.current) {
            isInitialRelocationRef.current = false;
            if (pct > 0 && (!bookPropRef.current?.progress?.percent || bookPropRef.current.progress.percent === 0)) {
              saveProgressDebouncedRef.current(cfi, pct, curPage, totalPages);
            }
            return;
          }

          saveProgressDebouncedRef.current(cfi, pct, curPage, totalPages);
        });

        rendition.on('keydown', (e) => {
          handleKeyDownRef.current?.(e);
        });

      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load EPUB:', err);
          setError(err.message || 'Failed to render EPUB file.');
          setLoading(false);
        }
      }
    }

    initEpub();

    return () => {
      isCancelled = true;
      if (domObserver) domObserver.disconnect();
      setRenditionReady(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      try {
        if (renditionRef.current) renditionRef.current.destroy();
        if (bookRef.current) bookRef.current.destroy();
      } catch {}
    };
  }, [book.id, setSelectionMenu, attachListenersToIframeRef, handleKeyDownRef, themeRef, fontSizeRef]);

  const handleSelectChapter = (href) => {
    if (href && renditionRef.current) {
      renditionRef.current.display(href);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setTocOpen(false);
      }
    }
  };

  const handleFavToggle = () => {
    const nextFav = !favState;
    setFavState(nextFav);
    if (onToggleFavorite) {
      onToggleFavorite(book);
    }
  };

  return (
    <div 
      className={`fixed inset-0 h-[100dvh] z-50 flex flex-col ${themeSystem.viewerBgClass} text-neutral-200 select-none overflow-hidden transition-colors duration-300`}
    >
      {/* Top Header Bar */}
      <EpubToolbar
        book={book}
        shouldShowExtension={shouldShowExtension}
        theme={themeSystem.theme}
        fontSize={themeSystem.fontSize}
        pageInfo={pageInfo}
        pageInput={pageInput}
        setPageInput={setPageInput}
        handlePageSubmit={handlePageSubmit}
        locationInfo={locationInfo}
        flipPrev={navSystem.flipPrev}
        flipNext={navSystem.flipNext}
        changeFontSize={themeSystem.changeFontSize}
        resetFontSize={themeSystem.resetFontSize}
        applyTheme={themeSystem.applyTheme}
        searchOpen={searchSystem.searchOpen}
        setSearchOpen={searchSystem.setSearchOpen}
        handleCloseSearch={searchSystem.handleCloseSearch}
        ttsOpen={ttsSystem.ttsOpen}
        toggleTts={ttsSystem.toggleTts}
        favState={favState}
        handleFavToggle={handleFavToggle}
        commentsDrawerOpen={annotationsSystem.commentsDrawerOpen}
        setCommentsDrawerOpen={annotationsSystem.setCommentsDrawerOpen}
        annotationsCount={annotationsSystem.annotations.length}
        tocOpen={tocOpen}
        setTocOpen={setTocOpen}
        headerPinned={navSystem.headerPinned}
        toggleHeaderPinned={navSystem.toggleHeaderPinned}
        isHeaderShowing={navSystem.isHeaderShowing}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        handleClose={handleClose}
        onMouseEnterHeader={navSystem.onMouseEnterHeader}
        onMouseLeaveHeader={navSystem.onMouseLeaveHeader}
        onTouchStartHeader={navSystem.onTouchStartHeader}
        onTouchEndHeader={navSystem.onTouchEndHeader}
        readerSettingsOpen={navSystem.readerSettingsOpen}
        setReaderSettingsOpen={navSystem.setReaderSettingsOpen}
        showBottomProgress={navSystem.showBottomProgress}
        toggleBottomProgress={navSystem.toggleBottomProgress}
        trackpadSwipeEnabled={navSystem.trackpadSwipeEnabled}
        toggleTrackpadSwipe={navSystem.toggleTrackpadSwipe}
        floatingButtonsEnabled={navSystem.floatingButtonsEnabled}
        toggleFloatingButtons={navSystem.toggleFloatingButtons}
        upDownFlipEnabled={navSystem.upDownFlipEnabled}
        toggleUpDownFlip={navSystem.toggleUpDownFlip}
      />

      {/* Main EPUB Reader Stage + Side Drawers */}
      <div className={`relative flex-1 flex w-full h-full overflow-hidden min-h-0 pt-14 ${
        isFullscreen ? 'pb-2 sm:pb-3' : 'pb-14 sm:pb-3'
      }`}>
        {/* Toggleable Left Table of Contents Drawer */}
        <PdfOutline
          outline={toc}
          isOpen={tocOpen}
          onClose={() => setTocOpen(false)}
          onItemClick={(item) => handleSelectChapter(item.href || item.url)}
          activeChapter={locationInfo.chapter}
          totalChapters={toc ? toc.length : 0}
          percentage={locationInfo.percentage}
        />

        <EpubReaderStage
          viewerRef={viewerRef}
          loading={loading}
          error={error}
          handleClose={handleClose}
          floatingButtonsEnabled={navSystem.floatingButtonsEnabled}
          flipPrev={navSystem.flipPrev}
          flipNext={navSystem.flipNext}
        />

        {/* Toggleable Right Comments & Highlights Drawer */}
        <CommentsDrawer
          annotations={annotationsSystem.annotations}
          isOpen={annotationsSystem.commentsDrawerOpen}
          onClose={() => annotationsSystem.setCommentsDrawerOpen(false)}
          onJumpToAnnotation={annotationsSystem.handleJumpToAnnotation}
          onUpdateComment={annotationsSystem.handleUpdateComment}
          onDeleteAnnotation={annotationsSystem.handleDeleteAnnotation}
          book={book}
        />

        {/* Floating In-Book Search Bar */}
        <BookSearchBar
          search={searchSystem}
          theme={themeSystem.theme}
        />

        {/* Text-to-Speech (Read Aloud) Player Bar */}
        <TtsPlayerBar
          tts={{
            ...ttsSystem,
            pageNumber: pageInfo.page || 1,
            totalPages: pageInfo.total,
            onNextPage: navSystem.flipNext,
            onPrevPage: navSystem.flipPrev,
            theme: themeSystem.theme,
            bookTitle: book?.title || '',
          }}
        />
      </div>

      {/* Floating Context Menu for Text Selection */}
      {annotationsSystem.selectionMenu.isOpen && (
        <TextSelectionMenu
          x={annotationsSystem.selectionMenu.x}
          y={annotationsSystem.selectionMenu.y}
          selectedText={annotationsSystem.selectionMenu.text}
          onHighlight={annotationsSystem.handleCreateHighlight}
          onClose={() => annotationsSystem.setSelectionMenu({ isOpen: false, x: 0, y: 0, text: '', cfi: null })}
          onReadAloud={ttsSystem.handleReadSelection}
        />
      )}

      {/* Floating Bottom Progress Indicator */}
      {navSystem.showBottomProgress && (
        <footer className={`fixed bottom-0 inset-x-0 h-1.5 z-30 pointer-events-none ${
          themeSystem.theme === 'dark' ? 'bg-black/60' : themeSystem.theme === 'sepia' ? 'bg-[#d8c5a0]/40' : 'bg-neutral-300/40'
        }`}>
          <div 
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ 
              width: `${Math.min(100, Math.max(0, 
                pageInfo.total > 0 
                  ? (pageInfo.page / pageInfo.total) * 100 
                  : locationInfo.percentage
              ))}%` 
            }}
          />
        </footer>
      )}
    </div>
  );
}
