import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from '../utils/clipboard';
import { applyEpubPolyfills } from '../utils/epubPolyfills';
import ePub from 'epubjs';

describe('Universal Clipboard Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard.writeText when available and successful', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeMock },
      configurable: true,
      writable: true,
    });

    const res = await copyToClipboard('Hello World');
    expect(res).toBe(true);
    expect(writeMock).toHaveBeenCalledWith('Hello World');
  });

  it('falls back to document.execCommand when navigator.clipboard.writeText rejects (e.g. non-secure HTTP on LAN)', async () => {
    const writeMock = vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeMock },
      configurable: true,
      writable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const res = await copyToClipboard('Diagnostic Report Content');
    expect(res).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('falls back to document.execCommand when navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const res = await copyToClipboard('Diagnostic Report Content');
    expect(res).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('handles null, undefined, and non-string values gracefully', async () => {
    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    expect(await copyToClipboard(null)).toBe(true);
    expect(await copyToClipboard(12345)).toBe(true);
  });
});

describe('epub.js Defensive Polyfills', () => {
  it('prevents TypeError when this.window.getComputedStyle is null in Firefox', () => {
    applyEpubPolyfills();

    const mockContents = {
      window: {
        getComputedStyle: () => null,
      },
      documentElement: {
        style: {},
      },
      content: {},
    };

    // Before patch, calling writingMode throws TypeError: can't access property "writing-mode", this.window.getComputedStyle(...) is null
    const result = ePub.Contents.prototype.writingMode.call(mockContents);
    expect(result).toBe('');

    const cssResult = ePub.Contents.prototype.css.call(mockContents, 'color');
    expect(cssResult).toBe('');

    const overflowResult = ePub.Contents.prototype.overflow.call(mockContents);
    expect(overflowResult).toBe('');
  });

  it('prevents TypeError when section is destroyed during in-flight load', () => {
    applyEpubPolyfills();
    const Section = require('epubjs/lib/section').default;
    const section = new Section({ idref: 'sec-1', href: 'ch1.xhtml' });
    section.destroy();

    // hooks should not be undefined, preventing Cannot read properties of undefined (reading 'content')
    expect(section.hooks).toBeDefined();
    expect(typeof section.hooks.content.trigger).toBe('function');
  });
});
