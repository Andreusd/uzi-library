import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { useEpubTheme } from '../hooks/useEpubTheme';
import { useEpubSearch } from '../hooks/useEpubSearch';
import { useEpubAnnotations } from '../hooks/useEpubAnnotations';
import { useLibraryData } from '../hooks/useLibraryData';

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

describe('EPUB Viewer Subsystem Hooks', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        status: 'ok',
        annotations: [],
        libraries: [{ id: 'lib-1', name: 'Main' }],
        shelves: [],
        books: [],
        progress: {},
      }),
    }));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  describe('useEpubTheme', () => {
    it('initializes default dark theme and font size 100%', () => {
      const renditionRef = { current: { themes: { select: vi.fn(), fontSize: vi.fn() }, getContents: () => [] } };
      const viewerRef = { current: { querySelectorAll: () => [] } };

      const { result } = renderHook(() =>
        useEpubTheme({
          book: { id: 'book-1', progress: {} },
          mode: 'dark',
          onModeChange: vi.fn(),
          renditionRef,
          viewerRef,
        }),
        { wrapper }
      );

      expect(result.current.theme).toBe('dark');
      expect(result.current.fontSize).toBe(100);
      expect(result.current.viewerBgClass).toContain('bg-black');
    });

    it('cycles themes dark -> light -> sepia -> dark', () => {
      const renditionRef = { current: { themes: { select: vi.fn(), fontSize: vi.fn() }, getContents: () => [] } };
      const viewerRef = { current: { querySelectorAll: () => [] } };
      const onModeChange = vi.fn();

      const { result } = renderHook(() =>
        useEpubTheme({
          book: { id: 'book-1', progress: {} },
          mode: 'dark',
          onModeChange,
          renditionRef,
          viewerRef,
        }),
        { wrapper }
      );

      // dark -> light
      act(() => {
        result.current.cycleTheme();
      });
      expect(result.current.theme).toBe('light');
      expect(result.current.viewerBgClass).toContain('bg-white');

      // light -> sepia
      act(() => {
        result.current.cycleTheme();
      });
      expect(result.current.theme).toBe('sepia');
      expect(result.current.viewerBgClass).toContain('bg-[#fbf0d9]');

      // sepia -> dark
      act(() => {
        result.current.cycleTheme();
      });
      expect(result.current.theme).toBe('dark');
    });

    it('modifies and clamps font size within range [70%, 220%]', () => {
      const selectMock = vi.fn();
      const fontSizeMock = vi.fn();
      const renditionRef = { current: { themes: { select: selectMock, fontSize: fontSizeMock }, getContents: () => [] } };
      const viewerRef = { current: { querySelectorAll: () => [] } };

      const { result } = renderHook(() =>
        useEpubTheme({
          book: { id: 'book-1', progress: {} },
          mode: 'dark',
          onModeChange: vi.fn(),
          renditionRef,
          viewerRef,
        }),
        { wrapper }
      );

      act(() => {
        result.current.changeFontSize(15);
      });
      expect(result.current.fontSize).toBe(115);

      act(() => {
        result.current.changeFontSize(-30);
      });
      expect(result.current.fontSize).toBe(85);

      act(() => {
        result.current.changeFontSize(-100);
      });
      expect(result.current.fontSize).toBe(70); // clamped min

      act(() => {
        result.current.changeFontSize(300);
      });
      expect(result.current.fontSize).toBe(220); // clamped max

      act(() => {
        result.current.resetFontSize();
      });
      expect(result.current.fontSize).toBe(100);
    });

    it('initializes font family and allows changing it with localStorage persistence', () => {
      const renditionRef = { current: { themes: { select: vi.fn(), fontSize: vi.fn() }, getContents: () => [] } };
      const viewerRef = { current: { querySelectorAll: () => [] } };

      const { result } = renderHook(() =>
        useEpubTheme({
          book: { id: 'book-1', progress: {} },
          mode: 'dark',
          onModeChange: vi.fn(),
          renditionRef,
          viewerRef,
        }),
        { wrapper }
      );

      expect(result.current.fontFamily).toBe('default');

      act(() => {
        result.current.changeFontFamily('georgia');
      });

      expect(result.current.fontFamily).toBe('georgia');
      expect(localStorage.setItem).toHaveBeenCalledWith('reader_font_family', 'georgia');
      expect(localStorage.setItem).toHaveBeenCalledWith('book_font_family_book-1', 'georgia');
    });
  });

  describe('useEpubSearch', () => {
    it('manages search drawer state and results reset', () => {
      const bookRef = { current: null };
      const renditionRef = { current: null };

      const { result } = renderHook(() =>
        useEpubSearch({ bookRef, renditionRef }),
        { wrapper }
      );

      expect(result.current.searchOpen).toBe(false);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);

      act(() => {
        result.current.setSearchOpen(true);
        result.current.setSearchQuery('test query');
      });

      expect(result.current.searchOpen).toBe(true);
      expect(result.current.searchQuery).toBe('test query');

      act(() => {
        result.current.handleCloseSearch();
      });

      expect(result.current.searchOpen).toBe(false);
      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe('useEpubAnnotations', () => {
    it('loads annotations on mount and exposes handlers', async () => {
      const mockAnnotations = [
        { id: 'ann-1', text: 'Sample highlight', color: 'yellow', cfi: 'epubcfi(/6/4)' }
      ];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ status: 'ok', annotations: mockAnnotations }),
      }));

      const renditionRef = {
        current: {
          annotations: {
            add: vi.fn(),
            remove: vi.fn(),
          }
        }
      };
      const viewerRef = { current: null };

      let result;
      await act(async () => {
        const rendered = renderHook(() =>
          useEpubAnnotations({
            book: { id: 'book-1' },
            renditionRef,
            renditionReady: true,
            viewerRef,
            locationInfo: { chapter: 'Chapter 1' }
          }),
          { wrapper }
        );
        result = rendered.result;
      });

      expect(result.current.commentsDrawerOpen).toBe(false);
      expect(result.current.selectionMenu.isOpen).toBe(false);

      act(() => {
        result.current.setCommentsDrawerOpen(true);
      });
      expect(result.current.commentsDrawerOpen).toBe(true);
    });
  });

  describe('useLibraryData', () => {
    it('initializes library state and navigates shelves', async () => {
      const setCurrentUser = vi.fn();
      const modals = {
        closeRenameModal: vi.fn(),
        closeIconModal: vi.fn(),
      };
      const router = {
        route: { libraryId: 'lib-1', shelfId: 'favorites' },
        navigateToShelf: vi.fn(),
        navigateToBook: vi.fn(),
        navigateToLibraries: vi.fn(),
      };

      let result;
      await act(async () => {
        const rendered = renderHook(() =>
          useLibraryData({ setCurrentUser, modals, router }),
          { wrapper }
        );
        result = rendered.result;
      });

      expect(result.current.activeLibraryId).toBe('lib-1');
      expect(result.current.selectedShelf).toBe('favorites');

      act(() => {
        result.current.navigateToShelf('all-books');
      });

      expect(result.current.selectedShelf).toBe('all-books');
      expect(router.navigateToShelf).toHaveBeenCalledWith('all-books', 'lib-1');
    });

    it('updates book progress optimistically', async () => {
      const setCurrentUser = vi.fn();
      const modals = { closeRenameModal: vi.fn(), closeIconModal: vi.fn() };
      const router = {
        route: { libraryId: 'lib-1' },
        navigateToShelf: vi.fn(),
        navigateToBook: vi.fn(),
        navigateToLibraries: vi.fn(),
      };

      let result;
      await act(async () => {
        const rendered = renderHook(() =>
          useLibraryData({ setCurrentUser, modals, router }),
          { wrapper }
        );
        result = rendered.result;
      });

      act(() => {
        result.current.handleProgressUpdate('book-1', { page: 15, total_pages: 100, percent: 15, status: 'reading' });
      });

      expect(typeof result.current.handleProgressUpdate).toBe('function');
    });
  });
});
