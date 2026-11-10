import ePub from 'epubjs';

/**
 * Applies defensive polyfills to epubjs to prevent browser-specific exceptions
 * (such as Firefox throwing TypeError: can't access property "writing-mode", this.window.getComputedStyle(...) is null
 * when iframes are hidden, detached, or mid-transition).
 */
export function applyEpubPolyfills() {
  if (!ePub || !ePub.Contents || !ePub.Contents.prototype) return;

  const proto = ePub.Contents.prototype;

  // 1. writingMode: Guard against null getComputedStyle
  if (typeof proto.writingMode === 'function' && !proto._writingModePatched) {
    const origWritingMode = proto.writingMode;
    proto.writingMode = function (mode) {
      try {
        if (this.window && this.documentElement) {
          const computed = this.window.getComputedStyle ? this.window.getComputedStyle(this.documentElement) : null;
          if (!computed) return '';
        }
        return origWritingMode.call(this, mode) || '';
      } catch {
        return '';
      }
    };
    proto._writingModePatched = true;
  }

  // 2. css: Guard against null getComputedStyle
  if (typeof proto.css === 'function' && !proto._cssPatched) {
    const origCss = proto.css;
    proto.css = function (property, value, priority) {
      try {
        if (!value && this.window && this.content) {
          const computed = this.window.getComputedStyle ? this.window.getComputedStyle(this.content) : null;
          if (!computed) return '';
        }
        return origCss.call(this, property, value, priority);
      } catch {
        return '';
      }
    };
    proto._cssPatched = true;
  }

  // 3. overflow: Guard against null getComputedStyle
  if (typeof proto.overflow === 'function' && !proto._overflowPatched) {
    const origOverflow = proto.overflow;
    proto.overflow = function (overflow) {
      try {
        if (!overflow && this.window && this.documentElement) {
          const computed = this.window.getComputedStyle ? this.window.getComputedStyle(this.documentElement) : null;
          if (!computed) return '';
        }
        return origOverflow.call(this, overflow);
      } catch {
        return '';
      }
    };
    proto._overflowPatched = true;
  }
}

// Auto-apply on import
applyEpubPolyfills();
