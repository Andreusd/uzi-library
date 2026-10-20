import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import ReaderTransition from '../components/ReaderTransition';
import SettingsModal from '../components/SettingsModal';
import { I18nProvider } from '../i18n';
import { getBookOriginRect, getCenteredFallbackRect } from '../utils/bookTransition';

describe('bookTransition utilities', () => {
  it('returns centered fallback rect when bookId is not provided or element is not in DOM', () => {
    const rect = getBookOriginRect('non-existent-book-123');
    expect(rect).toBeDefined();
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left).toBeGreaterThanOrEqual(0);
  });

  it('calculates proper 1:1.45 aspect ratio in getCenteredFallbackRect', () => {
    const fallback = getCenteredFallbackRect();
    const ratio = fallback.height / fallback.width;
    expect(Math.abs(ratio - 1.45)).toBeLessThan(0.05);
  });

  it('locates valid DOM element with data-book-id and returns its rect', () => {
    const testDiv = document.createElement('div');
    testDiv.setAttribute('data-book-id', 'test-book-dom');
    const coverDiv = document.createElement('div');
    coverDiv.className = 'book-cover-container';
    // Mock getBoundingClientRect
    coverDiv.getBoundingClientRect = () => ({
      top: 150,
      left: 200,
      width: 180,
      height: 260,
      right: 380,
      bottom: 410,
    });
    testDiv.appendChild(coverDiv);
    document.body.appendChild(testDiv);

    const rect = getBookOriginRect('test-book-dom');
    expect(rect).toEqual({
      top: 150,
      left: 200,
      width: 180,
      height: 260,
      right: 380,
      bottom: 410,
    });

    document.body.removeChild(testDiv);
  });
});

describe('ReaderTransition component', () => {
  const mockBook = {
    id: 'book-anim-1',
    title: 'The Hobbit',
    cover_url: '/covers/hobbit.jpg',
    shelf_display: 'Fantasy',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when book is null', () => {
    const { container } = render(
      <ReaderTransition book={null} onClose={vi.fn()}>
        <div>Reader Content</div>
      </ReaderTransition>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders backdrop, zooming aperture, cover layer, and reader content when book is provided', () => {
    render(
      <ReaderTransition book={mockBook} onClose={vi.fn()}>
        {(book, onClose) => (
          <div data-testid="active-reader">
            <span>Reading {book.title}</span>
            <button onClick={onClose}>Exit</button>
          </div>
        )}
      </ReaderTransition>
    );

    expect(screen.getByTestId('reader-transition-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('reader-zoom-aperture')).toBeInTheDocument();
    expect(screen.getByTestId('reader-zoom-content')).toBeInTheDocument();
    expect(screen.getByText('Reading The Hobbit')).toBeInTheDocument();
  });

  it('initiates zoom-in expansion via double requestAnimationFrame', () => {
    render(
      <ReaderTransition book={mockBook} onClose={vi.fn()}>
        <div>Child Content</div>
      </ReaderTransition>
    );

    const aperture = screen.getByTestId('reader-zoom-aperture');
    expect(aperture).toBeInTheDocument();

    // Advance animation frames
    act(() => {
      vi.advanceTimersByTime(50);
    });

    // Advance past opening duration (340ms)
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Fully open: cover layer unmounts for memory and performance
    expect(screen.queryByTestId('reader-zoom-cover')).toBeNull();
  });

  it('executes zoom-out transition when reader close handler is triggered and calls onClose', () => {
    const onClose = vi.fn();
    const onStateChange = vi.fn();

    render(
      <ReaderTransition
        book={mockBook}
        onClose={onClose}
        onTransitionStateChange={onStateChange}
      >
        {(book, handleClose) => (
          <button data-testid="close-btn" onClick={handleClose}>
            Close Reader
          </button>
        )}
      </ReaderTransition>
    );

    // Initial state change call with true
    expect(onStateChange).toHaveBeenCalledWith(true);

    // Trigger close action
    act(() => {
      screen.getByTestId('close-btn').click();
    });

    // Cover layer reappears for contraction animation
    expect(screen.getByTestId('reader-zoom-cover')).toBeInTheDocument();

    // Before duration completes, onClose should not yet have been called
    expect(onClose).not.toHaveBeenCalled();

    // Advance 340ms transition duration
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Now onClose should be called and transition should finish
    expect(onClose).toHaveBeenCalled();
  });

  it('triggers zoom-out when book prop becomes null (browser back navigation)', () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <ReaderTransition book={mockBook} onClose={onClose}>
        {() => <div>Reader Page</div>}
      </ReaderTransition>
    );

    // Initial open animation
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Simulate URL router popping back: book becomes null
    rerender(
      <ReaderTransition book={null} onClose={onClose}>
        {() => <div>Reader Page</div>}
      </ReaderTransition>
    );

    // Should still display reader while contracting
    expect(screen.getByTestId('reader-zoom-aperture')).toBeInTheDocument();

    // Advance animation duration
    act(() => {
      vi.advanceTimersByTime(450);
    });

    // Unmounts after animation ends
    expect(screen.queryByTestId('reader-zoom-aperture')).toBeNull();
  });

  it('immediately opens and closes without animations when enabled is false', () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <ReaderTransition book={mockBook} enabled={false} onClose={onClose}>
        {(book, handleClose) => (
          <button data-testid="exit-btn" onClick={handleClose}>
            Exit
          </button>
        )}
      </ReaderTransition>
    );

    // Aperture is rendered immediately
    const aperture = screen.getByTestId('reader-zoom-aperture');
    expect(aperture).toBeInTheDocument();

    // Cover layer is skipped completely when animations are disabled
    expect(screen.queryByTestId('reader-zoom-cover')).toBeNull();

    // Trigger close action
    act(() => {
      screen.getByTestId('exit-btn').click();
    });

    // Immediately closes and invokes onClose without waiting for timer
    expect(onClose).toHaveBeenCalled();

    rerender(
      <ReaderTransition book={null} enabled={false} onClose={onClose}>
        {() => <div>Reader Page</div>}
      </ReaderTransition>
    );

    expect(screen.queryByTestId('reader-zoom-aperture')).toBeNull();
  });
});

describe('SettingsModal animation toggle', () => {
  it('renders book animations toggle with default checked state and allows toggling', async () => {
    const onToggle = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ libraries: [], active_library_id: '' }),
      })
    );

    render(
      <I18nProvider>
        <SettingsModal
          isOpen={true}
          onClose={vi.fn()}
          bookAnimations={true}
          onToggleBookAnimations={onToggle}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Book open/close animations')).toBeInTheDocument();
    expect(screen.getByText('Smooth zoom-in and zoom-out transitions when opening and closing books')).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    // Second checkbox is the animations toggle (first is showFileExtension)
    const animCheckbox = checkboxes[1];
    expect(animCheckbox).toBeChecked();

    act(() => {
      fireEvent.click(animCheckbox);
    });

    expect(onToggle).toHaveBeenCalledWith(false);
    fetchSpy.mockRestore();
  });

  it('closes SettingsModal when clicking outside the dialog on the backdrop', () => {
    const onClose = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ libraries: [], active_library_id: '' }),
      })
    );

    render(
      <I18nProvider>
        <SettingsModal
          isOpen={true}
          onClose={onClose}
        />
      </I18nProvider>
    );

    const backdrop = screen.getByTestId('settings-modal-backdrop');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('does not close SettingsModal when clicking inside the dialog content', () => {
    const onClose = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ libraries: [], active_library_id: '' }),
      })
    );

    render(
      <I18nProvider>
        <SettingsModal
          isOpen={true}
          onClose={onClose}
        />
      </I18nProvider>
    );

    // Click on title inside the modal
    const title = screen.getByText(/library settings/i);
    fireEvent.click(title);

    expect(onClose).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('closes SettingsModal when pressing Escape', () => {
    const onClose = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ libraries: [], active_library_id: '' }),
      })
    );

    render(
      <I18nProvider>
        <SettingsModal
          isOpen={true}
          onClose={onClose}
        />
      </I18nProvider>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});

