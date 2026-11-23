import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { useEpubNavigation } from '../hooks/useEpubNavigation';
import ReaderSettingsPopover from '../components/ReaderSettingsPopover';

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

describe('EPUB Chapter Scroll Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useEpubNavigation chapterScrollModeEnabled state', () => {
    it('defaults to false when localStorage is empty', () => {
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn(), flow: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      expect(result.current.chapterScrollModeEnabled).toBe(false);
    });

    it('initializes to true if stored as "true" in localStorage', () => {
      localStorage.setItem('reader_chapter_scroll_mode', 'true');
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn(), flow: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      expect(result.current.chapterScrollModeEnabled).toBe(true);
    });

    it('toggleChapterScrollMode toggles state and persists in localStorage', () => {
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn(), flow: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      expect(result.current.chapterScrollModeEnabled).toBe(false);

      act(() => {
        result.current.toggleChapterScrollMode();
      });

      expect(result.current.chapterScrollModeEnabled).toBe(true);
      expect(localStorage.getItem('reader_chapter_scroll_mode')).toBe('true');

      act(() => {
        result.current.toggleChapterScrollMode();
      });

      expect(result.current.chapterScrollModeEnabled).toBe(false);
      expect(localStorage.getItem('reader_chapter_scroll_mode')).toBe('false');
    });
  });

  describe('wheel and gesture event behavior with chapterScrollModeEnabled', () => {
    it('scrolls the container element by deltaY without triggering page flips during normal reading', () => {
      const nextMock = vi.fn().mockReturnValue(Promise.resolve());
      const prevMock = vi.fn().mockReturnValue(Promise.resolve());
      const renditionRef = { current: { next: nextMock, prev: prevMock, flow: vi.fn() } };
      const mockContainer = {
        scrollTop: 100,
        scrollHeight: 2000,
        clientHeight: 600,
      };
      const viewerRef = {
        current: {
          querySelector: vi.fn((sel) => (sel === '.epub-container' ? mockContainer : null)),
        },
      };

      localStorage.setItem('reader_chapter_scroll_mode', 'true');

      renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      let wheelEvt;
      act(() => {
        wheelEvt = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: 120,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelEvt);
      });

      expect(nextMock).not.toHaveBeenCalled();
      expect(prevMock).not.toHaveBeenCalled();
      expect(mockContainer.scrollTop).toBe(220);
      expect(wheelEvt.defaultPrevented).toBe(true);
    });

    it('triggers next chapter when scrolling past bottom boundary with deliberate effort', () => {
      const nextMock = vi.fn().mockReturnValue(Promise.resolve());
      const prevMock = vi.fn().mockReturnValue(Promise.resolve());
      const renditionRef = { current: { next: nextMock, prev: prevMock, flow: vi.fn() } };
      const mockContainer = {
        scrollTop: 1400, // at bottom: 2000 - 600 = 1400
        scrollHeight: 2000,
        clientHeight: 600,
      };
      const viewerRef = {
        current: {
          querySelector: vi.fn((sel) => (sel === '.epub-container' ? mockContainer : null)),
        },
      };

      localStorage.setItem('reader_chapter_scroll_mode', 'true');

      renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      act(() => {
        const wheelEvt = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: 90,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelEvt);
      });

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(prevMock).not.toHaveBeenCalled();
    });

    it('triggers prev chapter when scrolling past top boundary with deliberate effort', () => {
      const nextMock = vi.fn().mockReturnValue(Promise.resolve());
      const prevMock = vi.fn().mockReturnValue(Promise.resolve());
      const renditionRef = { current: { next: nextMock, prev: prevMock, flow: vi.fn() } };
      const mockContainer = {
        scrollTop: 0, // at top
        scrollHeight: 2000,
        clientHeight: 600,
      };
      const viewerRef = {
        current: {
          querySelector: vi.fn((sel) => (sel === '.epub-container' ? mockContainer : null)),
        },
      };

      localStorage.setItem('reader_chapter_scroll_mode', 'true');

      renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      act(() => {
        const wheelEvt = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: -90,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelEvt);
      });

      expect(prevMock).toHaveBeenCalledTimes(1);
      expect(nextMock).not.toHaveBeenCalled();
    });

    it('scrolls container on touch move in chapter scroll mode', () => {
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn() } };
      const mockContainer = {
        scrollTop: 150,
        scrollHeight: 2000,
        clientHeight: 600,
      };
      const viewerRef = {
        current: {
          querySelector: vi.fn((sel) => (sel === '.epub-container' ? mockContainer : null)),
        },
      };

      localStorage.setItem('reader_chapter_scroll_mode', 'true');

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      // Simulate touch start
      act(() => {
        result.current.handleTouchStartRef.current({
          touches: [{ clientX: 100, clientY: 300 }],
        });
      });

      // Simulate touch move upwards by 50px (scrolls document down by 50px)
      act(() => {
        result.current.handleTouchMoveRef.current({
          touches: [{ clientX: 100, clientY: 250 }],
        });
      });

      expect(mockContainer.scrollTop).toBe(200);
    });

    it('triggers kinetic momentum glide on fast touch swipe release in chapter scroll mode', () => {
      let rafCallback = null;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return 123;
      });

      const renditionRef = { current: { next: vi.fn(), prev: vi.fn() } };
      const mockContainer = {
        scrollTop: 100,
        scrollHeight: 3000,
        clientHeight: 600,
      };
      const viewerRef = {
        current: {
          querySelector: vi.fn((sel) => (sel === '.epub-container' ? mockContainer : null)),
        },
      };

      localStorage.setItem('reader_chapter_scroll_mode', 'true');

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      // Start touch
      act(() => {
        result.current.handleTouchStartRef.current({
          touches: [{ clientX: 100, clientY: 400 }],
        });
      });

      // Move rapidly upwards (simulates flick gesture)
      act(() => {
        result.current.handleTouchMoveRef.current({
          touches: [{ clientX: 100, clientY: 250 }],
        });
      });

      expect(mockContainer.scrollTop).toBe(250);

      // Release touch (flick release)
      act(() => {
        result.current.handleTouchEndRef.current({
          changedTouches: [{ clientX: 100, clientY: 250 }],
        });
      });

      // Verify requestAnimationFrame was triggered for inertia glide
      expect(window.requestAnimationFrame).toHaveBeenCalled();
      expect(rafCallback).toBeInstanceOf(Function);

      // Execute inertia step
      act(() => {
        rafCallback();
      });

      // scrollTop should have increased further due to momentum
      expect(mockContainer.scrollTop).toBeGreaterThan(250);
    });
  });

  describe('ReaderSettingsPopover chapter scroll and up/down flip sub-option', () => {
    it('renders the toggle item and triggers toggleChapterScrollMode on click', () => {
      const toggleChapterScrollMode = vi.fn();

      render(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            chapterScrollModeEnabled={false}
            toggleChapterScrollMode={toggleChapterScrollMode}
          />
        </I18nProvider>
      );

      const toggleCheckbox = screen.getByRole('checkbox', {
        name: /Chapter Scroll Mode|Modo Rolagem por Capítulo/i,
      });
      expect(toggleCheckbox).toBeInTheDocument();
      expect(toggleCheckbox.checked).toBe(false);

      fireEvent.click(toggleCheckbox);
      expect(toggleChapterScrollMode).toHaveBeenCalledTimes(1);
    });

    it('hides up/down flip option when chapterScrollModeEnabled is false', () => {
      render(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            chapterScrollModeEnabled={false}
            toggleChapterScrollMode={() => {}}
            upDownFlipEnabled={false}
            toggleUpDownFlip={() => {}}
          />
        </I18nProvider>
      );

      const upDownCheckbox = screen.queryByRole('checkbox', {
        name: /Up\/Down Page Flip|Virar Página com Setas Cima\/Baixo/i,
      });
      expect(upDownCheckbox).not.toBeInTheDocument();
    });

    it('shows up/down flip option as nested sub-option when chapterScrollModeEnabled is true', () => {
      render(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            chapterScrollModeEnabled={true}
            toggleChapterScrollMode={() => {}}
            upDownFlipEnabled={false}
            toggleUpDownFlip={() => {}}
          />
        </I18nProvider>
      );

      const upDownCheckbox = screen.getByRole('checkbox', {
        name: /Up\/Down Page Flip|Virar Página com Setas Cima\/Baixo/i,
      });
      expect(upDownCheckbox).toBeInTheDocument();
      expect(upDownCheckbox.closest('label')).toHaveClass('pl-6');
    });
  });

  describe('Keyboard up/down flip scoping to chapterScrollMode', () => {
    it('does not flip on ArrowDown when chapterScrollMode is disabled even if upDownFlip is true', () => {
      localStorage.setItem('reader_chapter_scroll_mode', 'false');
      localStorage.setItem('reader_up_down_flip', 'true');

      const nextMock = vi.fn().mockReturnValue(Promise.resolve());
      const prevMock = vi.fn().mockReturnValue(Promise.resolve());
      const renditionRef = { current: { next: nextMock, prev: prevMock } };
      const viewerRef = { current: { querySelector: () => null } };

      renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });

      expect(nextMock).not.toHaveBeenCalled();
    });

    it('flips on ArrowDown when both chapterScrollMode and upDownFlip are enabled', () => {
      localStorage.setItem('reader_chapter_scroll_mode', 'true');
      localStorage.setItem('reader_up_down_flip', 'true');

      const nextMock = vi.fn().mockReturnValue(Promise.resolve());
      const prevMock = vi.fn().mockReturnValue(Promise.resolve());
      const renditionRef = { current: { next: nextMock, prev: prevMock } };
      const viewerRef = { current: { querySelector: () => null } };

      renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it('flips on ArrowUp when both chapterScrollMode and upDownFlip are enabled', () => {
      localStorage.setItem('reader_chapter_scroll_mode', 'true');
      localStorage.setItem('reader_up_down_flip', 'true');

      const nextMock = vi.fn().mockReturnValue(Promise.resolve());
      const prevMock = vi.fn().mockReturnValue(Promise.resolve());
      const renditionRef = { current: { next: nextMock, prev: prevMock } };
      const viewerRef = { current: { querySelector: () => null } };

      renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      });
      expect(prevMock).toHaveBeenCalledTimes(1);
    });

    it('does not close reader settings when touch events occur on toggle inputs or dialog', () => {
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      // Open reader settings
      act(() => {
        result.current.setReaderSettingsOpen(true);
      });
      expect(result.current.readerSettingsOpen).toBe(true);

      // Create an input inside a label inside reader settings dialog
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('data-reader-settings', 'true');
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      label.appendChild(input);
      dialog.appendChild(label);
      document.body.appendChild(dialog);

      // Simulate touch start and touch end on the checkbox input
      const touchObj = { clientX: 100, clientY: 100 };
      const touchStartEvent = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchStartEvent, 'touches', { value: [touchObj] });
      Object.defineProperty(touchStartEvent, 'target', { value: input });
      act(() => {
        window.dispatchEvent(touchStartEvent);
      });

      const touchEndEvent = new Event('touchend', { bubbles: true, cancelable: true });
      Object.defineProperty(touchEndEvent, 'changedTouches', { value: [touchObj] });
      Object.defineProperty(touchEndEvent, 'target', { value: input });
      act(() => {
        window.dispatchEvent(touchEndEvent);
      });

      // Settings should still be open!
      expect(result.current.readerSettingsOpen).toBe(true);

      // Clean up DOM
      document.body.removeChild(dialog);
    });

    it('initializes singlePageEnabled to false by default and toggles correctly', () => {
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            themeRef: { current: 'dark' },
          }),
        { wrapper }
      );

      expect(result.current.singlePageEnabled).toBe(false);
      expect(result.current.epubReadingMode).toBe('dual');

      act(() => {
        result.current.changeEpubReadingMode('single');
      });

      expect(result.current.singlePageEnabled).toBe(true);
      expect(result.current.chapterScrollModeEnabled).toBe(false);
      expect(result.current.epubReadingMode).toBe('single');
      expect(localStorage.getItem('reader_epub_reading_mode')).toBe('single');

      act(() => {
        result.current.changeEpubReadingMode('chapterScroll');
      });

      expect(result.current.singlePageEnabled).toBe(false);
      expect(result.current.chapterScrollModeEnabled).toBe(true);
      expect(result.current.epubReadingMode).toBe('chapterScroll');
      expect(localStorage.getItem('reader_epub_reading_mode')).toBe('chapterScroll');

      act(() => {
        result.current.changeEpubReadingMode('dual');
      });

      expect(result.current.singlePageEnabled).toBe(false);
      expect(result.current.chapterScrollModeEnabled).toBe(false);
      expect(result.current.epubReadingMode).toBe('dual');
    });

    it('renders unified Reading Mode combo with Dual Page, Single Page, Chapter Scroll in ReaderSettingsPopover', () => {
      const changeEpubReadingMode = vi.fn();
      const toggleUpDownFlip = vi.fn();

      const { rerender } = render(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            epubReadingMode="dual"
            changeEpubReadingMode={changeEpubReadingMode}
            upDownFlipEnabled={false}
            toggleUpDownFlip={toggleUpDownFlip}
          />
        </I18nProvider>
      );

      const select = screen.getByRole('combobox', { name: /Reading Mode|Modo de Leitura/i });
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('dual');

      // In 'dual' mode, Up/Down flip sub-option is not shown
      expect(screen.queryByText(/Up\/Down Page Flip|Rolagem por Capítulo/i)).not.toBeInTheDocument();

      // Trigger change
      fireEvent.change(select, { target: { value: 'chapterScroll' } });
      expect(changeEpubReadingMode).toHaveBeenCalledWith('chapterScroll');

      // In 'chapterScroll' mode, Up/Down flip sub-option is shown
      rerender(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            epubReadingMode="chapterScroll"
            changeEpubReadingMode={changeEpubReadingMode}
            upDownFlipEnabled={true}
            toggleUpDownFlip={toggleUpDownFlip}
          />
        </I18nProvider>
      );

      expect(screen.getByText(/Up\/Down Page Flip/i)).toBeInTheDocument();
    });

    it('shows Single Page Mode in ReaderSettingsPopover in legacy fallback when chapter scroll mode is disabled', () => {
      const toggleSinglePage = vi.fn();

      // Case 1: Chapter scroll mode is disabled -> Single Page toggle is visible
      const { rerender } = render(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            chapterScrollModeEnabled={false}
            toggleChapterScrollMode={() => {}}
            singlePageEnabled={false}
            toggleSinglePage={toggleSinglePage}
          />
        </I18nProvider>
      );

      expect(
        screen.getByRole('checkbox', {
          name: /Single Page Mode|Modo Página Única/i,
        })
      ).toBeInTheDocument();

      // Case 2: Chapter scroll mode is enabled -> Single Page toggle is hidden
      rerender(
        <I18nProvider>
          <ReaderSettingsPopover
            isOpen={true}
            onClose={() => {}}
            chapterScrollModeEnabled={true}
            toggleChapterScrollMode={() => {}}
            singlePageEnabled={false}
            toggleSinglePage={toggleSinglePage}
          />
        </I18nProvider>
      );

      expect(
        screen.queryByRole('checkbox', {
          name: /Single Page Mode|Modo Página Única/i,
        })
      ).not.toBeInTheDocument();
    });
  });
});
