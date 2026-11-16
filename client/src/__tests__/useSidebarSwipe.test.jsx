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
    const onOpenSettings = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: true,
        setSidebarOpen,
        onOpenSettings,
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
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it('opens library settings when swiping right-to-left while sidebar is closed', () => {
    const setSidebarOpen = vi.fn();
    const onOpenSettings = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        onOpenSettings,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 300, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 220, clientY: 200 }])
      );
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(setSidebarOpen).not.toHaveBeenCalled();
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

  it('opens sidebar when swiping right on a carousel that is at the beginning (scrollLeft <= 8)', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    const carousel = document.createElement('div');
    carousel.className = 'overflow-x-auto';
    carousel.scrollLeft = 0; // At beginning, no books to the left
    document.body.appendChild(carousel);

    const bookItem = document.createElement('div');
    carousel.appendChild(bookItem);

    const event = createTouchEvent('touchstart', [{ clientX: 120, clientY: 200 }]);
    Object.defineProperty(event, 'target', { value: bookItem });

    act(() => {
      window.dispatchEvent(event);
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 190, clientY: 200 }])
      );
    });

    expect(setSidebarOpen).toHaveBeenCalledWith(true);
    document.body.removeChild(carousel);
  });

  it('allows carousel scrolling and does not open sidebar when carousel has items to the left (scrollLeft > 8)', () => {
    const setSidebarOpen = vi.fn();
    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    const carousel = document.createElement('div');
    carousel.className = 'overflow-x-auto';
    carousel.scrollLeft = 100; // Scrolled into carousel, items exist to the left
    document.body.appendChild(carousel);

    const bookItem = document.createElement('div');
    carousel.appendChild(bookItem);

    const event = createTouchEvent('touchstart', [{ clientX: 120, clientY: 200 }]);
    Object.defineProperty(event, 'target', { value: bookItem });

    act(() => {
      window.dispatchEvent(event);
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 190, clientY: 200 }])
      );
    });

    expect(setSidebarOpen).not.toHaveBeenCalled();
    document.body.removeChild(carousel);
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

  it('triggers onToggleFilterAndSort when swiping right-to-left while isSearchActive is true', () => {
    const onToggleFilterAndSort = vi.fn();
    const onOpenSettings = vi.fn();
    const setSidebarOpen = vi.fn();

    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        onOpenSettings,
        isSearchActive: true,
        onToggleFilterAndSort,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 300, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 220, clientY: 200 }])
      );
    });

    expect(onToggleFilterAndSort).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('triggers onBackToSearch when swiping left-to-right while mobileFilterOpen is true', () => {
    const onBackToSearch = vi.fn();
    const setSidebarOpen = vi.fn();

    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        mobileFilterOpen: true,
        onBackToSearch,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 180, clientY: 200 }])
      );
    });

    expect(onBackToSearch).toHaveBeenCalledTimes(1);
    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('triggers onOpenTheme when swiping right-to-left while mobileFilterOpen is true', () => {
    const onOpenTheme = vi.fn();
    const onToggleFilterAndSort = vi.fn();
    const onOpenSettings = vi.fn();
    const setSidebarOpen = vi.fn();

    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        mobileFilterOpen: true,
        onOpenTheme,
        onToggleFilterAndSort,
        onOpenSettings,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 300, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 220, clientY: 200 }])
      );
    });

    expect(onOpenTheme).toHaveBeenCalledTimes(1);
    expect(onToggleFilterAndSort).not.toHaveBeenCalled();
    expect(onOpenSettings).not.toHaveBeenCalled();
    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('triggers onBackToFilter when swiping left-to-right while themeMenuOpen is true', () => {
    const onBackToFilter = vi.fn();
    const onBackToSearch = vi.fn();
    const setSidebarOpen = vi.fn();

    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        themeMenuOpen: true,
        onBackToFilter,
        onBackToSearch,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 180, clientY: 200 }])
      );
    });

    expect(onBackToFilter).toHaveBeenCalledTimes(1);
    expect(onBackToSearch).not.toHaveBeenCalled();
    expect(setSidebarOpen).not.toHaveBeenCalled();
  });

  it('triggers onOpenSettings when swiping right-to-left while themeMenuOpen is true', () => {
    const onOpenSettings = vi.fn();
    const setSidebarOpen = vi.fn();

    renderHook(() =>
      useSidebarSwipe({
        sidebarOpen: false,
        setSidebarOpen,
        themeMenuOpen: true,
        onOpenSettings,
        enabled: true,
        minSwipeDistance: 50,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 300, clientY: 200 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 220, clientY: 200 }])
      );
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(setSidebarOpen).not.toHaveBeenCalled();
  });
});
