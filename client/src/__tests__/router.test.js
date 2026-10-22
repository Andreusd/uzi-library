import { describe, it, expect, afterEach } from 'vitest';
import { parseRoute, getPathForShelf, getPathForBook } from '../hooks/useLibraryRouter';

describe('useLibraryRouter', () => {
  const originalLocation = window.location;

  const setLocation = (pathname, hash = '') => {
    delete window.location;
    window.location = {
      ...originalLocation,
      pathname,
      hash,
    };
  };

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('parseRoute', () => {
    it('parses root / as select-library view', () => {
      setLocation('/');
      const route = parseRoute();
      expect(route.view).toBe('select-library');
      expect(route.libraryId).toBeNull();
    });

    it('parses library home route /:libraryId', () => {
      setLocation('/lib_123');
      const route = parseRoute();
      expect(route.view).toBe('home');
      expect(route.libraryId).toBe('lib_123');
    });

    it('parses folder route /:libraryId/folder/:id', () => {
      setLocation('/lib_123/folder/Sci-Fi');
      const route = parseRoute();
      expect(route.view).toBe('folder');
      expect(route.libraryId).toBe('lib_123');
      expect(route.shelfId).toBe('Sci-Fi');
    });

    it('parses book route /:libraryId/book/:id', () => {
      setLocation('/lib_123/book/book_abc');
      const route = parseRoute();
      expect(route.view).toBe('book');
      expect(route.libraryId).toBe('lib_123');
      expect(route.bookId).toBe('book_abc');
    });

    it('parses continue-reading route', () => {
      setLocation('/lib_123/continue-reading');
      const route = parseRoute();
      expect(route.view).toBe('continue-reading');
      expect(route.libraryId).toBe('lib_123');
    });

    it('parses favorites route', () => {
      setLocation('/lib_123/favorites');
      const route = parseRoute();
      expect(route.view).toBe('favorites');
      expect(route.libraryId).toBe('lib_123');
    });

    it('parses read-books route', () => {
      setLocation('/lib_123/read-books');
      const route = parseRoute();
      expect(route.view).toBe('read-books');
      expect(route.libraryId).toBe('lib_123');
      expect(route.shelfId).toBe('read-books');

      setLocation('/lib_123/completed');
      const routeCompleted = parseRoute();
      expect(routeCompleted.view).toBe('read-books');
      expect(routeCompleted.shelfId).toBe('read-books');
    });

    it('supports hash navigation (e.g. #/lib_123/folders)', () => {
      setLocation('/', '#/lib_123/folders');
      const route = parseRoute();
      expect(route.view).toBe('folders');
      expect(route.libraryId).toBe('lib_123');
    });
  });

  describe('getPathForShelf', () => {
    it('returns / if no libraryId is provided', () => {
      expect(getPathForShelf('Sci-Fi', null)).toBe('/');
    });

    it('formats library and special views correctly', () => {
      expect(getPathForShelf(null, 'lib_1')).toBe('/lib_1');
      expect(getPathForShelf('continue-reading', 'lib_1')).toBe('/lib_1/continue-reading');
      expect(getPathForShelf('favorites', 'lib_1')).toBe('/lib_1/favorites');
      expect(getPathForShelf('read-books', 'lib_1')).toBe('/lib_1/read-books');
      expect(getPathForShelf('folders', 'lib_1')).toBe('/lib_1/folders');
      expect(getPathForShelf('all-books', 'lib_1')).toBe('/lib_1/all-books');
      expect(getPathForShelf('tags', 'lib_1')).toBe('/lib_1/tags');
      expect(getPathForShelf('tag:fiction', 'lib_1')).toBe('/lib_1/tag/fiction');
      expect(getPathForShelf('Sci-Fi', 'lib_1')).toBe('/lib_1/folder/Sci-Fi');
    });
  });

  describe('getPathForBook', () => {
    it('formats book URLs with or without library ID', () => {
      expect(getPathForBook('book_99', null)).toBe('/book/book_99');
      expect(getPathForBook('book_99', 'lib_dev')).toBe('/lib_dev/book/book_99');
    });
  });
});
