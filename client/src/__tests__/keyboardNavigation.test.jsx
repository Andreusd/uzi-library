import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, act, fireEvent } from '@testing-library/react';
import BookCard from '../components/BookCard';
import ContinueReading from '../components/ContinueReading';
import { BookActionsProvider } from '../contexts/BookActionsContext.jsx';
import { useLibraryKeyboardNavigation } from '../hooks/useLibraryKeyboardNavigation';
import { usePdfKeyboardGestures } from '../hooks/usePdfKeyboardGestures';
import { useEpubNavigation } from '../hooks/useEpubNavigation';
import Sidebar from '../components/Sidebar';
import FolderCard from '../components/FolderCard';
import TagCard from '../components/TagCard';
import LibrarySelector from '../components/LibrarySelector';
import ContextMenu from '../components/ContextMenu';
import { I18nProvider } from '../i18n';

describe('Library Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBooks = [
    { id: 'b1', title: 'Book One', cover_url: '/c1.jpg', format: 'epub' },
    { id: 'b2', title: 'Book Two', cover_url: '/c2.jpg', format: 'pdf' },
    { id: 'b3', title: 'Book Three', cover_url: '/c3.jpg', format: 'epub' },
    { id: 'b4', title: 'Book Four', cover_url: '/c4.jpg', format: 'pdf' },
  ];

  describe('useLibraryKeyboardNavigation hook', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    function setupMockDomCards() {
      container.innerHTML = `
        <div data-book-card="true" data-card-id="grid-b1" data-book-id="b1" class="book-card" style="width: 150px; height: 200px;">
          <div class="book-cover-container"></div>
        </div>
        <div data-book-card="true" data-card-id="grid-b2" data-book-id="b2" class="book-card" style="width: 150px; height: 200px;">
          <div class="book-cover-container"></div>
        </div>
        <div data-book-card="true" data-card-id="grid-b3" data-book-id="b3" class="book-card" style="width: 150px; height: 200px;">
          <div class="book-cover-container"></div>
        </div>
        <div data-book-card="true" data-card-id="grid-b4" data-book-id="b4" class="book-card" style="width: 150px; height: 200px;">
          <div class="book-cover-container"></div>
        </div>
      `;

      const cards = container.querySelectorAll('[data-book-card="true"]');
      // Mock layout: 2x2 grid
      // Row 1: b1 (left: 0, top: 0), b2 (left: 160, top: 0)
      // Row 2: b3 (left: 0, top: 220), b4 (left: 160, top: 220)
      const rects = [
        { top: 0, bottom: 200, left: 0, right: 150, width: 150, height: 200 },
        { top: 0, bottom: 200, left: 160, right: 310, width: 150, height: 200 },
        { top: 220, bottom: 420, left: 0, right: 150, width: 150, height: 200 },
        { top: 220, bottom: 420, left: 160, right: 310, width: 150, height: 200 },
      ];

      cards.forEach((card, idx) => {
        const r = rects[idx];
        card.getBoundingClientRect = () => r;
        Object.defineProperty(card, 'offsetWidth', { value: r.width, configurable: true });
        Object.defineProperty(card, 'offsetHeight', { value: r.height, configurable: true });
        Object.defineProperty(card, 'offsetParent', { value: container, configurable: true });
        card.scrollIntoView = vi.fn();
      });

      return cards;
    }

    it('highlights the first book when any arrow key is pressed initially', () => {
      setupMockDomCards();
      const openReader = vi.fn();

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: {},
          libraryData: { books: mockBooks },
          openReader,
        })
      );

      expect(result.current.highlightedCardId).toBeNull();

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });

      expect(result.current.highlightedCardId).toBe('grid-b1');
    });

    it('navigates spatially: Right, Down, Left, Up', () => {
      setupMockDomCards();
      const openReader = vi.fn();

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: {},
          libraryData: { books: mockBooks },
          openReader,
        })
      );

      // Start navigation: highlights b1
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');

      // Move Right to b2
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b2');

      // Move Down to b4
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b4');

      // Move Left to b3
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b3');

      // Move Up to b1
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');
    });

    it('does not move to the next row when there are no books to the right and Right is pressed', () => {
      setupMockDomCards();
      const openReader = vi.fn();

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: {},
          libraryData: { books: mockBooks },
          openReader,
        })
      );

      // Start navigation: highlights b1
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');

      // Move Right to b2 (rightmost item in row 1)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b2');

      // Press Right again when no card is to the right -> does nothing (stays on grid-b2, does not jump to row 2)
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b2');
    });

    it('opens the highlighted book on Enter', () => {
      setupMockDomCards();
      const openReader = vi.fn();

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: {},
          libraryData: { books: mockBooks },
          openReader,
        })
      );

      // Highlight b1
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');

      // Press Enter
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(openReader).toHaveBeenCalledTimes(1);
      expect(openReader).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1', title: 'Book One' }),
        expect.any(Object)
      );
    });

    it('clears highlight on Escape or Backspace in library', () => {
      setupMockDomCards();
      const openReader = vi.fn();

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: {},
          libraryData: { books: mockBooks },
          openReader,
        })
      );

      // Highlight b1
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');

      // Press Backspace in library
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      });
      expect(result.current.highlightedCardId).toBeNull();

      // Highlight again
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');

      // Press Escape in library
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(result.current.highlightedCardId).toBeNull();
    });

    it('does not intercept navigation when user is typing in an input', () => {
      setupMockDomCards();
      const input = document.createElement('input');
      container.appendChild(input);

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: {},
          libraryData: { books: mockBooks },
          openReader: vi.fn(),
        })
      );

      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });

      expect(result.current.highlightedCardId).toBeNull();
    });

    it('does not navigate when a modal is open', () => {
      setupMockDomCards();

      const { result } = renderHook(() =>
        useLibraryKeyboardNavigation({
          isReaderActive: false,
          modals: { settingsOpen: true },
          libraryData: { books: mockBooks },
          openReader: vi.fn(),
        })
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });

      expect(result.current.highlightedCardId).toBeNull();
    });

    it('does not highlight book when opening and closing a book, activating only on arrow key press', () => {
      setupMockDomCards();

      let activeBook = null;
      let isReaderActive = false;

      const { result, rerender } = renderHook(
        (props) =>
          useLibraryKeyboardNavigation({
            isReaderActive: props.isReaderActive,
            modals: {},
            libraryData: { books: mockBooks },
            activeBook: props.activeBook,
            openReader: vi.fn(),
          }),
        { initialProps: { activeBook, isReaderActive } }
      );

      // Initially no card is highlighted
      expect(result.current.highlightedCardId).toBeNull();

      // Open a book
      activeBook = mockBooks[0];
      isReaderActive = true;
      rerender({ activeBook, isReaderActive });

      // Opening the book must NOT highlight it
      expect(result.current.highlightedCardId).toBeNull();

      // Close the book
      activeBook = null;
      isReaderActive = false;
      rerender({ activeBook, isReaderActive });

      // Closing the book must NOT highlight it either
      expect(result.current.highlightedCardId).toBeNull();

      // Highlighting must activate ONLY when an arrow key is pressed
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });
      expect(result.current.highlightedCardId).toBe('grid-b1');
    });

    describe('Sidebar Menu Keyboard Navigation', () => {
      function setupMockDomWithMenuAndCards({
        includeFoldersChild = true,
        includeTagsChild = true,
        includeTopItems = false,
        includeLibraryDropdown = false,
      } = {}) {
        container.innerHTML = `
          <nav class="sidebar">
            ${
              includeTopItems
                ? `
              <button data-sidebar-item="true" data-item-id="menu-library-select" class="sidebar-item">Biblioteca Ativa</button>
              ${
                includeLibraryDropdown
                  ? `
                <button data-sidebar-item="true" data-item-id="menu-lib-all" class="sidebar-item">Todas as Bibliotecas</button>
                <button data-sidebar-item="true" data-item-id="menu-lib-lib1" class="sidebar-item">Lib 1</button>
                <button data-sidebar-item="true" data-item-id="menu-lib-lib2" class="sidebar-item">Lib 2</button>
                <button data-sidebar-item="true" data-item-id="menu-lib-manage" class="sidebar-item">Gerenciar</button>
              `
                  : ''
              }
              <div data-sidebar-item="true" data-item-id="menu-filter-shelves" class="sidebar-item">
                <input data-shelf-filter-input="true" type="text" />
              </div>
            `
                : ''
            }
            <button data-sidebar-item="true" data-item-id="menu-home" class="sidebar-item">Início</button>
            <button data-sidebar-item="true" data-item-id="menu-continue-reading" class="sidebar-item">Continuar lendo</button>
            <button data-sidebar-item="true" data-item-id="menu-favorites" class="sidebar-item">Favoritos</button>
            <div data-sidebar-item="true" data-item-id="menu-folders" class="sidebar-item">Pastas</div>
            ${includeFoldersChild ? '<button data-sidebar-item="true" data-item-id="menu-folder-f1" class="sidebar-item">Folder 1</button>' : ''}
            <div data-sidebar-item="true" data-item-id="menu-tags" class="sidebar-item">Tags</div>
            ${includeTagsChild ? '<button data-sidebar-item="true" data-item-id="menu-tag-t1" class="sidebar-item">Tag 1</button>' : ''}
            <button data-sidebar-item="true" data-item-id="menu-all-books" class="sidebar-item">Todos os Livros</button>
          </nav>
          <div class="library">
            <div data-book-card="true" data-card-id="grid-b1" data-book-id="b1" class="book-card" style="width: 150px; height: 200px;">
              <div class="book-cover-container"></div>
            </div>
            <div data-book-card="true" data-card-id="grid-b2" data-book-id="b2" class="book-card" style="width: 150px; height: 200px;">
              <div class="book-cover-container"></div>
            </div>
            <div data-book-card="true" data-card-id="grid-b3" data-book-id="b3" class="book-card" style="width: 150px; height: 200px;">
              <div class="book-cover-container"></div>
            </div>
            <div data-book-card="true" data-card-id="grid-b4" data-book-id="b4" class="book-card" style="width: 150px; height: 200px;">
              <div class="book-cover-container"></div>
            </div>
          </div>
        `;

        const cards = container.querySelectorAll('[data-book-card="true"]');
        const rects = [
          { top: 0, bottom: 200, left: 0, right: 150, width: 150, height: 200 },
          { top: 0, bottom: 200, left: 160, right: 310, width: 150, height: 200 },
          { top: 220, bottom: 420, left: 0, right: 150, width: 150, height: 200 },
          { top: 220, bottom: 420, left: 160, right: 310, width: 150, height: 200 },
        ];

        cards.forEach((card, idx) => {
          const r = rects[idx];
          card.getBoundingClientRect = () => r;
          Object.defineProperty(card, 'offsetWidth', { value: r.width, configurable: true });
          Object.defineProperty(card, 'offsetHeight', { value: r.height, configurable: true });
          Object.defineProperty(card, 'offsetParent', { value: container, configurable: true });
          card.scrollIntoView = vi.fn();
        });

        const menuItems = container.querySelectorAll('[data-sidebar-item="true"]');
        menuItems.forEach((item) => {
          item.scrollIntoView = vi.fn();
        });

        return { cards, menuItems };
      }

      it('switches to sidebar menu when pressing Left and no book to the left', () => {
        setupMockDomWithMenuAndCards();
        const setSidebarOpen = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            setSidebarOpen,
          })
        );

        // First right arrow highlights grid-b1 (leftmost card)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        expect(result.current.highlightedCardId).toBe('grid-b1');
        expect(result.current.focusArea).toBe('books');

        // Press Left on grid-b1 -> no book to left -> switch to menu
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });

        expect(setSidebarOpen).toHaveBeenCalledWith(true);
        expect(result.current.focusArea).toBe('menu');
        expect(result.current.highlightedCardId).toBeNull();
        expect(result.current.highlightedMenuItemId).toBe('menu-home');
      });

      it('browses through menu items with ArrowDown and ArrowUp without changing the page', () => {
        setupMockDomWithMenuAndCards();
        const onSelectShelf = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            onSelectShelf,
            isFoldersOpen: true,
            isTagsOpen: true,
          })
        );

        // Highlight b1 and move left to menu
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.focusArea).toBe('menu');
        expect(result.current.highlightedMenuItemId).toBe('menu-home');

        // ArrowDown -> menu-continue-reading
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-continue-reading');
        expect(onSelectShelf).not.toHaveBeenCalled();

        // ArrowDown -> menu-favorites
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-favorites');
        expect(onSelectShelf).not.toHaveBeenCalled();

        // ArrowDown -> menu-folders
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-folders');
        expect(onSelectShelf).not.toHaveBeenCalled();

        // ArrowDown -> menu-folder-f1
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-folder-f1');
        expect(onSelectShelf).not.toHaveBeenCalled();

        // ArrowUp -> menu-folders
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-folders');
        expect(onSelectShelf).not.toHaveBeenCalled();

        // ArrowUp -> menu-favorites
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-favorites');
        expect(onSelectShelf).not.toHaveBeenCalled();
      });

      it('collapses folders or tags when pressing Left on collapsible header', () => {
        setupMockDomWithMenuAndCards();
        const setIsFoldersOpen = vi.fn();
        const setIsTagsOpen = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: 'folders',
            isFoldersOpen: true,
            setIsFoldersOpen,
            isTagsOpen: true,
            setIsTagsOpen,
          })
        );

        // Switch to menu -> since selectedShelf is 'folders', initial item is menu-folders
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.focusArea).toBe('menu');
        expect(result.current.highlightedMenuItemId).toBe('menu-folders');

        // Press Left on menu-folders -> collapses folders
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(setIsFoldersOpen).toHaveBeenCalledWith(false);

        // Navigate to menu-tags (skip folder-f1, tags is 2 steps down)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-tags');

        // Press Left on menu-tags -> collapses tags
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(setIsTagsOpen).toHaveBeenCalledWith(false);
      });

      it('jumps from a child item to its parent header on Left', () => {
        setupMockDomWithMenuAndCards();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: 'f1',
            isFoldersOpen: true,
            isTagsOpen: true,
          })
        );

        // Switch to menu -> initial item is menu-folder-f1
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-folder-f1');

        // Press Left on child item -> jumps to menu-folders
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-folders');
      });

      it('de-collapses a collapsed item when pressing Right', () => {
        setupMockDomWithMenuAndCards({ includeFoldersChild: false });
        const setIsFoldersOpen = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: 'folders',
            isFoldersOpen: false,
            setIsFoldersOpen,
          })
        );

        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-folders');

        // Press Right on collapsed item -> calls setIsFoldersOpen(true)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        expect(setIsFoldersOpen).toHaveBeenCalledWith(true);
        expect(result.current.focusArea).toBe('menu');
      });

      it('moves back to books when pressing Right on an already de-collapsed or non-collapsible item', () => {
        setupMockDomWithMenuAndCards();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            isFoldersOpen: true,
          })
        );

        // Highlight b1 first
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        expect(result.current.highlightedCardId).toBe('grid-b1');

        // Move to menu
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.focusArea).toBe('menu');
        expect(result.current.highlightedMenuItemId).toBe('menu-home');

        // Press Right on menu-home (non-collapsible) -> moves back to books and restores grid-b1
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        expect(result.current.focusArea).toBe('books');
        expect(result.current.highlightedCardId).toBe('grid-b1');
        expect(result.current.highlightedMenuItemId).toBeNull();
      });

      it('only changes the page when Enter is pressed on a menu item', () => {
        setupMockDomWithMenuAndCards();
        const onSelectShelf = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            onSelectShelf,
            isFoldersOpen: true,
            isTagsOpen: true,
          })
        );

        // Move to menu
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.focusArea).toBe('menu');

        // Down to menu-continue-reading
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        // Down to menu-favorites
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-favorites');
        expect(onSelectShelf).not.toHaveBeenCalled();

        // Press Enter on menu-favorites -> navigates to 'favorites'
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        expect(onSelectShelf).toHaveBeenCalledTimes(1);
        expect(onSelectShelf).toHaveBeenCalledWith('favorites');
        expect(result.current.focusArea).toBe('books');
      });

      it('exits menu back to books on Escape or Backspace', () => {
        setupMockDomWithMenuAndCards();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
          })
        );

        // Switch to menu
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.focusArea).toBe('menu');

        // Press Escape -> returns to books
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        });
        expect(result.current.focusArea).toBe('books');
        expect(result.current.highlightedMenuItemId).toBeNull();
      });

      it('navigates up from menu-home to filtrar pastas and active library selector', () => {
        setupMockDomWithMenuAndCards({ includeTopItems: true });

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
          })
        );

        // Switch to menu -> menu-home
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.focusArea).toBe('menu');
        expect(result.current.highlightedMenuItemId).toBe('menu-home');

        // ArrowUp -> menu-filter-shelves
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-filter-shelves');

        // ArrowUp -> menu-library-select
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-library-select');

        // ArrowDown -> back to menu-filter-shelves
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-filter-shelves');

        // ArrowDown -> back to menu-home
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-home');
      });

      it('focuses filtrar pastas input on Enter and handles keyboard shortcuts within it', () => {
        setupMockDomWithMenuAndCards({ includeTopItems: true });
        const input = container.querySelector('[data-shelf-filter-input="true"]');
        const focusSpy = vi.spyOn(input, 'focus');

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
          })
        );

        // Move to menu and up to menu-filter-shelves
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-filter-shelves');

        // Press Enter on menu-filter-shelves -> focuses the input
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        expect(focusSpy).toHaveBeenCalled();

        // While in input, pressing Escape blurs and keeps menu-filter-shelves highlighted
        act(() => {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-filter-shelves');
        expect(result.current.focusArea).toBe('menu');

        // While in input, pressing ArrowDown moves to menu-home
        act(() => {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-home');

        // While in input, pressing ArrowUp moves to menu-library-select
        act(() => {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-library-select');
      });

      it('opens active library dropdown on Enter and selects a library with keyboard', () => {
        const setIsLibraryDropdownOpen = vi.fn();
        setupMockDomWithMenuAndCards({ includeTopItems: true });

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            isLibraryDropdownOpen: false,
            setIsLibraryDropdownOpen,
          })
        );

        // Move to menu-library-select
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-library-select');

        // Press Enter on menu-library-select -> opens dropdown
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        expect(setIsLibraryDropdownOpen).toHaveBeenCalledWith(true);
      });

      it('browses dropdown items and selects an item with Enter', () => {
        const setIsLibraryDropdownOpen = vi.fn();
        setupMockDomWithMenuAndCards({ includeTopItems: true, includeLibraryDropdown: true });

        const lib1Button = container.querySelector('[data-item-id="menu-lib-lib1"]');
        const clickSpy = vi.spyOn(lib1Button, 'click');

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            isLibraryDropdownOpen: true,
            setIsLibraryDropdownOpen,
          })
        );

        // Switch to menu, move up to menu-lib-manage, menu-lib-lib2, menu-lib-lib1, etc.
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-home');

        // ArrowUp to menu-filter-shelves
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-filter-shelves');

        // ArrowUp to menu-lib-manage
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-lib-manage');

        // ArrowUp to menu-lib-lib2
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-lib-lib2');

        // ArrowUp to menu-lib-lib1
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedMenuItemId).toBe('menu-lib-lib1');

        // Press Enter on menu-lib-lib1 -> clicks the button and closes dropdown
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });
        expect(clickSpy).toHaveBeenCalled();
        expect(setIsLibraryDropdownOpen).toHaveBeenCalledWith(false);
        expect(result.current.highlightedMenuItemId).toBe('menu-library-select');
      });
    });

    describe('Pastas and Tags Library Browsing', () => {
      function setupMockDomWithBooksFoldersAndTags() {
        container.innerHTML = `
          <div class="library">
            <!-- Row 1: Books -->
            <div data-nav-card="true" data-book-card="true" data-card-id="book-b1" data-book-id="b1" style="width: 150px; height: 200px;"></div>
            <div data-nav-card="true" data-book-card="true" data-card-id="book-b2" data-book-id="b2" style="width: 150px; height: 200px;"></div>
            <!-- Row 2: Pastas (Folders) -->
            <div data-nav-card="true" data-card-id="folder-f1" data-folder-id="f1" style="width: 150px; height: 180px;"></div>
            <div data-nav-card="true" data-card-id="folder-f2" data-folder-id="f2" style="width: 150px; height: 180px;"></div>
            <!-- Row 3: Tags -->
            <div data-nav-card="true" data-card-id="tag-t1" data-tag-id="t1" style="width: 150px; height: 180px;"></div>
            <div data-nav-card="true" data-card-id="tag-t2" data-tag-id="t2" style="width: 150px; height: 180px;"></div>
          </div>
        `;

        const cards = container.querySelectorAll('[data-nav-card="true"]');
        const rects = [
          // Row 1 (Books)
          { top: 0, bottom: 200, left: 0, right: 150, width: 150, height: 200 },
          { top: 0, bottom: 200, left: 160, right: 310, width: 150, height: 200 },
          // Row 2 (Folders)
          { top: 240, bottom: 420, left: 0, right: 150, width: 150, height: 180 },
          { top: 240, bottom: 420, left: 160, right: 310, width: 150, height: 180 },
          // Row 3 (Tags)
          { top: 460, bottom: 640, left: 0, right: 150, width: 150, height: 180 },
          { top: 460, bottom: 640, left: 160, right: 310, width: 150, height: 180 },
        ];

        cards.forEach((card, idx) => {
          const r = rects[idx];
          card.getBoundingClientRect = () => r;
          Object.defineProperty(card, 'offsetWidth', { value: r.width, configurable: true });
          Object.defineProperty(card, 'offsetHeight', { value: r.height, configurable: true });
          Object.defineProperty(card, 'offsetParent', { value: container, configurable: true });
          card.scrollIntoView = vi.fn();
        });

        return cards;
      }

      it('navigates seamlessly between Books, Pastas (folders), and Tags with ArrowDown and ArrowUp', () => {
        setupMockDomWithBooksFoldersAndTags();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
          })
        );

        // Initial ArrowRight highlights first book (book-b1)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        expect(result.current.highlightedCardId).toBe('book-b1');

        // ArrowDown moves from Book row into Pastas row (folder-f1)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedCardId).toBe('folder-f1');

        // ArrowRight moves horizontally within Pastas (folder-f2)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        expect(result.current.highlightedCardId).toBe('folder-f2');

        // ArrowDown moves from Pastas row into Tags row (tag-t2)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedCardId).toBe('tag-t2');

        // ArrowLeft moves horizontally within Tags (tag-t1)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        });
        expect(result.current.highlightedCardId).toBe('tag-t1');

        // ArrowUp moves back up into Pastas row (folder-f1)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedCardId).toBe('folder-f1');

        // ArrowUp moves back up into Books row (book-b1)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        });
        expect(result.current.highlightedCardId).toBe('book-b1');
      });

      it('opens folder on Enter when FolderCard is highlighted', () => {
        setupMockDomWithBooksFoldersAndTags();
        const onSelectShelf = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            onSelectShelf,
          })
        );

        // Highlight book then move down to folder-f1
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedCardId).toBe('folder-f1');

        // Press Enter
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });

        expect(onSelectShelf).toHaveBeenCalledWith('f1');
      });

      it('opens tag on Enter when TagCard is highlighted', () => {
        setupMockDomWithBooksFoldersAndTags();
        const onSelectShelf = vi.fn();

        const { result } = renderHook(() =>
          useLibraryKeyboardNavigation({
            isReaderActive: false,
            modals: {},
            libraryData: { books: mockBooks },
            selectedShelf: null,
            onSelectShelf,
          })
        );

        // Move to tag-t1 (Down twice from book-b1)
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        });
        expect(result.current.highlightedCardId).toBe('tag-t1');

        // Press Enter
        act(() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        });

        expect(onSelectShelf).toHaveBeenCalledWith('tag:t1');
      });
    });
  });

  describe('BookCard component keyboard highlight rendering', () => {
    it('applies highlight classes and attributes when isHighlighted is true', () => {
      const book = mockBooks[0];
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="grid-b1">
            <BookCard book={book} cardId="grid-b1" />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-book-card="true"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-card-id', 'grid-b1');
      expect(card).toHaveAttribute('data-highlighted', 'true');
      expect(card).toHaveClass('scale-[1.03]');

      const cover = container.querySelector('.book-cover-container');
      expect(cover).toHaveClass('border-amber-400');
      expect(cover).toHaveClass('ring-4');
    });

    it('does not apply highlight classes when not highlighted', () => {
      const book = mockBooks[0];
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="grid-other">
            <BookCard book={book} cardId="grid-b1" />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-book-card="true"]');
      expect(card).not.toHaveAttribute('data-highlighted');
      expect(card).not.toHaveClass('scale-[1.03]');
    });

    it('does not set highlightedCardId when clicked', () => {
      const book = mockBooks[0];
      const setHighlightedCardId = vi.fn();
      const openReader = vi.fn();
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider setHighlightedCardId={setHighlightedCardId} openReader={openReader}>
            <BookCard book={book} cardId="grid-b1" />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-book-card="true"]');
      fireEvent.click(card);
      expect(setHighlightedCardId).not.toHaveBeenCalled();
      expect(openReader).toHaveBeenCalledTimes(1);
    });
  });

  describe('ContinueReading component keyboard highlight rendering', () => {
    it('applies highlight styling when highlightedCardId matches', () => {
      const book = { ...mockBooks[0], progress: { page: 5, total_pages: 10, percent: 50, status: 'in_progress' } };
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="cr-b1">
            <ContinueReading books={[book]} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="cr-b1"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-highlighted', 'true');
      expect(card).toHaveClass('border-amber-400');
      expect(card).toHaveClass('ring-4');
    });

    it('does not set highlightedCardId when clicked', () => {
      const book = { ...mockBooks[0], progress: { page: 5, total_pages: 10, percent: 50, status: 'in_progress' } };
      const setHighlightedCardId = vi.fn();
      const openReader = vi.fn();
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider setHighlightedCardId={setHighlightedCardId} openReader={openReader}>
            <ContinueReading books={[book]} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="cr-b1"]');
      fireEvent.click(card);
      expect(setHighlightedCardId).not.toHaveBeenCalled();
      expect(openReader).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reader Backspace exit behavior', () => {
    it('usePdfKeyboardGestures calls onClose when Backspace is pressed', () => {
      const onClose = vi.fn();
      const containerRef = { current: document.createElement('div') };

      renderHook(() =>
        usePdfKeyboardGestures({
          containerRef,
          nav: { goToNextPage: vi.fn(), goToPrevPage: vi.fn() },
          zoom: { handleZoomIn: vi.fn(), handleZoomOut: vi.fn(), handleResetZoom: vi.fn() },
          search: { searchOpen: false, handleCloseSearch: vi.fn() },
          tts: { ttsOpen: false, setTtsOpen: vi.fn() },
          onClose,
        })
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('useEpubNavigation calls handleClose when Backspace is pressed', () => {
      const onClose = vi.fn();

      renderHook(() =>
        useEpubNavigation({
          book: mockBooks[0],
          renditionRef: { current: null },
          onClose,
          loading: false,
          renditionReady: true,
          setLocationInfo: vi.fn(),
          setPageInfo: vi.fn(),
          setPageInput: vi.fn(),
          setSelectionMenu: vi.fn(),
          toc: [],
          tocOpen: false,
          setTocOpen: vi.fn(),
          commentsDrawerOpen: false,
          setCommentsDrawerOpen: vi.fn(),
          setThemeMenuOpen: vi.fn(),
          tts: { ttsOpen: false, setTtsOpen: vi.fn(), isPlaying: false, activeSentence: null },
          search: { searchOpen: false, handleCloseSearch: vi.fn(), clearSearch: vi.fn() },
          toggleFullscreen: vi.fn(),
          cycleTheme: vi.fn(),
        })
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('useEpubNavigation manages independent book and chapter progress bar states', () => {
      const { result } = renderHook(() =>
        useEpubNavigation({
          book: mockBooks[0],
          renditionRef: { current: null },
          onClose: vi.fn(),
          loading: false,
          renditionReady: true,
          setLocationInfo: vi.fn(),
          setPageInfo: vi.fn(),
          setPageInput: vi.fn(),
          setSelectionMenu: vi.fn(),
          toc: [],
          tocOpen: false,
          setTocOpen: vi.fn(),
          commentsDrawerOpen: false,
          setCommentsDrawerOpen: vi.fn(),
          setThemeMenuOpen: vi.fn(),
          tts: { ttsOpen: false, setTtsOpen: vi.fn(), isPlaying: false, activeSentence: null },
          search: { searchOpen: false, handleCloseSearch: vi.fn(), clearSearch: vi.fn() },
          toggleFullscreen: vi.fn(),
          cycleTheme: vi.fn(),
        })
      );

      // Both bars born enabled by default
      expect(result.current.showBottomProgress).toBe(true);
      expect(result.current.showChapterProgress).toBe(true);

      // Independent toggle for book progress
      act(() => {
        result.current.toggleBottomProgress();
      });
      expect(result.current.showBottomProgress).toBe(false);
      expect(result.current.showChapterProgress).toBe(true);

      // Independent toggle for chapter progress
      act(() => {
        result.current.toggleChapterProgress();
      });
      expect(result.current.showBottomProgress).toBe(false);
      expect(result.current.showChapterProgress).toBe(false);
    });
  });

  describe('Sidebar component keyboard highlight rendering', () => {
    const mockShelves = [{ id: 's1', name: 'Folder 1', icon: 'Folder', book_count: 3 }];
    const mockTags = [{ id: 't1', name: 'Tag 1', color: 'blue', book_count: 2 }];

    it('applies keyboard highlight classes to the highlighted menu item', () => {
      const { container } = render(
        <I18nProvider>
          <Sidebar
            shelves={mockShelves}
            totalBooks={10}
            isOpen={true}
            highlightedMenuItemId="menu-home"
            selectedShelf={null}
            onSelectShelf={vi.fn()}
            tags={mockTags}
          />
        </I18nProvider>
      );

      const homeBtn = container.querySelector('[data-item-id="menu-home"]');
      expect(homeBtn).toHaveAttribute('data-highlighted', 'true');
      expect(homeBtn).toHaveClass('ring-2');
      expect(homeBtn).toHaveClass('ring-amber-400');
    });

    it('highlights folder item when highlightedMenuItemId matches folder', () => {
      const { container } = render(
        <I18nProvider>
          <Sidebar
            shelves={mockShelves}
            totalBooks={10}
            isOpen={true}
            highlightedMenuItemId="menu-folders"
            selectedShelf={null}
            onSelectShelf={vi.fn()}
            tags={mockTags}
          />
        </I18nProvider>
      );

      const folderHeader = container.querySelector('[data-item-id="menu-folders"]');
      expect(folderHeader).toHaveAttribute('data-highlighted', 'true');
      expect(folderHeader).toHaveClass('ring-2');
      expect(folderHeader).toHaveClass('ring-amber-400');
    });
  });

  describe('FolderCard component keyboard highlight rendering', () => {
    it('applies highlight styling and attributes when highlighted', () => {
      const folder = { id: 'f1', name: 'Folder One', icon: 'Folder', book_count: 5 };
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="folder-f1">
            <FolderCard folder={folder} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="folder-f1"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-highlighted', 'true');
      expect(card).toHaveAttribute('data-nav-card', 'true');
      expect(card).toHaveClass('border-amber-400');
      expect(card).toHaveClass('ring-4');
      expect(card).toHaveClass('scale-[1.03]');
      expect(card).toHaveClass('scroll-mt-24');
    });

    it('does not apply highlight styling when not highlighted', () => {
      const folder = { id: 'f1', name: 'Folder One', icon: 'Folder', book_count: 5 };
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="folder-other">
            <FolderCard folder={folder} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="folder-f1"]');
      expect(card).toBeInTheDocument();
      expect(card).not.toHaveAttribute('data-highlighted');
      expect(card).not.toHaveClass('scale-[1.03]');
    });

    it('does not set highlightedCardId when clicked', () => {
      const folder = { id: 'f1', name: 'Folder One', icon: 'Folder', book_count: 5 };
      const setHighlightedCardId = vi.fn();
      const onSelectFolder = vi.fn();
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider setHighlightedCardId={setHighlightedCardId}>
            <FolderCard folder={folder} onSelectFolder={onSelectFolder} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="folder-f1"]');
      fireEvent.click(card);
      expect(setHighlightedCardId).not.toHaveBeenCalled();
      expect(onSelectFolder).toHaveBeenCalledWith('f1');
    });
  });

  describe('TagCard component keyboard highlight rendering', () => {
    it('applies highlight styling and attributes when highlighted', () => {
      const tag = { id: 't1', name: 'Tag One', color: 'blue', book_count: 3 };
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="tag-t1">
            <TagCard tag={tag} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="tag-t1"]');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-highlighted', 'true');
      expect(card).toHaveAttribute('data-nav-card', 'true');
      expect(card).toHaveClass('border-indigo-400');
      expect(card).toHaveClass('ring-4');
      expect(card).toHaveClass('scale-[1.03]');
      expect(card).toHaveClass('scroll-mt-24');
    });

    it('does not apply highlight styling when not highlighted', () => {
      const tag = { id: 't1', name: 'Tag One', color: 'blue', book_count: 3 };
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider highlightedCardId="tag-other">
            <TagCard tag={tag} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="tag-t1"]');
      expect(card).toBeInTheDocument();
      expect(card).not.toHaveAttribute('data-highlighted');
      expect(card).not.toHaveClass('scale-[1.03]');
    });

    it('does not set highlightedCardId when clicked', () => {
      const tag = { id: 't1', name: 'Tag One', color: 'blue', book_count: 3 };
      const setHighlightedCardId = vi.fn();
      const onSelectTag = vi.fn();
      const { container } = render(
        <I18nProvider>
          <BookActionsProvider setHighlightedCardId={setHighlightedCardId}>
            <TagCard tag={tag} onSelectTag={onSelectTag} />
          </BookActionsProvider>
        </I18nProvider>
      );

      const card = container.querySelector('[data-card-id="tag-t1"]');
      fireEvent.click(card);
      expect(setHighlightedCardId).not.toHaveBeenCalled();
      expect(onSelectTag).toHaveBeenCalledWith(tag);
    });
  });

  describe('LibrarySelector Keyboard Navigation', () => {
    it('navigates through library cards with Arrow keys and activates with Enter', () => {
      const mockLibraries = [
        { id: 'lib1', name: 'Tech Library', path: '/books/tech', book_count: 10, folder_count: 2 },
        { id: 'lib2', name: 'Fiction Library', path: '/books/fiction', book_count: 25, folder_count: 5 },
      ];
      const onSelectLibrary = vi.fn();

      const { container } = render(
        <I18nProvider>
          <LibrarySelector
            libraries={mockLibraries}
            currentUser="Andreusd"
            onSelectLibrary={onSelectLibrary}
          />
        </I18nProvider>
      );

      // Press ArrowRight to activate navigation
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      });

      // The first library card should now have the highlight ring
      const lib1Card = container.querySelector('[data-selector-id="lib-lib1"]');
      expect(lib1Card).toBeInTheDocument();
      expect(lib1Card.className).toContain('ring-amber-500');

      // Press Enter to open the highlighted library
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(onSelectLibrary).toHaveBeenCalledWith('lib1');
    });
  });

  describe('ContextMenu Keyboard Navigation', () => {
    it('navigates context menu items with ArrowDown and activates with Enter', () => {
      const book = { id: 'b1', title: 'Test Book', format: 'epub', path: '/test.epub' };
      const onOpenReader = vi.fn();
      const onClose = vi.fn();

      render(
        <I18nProvider>
          <ContextMenu
            x={100}
            y={100}
            book={book}
            onClose={onClose}
            onOpenReader={onOpenReader}
          />
        </I18nProvider>
      );

      // Initially focused on first item (Read Now). Press Enter to activate it
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(onOpenReader).toHaveBeenCalledWith(book);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
