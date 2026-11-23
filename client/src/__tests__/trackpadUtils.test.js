import { describe, it, expect } from 'vitest';
import { isLikelyTrackpad } from '../utils/trackpadUtils';

describe('trackpadUtils - isLikelyTrackpad', () => {
  it('returns false for null, undefined, or empty events', () => {
    expect(isLikelyTrackpad(null)).toBe(false);
    expect(isLikelyTrackpad(undefined)).toBe(false);
    expect(isLikelyTrackpad({})).toBe(false);
  });

  it('returns false for discrete physical mouse wheel events', () => {
    // Windows/Chrome physical mouse wheel standard notches
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe(false);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: -100, deltaMode: 0 })).toBe(false);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 120, deltaMode: 0, wheelDeltaY: -120 })).toBe(false);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: -120, deltaMode: 0, wheelDeltaY: 120 })).toBe(false);

    // Firefox line mode (deltaMode 1) is a physical mouse wheel
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe(false);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: -3, deltaMode: 1 })).toBe(false);

    // Page mode (deltaMode 2)
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 1, deltaMode: 2 })).toBe(false);
  });

  it('returns true for trackpad events with simultaneous X and Y drift', () => {
    expect(isLikelyTrackpad({ deltaX: 2, deltaY: 18, deltaMode: 0 })).toBe(true);
    expect(isLikelyTrackpad({ deltaX: -1, deltaY: 100, deltaMode: 0 })).toBe(true);
  });

  it('returns true for trackpad events with fractional floating-point deltas', () => {
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 15.35, deltaMode: 0 })).toBe(true);
    expect(isLikelyTrackpad({ deltaX: 1.2, deltaY: 0, deltaMode: 0 })).toBe(true);
  });

  it('returns true for continuous smooth micro-deltas (< 50)', () => {
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 8, deltaMode: 0 })).toBe(true);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 25, deltaMode: 0 })).toBe(true);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: -16, deltaMode: 0 })).toBe(true);
  });

  it('returns true for WebKit/Blink continuous wheelDeltaY not multiple of 120', () => {
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 80, deltaMode: 0, wheelDeltaY: -85 })).toBe(true);
    expect(isLikelyTrackpad({ deltaX: 0, deltaY: 60, deltaMode: 0, wheelDelta: 43 })).toBe(true);
  });
});
