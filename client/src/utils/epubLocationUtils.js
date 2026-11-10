/**
 * Utility helpers for EPUB CFI, location tracking, and table of contents resolution.
 */

export function findChapterLabel(items, href) {
  if (!items || !href) return '';

  // 1. Exact match (including fragment)
  for (const item of items) {
    if (item.href === href) {
      return item.label ? item.label.trim() : '';
    }
    if (item.subitems && item.subitems.length > 0) {
      const sub = findChapterLabel(item.subitems, href);
      if (sub) return sub;
    }
  }

  // 2. Base href match without fragment
  const cleanHref = href.split('#')[0];
  for (const item of items) {
    const itemClean = (item.href || '').split('#')[0];
    if (itemClean === cleanHref) {
      return item.label ? item.label.trim() : '';
    }
    if (item.subitems && item.subitems.length > 0) {
      const sub = findChapterLabel(item.subitems, cleanHref);
      if (sub) return sub;
    }
  }
  return '';
}

export function getEffectiveProgress(book) {
  if (!book?.id) {
    return {
      cfi: book?.progress?.cfi || null,
      page: book?.progress?.page || 1,
      percent: book?.progress?.percent || 0,
      totalPages: book?.progress?.total_pages || 0,
    };
  }

  let localCfi = null;
  let localPage = null;
  let localPercent = null;
  let localTotalPages = null;
  let localUpdatedAt = null;

  try {
    const cfi = localStorage.getItem(`book_cfi_${book.id}`);
    if (cfi && typeof cfi === 'string' && cfi.trim() !== '') localCfi = cfi.trim();

    const pageStr = localStorage.getItem(`book_page_${book.id}`);
    if (pageStr !== null) {
      const parsed = parseInt(pageStr, 10);
      if (!isNaN(parsed) && parsed > 0) localPage = parsed;
    }

    const pctStr = localStorage.getItem(`book_percent_${book.id}`);
    if (pctStr !== null) {
      const parsed = parseFloat(pctStr);
      if (!isNaN(parsed) && parsed >= 0) localPercent = parsed;
    }

    const totalStr = localStorage.getItem(`book_total_pages_${book.id}`);
    if (totalStr !== null) {
      const parsed = parseInt(totalStr, 10);
      if (!isNaN(parsed) && parsed > 0) localTotalPages = parsed;
    }

    localUpdatedAt = localStorage.getItem(`book_updated_at_${book.id}`);
  } catch {}

  const serverProgress = book?.progress;
  const serverUpdatedAt = serverProgress?.updated_at;

  // Decide if local storage has fresher reading progress than the server record.
  // This is critical for tab refreshes (F5) and local reading persistence.
  let preferLocal = false;
  if (localCfi || (localPage && localPage > 1)) {
    if (localUpdatedAt && serverUpdatedAt) {
      try {
        preferLocal = new Date(localUpdatedAt).getTime() >= new Date(serverUpdatedAt).getTime();
      } catch {
        preferLocal = true;
      }
    } else if (localPage && serverProgress?.page) {
      preferLocal = localPage >= serverProgress.page;
    } else {
      preferLocal = true;
    }
  }

  const cfi = preferLocal && localCfi ? localCfi : (serverProgress?.cfi || localCfi || null);
  const page = preferLocal && localPage ? localPage : (serverProgress?.page || localPage || 1);
  const percent = preferLocal && localPercent !== null ? localPercent : (serverProgress?.percent ?? localPercent ?? 0);
  const totalPages = (serverProgress?.total_pages && serverProgress.total_pages > 0)
    ? serverProgress.total_pages
    : (localTotalPages || 0);

  return { cfi, page, percent, totalPages };
}

export function getInitialCfi(book) {
  return getEffectiveProgress(book).cfi;
}

export function getInitialPercent(book) {
  return getEffectiveProgress(book).percent;
}

export function getInitialPage(book) {
  return getEffectiveProgress(book).page;
}

export function getInitialTotalPages(book) {
  return getEffectiveProgress(book).totalPages;
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

