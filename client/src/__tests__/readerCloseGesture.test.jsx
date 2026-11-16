import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import ReaderCloseConfirmation from '../components/ReaderCloseConfirmation';
import { useEpubNavigation } from '../hooks/useEpubNavigation';

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

function createTouchEvent(type, touches, changedTouches) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.touches = touches || [];
  event.changedTouches = changedTouches || touches || [];
  return event;
}

describe('Reader Close Gesture Subsystem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('ReaderCloseConfirmation Component', () => {
    it('returns null when isOpen is false', () => {
      const { container } = render(
        <I18nProvider>
          <ReaderCloseConfirmation isOpen={false} onDismiss={vi.fn()} />
        </I18nProvider>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders confirmation text when isOpen is true', () => {
      render(
        <I18nProvider>
          <ReaderCloseConfirmation isOpen={true} onDismiss={vi.fn()} theme="dark" />
        </I18nProvider>
      );

      const prompt = screen.getByTestId('reader-close-confirmation');
      expect(prompt).toBeInTheDocument();
      expect(prompt).toHaveTextContent(/deslize|slide/i);
    });

    it('triggers onDismiss when close button is clicked', () => {
      const onDismiss = vi.fn();
      render(
        <I18nProvider>
          <ReaderCloseConfirmation isOpen={true} onDismiss={onDismiss} theme="sepia" />
        </I18nProvider>
      );

      const dismissBtn = screen.getByRole('button', { name: /dismiss|dispensar/i });
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('useEpubNavigation slide up-to-down gesture', () => {
    it('opens confirmation on first slide down and closes book on second slide down', () => {
      const handleClose = vi.fn();
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            handleClose,
          }),
        { wrapper }
      );

      expect(result.current.closeConfirmOpen).toBe(false);

      // First slide: from (150, 80) down to (150, 180) -> diffY = +100
      act(() => {
        window.dispatchEvent(
          createTouchEvent('touchstart', [{ clientX: 150, clientY: 80 }])
        );
        window.dispatchEvent(
          createTouchEvent('touchend', [], [{ clientX: 150, clientY: 180 }])
        );
      });

      // Confirmation prompt should now be open, but book NOT yet closed
      expect(result.current.closeConfirmOpen).toBe(true);
      expect(handleClose).not.toHaveBeenCalled();

      // Second slide down within confirmation window: from (150, 90) down to (150, 190) -> diffY = +100
      act(() => {
        window.dispatchEvent(
          createTouchEvent('touchstart', [{ clientX: 150, clientY: 90 }])
        );
        window.dispatchEvent(
          createTouchEvent('touchend', [], [{ clientX: 150, clientY: 190 }])
        );
      });

      // Now handleClose must be called and confirmation closed
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(result.current.closeConfirmOpen).toBe(false);
    });

    it('auto-dismisses confirmation prompt after 3 seconds', () => {
      const handleClose = vi.fn();
      const renditionRef = { current: { next: vi.fn(), prev: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            handleClose,
          }),
        { wrapper }
      );

      // Slide down once
      act(() => {
        window.dispatchEvent(
          createTouchEvent('touchstart', [{ clientX: 150, clientY: 80 }])
        );
        window.dispatchEvent(
          createTouchEvent('touchend', [], [{ clientX: 150, clientY: 180 }])
        );
      });

      expect(result.current.closeConfirmOpen).toBe(true);

      // Fast-forward 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.closeConfirmOpen).toBe(false);
    });

    it('dismisses confirmation when page is flipped horizontally', () => {
      const handleClose = vi.fn();
      const nextMock = vi.fn();
      const renditionRef = { current: { next: nextMock, prev: vi.fn() } };
      const viewerRef = { current: { querySelector: () => null } };

      const { result } = renderHook(
        () =>
          useEpubNavigation({
            renditionRef,
            viewerRef,
            handleClose,
          }),
        { wrapper }
      );

      // First slide down
      act(() => {
        window.dispatchEvent(
          createTouchEvent('touchstart', [{ clientX: 150, clientY: 80 }])
        );
        window.dispatchEvent(
          createTouchEvent('touchend', [], [{ clientX: 150, clientY: 180 }])
        );
      });

      expect(result.current.closeConfirmOpen).toBe(true);

      // Now horizontal swipe left: (200, 200) to (100, 200) -> flipNext
      act(() => {
        window.dispatchEvent(
          createTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }])
        );
        window.dispatchEvent(
          createTouchEvent('touchend', [], [{ clientX: 100, clientY: 200 }])
        );
      });

      expect(result.current.closeConfirmOpen).toBe(false);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });
});
