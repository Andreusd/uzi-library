/**
 * Utility helpers for EPUB CFI, location tracking, and table of contents resolution.
 */

export function findChapterLabel(items, href) {
  if (!items || !href) return '';
  const cleanHref = href.split('#')[0];
  for (const item of items) {
    const itemClean = (item.href || '').split('#')[0];
    if (item.href === href || itemClean === cleanHref) {
      return item.label ? item.label.trim() : '';
    }
    if (item.subitems && item.subitems.length > 0) {
      const sub = findChapterLabel(item.subitems, href);
      if (sub) return sub;
    }
  }
  return '';
}

export function getInitialCfi(book) {
  if (book?.progress?.cfi && typeof book.progress.cfi === 'string' && book.progress.cfi.trim() !== '') {
    return book.progress.cfi;
  }
  try {
    const local = localStorage.getItem(`book_cfi_${book?.id}`);
    if (local && local.trim() !== '') return local;
  } catch {}
  return null;
}

export function getInitialPercent(book) {
  if (book?.progress?.percent !== undefined && book?.progress?.percent !== null) {
    const p = parseFloat(book.progress.percent);
    if (!isNaN(p) && p >= 0) return p;
  }
  try {
    const local = localStorage.getItem(`book_percent_${book?.id}`);
    if (local) {
      const p = parseFloat(local);
      if (!isNaN(p) && p >= 0) return p;
    }
  } catch {}
  return 0;
}

export function getInitialPage(book) {
  if (book?.progress?.page && typeof book.progress.page === 'number' && book.progress.page > 0) {
    return book.progress.page;
  }
  try {
    const local = localStorage.getItem(`book_page_${book?.id}`);
    if (local !== null) {
      const val = parseInt(local, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {}
  return 1;
}

export function getInitialTotalPages(book) {
  if (book?.progress?.total_pages && typeof book.progress.total_pages === 'number' && book.progress.total_pages > 0) {
    return book.progress.total_pages;
  }
  try {
    const local = localStorage.getItem(`book_total_pages_${book?.id}`);
    if (local !== null) {
      const val = parseInt(local, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {}
  return 0;
}

/**
 * Normalizes a DOM Range so that its start and end endpoints point to TextNodes (nodeType === 3)
 * with character offsets, rather than Element nodes (nodeType === 1) with child indices.
 *
 * Why this is needed:
 * When users triple-click a paragraph, select entire blocks, or drag across block boundaries,
 * browser Selection APIs produce Ranges where startContainer and/or endContainer are Element nodes
 * (e.g. <p> with startOffset: 0, endOffset: 1).
 * epub.js erroneously treats these child-node indices (0 and 1) as character offsets in the first
 * TextNode, resulting in single-character CFIs (/1:0,/1:1) that highlight only the first letter.
 */
export function normalizeRangeToTextNodes(range, doc) {
  if (!range) return null;

  let { startContainer, startOffset, endContainer, endOffset } = range;

  // 1. Normalize startContainer if it is an Element node
  if (startContainer && startContainer.nodeType === 1) { // Node.ELEMENT_NODE
    const children = startContainer.childNodes;
    if (children && children.length > 0) {
      const idx = Math.max(0, Math.min(startOffset, children.length - 1));
      let target = children[idx];
      while (target && target.nodeType === 1 && target.firstChild) {
        target = target.firstChild;
      }
      if (target && target.nodeType === 3) { // Node.TEXT_NODE
        startContainer = target;
        startOffset = 0;
      }
    }
  }

  // 2. Normalize endContainer if it is an Element node
  if (endContainer && endContainer.nodeType === 1) { // Node.ELEMENT_NODE
    const children = endContainer.childNodes;
    if (children && children.length > 0 && endOffset > 0) {
      const idx = Math.max(0, Math.min(endOffset - 1, children.length - 1));
      let target = children[idx];
      while (target && target.nodeType === 1 && target.lastChild) {
        target = target.lastChild;
      }
      if (target && target.nodeType === 3) { // Node.TEXT_NODE
        endContainer = target;
        endOffset = target.textContent ? target.textContent.length : 0;
      }
    }
  }

  try {
    const targetDoc = doc || startContainer?.ownerDocument || endContainer?.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (targetDoc && typeof targetDoc.createRange === 'function') {
      const normalized = targetDoc.createRange();
      normalized.setStart(startContainer, startOffset);
      normalized.setEnd(endContainer, endOffset);
      return normalized;
    }
  } catch {}

  return range;
}

/**
 * Sanitizes and repairs EPUB CFI strings that suffer from the single-character element range bug.
 * If the CFI ends in ,/X:0,/X:1) (i.e. offset 0 to 1 on the same text node) but the selected text
 * has more than 1 character, it replaces the end offset with text.trim().length.
 */
export function sanitizeCfiRange(cfi, text) {
  if (!cfi || !text || typeof cfi !== 'string') return cfi;
  const cleanText = text.trim();
  if (cleanText.length <= 1) return cfi;

  // Pattern: ,/X:0,/X:1)
  const singleCharPattern = /,(\/\d+:0),(\/\d+):1\)$/;
  const match = cfi.match(singleCharPattern);
  if (match) {
    const endStep = match[2];
    return cfi.replace(singleCharPattern, `,$1,${endStep}:${cleanText.length})`);
  }
  return cfi;
}

