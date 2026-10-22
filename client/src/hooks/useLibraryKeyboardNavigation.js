import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to enable keyboard navigation across books and the sidebar menu in the library.
 * - Arrow Keys in Library (Up, Down, Left, Right): Highlights books and navigates 2D spatially.
 * - Left when no book to the left: Switches focus to the sidebar menu (Inicio, Continuar lendo, Favoritos, etc.).
 * - Arrow Up / Down in Menu: Moves through menu items (without changing page).
 * - Left in Menu on Collapsible: Collapses item (folders or tags).
 * - Right in Menu on Collapsed: De-collapses (expands) item.
 * - Right in Menu when De-collapsed / Not Collapsible: Moves focus back to the books!
 * - Enter in Menu: Changes the page / shelf.
 * - Enter on Book: Opens the currently highlighted book.
 * - Backspace / Escape: In library, deselects. In reader, exits the book.
 */
export function useLibraryKeyboardNavigation({
  isReaderActive,
  modals,
  libraryData = {},
  openReader,
  _closeReader,
  activeBook,
  selectedShelf,
  debouncedQuery,
  _sidebarOpen,
  setSidebarOpen,
  searchInputRef,
  isFoldersOpen = true,
  setIsFoldersOpen,
  isTagsOpen = true,
  setIsTagsOpen,
  isLibraryDropdownOpen = false,
  setIsLibraryDropdownOpen,
  activeLibraryId = '',
  onSelectShelf,
}) {
  const [focusArea, setFocusArea] = useState('books'); // 'books' | 'menu'
  const focusAreaRef = useRef(focusArea);

  const [highlightedCardId, setHighlightedCardId] = useState(null);
  const highlightedCardIdRef = useRef(highlightedCardId);

  const [highlightedMenuItemId, setHighlightedMenuItemId] = useState(null);
  const highlightedMenuItemIdRef = useRef(highlightedMenuItemId);
  const lastHighlightedMenuItemIdRef = useRef(null);

  const lastHighlightedBookIdRef = useRef(null);

  useEffect(() => {
    focusAreaRef.current = focusArea;
  }, [focusArea]);

  useEffect(() => {
    highlightedCardIdRef.current = highlightedCardId;
    lastHighlightedBookIdRef.current = highlightedCardId || null;
  }, [highlightedCardId]);

  useEffect(() => {
    highlightedMenuItemIdRef.current = highlightedMenuItemId;
    if (highlightedMenuItemId) {
      lastHighlightedMenuItemIdRef.current = highlightedMenuItemId;
    }
  }, [highlightedMenuItemId]);

  // Adjust state during render when shelf, query, activeBook, or reader active state change
  const [prevShelf, setPrevShelf] = useState(selectedShelf);
  const [prevQuery, setPrevQuery] = useState(debouncedQuery);
  const [prevActiveBookId, setPrevActiveBookId] = useState(activeBook?.id);
  const [prevIsReaderActive, setPrevIsReaderActive] = useState(isReaderActive);

  if (selectedShelf !== prevShelf || debouncedQuery !== prevQuery) {
    setPrevShelf(selectedShelf);
    setPrevQuery(debouncedQuery);
    setHighlightedCardId(null);
    setFocusArea('books');
    setHighlightedMenuItemId(null);
  }

  if (activeBook?.id !== prevActiveBookId || isReaderActive !== prevIsReaderActive) {
    setPrevActiveBookId(activeBook?.id);
    setPrevIsReaderActive(isReaderActive);
    setHighlightedCardId(null);
    setFocusArea('books');
    setHighlightedMenuItemId(null);
  }

  const { books = [], continueReading = [], favorites = [], readBooks = [] } = libraryData;

  const findBookById = useCallback(
    (bookId) => {
      if (!bookId) return null;
      const strId = String(bookId);
      return (
        continueReading.find((b) => b && String(b.id) === strId) ||
        favorites.find((b) => b && String(b.id) === strId) ||
        readBooks.find((b) => b && String(b.id) === strId) ||
        books.find((b) => b && String(b.id) === strId) ||
        null
      );
    },
    [books, continueReading, favorites, readBooks]
  );

  // Helper to open highlighted card (book, folder, or tag)
  const openHighlightedCard = useCallback(() => {
    const currentId = highlightedCardIdRef.current;
    if (!currentId) return false;

    const currentEl =
      document.querySelector(`[data-card-id="${currentId}"]`) ||
      document.querySelector(`[data-book-id="${currentId}"]`) ||
      document.querySelector(`[data-folder-id="${currentId}"]`) ||
      document.querySelector(`[data-tag-id="${currentId}"]`);

    if (!currentEl) return false;

    // 1. If it's a folder card
    const folderId = currentEl.getAttribute('data-folder-id');
    if (folderId) {
      if (onSelectShelf) {
        onSelectShelf(folderId);
        return true;
      }
      currentEl.click();
      return true;
    }

    // 2. If it's a tag card
    const tagId = currentEl.getAttribute('data-tag-id');
    if (tagId) {
      if (onSelectShelf) {
        onSelectShelf(`tag:${tagId}`);
        return true;
      }
      currentEl.click();
      return true;
    }

    // 3. Otherwise it's a book card
    const bookId = currentEl.getAttribute('data-book-id');
    const book = findBookById(bookId);
    const coverEl =
      currentEl.querySelector('.book-cover-container') ||
      currentEl.querySelector('.continue-reading-cover') ||
      currentEl;

    const rect = coverEl.getBoundingClientRect();
    const originRect = {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
    };

    if (book && openReader) {
      openReader(book, originRect);
      return true;
    }

    currentEl.click();
    return true;
  }, [findBookById, onSelectShelf, openReader]);

  const isElementVisible = (el) => {
    if (!el || el.hidden || el.style?.display === 'none' || el.closest?.('[hidden]')) {
      return false;
    }
    return true;
  };

  // Helper to get active menu items list from DOM
  const getVisibleMenuItems = useCallback(() => {
    const els = Array.from(document.querySelectorAll('[data-sidebar-item="true"]')).filter(
      isElementVisible
    );
    return els.map((el) => {
      const id = el.getAttribute('data-item-id');
      const isCollapsible =
        id === 'menu-folders' || id === 'menu-tags' || id === 'menu-library-select';
      const isCollapsed =
        (id === 'menu-folders' && !isFoldersOpen) ||
        (id === 'menu-tags' && !isTagsOpen) ||
        (id === 'menu-library-select' && !isLibraryDropdownOpen);
      const parentId = id.startsWith('menu-folder-')
        ? 'menu-folders'
        : id.startsWith('menu-tag-')
        ? 'menu-tags'
        : id.startsWith('menu-lib-')
        ? 'menu-library-select'
        : null;

      let shelfId = null;
      if (id === 'menu-home') shelfId = null;
      else if (id === 'menu-continue-reading') shelfId = 'continue-reading';
      else if (id === 'menu-favorites') shelfId = 'favorites';
      else if (id === 'menu-folders') shelfId = 'folders';
      else if (id === 'menu-tags') shelfId = 'tags';
      else if (id === 'menu-all-books') shelfId = 'all-books';
      else if (id.startsWith('menu-folder-')) shelfId = id.slice(12);
      else if (id.startsWith('menu-tag-')) shelfId = `tag:${id.slice(9)}`;

      return {
        el,
        id,
        shelfId,
        isCollapsible,
        isCollapsed,
        parentId,
      };
    });
  }, [isFoldersOpen, isTagsOpen, isLibraryDropdownOpen]);

  // Helper to transition focus back to books/cards
  const switchToBooks = useCallback(() => {
    setFocusArea('books');
    setHighlightedMenuItemId(null);

    const cardElements = Array.from(
      document.querySelectorAll('[data-nav-card="true"], [data-book-card="true"]')
    ).filter(isElementVisible);

    if (cardElements.length === 0) return;

    // Restore last highlighted item if present, or choose first visible card
    const targetCard =
      (lastHighlightedBookIdRef.current
        ? cardElements.find(
            (el) =>
              el.getAttribute('data-card-id') === lastHighlightedBookIdRef.current ||
              el.getAttribute('data-book-id') === lastHighlightedBookIdRef.current ||
              el.getAttribute('data-folder-id') === lastHighlightedBookIdRef.current ||
              el.getAttribute('data-tag-id') === lastHighlightedBookIdRef.current
          )
        : null) || cardElements[0];

    const cardId =
      targetCard.getAttribute('data-card-id') ||
      targetCard.getAttribute('data-book-id') ||
      targetCard.getAttribute('data-folder-id') ||
      targetCard.getAttribute('data-tag-id');
    setHighlightedCardId(cardId);
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    targetCard.focus?.({ preventScroll: true });
  }, []);

  // Helper to transition focus to sidebar menu
  const switchToMenu = useCallback(() => {
    if (setSidebarOpen) {
      setSidebarOpen(true);
    }
    setFocusArea('menu');
    setHighlightedCardId(null);

    const menuItems = getVisibleMenuItems();
    if (menuItems.length === 0) return;

    // Restore previous highlighted menu item if still valid, or match current selectedShelf
    let initialItem = null;
    if (lastHighlightedMenuItemIdRef.current) {
      initialItem = menuItems.find((m) => m.id === lastHighlightedMenuItemIdRef.current);
    }

    if (!initialItem) {
      if (selectedShelf === null) {
        initialItem = menuItems.find((m) => m.id === 'menu-home');
      } else if (selectedShelf === 'continue-reading') {
        initialItem = menuItems.find((m) => m.id === 'menu-continue-reading');
      } else if (selectedShelf === 'favorites') {
        initialItem = menuItems.find((m) => m.id === 'menu-favorites');
      } else if (selectedShelf === 'read-books' || selectedShelf === 'read') {
        initialItem = menuItems.find((m) => m.id === 'menu-read-books');
      } else if (selectedShelf === 'folders') {
        initialItem = menuItems.find((m) => m.id === 'menu-folders');
      } else if (selectedShelf === 'tags') {
        initialItem = menuItems.find((m) => m.id === 'menu-tags');
      } else if (selectedShelf === 'all-books') {
        initialItem = menuItems.find((m) => m.id === 'menu-all-books');
      } else if (selectedShelf && selectedShelf.startsWith('tag:')) {
        const tagId = selectedShelf.slice(4);
        initialItem =
          menuItems.find((m) => m.id === `menu-tag-${tagId}`) ||
          menuItems.find((m) => m.id === 'menu-tags');
      } else if (selectedShelf) {
        initialItem =
          menuItems.find((m) => m.id === `menu-folder-${selectedShelf}`) ||
          menuItems.find((m) => m.id === 'menu-folders');
      }
    }

    if (!initialItem) {
      initialItem = menuItems[0];
    }

    setHighlightedMenuItemId(initialItem.id);
    initialItem.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    initialItem.el.focus?.({ preventScroll: true });
  }, [getVisibleMenuItems, selectedShelf, setSidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. If reader is active, App.jsx / Reader components handle Reader shortcuts
      if (isReaderActive) return;

      const target = e.target;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute?.('contenteditable') === 'true');

      // If user is in the navbar search input and hits Escape, blur it
      if (target === searchInputRef?.current && e.key === 'Escape') {
        e.preventDefault();
        searchInputRef.current?.blur();
        return;
      }

      // Check if user is in shelf filter input
      const isShelfFilterInput =
        Boolean(target?.getAttribute?.('data-shelf-filter-input') === 'true' || target?.closest?.('[data-shelf-filter-input="true"]'));

      if (isShelfFilterInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          target.blur();
          setFocusArea('menu');
          setHighlightedMenuItemId('menu-filter-shelves');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          target.blur();
          setFocusArea('menu');
          setHighlightedMenuItemId('menu-home');
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          target.blur();
          setFocusArea('menu');
          setHighlightedMenuItemId('menu-library-select');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          target.blur();
          setFocusArea('menu');
          setHighlightedMenuItemId('menu-home');
          return;
        }
        // Let user type normally
        return;
      }

      // If typing in an input, do not intercept keyboard navigation unless ArrowDown on search input
      if (isInput) {
        if (target === searchInputRef?.current && e.key === 'ArrowDown') {
          e.preventDefault();
          searchInputRef.current?.blur();
        } else {
          return;
        }
      }

      // 2. Ignore when any modal is open
      const isAnyModalOpen = Boolean(
        modals?.contextMenu?.isOpen ||
          modals?.shelfContextMenu?.isOpen ||
          modals?.renameModal?.isOpen ||
          modals?.iconModal?.isOpen ||
          modals?.tagModal?.isOpen ||
          modals?.detailsModal?.isOpen ||
          modals?.settingsOpen ||
          modals?.themeMenuOpen
      );
      if (isAnyModalOpen) return;

      // Ignore modifier combinations
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // ============================================
      // MENU FOCUS AREA HANDLING
      // ============================================
      if (focusAreaRef.current === 'menu') {
        const menuItems = getVisibleMenuItems();
        if (menuItems.length === 0) {
          switchToBooks();
          return;
        }

        const currentIndex = menuItems.findIndex(
          (m) => m.id === highlightedMenuItemIdRef.current
        );
        const currentItem = currentIndex >= 0 ? menuItems[currentIndex] : menuItems[0];

        // Typing into the filter when menu-filter-shelves is highlighted
        if (currentItem.id === 'menu-filter-shelves') {
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const input = currentItem.el.querySelector('input');
            if (input) {
              input.focus();
              return;
            }
          }
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, menuItems.length - 1);
          const nextItem = menuItems[nextIndex];
          setHighlightedMenuItemId(nextItem.id);
          nextItem.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          nextItem.el.focus?.({ preventScroll: true });
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevItem = menuItems[prevIndex];
          setHighlightedMenuItemId(prevItem.id);
          prevItem.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          prevItem.el.focus?.({ preventScroll: true });
          return;
        }

        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          // Library selector dropdown collapse
          if (currentItem.id === 'menu-library-select') {
            if (isLibraryDropdownOpen && setIsLibraryDropdownOpen) {
              setIsLibraryDropdownOpen(false);
            }
            return;
          }

          // "pressing left on a collapsible item eg folder or tags collapses that item"
          if (currentItem.id === 'menu-folders') {
            if (isFoldersOpen && setIsFoldersOpen) {
              setIsFoldersOpen(false);
            }
            return;
          }

          if (currentItem.id === 'menu-tags') {
            if (isTagsOpen && setIsTagsOpen) {
              setIsTagsOpen(false);
            }
            return;
          }

          // If on a child folder/tag or library child, jump up to parent header
          if (currentItem.parentId) {
            if (currentItem.parentId === 'menu-library-select' && setIsLibraryDropdownOpen) {
              setIsLibraryDropdownOpen(false);
            }
            const parentItem = menuItems.find((m) => m.id === currentItem.parentId);
            if (parentItem) {
              setHighlightedMenuItemId(parentItem.id);
              parentItem.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              parentItem.el.focus?.({ preventScroll: true });
            }
            return;
          }
          return;
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          // Library dropdown expand
          if (currentItem.id === 'menu-library-select' && !isLibraryDropdownOpen) {
            if (setIsLibraryDropdownOpen) {
              setIsLibraryDropdownOpen(true);
              const targetLibId = activeLibraryId ? `menu-lib-${activeLibraryId}` : 'menu-lib-all';
              setHighlightedMenuItemId(targetLibId);
            }
            return;
          }

          // "and pressing right on a collapsed item de-collapses it
          //  if its already decolapsed then I move back to the books"
          if (currentItem.id === 'menu-folders' && !isFoldersOpen) {
            if (setIsFoldersOpen) {
              setIsFoldersOpen(true);
            }
            return;
          }

          if (currentItem.id === 'menu-tags' && !isTagsOpen) {
            if (setIsTagsOpen) {
              setIsTagsOpen(true);
            }
            return;
          }

          if (isLibraryDropdownOpen && setIsLibraryDropdownOpen) {
            setIsLibraryDropdownOpen(false);
          }

          // If already de-collapsed or not collapsible, move back to books!
          switchToBooks();
          return;
        }

        if (e.key === 'Enter') {
          e.preventDefault();

          if (currentItem.id === 'menu-library-select') {
            if (setIsLibraryDropdownOpen) {
              const nextOpen = !isLibraryDropdownOpen;
              setIsLibraryDropdownOpen(nextOpen);
              if (nextOpen) {
                const targetLibId = activeLibraryId ? `menu-lib-${activeLibraryId}` : 'menu-lib-all';
                setHighlightedMenuItemId(targetLibId);
              }
            } else {
              currentItem.el.click();
            }
            return;
          }

          if (currentItem.id === 'menu-filter-shelves') {
            const input = currentItem.el.querySelector('input') || currentItem.el;
            input.focus?.();
            return;
          }

          if (currentItem.id.startsWith('menu-lib-')) {
            currentItem.el.click();
            if (setIsLibraryDropdownOpen) {
              setIsLibraryDropdownOpen(false);
            }
            setHighlightedMenuItemId('menu-library-select');
            return;
          }

          // "only change the page if I press enter on the menu"
          if (onSelectShelf) {
            onSelectShelf(currentItem.shelfId);
          } else {
            currentItem.el.click();
          }
          switchToBooks();
          return;
        }

        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          if (isLibraryDropdownOpen && setIsLibraryDropdownOpen) {
            setIsLibraryDropdownOpen(false);
            setHighlightedMenuItemId('menu-library-select');
            return;
          }
          switchToBooks();
          return;
        }

        return;
      }

      // ============================================
      // BOOKS FOCUS AREA HANDLING
      // ============================================

      // Handle Enter: Open currently highlighted card (book, folder, or tag)
      if (e.key === 'Enter') {
        if (highlightedCardIdRef.current) {
          e.preventDefault();
          openHighlightedCard();
        }
        return;
      }

      // Handle Escape / Backspace in library view: Deselect highlight
      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (highlightedCardIdRef.current) {
          e.preventDefault();
          setHighlightedCardId(null);
        }
        return;
      }

      // Handle Arrow Keys
      const isArrowKey =
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight';

      if (!isArrowKey) return;

      e.preventDefault();

      // Locate all visible cards (books, folders, tags) currently in the DOM
      const cardElements = Array.from(
        document.querySelectorAll('[data-nav-card="true"], [data-book-card="true"]')
      ).filter(isElementVisible);

      if (cardElements.length === 0) {
        if (e.key === 'ArrowLeft') {
          switchToMenu();
        }
        return;
      }

      const cards = cardElements.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          el,
          cardId:
            el.getAttribute('data-card-id') ||
            el.getAttribute('data-book-id') ||
            el.getAttribute('data-folder-id') ||
            el.getAttribute('data-tag-id'),
          bookId: el.getAttribute('data-book-id'),
          folderId: el.getAttribute('data-folder-id'),
          tagId: el.getAttribute('data-tag-id'),
          rect,
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        };
      });

      // Find currently highlighted card
      let current = highlightedCardIdRef.current
        ? cards.find(
            (c) =>
              c.cardId === highlightedCardIdRef.current ||
              (c.bookId && c.bookId === highlightedCardIdRef.current) ||
              (c.folderId && c.folderId === highlightedCardIdRef.current) ||
              (c.tagId && c.tagId === highlightedCardIdRef.current) ||
              (c.cardId && c.cardId.endsWith(`-${highlightedCardIdRef.current}`))
          )
        : null;

      // If no card is highlighted yet
      if (!current) {
        if (e.key === 'ArrowLeft') {
          switchToMenu();
          return;
        }

        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
        const visibleCards = cards.filter((c) => c.bottom > 80 && c.top < viewportHeight);
        const candidateCards = visibleCards.length > 0 ? visibleCards : cards;

        candidateCards.sort((a, b) => {
          const topDiff = a.top - b.top;
          if (Math.abs(topDiff) > 25) return topDiff;
          return a.left - b.left;
        });

        const first = candidateCards[0] || cards[0];
        setHighlightedCardId(first.cardId);
        first.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        first.el.focus?.({ preventScroll: true });
        return;
      }

      // 2D Spatial Navigation calculation
      const rowTolerance = Math.min(Math.max(current.height * 0.45, 30), 80);
      let next = null;

      if (e.key === 'ArrowRight') {
        // Next card in same row/carousel
        const sameRowRight = cards.filter(
          (c) =>
            c !== current &&
            Math.abs(c.centerY - current.centerY) <= rowTolerance &&
            c.left >= current.left + 5
        );

        if (sameRowRight.length > 0) {
          sameRowRight.sort((a, b) => a.left - b.left);
          next = sameRowRight[0];
        }
        // If there are no cards to the right in the current row, do not wrap to next row; simply do nothing.
      } else if (e.key === 'ArrowLeft') {
        // Look for cards on the same horizontal row to the left
        const sameRowLeft = cards.filter(
          (c) =>
            c !== current &&
            Math.abs(c.centerY - current.centerY) <= rowTolerance &&
            c.right <= current.right - 5
        );

        if (sameRowLeft.length > 0) {
          sameRowLeft.sort((a, b) => b.right - a.right);
          next = sameRowLeft[0];
        } else {
          // "if I press left and there is no book to the left, I want to browse the menu."
          switchToMenu();
          return;
        }
      } else if (e.key === 'ArrowDown') {
        const cardsBelow = cards.filter((c) => c.centerY > current.centerY + rowTolerance);
        if (cardsBelow.length > 0) {
          const minCenterYBelow = Math.min(...cardsBelow.map((c) => c.centerY));
          const nextRow = cardsBelow.filter(
            (c) => Math.abs(c.centerY - minCenterYBelow) <= rowTolerance
          );
          nextRow.sort(
            (a, b) => Math.abs(a.centerX - current.centerX) - Math.abs(b.centerX - current.centerX)
          );
          next = nextRow[0];
        }
      } else if (e.key === 'ArrowUp') {
        const cardsAbove = cards.filter((c) => c.centerY < current.centerY - rowTolerance);
        if (cardsAbove.length > 0) {
          const maxCenterYAbove = Math.max(...cardsAbove.map((c) => c.centerY));
          const prevRow = cardsAbove.filter(
            (c) => Math.abs(c.centerY - maxCenterYAbove) <= rowTolerance
          );
          prevRow.sort(
            (a, b) => Math.abs(a.centerX - current.centerX) - Math.abs(b.centerX - current.centerX)
          );
          next = prevRow[0];
        }
      }

      if (next) {
        setHighlightedCardId(next.cardId);
        next.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        next.el.focus?.({ preventScroll: true });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isReaderActive,
    modals,
    searchInputRef,
    openHighlightedCard,
    getVisibleMenuItems,
    switchToBooks,
    switchToMenu,
    isFoldersOpen,
    setIsFoldersOpen,
    isTagsOpen,
    setIsTagsOpen,
    isLibraryDropdownOpen,
    setIsLibraryDropdownOpen,
    activeLibraryId,
    onSelectShelf,
  ]);

  return {
    focusArea,
    setFocusArea,
    highlightedCardId,
    setHighlightedCardId,
    highlightedMenuItemId,
    setHighlightedMenuItemId,
    openHighlightedBook: openHighlightedCard,
    openHighlightedCard,
    switchToBooks,
    switchToMenu,
  };
}
