import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { EventBus, PDFFindController } from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';

import ReaderToolbar from './ReaderToolbar';
import ReaderLayout from './ReaderLayout';
import PdfDocumentStage from './PdfDocumentStage';
import { PdfViewerContext } from '../contexts/pdfViewerContext';
import { useZoomControls } from '../hooks/useZoomControls';
import { usePageNavigation } from '../hooks/usePageNavigation';
import { usePdfSearch } from '../hooks/usePdfSearch';
import { usePdfTts } from '../hooks/usePdfTts';
import { usePdfAnnotations } from '../hooks/usePdfAnnotations';
import { useFullscreen } from '../hooks/useFullscreen';
import { useTrackpadSwipe } from '../hooks/useTrackpadSwipe';
import { useReaderHeaderPin } from '../hooks/useReaderHeaderPin';
import { usePdfKeyboardGestures } from '../hooks/usePdfKeyboardGestures';
import { SimpleLinkService } from '../utils/SimpleLinkService';
import { queuePreloadPages, clearPageRenderCache, getDualPageSpread, getNextSpreadPage, getPrevSpreadPage } from '../utils/pdfPageUtils';
import { getOfflineBookArrayBuffer } from '../services/offlineStorage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfViewer({ 
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

  const [favState, setFavState] = useState(isFavorite !== undefined ? isFavorite : Boolean(book?.is_favorite));
  const [pdfDoc, setPdfDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const getInitialInvertColors = () => {
    if (mode === 'light') return false;
    if (mode === 'dark') return true;

    try {
      const appMode = localStorage.getItem('app_mode');
      if (appMode === 'light') return false;
      if (appMode === 'dark') return true;
    } catch {}

    try {
      const localInvert = localStorage.getItem(`book_invert_${book?.id}`);
      if (localInvert !== null) {
        return localInvert === 'true';
      }
    } catch {}

    if (book?.progress?.invert_colors !== undefined) {
      return Boolean(book.progress.invert_colors);
    }
    return true;
  };

  const [invertColors, setInvertColors] = useState(getInitialInvertColors);
  const invertColorsRef = useRef(invertColors);
  useEffect(() => {
    invertColorsRef.current = invertColors;
  }, [invertColors]);

  // Sync mode changes
  const [prevMode, setPrevMode] = useState(mode);
  if (mode !== prevMode) {
    setPrevMode(mode);
    if (mode === 'dark' || mode === 'light') {
      setInvertColors(mode === 'dark');
    }
  }

  const [prevIsFavorite, setPrevIsFavorite] = useState(isFavorite);
  if (isFavorite !== prevIsFavorite) {
    setPrevIsFavorite(isFavorite);
    if (isFavorite !== undefined) {
      setFavState(isFavorite);
    }
  }

  const [prevBookId, setPrevBookId] = useState(book?.id);
  if (book?.id !== prevBookId) {
    setPrevBookId(book?.id);
    setLoading(true);
  }

  const containerRef = useRef(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Outline / TOC
  const [outline, setOutline] = useState([]);
  const [hasOutline, setHasOutline] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  // Settings
  const [readerSettingsOpen, setReaderSettingsOpen] = useState(false);
  const [showBottomProgress, setShowBottomProgress] = useState(() => {
    try {
      return localStorage.getItem('reader_bottom_progress') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleBottomProgress = () => {
    setShowBottomProgress(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_bottom_progress', String(next));
      } catch {}
      return next;
    });
  };

  const [trackpadSwipeEnabled, setTrackpadSwipeEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_trackpad_swipe') !== 'false';
    } catch {
      return true;
    }
  });

  const [floatingButtonsEnabled, setFloatingButtonsEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_floating_buttons') !== 'false';
    } catch {
      return true;
    }
  });

  const [upDownFlipEnabled, setUpDownFlipEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_up_down_flip') === 'true';
    } catch {
      return false;
    }
  });

  const [bookTextureEnabled, setBookTextureEnabled] = useState(() => {
    try {
      return localStorage.getItem('reader_book_texture') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleBookTexture = () => {
    setBookTextureEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_book_texture', String(next));
      } catch {}
      return next;
    });
  };

  const [continuousPageSpacing, setContinuousPageSpacing] = useState(() => {
    try {
      return localStorage.getItem('reader_continuous_spacing') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleContinuousPageSpacing = () => {
    setContinuousPageSpacing(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_continuous_spacing', String(next));
      } catch {}
      return next;
    });
  };

  const [centerVertically, setCenterVertically] = useState(() => {
    try {
      return localStorage.getItem('reader_center_vertically') !== 'false';
    } catch {
      return true;
    }
  });

  const centerVerticallyRef = useRef(centerVertically);
  useEffect(() => {
    centerVerticallyRef.current = centerVertically;
  }, [centerVertically]);

  // Header auto-hide / pin hook
  const {
    headerPinned,
    isHeaderVisible,
    showHeader,
    startHideTimer,
    toggleHeaderPinned,
    onMouseEnterHeader,
    onMouseLeaveHeader,
    onTouchStartHeader,
    onTouchEndHeader,
    isMouseOverHeaderRef,
  } = useReaderHeaderPin();

  // Page dimensions map & visible pages
  const [visiblePageNumbers, setVisiblePageNumbers] = useState(() => new Set([book?.progress?.page || 1]));
  const pageDimsMapRef = useRef({});
  const [pageDimsMap, setPageDimsMap] = useState({});
  const pageRefsMap = useRef(new Map());

  // Zoom controls hook
  const zoom = useZoomControls({
    book,
    pdfDoc,
    containerRef,
    isDualPage: false,
  });

  // Page navigation hook
  const nav = usePageNavigation({
    book,
    pdfDoc,
    containerRef,
    pageRefsMap,
    onProgressUpdate,
    scaleRef: zoom.scaleRef,
    invertColorsRef,
    fitWidth: zoom.fitWidth,
    centerVerticallyRef,
    setVisiblePageNumbers,
  });

  // Trackpad swipe gesture hook
  const { handleTrackpadWheel } = useTrackpadSwipe({
    onNext: nav.goToNextPage,
    onPrev: nav.goToPrevPage,
    enabled: trackpadSwipeEnabled,
    threshold: 28,
    cooldownMs: 350,
  });

  // Center Page Vertically helper
  const centerPageVertically = useCallback(() => {
    if (nav.isContinuous || !containerRef.current) return;
    const container = containerRef.current;
    if (centerVerticallyRef.current) {
      const scrollDiff = container.scrollHeight - container.clientHeight;
      if (scrollDiff > 0) {
        container.scrollTop = Math.round(scrollDiff / 2);
      } else {
        container.scrollTop = 0;
      }
    } else {
      container.scrollTop = 0;
    }
  }, [nav.isContinuous]);

  const toggleCenterVertically = () => {
    setCenterVertically(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_center_vertically', String(next));
      } catch {}
      centerVerticallyRef.current = next;
      if (nav.isContinuous) {
        nav.scrollToPageInContinuous(nav.currentPage, true);
      } else {
        requestAnimationFrame(() => {
          centerPageVertically();
        });
      }
      return next;
    });
  };

  const handlePageDimensionsLoaded = useCallback((p, dims) => {
    pageDimsMapRef.current[p] = dims;
    setPageDimsMap(prev => ({ ...prev, [p]: dims }));
    if (!nav.isContinuous && centerVerticallyRef.current) {
      requestAnimationFrame(() => {
        centerPageVertically();
      });
    }
  }, [nav.isContinuous, centerPageVertically]);

  const estimatedPageDims = useMemo(() => {
    const known = Object.values(pageDimsMap);
    if (known.length > 0 && known[0].width && known[0].height) {
      return known[0];
    }
    return {
      width: Math.round(620 * zoom.scale),
      height: Math.round(877 * zoom.scale),
    };
  }, [zoom.scale, pageDimsMap]);

  // SimpleLinkService & PDF.js Controller setup
  const linkService = useMemo(() => new SimpleLinkService(), []);
  const eventBus = useMemo(() => new EventBus(), []);
  const findController = useMemo(() => new PDFFindController({
    linkService,
    eventBus,
  }), [linkService, eventBus]);

  // Search hook
  const search = usePdfSearch({
    eventBus,
    findController,
    showHeader,
  });

  // TTS hook
  const tts = usePdfTts({
    pdfDoc,
    currentPage: nav.currentPage,
    isDualPage: nav.isDualPage,
    spread: nav.spread,
  });

  // Annotations hook
  const annotations = usePdfAnnotations({
    bookId: book?.id,
  });

  // Keyboard navigation & native wheel gesture listener hook
  usePdfKeyboardGestures({
    containerRef,
    nav,
    zoom,
    search,
    tts,
    onClose,
    upDownFlipEnabled,
    handleTrackpadWheel,
  });

  // Link service configuration
  useEffect(() => {
    linkService.setNavigate(nav.handleLinkNavigate);
  }, [linkService, nav.handleLinkNavigate]);

  useEffect(() => {
    linkService.setPage(nav.currentPage);
  }, [linkService, nav.currentPage]);

  useEffect(() => {
    if (pdfDoc) {
      linkService.setDocument(pdfDoc);
      findController.setDocument(pdfDoc);
    }
  }, [pdfDoc, linkService, findController]);

  const { initializeDocument } = nav;
  const initialPage = book?.progress?.page || 1;
  const bookId = book?.id;

  // Load PDF Document
  useEffect(() => {
    let active = true;
    let currentLoadingTask = null;

    async function loadDoc() {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const docParams = {
        cMapUrl: `${origin}/pdfjs-cmaps/`,
        cMapPacked: true,
        wasmUrl: `${origin}/pdfjs-wasm/`,
      };

      try {
        const offlineBuffer = await getOfflineBookArrayBuffer(bookId);
        if (!active) return;
        if (offlineBuffer) {
          docParams.data = new Uint8Array(offlineBuffer);
        } else {
          docParams.url = `/api/pdf/${bookId}`;
        }

        currentLoadingTask = pdfjsLib.getDocument(docParams);
        const doc = await currentLoadingTask.promise;
        if (!active) return;

        setPdfDoc(doc);
        initializeDocument(doc.numPages, initialPage);
        setLoading(false);

        try {
          const outlineData = await doc.getOutline();
          if (!active) return;
          if (Array.isArray(outlineData) && outlineData.length > 0) {
            setOutline(outlineData);
            setHasOutline(true);
          } else {
            setOutline([]);
            setHasOutline(false);
          }
        } catch {
          if (active) {
            setOutline([]);
            setHasOutline(false);
          }
        }
      } catch (error) {
        if (!active) return;
        console.error('Error loading PDF:', error);
        setLoading(false);
      }
    }

    loadDoc();

    return () => {
      active = false;
      if (currentLoadingTask) {
        try {
          currentLoadingTask.destroy();
        } catch {}
      }
      clearPageRenderCache();
    };
  }, [bookId, initialPage, initializeDocument]);

  // Outline item click handler
  const handleOutlineClick = useCallback((item) => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else if (item.dest) {
      linkService.goToDestination(item.dest);
    }
    if (window.innerWidth < 768) {
      setOutlineOpen(false);
    }
  }, [linkService]);

  // Jump to annotation
  const handleJumpToAnnotation = useCallback((ann) => {
    annotations.handleJumpToAnnotation(ann, (page) => {
      nav.handleLinkNavigate(page);
    });
  }, [annotations, nav]);

  // Toggle favorite
  const handleToggleFav = useCallback(() => {
    if (!book?.id) return;
    fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: book.id })
    })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok') {
        setFavState(data.is_favorite);
        if (onToggleFavorite) onToggleFavorite(book);
      }
    })
    .catch(err => console.error('Failed to toggle favorite:', err));
  }, [book, onToggleFavorite]);

  // Toggle night / light mode
  const handleToggleInvertColors = useCallback(() => {
    const nextInvert = !invertColors;
    setInvertColors(nextInvert);
    const newMode = nextInvert ? 'dark' : 'light';
    try {
      localStorage.setItem('app_mode', newMode);
      document.documentElement.setAttribute('data-mode', newMode);
      if (book?.id) {
        localStorage.setItem(`book_invert_${book.id}`, String(nextInvert));
      }
    } catch {}
    if (onModeChange) onModeChange(newMode);
    window.dispatchEvent(new CustomEvent('app_mode_change', { detail: { mode: newMode } }));
  }, [invertColors, book, onModeChange]);

  // Preload adjacent pages
  useEffect(() => {
    if (!pdfDoc || nav.totalPages <= 1) return;

    const timer = setTimeout(() => {
      const pagesToPreload = [];
      if (!nav.isContinuous) {
        if (nav.isDualPage) {
          const currentSp = getDualPageSpread(nav.currentPage, nav.totalPages, nav.dualCoverStandalone);
          const currentPages = new Set([currentSp.left, currentSp.right].filter(Boolean));
          const next1 = getNextSpreadPage(currentSp.currentBase, nav.totalPages, nav.dualCoverStandalone);
          if (next1 !== currentSp.currentBase) {
            const next1Sp = getDualPageSpread(next1, nav.totalPages, nav.dualCoverStandalone);
            if (next1Sp.left && !currentPages.has(next1Sp.left)) pagesToPreload.push(next1Sp.left);
            if (next1Sp.right && !currentPages.has(next1Sp.right)) pagesToPreload.push(next1Sp.right);
          }
          const prev1 = getPrevSpreadPage(currentSp.currentBase, nav.totalPages, nav.dualCoverStandalone);
          if (prev1 !== currentSp.currentBase) {
            const prev1Sp = getDualPageSpread(prev1, nav.totalPages, nav.dualCoverStandalone);
            if (prev1Sp.left && !currentPages.has(prev1Sp.left)) pagesToPreload.push(prev1Sp.left);
            if (prev1Sp.right && !currentPages.has(prev1Sp.right)) pagesToPreload.push(prev1Sp.right);
          }
        } else {
          const candidates = [nav.currentPage + 1, nav.currentPage + 2, nav.currentPage - 1];
          candidates.forEach(p => {
            if (p >= 1 && p <= nav.totalPages && p !== nav.currentPage && !pagesToPreload.includes(p)) {
              pagesToPreload.push(p);
            }
          });
        }
      }
      if (pagesToPreload.length > 0) {
        queuePreloadPages(pdfDoc, pagesToPreload, zoom.scale);
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [pdfDoc, nav.currentPage, nav.isDualPage, nav.dualCoverStandalone, nav.isContinuous, zoom.scale, nav.totalPages]);

  // Continuous Vertical Scroll: Observer
  const currentPageRef = useRef(nav.currentPage);
  useEffect(() => {
    currentPageRef.current = nav.currentPage;
  }, [nav.currentPage]);

  useEffect(() => {
    if (!nav.isContinuous || !containerRef.current || !pdfDoc) return;

    const renderObserver = new IntersectionObserver((entries) => {
      setVisiblePageNumbers(prev => {
        const next = new Set(prev);
        let changed = false;
        entries.forEach(entry => {
          const p = Number(entry.target.getAttribute('data-page-number'));
          if (!p) return;
          if (entry.isIntersecting) {
            if (!next.has(p)) {
              next.add(p);
              changed = true;
            }
          } else {
            if (next.has(p) && Math.abs(p - currentPageRef.current) > (nav.isDualPage ? 8 : 4)) {
              next.delete(p);
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    }, {
      root: containerRef.current,
      rootMargin: '1200px 0px 1200px 0px',
      threshold: 0
    });

    pageRefsMap.current.forEach(el => {
      renderObserver.observe(el);
    });

    return () => {
      renderObserver.disconnect();
    };
  }, [nav.isContinuous, pdfDoc, nav.totalPages, zoom.scale, nav.isDualPage]);

  const currentProgressPage = nav.isDualPage && nav.spread.right ? nav.spread.right : nav.currentPage;
  const progressPercent = nav.totalPages > 0 ? Math.round((currentProgressPage / nav.totalPages) * 100) : 0;

  const isHeaderShowing = headerPinned || isHeaderVisible || readerSettingsOpen || annotations.commentsDrawerOpen || outlineOpen || search.searchOpen;

  const pdfViewerContextValue = useMemo(() => ({
    pdfDoc,
    scale: zoom.scale,
    invertColors,
    linkService,
    findController,
    eventBus,
    annotations: annotations.annotations,
    onUpdateComment: annotations.handleUpdateComment,
    onDeleteAnnotation: annotations.handleDeleteAnnotation,
    showBookTexture: bookTextureEnabled,
    onDimensionsLoaded: handlePageDimensionsLoaded,
  }), [
    pdfDoc,
    zoom.scale,
    invertColors,
    linkService,
    findController,
    eventBus,
    annotations.annotations,
    annotations.handleUpdateComment,
    annotations.handleDeleteAnnotation,
    bookTextureEnabled,
    handlePageDimensionsLoaded,
  ]);

  const toolbarElement = (
    <ReaderToolbar
      book={book}
      shouldShowExtension={shouldShowExtension}
      onClose={onClose}
      hasOutline={hasOutline}
      outlineOpen={outlineOpen}
      setOutlineOpen={setOutlineOpen}
      hasPrev={nav.hasPrev}
      hasNext={nav.hasNext}
      goToPrevPage={nav.goToPrevPage}
      goToNextPage={nav.goToNextPage}
      pageInput={nav.pageInput}
      setPageInput={nav.setPageInput}
      handlePageSubmit={nav.handlePageSubmit}
      handlePageInputBlur={nav.handlePageInputBlur}
      totalPages={nav.totalPages}
      progressPercent={progressPercent}
      zoomScale={zoom.zoomScale}
      handleZoomIn={zoom.handleZoomIn}
      handleZoomOut={zoom.handleZoomOut}
      handleResetZoom={() => zoom.handleResetZoom(nav.currentPage)}
      fitWidth={() => zoom.fitWidth(nav.isDualPage, nav.currentPage)}
      searchOpen={search.searchOpen}
      onToggleSearch={() => {
        if (search.searchOpen) search.handleCloseSearch();
        else search.openSearch();
      }}
      ttsOpen={tts.ttsOpen}
      toggleTts={tts.toggleTts}
      invertColors={invertColors}
      onToggleInvertColors={handleToggleInvertColors}
      favState={favState}
      handleToggleFav={handleToggleFav}
      commentsDrawerOpen={annotations.commentsDrawerOpen}
      setCommentsDrawerOpen={annotations.setCommentsDrawerOpen}
      annotationsCount={annotations.annotations.length}
      isFullscreen={isFullscreen}
      toggleFullscreen={toggleFullscreen}
      readerSettingsOpen={readerSettingsOpen}
      setReaderSettingsOpen={setReaderSettingsOpen}
      centerVertically={centerVertically}
      toggleCenterVertically={toggleCenterVertically}
      showBottomProgress={showBottomProgress}
      toggleBottomProgress={toggleBottomProgress}
      trackpadSwipeEnabled={trackpadSwipeEnabled}
      setTrackpadSwipeEnabled={setTrackpadSwipeEnabled}
      floatingButtonsEnabled={floatingButtonsEnabled}
      setFloatingButtonsEnabled={setFloatingButtonsEnabled}
      upDownFlipEnabled={upDownFlipEnabled}
      setUpDownFlipEnabled={setUpDownFlipEnabled}
      isDualPage={nav.isDualPage}
      toggleDualPage={nav.toggleDualPage}
      dualCoverStandalone={nav.dualCoverStandalone}
      toggleDualCover={nav.toggleDualCover}
      bookTextureEnabled={bookTextureEnabled}
      toggleBookTexture={toggleBookTexture}
      isContinuous={nav.isContinuous}
      toggleScrollMode={nav.toggleScrollMode}
      continuousPageSpacing={continuousPageSpacing}
      toggleContinuousPageSpacing={toggleContinuousPageSpacing}
      isHeaderShowing={isHeaderShowing}
      headerPinned={headerPinned}
      toggleHeaderPinned={toggleHeaderPinned}
      onMouseEnterHeader={onMouseEnterHeader}
      onMouseLeaveHeader={onMouseLeaveHeader}
      onTouchStartHeader={onTouchStartHeader}
      onTouchEndHeader={onTouchEndHeader}
    />
  );

  return (
    <ReaderLayout
      invertColors={invertColors}
      headerPinned={headerPinned}
      isFullscreen={isFullscreen}
      toolbar={toolbarElement}
      hasOutline={hasOutline}
      outline={outline}
      outlineOpen={outlineOpen}
      setOutlineOpen={setOutlineOpen}
      onOutlineClick={handleOutlineClick}
      progressPercent={progressPercent}
      containerRef={containerRef}
      onContainerScroll={nav.onContainerScroll}
      onTextContextMenu={annotations.handleTextContextMenu}
      loading={loading}
      floatingButtonsEnabled={floatingButtonsEnabled}
      hasPrev={nav.hasPrev}
      hasNext={nav.hasNext}
      goToPrevPage={nav.goToPrevPage}
      goToNextPage={nav.goToNextPage}
      annotations={annotations.annotations}
      commentsDrawerOpen={annotations.commentsDrawerOpen}
      setCommentsDrawerOpen={annotations.setCommentsDrawerOpen}
      onJumpToAnnotation={handleJumpToAnnotation}
      onUpdateComment={annotations.handleUpdateComment}
      onDeleteAnnotation={annotations.handleDeleteAnnotation}
      book={book}
      search={search}
      tts={{
        ...tts,
        pageNumber: tts.ttsPageNumber,
        totalPages: nav.totalPages,
        onNextPage: nav.goToNextPage,
        onPrevPage: nav.goToPrevPage,
        theme: invertColors ? 'dark' : 'light',
        bookTitle: book?.title || '',
      }}
      selectionMenu={annotations.selectionMenu}
      onHighlight={annotations.handleCreateHighlight}
      onCloseSelectionMenu={() => annotations.setSelectionMenu({ isOpen: false, x: 0, y: 0, text: '', rects: [], page: 1 })}
      onReadAloud={tts.handleReadSelection}
      showBottomProgress={showBottomProgress}
    >
      <PdfViewerContext.Provider value={pdfViewerContextValue}>
        <PdfDocumentStage
          nav={nav}
          continuousPageSpacing={continuousPageSpacing}
          bookTextureEnabled={bookTextureEnabled}
          centerVertically={centerVertically}
          pageDimsMap={pageDimsMap}
          estimatedPageDims={estimatedPageDims}
          visiblePageNumbers={visiblePageNumbers}
          pageRefsMap={pageRefsMap}
        />
      </PdfViewerContext.Provider>
    </ReaderLayout>
  );
}
