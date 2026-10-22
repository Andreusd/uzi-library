import { useState, useEffect, useCallback } from 'react';

/**
 * Extracts view & route information from URL.
 * Scoped routes: /:libraryId, /:libraryId/folder/:id, /:libraryId/continue-reading, /:libraryId/favorites, /:libraryId/book/:id
 * Root / -> view: 'select-library'
 */
export function parseRoute() {
  if (typeof window === 'undefined') {
    return { view: 'select-library', libraryId: null, shelfId: null, bookId: null };
  }

  let rawPath = window.location.pathname;
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    rawPath = window.location.hash.slice(1);
  }

  const segments = rawPath.split('/').filter(Boolean).map((s) => decodeURIComponent(s));

  // 1. Root / -> Select Library view
  if (segments.length === 0) {
    return { view: 'select-library', libraryId: null, shelfId: null, bookId: null };
  }

  // 2. Legacy direct paths without library prefix
  if (segments[0] === 'book' && segments[1]) {
    return { view: 'book', libraryId: null, shelfId: null, bookId: segments[1] };
  }
  if (segments[0] === 'continue-reading') {
    return { view: 'continue-reading', libraryId: null, shelfId: 'continue-reading', bookId: null };
  }
  if (segments[0] === 'favorites') {
    return { view: 'favorites', libraryId: null, shelfId: 'favorites', bookId: null };
  }
  if (segments[0] === 'read-books' || segments[0] === 'read' || segments[0] === 'completed') {
    return { view: 'read-books', libraryId: null, shelfId: 'read-books', bookId: null };
  }
  if (segments[0] === 'folders' || segments[0] === 'shelves') {
    return { view: 'folders', libraryId: null, shelfId: 'folders', bookId: null };
  }
  if (segments[0] === 'all-books' || segments[0] === 'all') {
    return { view: 'all-books', libraryId: null, shelfId: 'all-books', bookId: null };
  }
  if (segments[0] === 'tags') {
    return { view: 'tags', libraryId: null, shelfId: 'tags', bookId: null };
  }
  if ((segments[0] === 'folder' || segments[0] === 'shelf') && segments[1]) {
    return { view: 'folder', libraryId: null, shelfId: segments[1], bookId: null };
  }
  if (segments[0] === 'tag' && segments[1]) {
    return { view: 'tag', libraryId: null, shelfId: `tag:${segments[1]}`, bookId: null };
  }

  // 3. Library-scoped routes
  let libId = segments[0];
  let rest = segments.slice(1);
  if (libId === 'library' && rest.length > 0) {
    libId = rest[0];
    rest = rest.slice(1);
  }

  if (rest.length === 0) {
    return { view: 'home', libraryId: libId, shelfId: null, bookId: null };
  }

  if (rest[0] === 'book' && rest[1]) {
    return { view: 'book', libraryId: libId, shelfId: null, bookId: rest[1] };
  }
  if (rest[0] === 'continue-reading') {
    return { view: 'continue-reading', libraryId: libId, shelfId: 'continue-reading', bookId: null };
  }
  if (rest[0] === 'favorites') {
    return { view: 'favorites', libraryId: libId, shelfId: 'favorites', bookId: null };
  }
  if (rest[0] === 'read-books' || rest[0] === 'read' || rest[0] === 'completed') {
    return { view: 'read-books', libraryId: libId, shelfId: 'read-books', bookId: null };
  }
  if (rest[0] === 'folders' || rest[0] === 'shelves') {
    return { view: 'folders', libraryId: libId, shelfId: 'folders', bookId: null };
  }
  if (rest[0] === 'all-books' || rest[0] === 'all') {
    return { view: 'all-books', libraryId: libId, shelfId: 'all-books', bookId: null };
  }
  if (rest[0] === 'tags') {
    return { view: 'tags', libraryId: libId, shelfId: 'tags', bookId: null };
  }
  if ((rest[0] === 'folder' || rest[0] === 'shelf') && rest[1]) {
    return { view: 'folder', libraryId: libId, shelfId: rest[1], bookId: null };
  }
  if (rest[0] === 'tag' && rest[1]) {
    return { view: 'tag', libraryId: libId, shelfId: `tag:${rest[1]}`, bookId: null };
  }

  return { view: 'home', libraryId: libId, shelfId: null, bookId: null };
}

export function getPathForShelf(shelfId, libraryId) {
  if (!libraryId) return '/';
  const base = `/${encodeURIComponent(libraryId)}`;
  if (!shelfId) return base;
  if (shelfId === 'continue-reading') return `${base}/continue-reading`;
  if (shelfId === 'favorites') return `${base}/favorites`;
  if (shelfId === 'read-books' || shelfId === 'read') return `${base}/read-books`;
  if (shelfId === 'folders' || shelfId === 'shelves') return `${base}/folders`;
  if (shelfId === 'all-books' || shelfId === 'all') return `${base}/all-books`;
  if (shelfId === 'tags') return `${base}/tags`;
  if (shelfId.startsWith('tag:')) return `${base}/tag/${encodeURIComponent(shelfId.slice(4))}`;
  return `${base}/folder/${encodeURIComponent(shelfId)}`;
}
export const getPathForFolder = getPathForShelf;

export function getPathForBook(bookId, libraryId) {
  if (!libraryId) return `/book/${encodeURIComponent(bookId)}`;
  return `/${encodeURIComponent(libraryId)}/book/${encodeURIComponent(bookId)}`;
}

/**
 * Custom hook to manage URL routing, browser history, and view transitions.
 */
export function useLibraryRouter() {
  const [route, setRoute] = useState(() => parseRoute());

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((url) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', url);
      setRoute(parseRoute());
    }
  }, []);

  const navigateToShelf = useCallback((shelfId, libraryId) => {
    const url = getPathForShelf(shelfId, libraryId);
    navigate(url);
  }, [navigate]);

  const navigateToBook = useCallback((bookId, libraryId) => {
    const url = getPathForBook(bookId, libraryId);
    navigate(url);
  }, [navigate]);

  const navigateToLibraries = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return {
    route,
    setRoute,
    navigate,
    navigateToShelf,
    navigateToBook,
    navigateToLibraries,
  };
}
