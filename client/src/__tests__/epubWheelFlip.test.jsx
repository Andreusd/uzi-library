import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { useEpubNavigation } from '../hooks/useEpubNavigation';
import ReaderSettingsPopover from '../components/ReaderSettingsPopover';

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

describe('EPUB Mouse Wheel Page Flip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useEpubNavigation mouseWheelFlipEnabled state', () => {
    it('defaults to true when localStorage is empty', () => {
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

      expect(result.current.mouseWheelFlipEnabled).toBe(true);
    });

    it('initializes to false if stored as "false" in localStorage', () => {
      localStorage.setItem('reader_mouse_wheel_flip', 'false');
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

      expect(result.current.mouseWheelFlipEnabled).toBe(false);
    });

    it('toggleMouseWheelFlip toggles state and persists in localStorage', () => {
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

      expect(result.current.mouseWheelFlipEnabled).toBe(true);

      act(() => {
        result.current.toggleMouseWheelFlip();
      });

      expect(result.current.mouseWheelFlipEnabled).toBe(false);
      expect(localStorage.getItem('reader_mouse_wheel_flip')).toBe('false');

      act(() => {
        result.current.toggleMouseWheelFlip();
      });

      expect(result.current.mouseWheelFlipEnabled).toBe(true);
      expect(localStorage.getItem('reader_mouse_wheel_flip')).toBe('true');
    });
  });

  describe('wheel gesture execution', () => {
    it('scroll down (deltaY > 0) navigates to next page', () => {
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
        const wheelEvt = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: 100,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelEvt);
      });

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(prevMock).not.toHaveBeenCalled();
    });

    it('scroll up (deltaY < 0) navigates to previous page', () => {
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
        const wheelEvt = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: -100,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelEvt);
      });

      expect(prevMock).toHaveBeenCalledTimes(1);
      expect(nextMock).not.toHaveBeenCalled();
    });

    it('does not navigate on wheel when mouseWheelFlipEnabled is disabled', () => {
      localStorage.setItem('reader_mouse_wheel_flip', 'false');
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
        const wheelDown = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: 100,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelDown);

        const wheelUp = new WheelEvent('wheel', {
          deltaX: 0,
          deltaY: -100,
          bubbles: true,
          cancelable: true,
        });
        window.dispatchEvent(wheelUp);
      });

      expect(nextMock).not.toHaveBeenCalled();
      expect(prevMock).not.toHaveBeenCalled();
    });
  });

  describe('ReaderSettingsPopover toggle item', () => {
    it('renders the toggle item and triggers toggleMouseWheelFlip on click', () => {
      const toggleMouseWheelFlip = vi.fn();

      render(
        <ReaderSettingsPopover
          isOpen={true}
          onClose={vi.fn()}
          theme="dark"
          mouseWheelFlipEnabled={true}
          toggleMouseWheelFlip={toggleMouseWheelFlip}
        />,
        { wrapper }
      );

      const toggleCheckbox = screen.getByRole('checkbox', {
        name: /mouse wheel page flip|virar páginas com a roda do mouse/i,
      });
      expect(toggleCheckbox).toBeDefined();
      expect(toggleCheckbox.checked).toBe(true);

      fireEvent.click(toggleCheckbox);
      expect(toggleMouseWheelFlip).toHaveBeenCalledTimes(1);
    });
  });
});
