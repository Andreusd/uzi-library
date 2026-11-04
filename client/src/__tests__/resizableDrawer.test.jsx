import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResizableDrawer } from '../hooks/useResizableDrawer';

describe('useResizableDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with default width when no storage is saved', () => {
    const { result } = renderHook(() =>
      useResizableDrawer({
        storageKey: 'test-drawer',
        defaultWidth: 400,
        minWidth: 280,
        maxWidth: 800,
      })
    );

    expect(result.current.width).toBe(400);
    expect(result.current.isCustomWidth).toBe(false);
    expect(result.current.isResizing).toBe(false);
  });

  it('loads saved width from localStorage if valid', () => {
    localStorage.setItem('test-drawer', '550');

    const { result } = renderHook(() =>
      useResizableDrawer({
        storageKey: 'test-drawer',
        defaultWidth: 400,
        minWidth: 280,
        maxWidth: 800,
      })
    );

    expect(result.current.width).toBe(550);
    expect(result.current.isCustomWidth).toBe(true);
  });

  it('resets to default width and cleans storage when resetWidth is called', () => {
    localStorage.setItem('test-drawer', '600');

    const { result } = renderHook(() =>
      useResizableDrawer({
        storageKey: 'test-drawer',
        defaultWidth: 400,
        minWidth: 280,
        maxWidth: 800,
      })
    );

    expect(result.current.width).toBe(600);
    expect(result.current.isCustomWidth).toBe(true);

    act(() => {
      result.current.resetWidth();
    });

    expect(result.current.width).toBe(400);
    expect(result.current.isCustomWidth).toBe(false);
    expect(localStorage.getItem('test-drawer')).toBeNull();
  });

  it('handles mouse dragging and clamps to minWidth and maxWidth', () => {
    const { result } = renderHook(() =>
      useResizableDrawer({
        storageKey: 'test-drawer',
        defaultWidth: 400,
        minWidth: 300,
        maxWidth: 700,
      })
    );

    // Start drag at clientX: 800
    act(() => {
      result.current.handleMouseDown({
        clientX: 800,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    });

    expect(result.current.isResizing).toBe(true);

    // Drag left by 100px (clientX: 700) -> width should increase to 500
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 700 }));
    });

    expect(result.current.width).toBe(500);

    // Drag right by 300px (clientX: 1100) -> width would be 100, clamped to minWidth 300
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1100 }));
    });

    expect(result.current.width).toBe(300);

    // Release mouse
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.isResizing).toBe(false);
    expect(localStorage.getItem('test-drawer')).toBe('300');
  });
});
