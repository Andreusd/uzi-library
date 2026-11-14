import ePub from 'epubjs';
import Section from 'epubjs/lib/section';

/**
 * Applies defensive polyfills to epubjs to prevent browser-specific exceptions
 * (such as Firefox throwing TypeError: can't access property "writing-mode", this.window.getComputedStyle(...) is null
 * when iframes are hidden, detached, or mid-transition, or unhandled rejection Cannot read properties of undefined (reading 'content')
 * when sections are destroyed while async requests are in-flight).
 */
export function applyEpubPolyfills() {
  if (ePub && ePub.Contents && ePub.Contents.prototype) {
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

  // 4. Section: Prevent Uncaught TypeError: Cannot read properties of undefined (reading 'content')
  // when Section.destroy() is invoked while async Section.load() network request is still in-flight
  const SectionClass = Section || (ePub && ePub.Section);
  if (SectionClass && SectionClass.prototype) {
    const sProto = SectionClass.prototype;
    if (typeof sProto.destroy === 'function' && !sProto._destroyPatched) {
      const origDestroy = sProto.destroy;
      sProto.destroy = function () {
        origDestroy.call(this);
        // Replace undefined hooks with no-op dummy hooks so in-flight async loads don't crash
        this.hooks = {
          serialize: { trigger: () => Promise.resolve(), register: () => {}, deregister: () => {}, clear: () => {} },
          content: { trigger: () => Promise.resolve(), register: () => {}, deregister: () => {}, clear: () => {} },
        };
      };
      sProto._destroyPatched = true;
    }
  }
}

// Auto-apply on import
applyEpubPolyfills();
