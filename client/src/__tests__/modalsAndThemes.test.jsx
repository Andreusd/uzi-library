import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act, fireEvent, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import ShelfRenameModal from '../components/ShelfRenameModal';
import TagManagerModal from '../components/TagManagerModal';
import ThemeMenu from '../components/ThemeMenu';
import { useBookModals } from '../hooks/useBookModals';
import { useReaderHeaderPin } from '../hooks/useReaderHeaderPin';

describe('Modals & Themes Frontend Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ShelfRenameModal Component', () => {
    const mockShelf = {
      id: 'shelf_dev',
      name: 'Development',
      original_name: 'dev',
      folder: 'dev',
      custom_name: 'Development',
    };

    it('returns null when closed or without shelf', () => {
      const { container, rerender } = render(
        <I18nProvider>
          <ShelfRenameModal shelf={mockShelf} isOpen={false} onClose={vi.fn()} onSave={vi.fn()} />
        </I18nProvider>
      );
      expect(container.firstChild).toBeNull();

      rerender(
        <I18nProvider>
          <ShelfRenameModal shelf={null} isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />
        </I18nProvider>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders input with initial shelf name and calls onSave on submit', () => {
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <I18nProvider>
          <ShelfRenameModal shelf={mockShelf} isOpen={true} onClose={onClose} onSave={onSave} />
        </I18nProvider>
      );

      const input = screen.getByRole('textbox');
      expect(input.value).toBe('Development');

      fireEvent.change(input, { target: { value: 'New Dev Books' } });
      expect(input.value).toBe('New Dev Books');

      const form = input.closest('form');
      fireEvent.submit(form);

      expect(onSave).toHaveBeenCalledWith('shelf_dev', 'New Dev Books');
    });

    it('does not submit when name is empty or only whitespace', () => {
      const onSave = vi.fn();

      render(
        <I18nProvider>
          <ShelfRenameModal shelf={mockShelf} isOpen={true} onClose={vi.fn()} onSave={onSave} />
        </I18nProvider>
      );

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });

      const form = input.closest('form');
      fireEvent.submit(form);

      expect(onSave).not.toHaveBeenCalled();
    });

    it('restores original name when reset button is clicked', () => {
      const onSave = vi.fn();

      render(
        <I18nProvider>
          <ShelfRenameModal shelf={mockShelf} isOpen={true} onClose={vi.fn()} onSave={onSave} />
        </I18nProvider>
      );

      // Reset button exists because shelf.custom_name is set
      const resetBtn = screen.getByTitle(/restaurar original|restore original/i);
      fireEvent.click(resetBtn);

      expect(onSave).toHaveBeenCalledWith('shelf_dev', '');
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();

      render(
        <I18nProvider>
          <ShelfRenameModal shelf={mockShelf} isOpen={true} onClose={onClose} onSave={vi.fn()} />
        </I18nProvider>
      );

      const closeButtons = screen.getAllByRole('button');
      const closeBtn = closeButtons.find((btn) => btn.querySelector('svg.lucide-x') !== null);
      expect(closeBtn).toBeDefined();
      fireEvent.click(closeBtn);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('TagManagerModal Component', () => {
    const mockBook = {
      id: 'book_101',
      title: 'Clean Architecture',
      library_id: 'lib_main',
      tags: [{ id: 't1', name: 'Architecture', color: 'blue' }],
    };

    const mockTags = [
      { id: 't1', name: 'Architecture', color: 'blue', book_count: 5 },
      { id: 't2', name: 'Design Patterns', color: 'emerald', book_count: 3 },
    ];

    it('returns null when closed', () => {
      const { container } = render(
        <I18nProvider>
          <TagManagerModal isOpen={false} onClose={vi.fn()} />
        </I18nProvider>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders tags and toggles assignment for a book', async () => {
      const onBookTagsUpdated = vi.fn();
      const onTagsUpdated = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', tags: [{ id: 't1', name: 'Architecture' }, { id: 't2', name: 'Design Patterns' }] }),
      });

      render(
        <I18nProvider>
          <TagManagerModal
            isOpen={true}
            onClose={vi.fn()}
            book={mockBook}
            tags={mockTags}
            libraryId="lib_main"
            onBookTagsUpdated={onBookTagsUpdated}
            onTagsUpdated={onTagsUpdated}
          />
        </I18nProvider>
      );

      expect(screen.getByText('Architecture')).toBeInTheDocument();
      expect(screen.getByText('Design Patterns')).toBeInTheDocument();

      // Click on tag to toggle
      const tagChip = screen.getByText('Design Patterns');
      fireEvent.click(tagChip);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/books/book_101/tags/toggle',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ tag_id: 't2' }),
          })
        );
      });
      expect(onBookTagsUpdated).toHaveBeenCalled();
      expect(onTagsUpdated).toHaveBeenCalled();
    });

    it('handles creating a new tag via form', async () => {
      const onTagsUpdated = vi.fn();

      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ok', tag: { id: 't3', name: 'Microservices', color: 'amber' } }),
      });

      render(
        <I18nProvider>
          <TagManagerModal
            isOpen={true}
            onClose={vi.fn()}
            book={mockBook}
            tags={mockTags}
            libraryId="lib_main"
            onTagsUpdated={onTagsUpdated}
          />
        </I18nProvider>
      );

      const input = screen.getByPlaceholderText(/tag name|nome da tag/i);
      fireEvent.change(input, { target: { value: 'Microservices' } });

      const form = input.closest('form');
      fireEvent.submit(form);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/tags',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Microservices'),
          })
        );
      });
    });

    it('closes on Escape key press', () => {
      const onClose = vi.fn();
      render(
        <I18nProvider>
          <TagManagerModal isOpen={true} onClose={onClose} book={mockBook} tags={mockTags} />
        </I18nProvider>
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('ThemeMenu Component', () => {
    it('renders theme choices and allows selecting mode and theme', () => {
      const onSelectTheme = vi.fn();
      const onSelectMode = vi.fn();
      const onClose = vi.fn();

      render(
        <I18nProvider>
          <ThemeMenu
            currentTheme="default"
            currentMode="dark"
            onSelectTheme={onSelectTheme}
            onSelectMode={onSelectMode}
            onClose={onClose}
          />
        </I18nProvider>
      );

      // Check mode buttons
      const modeButtons = screen.getAllByRole('button');
      const lightBtn = modeButtons.find((btn) => btn.textContent.toLowerCase().includes('claro') || btn.textContent.toLowerCase().includes('light'));
      if (lightBtn) {
        fireEvent.click(lightBtn);
        expect(onSelectMode).toHaveBeenCalledWith('light');
      }

      // Check theme item click
      const sepiaBtn = modeButtons.find((btn) => btn.getAttribute('data-theme-id') === 'sepia');
      if (sepiaBtn) {
        fireEvent.click(sepiaBtn);
        expect(onSelectTheme).toHaveBeenCalledWith('sepia');
      }
    });

    it('closes when clicking the backdrop overlay', () => {
      const onClose = vi.fn();

      const { container } = render(
        <I18nProvider>
          <ThemeMenu
            currentTheme="default"
            currentMode="dark"
            onSelectTheme={vi.fn()}
            onSelectMode={vi.fn()}
            onClose={onClose}
          />
        </I18nProvider>
      );

      const backdrop = container.querySelector('.fixed.inset-0.z-40');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop);

      expect(onClose).toHaveBeenCalled();
    });

    it('navigates with Arrow keys and Enter', () => {
      const onSelectTheme = vi.fn();

      render(
        <I18nProvider>
          <ThemeMenu
            currentTheme="default"
            currentMode="dark"
            onSelectTheme={onSelectTheme}
            onSelectMode={vi.fn()}
            onClose={vi.fn()}
          />
        </I18nProvider>
      );

      // Press ArrowDown to navigate to theme
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      });

      // Press Enter
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      });

      expect(onSelectTheme).toHaveBeenCalled();
    });
  });

  describe('useBookModals Hook', () => {
    it('manages modal open/close lifecycle seamlessly', () => {
      const { result } = renderHook(() => useBookModals());

      expect(result.current.contextMenu.isOpen).toBe(false);
      expect(result.current.shelfContextMenu.isOpen).toBe(false);
      expect(result.current.renameModal.isOpen).toBe(false);
      expect(result.current.iconModal.isOpen).toBe(false);
      expect(result.current.tagModal.isOpen).toBe(false);
      expect(result.current.detailsModal.isOpen).toBe(false);
      expect(result.current.settingsOpen).toBe(false);
      expect(result.current.themeMenuOpen).toBe(false);

      const fakeBook = { id: 'b1', title: 'Book 1' };
      const fakeShelf = { id: 's1', name: 'Dev' };
      const fakeEvent = { preventDefault: vi.fn(), clientX: 120, clientY: 250 };

      // Test book context menu
      act(() => {
        result.current.openBookContextMenu(fakeEvent, fakeBook);
      });
      expect(result.current.contextMenu.isOpen).toBe(true);
      expect(result.current.contextMenu.x).toBe(120);
      expect(result.current.contextMenu.y).toBe(250);
      expect(result.current.contextMenu.book).toBe(fakeBook);

      act(() => {
        result.current.closeBookContextMenu();
      });
      expect(result.current.contextMenu.isOpen).toBe(false);

      // Test shelf context menu
      act(() => {
        result.current.openShelfContextMenu(fakeEvent, fakeShelf);
      });
      expect(result.current.shelfContextMenu.isOpen).toBe(true);
      expect(result.current.shelfContextMenu.shelf).toBe(fakeShelf);

      act(() => {
        result.current.closeShelfContextMenu();
      });
      expect(result.current.shelfContextMenu.isOpen).toBe(false);

      // Test rename modal
      act(() => {
        result.current.openRenameModal(fakeShelf);
      });
      expect(result.current.renameModal.isOpen).toBe(true);
      expect(result.current.renameModal.shelf).toBe(fakeShelf);

      act(() => {
        result.current.closeRenameModal();
      });
      expect(result.current.renameModal.isOpen).toBe(false);

      // Test icon modal
      act(() => {
        result.current.openIconModal(fakeShelf);
      });
      expect(result.current.iconModal.isOpen).toBe(true);

      act(() => {
        result.current.closeIconModal();
      });
      expect(result.current.iconModal.isOpen).toBe(false);

      // Test tag modal
      act(() => {
        result.current.openTagModal(fakeBook);
      });
      expect(result.current.tagModal.isOpen).toBe(true);

      act(() => {
        result.current.closeTagModal();
      });
      expect(result.current.tagModal.isOpen).toBe(false);

      // Test details modal
      act(() => {
        result.current.openDetailsModal(fakeBook);
      });
      expect(result.current.detailsModal.isOpen).toBe(true);

      act(() => {
        result.current.closeDetailsModal();
      });
      expect(result.current.detailsModal.isOpen).toBe(false);

      // Settings and theme open toggles
      act(() => {
        result.current.setSettingsOpen(true);
        result.current.setThemeMenuOpen(true);
      });
      expect(result.current.settingsOpen).toBe(true);
      expect(result.current.themeMenuOpen).toBe(true);
    });
  });

  describe('useReaderHeaderPin Hook', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('initializes from localStorage and toggles pin state', () => {
      const { result } = renderHook(() => useReaderHeaderPin({ storageKey: 'test_pin' }));

      expect(result.current.headerPinned).toBe(false);
      expect(result.current.isHeaderVisible).toBe(true);

      act(() => {
        result.current.toggleHeaderPinned();
      });

      expect(result.current.headerPinned).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalledWith('test_pin', 'true');

      act(() => {
        result.current.toggleHeaderPinned();
      });

      expect(result.current.headerPinned).toBe(false);
      expect(localStorage.setItem).toHaveBeenCalledWith('test_pin', 'false');
    });

    it('auto-hides header when unpinned after delay', () => {
      const { result } = renderHook(() => useReaderHeaderPin());

      act(() => {
        result.current.showHeader();
      });
      expect(result.current.isHeaderVisible).toBe(true);

      // Fast-forward past hide timeout
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(result.current.isHeaderVisible).toBe(false);
    });

    it('prevents auto-hiding when mouse is hovering the header', () => {
      const { result } = renderHook(() => useReaderHeaderPin());

      act(() => {
        result.current.showHeader();
        result.current.onMouseEnterHeader({ pointerType: 'mouse' });
      });

      // Fast-forward timer
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Header remains visible because mouse is hovering
      expect(result.current.isHeaderVisible).toBe(true);

      // Mouse leaves header
      act(() => {
        result.current.onMouseLeaveHeader();
      });

      // Fast-forward exit delay
      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(result.current.isHeaderVisible).toBe(false);
    });

    it('re-shows header when mouse moves near top threshold of the screen', () => {
      const { result } = renderHook(() => useReaderHeaderPin({ hoverThresholdY: 60 }));

      // First hide header
      act(() => {
        result.current.showHeader();
        vi.advanceTimersByTime(4000);
      });
      expect(result.current.isHeaderVisible).toBe(false);

      // Mouse moves at y = 30 (within threshold)
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientY: 30 }));
      });

      expect(result.current.isHeaderVisible).toBe(true);
    });
  });
});
