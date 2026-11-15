import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarSwipe } from '../hooks/useSidebarSwipe';

function createTouchEvent(type, touches, changedTouches) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.touches = touches || [];
  event.changedTouches = changedTouches || touches || [];
  return event;
}

describe('useSidebarSwipe Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.innerWidth = 375; // Mobile viewport
  });

  it('opens sidebar when swiping right starting from left side of screen', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 120, clientY: 205 }])
      );
    });

    // Should trigger immediately during touchmove as soon as threshold is met
    expect(setSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('opens sidebar when swiping across screen (e.g. starting at x=150)', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 150, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 230, clientY: 205 }])
      );
    });

    expect(setSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('closes sidebar when swiping left while sidebar is open', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: true,
        setSidebarOpen,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 250, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 180, clientY: 200 }])
      );
    });

    expect(setSidebarOpen).toHaveBeenCalledWith(false);
  });

  it('does not trigger when vertical scrolling dominates', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 50, clientY: 100 }])
      );
      // Large vertical drag, small horizontal drag
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 60, clientY: 250 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 60, clientY: 250 }])
      );
    });

    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('does not trigger when enabled is false (e.g. inside Reader)', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: false,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 150, clientY: 200 }])
      );
    });

    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('does not trigger on desktop screen width (>= 1024px)', () => {
    window.innerWidth = 1200;
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 150, clientY: 200 }])
      );
    });

    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('ignores touches originating on input elements', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
      })
    );

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }]);
    Object.defineProperty(event, 'target', { value: input });

    act(() => {
      window.dispatchEvent(event);
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 150, clientY: 200 }])
      );
    });

    expect(setSidebarOpen).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
