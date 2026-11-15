import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToSearch } from '../hooks/usePullToSearch';

function createTouchEvent(type, touches, changedTouches) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  event.touches = touches || [];
  event.changedTouches = changedTouches || touches || [];
  return event;
}

describe('usePullToSearch Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.scrollY = 0;
    document.documentElement.scrollTop = 0;
  });

  it('triggers onTriggerSearch when pulling down past threshold from top', () => {
    const onTriggerSearch = vi.fn();
    const { result } = renderHook(() =>
      usePullToSearch({
        onTriggerSearch,
        enabled: true,
        threshold: 60,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 200, clientY: 50 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 200, clientY: 220 }])
      );
    });

    expect(result.current.isPulling).toBe(true);
    expect(result.current.isThresholdReached).toBe(true);
    expect(result.current.pullDistance).toBeGreaterThanOrEqual(60);

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 200, clientY: 220 }])
      );
    });

    expect(onTriggerSearch).toHaveBeenCalledTimes(1);
    expect(result.current.isPulling).toBe(false);
    expect(result.current.pullDistance).toBe(0);
  });

  it('does not trigger when pull distance is below threshold', () => {
    const onTriggerSearch = vi.fn();
    const { result } = renderHook(() =>
      usePullToSearch({
        onTriggerSearch,
        enabled: true,
        threshold: 60,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 200, clientY: 50 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 200, clientY: 90 }])
      );
    });

    expect(result.current.isPulling).toBe(true);
    expect(result.current.isThresholdReached).toBe(false);

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 200, clientY: 90 }])
      );
    });

    expect(onTriggerSearch).not.toHaveBeenCalled();
    expect(result.current.isPulling).toBe(false);
  });

  it('does not trigger when page is already scrolled down', () => {
    window.scrollY = 150;
    const onTriggerSearch = vi.fn();
    const { result } = renderHook(() =>
      usePullToSearch({
        onTriggerSearch,
        enabled: true,
        threshold: 60,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 200, clientY: 50 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 200, clientY: 220 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 200, clientY: 220 }])
      );
    });

    expect(onTriggerSearch).not.toHaveBeenCalled();
    expect(result.current.isPulling).toBe(false);
  });

  it('cancels pull when horizontal swipe dominates', () => {
    const onTriggerSearch = vi.fn();
    const { result } = renderHook(() =>
      usePullToSearch({
        onTriggerSearch,
        enabled: true,
        threshold: 60,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 20, clientY: 100 }])
      );
      // Large horizontal swipe, small vertical movement
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 200, clientY: 150 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 200, clientY: 150 }])
      );
    });

    expect(onTriggerSearch).not.toHaveBeenCalled();
    expect(result.current.isPulling).toBe(false);
  });

  it('does not trigger when enabled is false', () => {
    const onTriggerSearch = vi.fn();
    renderHook(() =>
      usePullToSearch({
        onTriggerSearch,
        enabled: false,
        threshold: 60,
      })
    );

    act(() => {
      window.dispatchEvent(
        createTouchEvent('touchstart', [{ clientX: 200, clientY: 50 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 200, clientY: 250 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 200, clientY: 250 }])
      );
    });

    expect(onTriggerSearch).not.toHaveBeenCalled();
  });

  it('ignores touches originating on input elements', () => {
    const onTriggerSearch = vi.fn();
    renderHook(() =>
      usePullToSearch({
        onTriggerSearch,
        enabled: true,
      })
    );

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = createTouchEvent('touchstart', [{ clientX: 200, clientY: 50 }]);
    Object.defineProperty(event, 'target', { value: input });

    act(() => {
      window.dispatchEvent(event);
      window.dispatchEvent(
        createTouchEvent('touchmove', [{ clientX: 200, clientY: 250 }])
      );
      window.dispatchEvent(
        createTouchEvent('touchend', [], [{ clientX: 200, clientY: 250 }])
      );
    });

    expect(onTriggerSearch).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
