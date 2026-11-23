/**
 * Utility to identify whether a WheelEvent originates from a trackpad / touchpad
 * gesture versus a discrete physical mouse wheel notch.
 *
 * Characteristics of trackpads:
 * 1. Pixel deltaMode (0). Line (1) or Page (2) modes are almost universally physical mice or keyboards.
 * 2. Continuous multi-axis glide: Simultaneous deltaX and deltaY (absX > 0 && absY > 0).
 * 3. Fractional floating-point values for deltaX or deltaY.
 * 4. Blink / WebKit wheelDeltaY that is NOT an integer multiple of 120 (e.g. 7, 23, 51).
 * 5. Small smooth delta steps (absY > 0 && absY < 50) at the start of gestures.
 * 6. Pixel deltas that are not standard discrete mouse wheel multiples of 100 or 120.
 */
export function isLikelyTrackpad(e) {
  if (!e) return false;

  // Line (1) or Page (2) mode is characteristic of physical mouse wheels (e.g. Firefox) or PageUp/Down
  if (e.deltaMode !== 0) return false;

  const absX = Math.abs(e.deltaX || 0);
  const absY = Math.abs(e.deltaY || 0);

  // Simultaneous X and Y movement is almost exclusively from trackpad two-finger glide
  if (absX > 0 && absY > 0) return true;

  // Trackpad deltas frequently have fractional decimal components
  if (!Number.isInteger(e.deltaY) || !Number.isInteger(e.deltaX)) return true;

  // WebKit / Blink legacy wheelDelta check: physical mouse wheels are multiples of 120
  if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0) {
    if (e.wheelDeltaY % 120 !== 0) return true;
  } else if (typeof e.wheelDelta === 'number' && e.wheelDelta !== 0) {
    if (e.wheelDelta % 120 !== 0) return true;
  }

  // Small smooth deltas (< 50) in pixel mode are characteristic of continuous trackpad events
  if (absY > 0 && absY < 50) return true;

  // Discrete mouse wheel notches in pixel mode are typically 100, 120, or exact multiples
  if (absY % 100 !== 0 && absY % 120 !== 0) return true;

  return false;
}
