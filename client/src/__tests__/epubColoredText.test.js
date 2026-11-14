import { describe, it, expect, vi } from 'vitest';
import {
  adaptColorForDarkMode,
  tokenizeCodeText,
  highlightUnstyledCodeBlocks,
  applyThemeToDoc,
  fixEpubViewportUnits,
  buildThemeCss,
  getFontFamilyCss,
  EPUB_FONTS,
  EPUB_THEMES,
} from '../utils/epubThemeUtils';

describe('EPUB Colored Text & Dark Mode Syntax Highlighting', () => {
  describe('adaptColorForDarkMode', () => {
    it('converts dark grayscale colors to readable body text', () => {
      expect(adaptColorForDarkMode('#000000', '#e2e8f0')).toBe('#e2e8f0');
      expect(adaptColorForDarkMode('black', '#e2e8f0')).toBe('#e2e8f0');
      expect(adaptColorForDarkMode('rgb(20, 20, 20)', '#e2e8f0')).toBe('#e2e8f0');
      expect(adaptColorForDarkMode('#222', '#e2e8f0')).toBe('#e2e8f0');
    });

    it('boosts lightness of dark saturated colors for high contrast', () => {
      const darkTeal = adaptColorForDarkMode('#006699');
      expect(darkTeal).toMatch(/hsl\(200,\s*100%,\s*65%\)/);

      const darkBlue = adaptColorForDarkMode('rgb(0, 0, 128)');
      expect(darkBlue).toMatch(/hsl\(240,\s*100%,\s*65%\)/);

      const darkOrange = adaptColorForDarkMode('rgb(204, 51, 0)');
      expect(darkOrange).toMatch(/hsl\(15,\s*100%,\s*75%\)/);
    });

    it('preserves colors that already have sufficient lightness and contrast', () => {
      expect(adaptColorForDarkMode('#00CCFF')).toBe('#00ccff');
      expect(adaptColorForDarkMode('#c0f')).toBe('#c0f');
      expect(adaptColorForDarkMode('#ffffff')).toBe('#ffffff');
      expect(adaptColorForDarkMode('white')).toBe('#ffffff');
      expect(adaptColorForDarkMode('transparent')).toBe('transparent');
    });

    it('maps named dark colors to high-contrast equivalents', () => {
      expect(adaptColorForDarkMode('navy')).toBe('#60a5fa');
      expect(adaptColorForDarkMode('darkred')).toBe('#f87171');
      expect(adaptColorForDarkMode('darkgreen')).toBe('#4ade80');
    });
  });

  describe('tokenizeCodeText', () => {
    it('tokenizes python code with keywords, strings, decorators, comments, and builtins', () => {
      const code = `
# 1) Define tool
@tool
def cancel_order(order_id: str) -> str:
    """Cancel order."""
    return f"Order {order_id}"
      `.trim();

      const html = tokenizeCodeText(code);
      expect(html).toContain('<code class="c1"># 1) Define tool</code>');
      expect(html).toContain('<code class="nd">@tool</code>');
      expect(html).toContain('<code class="kn">def</code>');
      expect(html).toContain('<code class="nf">cancel_order</code>');
      expect(html).toContain('<code class="nb">str</code>');
      expect(html).toContain('<code class="s1">&quot;&quot;&quot;Cancel order.&quot;&quot;&quot;</code>');
      expect(html).toContain('<code class="kn">return</code>');
    });
  });

  describe('highlightUnstyledCodeBlocks', () => {
    it('leaves pre-highlighted code blocks untouched', () => {
      const mockDoc = {
        querySelectorAll: () => [
          {
            querySelector: () => ({
              getAttribute: () => null,
              setAttribute: () => {},
              classList: ['kn'],
              textContent: 'from langchain.tools import tool',
            }),
          },
        ],
      };

      highlightUnstyledCodeBlocks(mockDoc);
    });
  });

  describe('applyThemeToDoc', () => {
    it('injects dark mode stylesheet containing code syntax rules without obliterating spans', () => {
      const createdStyles = [];
      const mockHead = {
        appendChild: (el) => createdStyles.push(el),
      };
      const mockDoc = {
        head: mockHead,
        getElementById: () => null,
        createElement: (tag) => {
          const el = { tagName: tag, id: '', textContent: '' };
          return el;
        },
        querySelectorAll: () => [],
        documentElement: { style: { setProperty: () => {} } },
        body: {
          style: { setProperty: () => {} },
          classList: { remove: () => {}, add: () => {} },
        },
      };

      applyThemeToDoc(mockDoc, 'dark');

      expect(createdStyles.length).toBe(1);
      const css = createdStyles[0].textContent;

      // Crucial: check that `span` and `code` are NOT unconditionally forced to `color: #e2e8f0 !important`
      expect(css).not.toMatch(/span\s*,\s*li.*pre\s*,\s*code\s*\{\s*color:\s*#e2e8f0\s*!important/);

      // Check dark mode syntax highlighting rules are present
      expect(css).toContain('code.kn');
      expect(css).toContain('#38bdf8 !important'); // keywords
      expect(css).toContain('code.nn');
      expect(css).toContain('#67e8f9 !important'); // namespaces
      expect(css).toContain('code.nf');
      expect(css).toContain('#c084fc !important'); // functions
      expect(css).toContain('code.s1');
      expect(css).toContain('#fb923c !important'); // strings
      expect(css).toContain('code.c1');
      expect(css).toContain('#94a3b8 !important'); // comments
      expect(css).toContain('code.p');
      expect(css).toContain('#cbd5e1 !important'); // punctuation
    });

    it('injects light mode stylesheet allowing author CSS colors to display freely', () => {
      let createdStyle = null;
      const mockDoc = {
        head: { appendChild: (el) => { createdStyle = el; } },
        getElementById: () => null,
        createElement: () => ({ tagName: 'style', id: '', textContent: '' }),
        querySelectorAll: () => [],
        documentElement: { style: { setProperty: () => {} } },
        body: {
          style: { setProperty: () => {} },
          classList: { remove: () => {}, add: () => {} },
        },
      };

      applyThemeToDoc(mockDoc, 'light');

      const css = createdStyle.textContent;

      // In light mode, span and code must NOT be forced to #1e293b !important
      expect(css).not.toContain('span, li, blockquote, dd, dt, article, section, label, header, footer, nav, table, tbody, thead, tr, td, th, caption, pre, code');
      expect(css).not.toContain('code.kn, code.k, code.kd, code.kp, code.kr, code.kt, span.kn, span.k, span.kd, span.kp, span.kr, span.kt {\n      color: #0284c7 !important;');

      // Background color is white
      expect(css).toContain(`background-color: ${EPUB_THEMES.light.bg} !important`);
    });

    it('adapts inline colors in dark mode and restores them in light mode', () => {
      const mockElement = {
        style: {
          color: 'rgb(0, 102, 153)', // dark teal #006699
          setProperty(prop, val) { this[prop] = val; },
          removeProperty(prop) { delete this[prop]; },
        },
        getAttribute: () => null,
        dataset: {},
      };

      const mockDoc = {
        head: { appendChild: () => {} },
        getElementById: () => null,
        createElement: () => ({ tagName: 'style', id: '', textContent: '' }),
        querySelectorAll: (selector) => {
          if (selector.includes('[style*="color"]') || selector.includes('[data-orig-color]')) {
            return [mockElement];
          }
          return [];
        },
        documentElement: { style: { setProperty: () => {} } },
        body: {
          style: { setProperty: () => {} },
          classList: { remove: () => {}, add: () => {} },
        },
      };

      // Apply dark mode: should save original color and boost lightness
      applyThemeToDoc(mockDoc, 'dark');
      expect(mockElement.dataset.origColor).toBe('rgb(0, 102, 153)');
      expect(mockElement.style.color).toMatch(/hsl\(200,\s*100%,\s*65%\)/);

      // Apply light mode: should restore original color
      applyThemeToDoc(mockDoc, 'light');
      expect(mockElement.dataset.origColor).toBeUndefined();
      expect(mockElement.style.color).toBe('rgb(0, 102, 153)');
    });

    it('injects math and equation styling to override viewport units', () => {
      let createdStyle = null;
      const mockDoc = {
        head: { appendChild: (el) => { createdStyle = el; } },
        getElementById: () => null,
        createElement: () => ({ tagName: 'style', id: '', textContent: '' }),
        querySelectorAll: () => [],
        documentElement: { style: { setProperty: () => {} } },
        body: {
          style: { setProperty: () => {} },
          classList: { remove: () => {}, add: () => {} },
        },
      };

      applyThemeToDoc(mockDoc, 'dark');
      const darkCss = createdStyle.textContent;
      expect(darkCss).toContain('font-size: 1.15em !important;');
      expect(darkCss).toContain('div[data-type="equation"] math');

      applyThemeToDoc(mockDoc, 'light');
      const lightCss = createdStyle.textContent;
      expect(lightCss).toContain('font-size: 1.15em !important;');
      expect(lightCss).toContain('div[data-type="equation"] math');
    });

    it('injects high-contrast keycap styling for dark and light modes', () => {
      let createdStyle = null;
      const mockDoc = {
        head: { appendChild: (el) => { createdStyle = el; } },
        getElementById: () => null,
        createElement: () => ({ tagName: 'style', id: '', textContent: '' }),
        querySelectorAll: () => [],
        documentElement: { style: { setProperty: () => {} } },
        body: {
          style: { setProperty: () => {} },
          classList: { remove: () => {}, add: () => {} },
        },
      };

      applyThemeToDoc(mockDoc, 'dark');
      const darkCss = createdStyle.textContent;
      expect(darkCss).toContain('#sbo-rt-content .keycap');
      expect(darkCss).toContain('background-color: #1e293b !important;');
      expect(darkCss).toContain('color: #f8fafc !important;');

      applyThemeToDoc(mockDoc, 'light');
      const lightCss = createdStyle.textContent;
      expect(lightCss).toContain('#sbo-rt-content .keycap');
      expect(lightCss).toContain('background-color: #f1f5f9 !important;');
      expect(lightCss).toContain('color: #0f172a !important;');
    });
  });

  describe('fixEpubViewportUnits', () => {
    it('normalizes font size on MathML elements and clamps inline vw/vh styles', () => {
      const mockMath = {
        getAttribute: () => 'block',
        closest: () => null,
        style: {
          setProperty(prop, val) { this[prop] = val; },
        },
      };

      const mockVwEl = {
        getAttribute: (attr) => (attr === 'style' ? 'font-size: 5vw; width: 50vw' : null),
        style: {
          setProperty(prop, val) { this[prop] = val; },
        },
      };

      const mockDoc = {
        querySelectorAll: (selector) => {
          if (selector === 'math') return [mockMath];
          if (selector.includes('[style*="vw"]')) return [mockVwEl];
          return [];
        },
      };

      fixEpubViewportUnits(mockDoc);
      expect(mockMath.style['font-size']).toBe('1.15em');
      expect(mockMath.style['max-width']).toBe('100%');
      expect(mockVwEl.style['font-size']).toBe('1em');
      expect(mockVwEl.style['width']).toBe('100%');
    });
  });

  describe('EPUB Typography & Custom Font Stacks', () => {
    it('defines distinct offline-first font options', () => {
      expect(EPUB_FONTS.length).toBeGreaterThanOrEqual(6);
      const ids = EPUB_FONTS.map(f => f.id);
      expect(ids).toContain('default');
      expect(ids).toContain('georgia');
      expect(ids).toContain('palatino');
      expect(ids).toContain('charter');
      expect(ids).toContain('sans');
      expect(ids).toContain('monospace');
      expect(ids).toContain('accessible');
    });

    it('resolves correct font family css string or falls back to theme default', () => {
      const fallback = 'system-ui, sans-serif';
      expect(getFontFamilyCss('default', fallback)).toBe(fallback);
      expect(getFontFamilyCss(null, fallback)).toBe(fallback);
      expect(getFontFamilyCss('unknown_id', fallback)).toBe(fallback);

      const georgiaCss = getFontFamilyCss('georgia', fallback);
      expect(georgiaCss).toContain('Georgia');

      const sansCss = getFontFamilyCss('sans', fallback);
      expect(sansCss).toContain('system-ui');

      const monoCss = getFontFamilyCss('monospace', fallback);
      expect(monoCss).toContain('ui-monospace');
    });

    it('injects selected font into buildThemeCss while preserving monospace for code blocks', () => {
      const darkCfg = EPUB_THEMES.dark;
      const cssGeorgia = buildThemeCss('dark', darkCfg, 'georgia');

      expect(cssGeorgia).toContain('font-family: Georgia');
      // Code and pre elements must maintain ui-monospace
      expect(cssGeorgia).toContain('pre, pre *, code, code * {\n        font-family: ui-monospace');

      const sepiaCfg = EPUB_THEMES.sepia;
      const cssMono = buildThemeCss('sepia', sepiaCfg, 'monospace');
      expect(cssMono).toContain('font-family: ui-monospace');
    });

    it('applies custom font family directly to documentElement and body in applyThemeToDoc', () => {
      const mockStyleTag = { id: '', textContent: '' };
      const docElementStyles = {};
      const bodyStyles = {};
      const bodyClassList = new Set();

      const mockDoc = {
        getElementById: () => mockStyleTag,
        head: { appendChild: vi.fn() },
        documentElement: {
          style: {
            setProperty(prop, val) { docElementStyles[prop] = val; }
          }
        },
        body: {
          style: {
            setProperty(prop, val) { bodyStyles[prop] = val; }
          },
          classList: {
            remove: (cls) => bodyClassList.delete(cls),
            add: (cls) => bodyClassList.add(cls)
          }
        },
        querySelectorAll: () => [],
        readyState: 'complete'
      };

      applyThemeToDoc(mockDoc, 'dark', 'palatino');
      expect(docElementStyles['font-family']).toContain('Palatino');
      expect(bodyStyles['font-family']).toContain('Palatino');
      expect(mockStyleTag.textContent).toContain('Palatino');
    });
  });
});

