import { useState, useRef, useEffect, useCallback } from 'react';
import { COLOR_HEX_MAP } from '../utils/epubThemeUtils';
import { normalizeRangeToTextNodes, sanitizeCfiRange } from '../utils/epubLocationUtils';

/**
 * Hook for managing highlights, comments, and selection menu inside EPUB reader.
 */
export function useEpubAnnotations({ book, renditionRef, renditionReady, viewerRef, locationInfo }) {
  const [annotations, setAnnotations] = useState([]);
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    text: '',
    cfi: null,
  });

  const commentsDrawerOpenRef = useRef(commentsDrawerOpen);
  useEffect(() => {
    commentsDrawerOpenRef.current = commentsDrawerOpen;
  }, [commentsDrawerOpen]);

  const loadAnnotations = useCallback(() => {
    if (!book?.id) return;
    fetch(`/api/annotations/${encodeURIComponent(book.id)}`)
      .then(r => r.json())
      .then(data => {
        setAnnotations(data.annotations || []);
      })
      .catch(err => console.error('Failed to load annotations:', err));
  }, [book]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  // Synchronize annotations into epub.js rendition
  useEffect(() => {
    if (!renditionRef?.current || !renditionReady || !Array.isArray(annotations)) return;

    annotations.forEach(ann => {
      if (!ann.cfi) return;
      try {
        const safeCfi = sanitizeCfiRange(ann.cfi, ann.text);
        renditionRef.current.annotations.remove(ann.cfi, 'highlight');
        if (safeCfi !== ann.cfi) {
          renditionRef.current.annotations.remove(safeCfi, 'highlight');
        }
        const colorHex = COLOR_HEX_MAP[ann.color] || '#facc15';
        renditionRef.current.annotations.add(
          'highlight',
          safeCfi,
          { id: ann.id },
          () => {
            setCommentsDrawerOpen(true);
          },
          'hl-annotation',
          { fill: colorHex, 'fill-opacity': '0.35', 'mix-blend-mode': 'normal' }
        );
      } catch (err) {
        console.warn('Failed to attach annotation highlight to rendition:', ann.id, err);
      }
    });
  }, [annotations, renditionReady, renditionRef]);

  // Create new highlight or comment
  const handleCreateHighlight = useCallback((color, comment = '') => {
    let cfi = selectionMenu.cfi;
    const text = selectionMenu.text;

    // Fallback: If CFI wasn't captured, try resolving from active iframe selection
    if (!cfi && text && renditionRef?.current) {
      try {
        const contentsList = renditionRef.current.getContents() || [];
        for (const c of contentsList) {
          const sel = c?.window?.getSelection();
          if (sel && sel.rangeCount > 0 && sel.toString().trim() === text) {
            const normRange = normalizeRangeToTextNodes(sel.getRangeAt(0), c.document);
            cfi = c.cfiFromRange(normRange);
            if (cfi) break;
          }
        }
      } catch {}
    }

    cfi = sanitizeCfiRange(cfi, text);

    if (!text || !cfi || !book?.id) return;

    const currentChapter = locationInfo?.chapter || '';

    const payload = {
      book_id: book.id,
      page: 1,
      cfi: cfi,
      chapter: currentChapter,
      text: text,
      color: color,
      comment: comment,
      rects: [],
    };

    fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok' && data.annotation) {
          setAnnotations(prev => [...prev, data.annotation]);
          if (renditionRef?.current) {
            try {
              renditionRef.current.annotations.remove(cfi, 'highlight');
              const colorHex = COLOR_HEX_MAP[color] || '#facc15';
              renditionRef.current.annotations.add(
                'highlight',
                cfi,
                { id: data.annotation.id },
                () => {
                  setCommentsDrawerOpen(true);
                },
                'hl-annotation',
                { fill: colorHex, 'fill-opacity': '0.35', 'mix-blend-mode': 'normal' }
              );
            } catch (err) {
              console.warn('Failed to add rendition annotation:', err);
            }
          }
        }
      })
      .catch(err => console.error('Failed to create annotation:', err));

    try {
      const activeWindow = viewerRef?.current?.querySelector('iframe')?.contentWindow;
      activeWindow?.getSelection()?.removeAllRanges();
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
      }
    } catch {}

    setSelectionMenu({ isOpen: false, x: 0, y: 0, text: '', cfi: null });
  }, [selectionMenu, book, locationInfo?.chapter, renditionRef, viewerRef]);

  // Update existing comment note
  const handleUpdateComment = useCallback((annotationId, newComment) => {
    if (!book?.id) return;
    fetch(`/api/annotations/${encodeURIComponent(book.id)}/${encodeURIComponent(annotationId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: newComment }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok' && data.annotation) {
          setAnnotations(prev => prev.map(a => a.id === annotationId ? data.annotation : a));
        }
      })
      .catch(err => console.error('Failed to update comment:', err));
  }, [book]);

  // Delete an annotation
  const handleDeleteAnnotation = useCallback((annotationId) => {
    if (!book?.id) return;
    const ann = annotations.find(a => a.id === annotationId);
    fetch(`/api/annotations/${encodeURIComponent(book.id)}/${encodeURIComponent(annotationId)}`, {
      method: 'DELETE',
    })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok') {
          if (ann && ann.cfi && renditionRef?.current) {
            try {
              renditionRef.current.annotations.remove(ann.cfi, 'highlight');
            } catch {}
          }
          setAnnotations(prev => prev.filter(a => a.id !== annotationId));
        }
      })
      .catch(err => console.error('Failed to delete annotation:', err));
  }, [annotations, book, renditionRef]);

  // Jump directly to an annotation
  const handleJumpToAnnotation = useCallback((ann) => {
    if (ann.cfi && renditionRef?.current) {
      renditionRef.current.display(ann.cfi);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setCommentsDrawerOpen(false);
      }
    }
  }, [renditionRef]);

  return {
    annotations,
    setAnnotations,
    commentsDrawerOpen,
    setCommentsDrawerOpen,
    commentsDrawerOpenRef,
    selectionMenu,
    setSelectionMenu,
    loadAnnotations,
    handleCreateHighlight,
    handleUpdateComment,
    handleDeleteAnnotation,
    handleJumpToAnnotation,
  };
}
