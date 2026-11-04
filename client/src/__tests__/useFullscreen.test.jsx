import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from '../hooks/useFullscreen';

describe('useFullscreen hook', () => {
  let mockRequestFullscreen;
  let mockExitFullscreen;

  beforeEach(() => {
    mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
    mockExitFullscreen = vi.fn().mockResolvedValue(undefined);

    document.documentElement.requestFullscreen = mockRequestFullscreen;
    document.exitFullscreen = mockExitFullscreen;

    // Reset document properties
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    document.hasFocus = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with isFullscreen false when no fullscreenElement exists', () => {
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it('enters fullscreen via toggleFullscreen', () => {
    const { result } = renderHook(() => useFullscreen());

    act(() => {
      result.current.toggleFullscreen();
    });

    expect(mockRequestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('exits fullscreen via toggleFullscreen when already in fullscreen', () => {
    const dummyEl = document.createElement('div');
    document.fullscreenElement = dummyEl;

    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(true);

    act(() => {
      result.current.toggleFullscreen();
    });

    expect(mockExitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('automatically restores fullscreen on user gesture after returning from background', () => {
    const dummyEl = document.createElement('div');
    document.fullscreenElement = dummyEl;

    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(true);

    // 1. Simulate app going to background (user switches app / locks screen)
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 2. Browser exits fullscreen in background
    act(() => {
      document.fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(result.current.isFullscreen).toBe(false);

    // 3. User switches back to app
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fullscreen should not have been requested yet (needs user gesture)
    mockRequestFullscreen.mockClear();

    // 4. User touches the screen (first interaction upon returning)
    act(() => {
      window.dispatchEvent(new Event('touchstart'));
    });

    // Fullscreen should have been automatically restored!
    expect(mockRequestFullscreen).toHaveBeenCalledTimes(1);
    expect(mockRequestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('does not restore fullscreen if the user explicitly exited fullscreen while active', () => {
    const dummyEl = document.createElement('div');
    document.fullscreenElement = dummyEl;

    const { result } = renderHook(() => useFullscreen());

    // Explicitly toggle fullscreen off
    act(() => {
      result.current.toggleFullscreen();
    });

    expect(mockExitFullscreen).toHaveBeenCalledTimes(1);

    act(() => {
      document.fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    mockRequestFullscreen.mockClear();

    // Next tap should NOT enter fullscreen
    act(() => {
      window.dispatchEvent(new Event('touchstart'));
    });

    expect(mockRequestFullscreen).not.toHaveBeenCalled();
  });
});
