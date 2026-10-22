/**
 * EPUB theme definitions, syntax highlighting, color adaptation,
 * and DOM iframe styling helpers.
 */

export const COLOR_HEX_MAP = {
  yellow: '#facc15',
  green: '#34d399',
  blue: '#38bdf8',
  purple: '#c084fc',
  rose: '#fb7185',
};

export const EPUB_THEMES = {
  dark: {
    bg: '#000000',
    text: '#e2e8f0',
    heading: '#f8fafc',
    link: '#fbbf24',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  light: {
    bg: '#ffffff',
    text: '#1e293b',
    heading: '#0f172a',
    link: '#d97706',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  sepia: {
    bg: '#fbf0d9',
    text: '#433422',
    heading: '#292014',
    link: '#b45309',
    fontFamily: 'Georgia, serif'
  }
};

/**
 * Intelligent color adaptation for dark mode.
 * Preserves hues while ensuring high contrast and legibility on dark backgrounds.
 */
export function adaptColorForDarkMode(colorStr, fallbackColor = '#e2e8f0') {
  if (!colorStr) return fallbackColor;
  const str = colorStr.trim().toLowerCase();

  if (str === 'transparent' || str === 'inherit' || str === 'initial') return str;
  if (str === '#fff' || str === '#ffffff' || str === 'white') return '#ffffff';

  let r = 0, g = 0, b = 0;

  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (str.startsWith('rgb')) {
    const match = str.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (match) {
      r = parseFloat(match[1]);
      g = parseFloat(match[2]);
      b = parseFloat(match[3]);
    }
  } else {
    const NAMED_DARK_COLORS = {
      black: '#e2e8f0',
      navy: '#60a5fa',
      darkblue: '#60a5fa',
      mediumblue: '#60a5fa',
      blue: '#38bdf8',
      darkgreen: '#4ade80',
      green: '#4ade80',
      teal: '#2dd4bf',
      darkcyan: '#2dd4bf',
      deepskyblue: '#38bdf8',
      darkred: '#f87171',
      maroon: '#f87171',
      red: '#f87171',
      purple: '#c084fc',
      indigo: '#c084fc',
      darkmagenta: '#f472b6',
      magenta: '#f472b6',
      darkorange: '#fb923c',
      saddlebrown: '#fb923c',
      sienna: '#fb923c',
      brown: '#fb923c',
      gray: '#94a3b8',
      dimgray: '#94a3b8',
      darkgray: '#94a3b8',
      darkslategray: '#94a3b8',
    };
    if (NAMED_DARK_COLORS[str]) {
      return NAMED_DARK_COLORS[str];
    }
    return str;
  }

  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  const d = max - min;
  const s = max === min ? 0 : (l > 0.5 ? d / (2 - max - min) : d / (max + min));

  // Grayscale / low saturation (black, dark grays)
  if (s < 0.18) {
    if (l < 0.5) {
      return fallbackColor;
    }
    return str;
  }

  // Colored text with low lightness on black background: boost lightness
  if (l < 0.48) {
    let h = 0;
    if (max === rf) {
      h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
    } else if (max === gf) {
      h = ((bf - rf) / d + 2) / 6;
    } else {
      h = ((rf - gf) / d + 4) / 6;
    }
    const targetL = Math.min(0.85, Math.max(0.65, l + 0.35));
    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(targetL * 100)}%)`;
  }

  return str;
}

/**
 * Scan document for inline colors and adapt them for dark mode contrast.
 */
export function adaptDocumentColorsForDarkMode(doc, fallbackColor = '#e2e8f0') {
  if (!doc) return;
  try {
    const coloredEls = doc.querySelectorAll('[style*="color"], font[color]');
    coloredEls.forEach(el => {
      if (!el.dataset.origColor) {
        el.dataset.origColor = el.style.color || el.getAttribute('color') || '';
      }
      const curColor = el.dataset.origColor;
      const adjusted = adaptColorForDarkMode(curColor, fallbackColor);
      if (adjusted && adjusted !== curColor) {
        el.style.setProperty('color', adjusted, 'important');
      }
    });
  } catch {}
}

/**
 * Revert any adapted inline colors when switching to light/sepia modes.
 */
export function restoreDocumentColors(doc) {
  if (!doc) return;
  try {
    const adaptedEls = doc.querySelectorAll('[data-orig-color]');
    adaptedEls.forEach(el => {
      if (el.dataset.origColor) {
        el.style.color = el.dataset.origColor;
      } else {
        el.style.removeProperty('color');
      }
      delete el.dataset.origColor;
    });
  } catch {}
}

/**
 * Tokenize plain unstyled code text into Pygments-compatible highlighted HTML.
 */
export function tokenizeCodeText(rawText) {
  if (!rawText) return '';

  const escapeHtml = (str) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const tokenRegex = /(f?"""[\s\S]*?"""|f?'''[\s\S]*?'''|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*')|(#.*$|\/\/.*$)|(@[a-zA-Z_]\w*)|(\b\d+(?:\.\d+)?\b)|(\b(?:from|import|def|class|return|if|elif|else|for|while|try|except|finally|with|as|async|await|yield|lambda|pass|break|continue|function|const|let|var|public|private|static|new|interface|implements|extends|typeof|instanceof|switch|case|default|throw)\b)|(\b(?:True|False|None|true|false|null|self|this|undefined|print|len|range|str|int|float|bool|list|dict|set|tuple|console|window|document)\b)|(\b[a-zA-Z_]\w*(?=\s*\())/gm;

  let lastIndex = 0;
  let html = '';
  let match;

  while ((match = tokenRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHtml(rawText.slice(lastIndex, match.index));
    }

    const [full, str, comment, decorator, num, keyword, builtin, fnCall] = match;

    if (str) {
      html += `<code class="s1">${escapeHtml(str)}</code>`;
    } else if (comment) {
      html += `<code class="c1">${escapeHtml(comment)}</code>`;
    } else if (decorator) {
      html += `<code class="nd">${escapeHtml(decorator)}</code>`;
    } else if (num) {
      html += `<code class="mi">${escapeHtml(num)}</code>`;
    } else if (keyword) {
      html += `<code class="kn">${escapeHtml(keyword)}</code>`;
    } else if (builtin) {
      html += `<code class="nb">${escapeHtml(builtin)}</code>`;
    } else if (fnCall) {
      html += `<code class="nf">${escapeHtml(fnCall)}</code>`;
    } else {
      html += escapeHtml(full);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    html += escapeHtml(rawText.slice(lastIndex));
  }

  return html;
}

/**
 * Highlight unstyled code blocks within the document.
 * If the code block already has syntax classes (e.g. .kn, .nn, etc.), it is untouched.
 */
export function highlightUnstyledCodeBlocks(doc) {
  if (!doc) return;
  try {
    const preElements = doc.querySelectorAll('pre');
    preElements.forEach(pre => {
      const code = pre.querySelector('code') || pre;
      if (code.getAttribute('data-syntax-highlighted')) return;
      if (code.querySelector('.kn, .nn, .nf, .s1, .c1, [class*="token"], [class*="hljs"]') || code.classList.length > 0) {
        code.setAttribute('data-syntax-highlighted', 'true');
        return;
      }

      const rawText = code.textContent;
      if (!rawText || rawText.trim().length < 5) return;

      const isCode = /^(import\s|from\s|def\s|class\s|const\s|let\s|var\s|function\s|#include|package\s|public\s|<\?php|\/\/|#\s)/m.test(rawText) ||
                     Boolean(pre.getAttribute('data-code-language')) ||
                     pre.className.includes('language') ||
                     code.className.includes('language');
      if (!isCode) return;

      const highlightedHtml = tokenizeCodeText(rawText);
      if (highlightedHtml) {
        code.innerHTML = highlightedHtml;
        code.setAttribute('data-syntax-highlighted', 'true');
      }
    });
  } catch {}
}

/**
 * Neutralize dangerous viewport units (vw, vh) that explode in epub.js paginated mode
 * where the iframe width expands across dozens of columns.
 */
export function fixEpubViewportUnits(doc) {
  if (!doc) return;
  try {
    // 1. Clamping MathML font size directly on elements
    const mathElements = doc.querySelectorAll('math');
    mathElements.forEach(mathEl => {
      const isInline = mathEl.getAttribute('display') !== 'block' && Boolean(mathEl.closest('p, li'));
      mathEl.style.setProperty('font-size', isInline ? '1em' : '1.15em', 'important');
      mathEl.style.setProperty('max-width', '100%', 'important');
    });

    // 2. Scan elements with inline styles using vw or vh units
    const styledWithVw = doc.querySelectorAll('[style*="vw"], [style*="vh"]');
    styledWithVw.forEach(el => {
      const inlineStyle = el.getAttribute('style') || '';
      if (/font-size\s*:\s*[^;]*(?:vw|vh)/i.test(inlineStyle)) {
        el.style.setProperty('font-size', '1em', 'important');
      }
      if (/max-width\s*:\s*[^;]*(?:vw|vh)/i.test(inlineStyle)) {
        el.style.setProperty('max-width', '100%', 'important');
      }
      if (/width\s*:\s*[^;]*(?:vw|vh)/i.test(inlineStyle)) {
        el.style.setProperty('width', '100%', 'important');
      }
    });
  } catch {}
}

/**
 * Build dedicated CSS stylesheet string for EPUB rendering based on theme.
 */
function buildThemeCss(themeName, cfg) {
  const isDark = themeName === 'dark';
  const isSepia = themeName === 'sepia';

  if (isDark) {
    return `
      html, body {
        background-color: ${cfg.bg} !important;
        color: ${cfg.text} !important;
        font-family: ${cfg.fontFamily} !important;
        line-height: 1.8 !important;
        margin: 0 !important;
        padding: 0 !important;
        font-weight: 400 !important;
      }
      *, *::before, *::after {
        box-sizing: border-box !important;
      }
      #book-content, #sbo-rt-content, .epub-container {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      div, p, li, blockquote, dd, dt, article, section, label, header, footer, nav, table, tbody, thead, tr, td, th, caption {
        background-color: transparent !important;
      }
      p:not([style*="color"]), li:not([style*="color"]), blockquote, dd, dt, article, section, label, td:not([style*="color"]), th:not([style*="color"]), caption {
        color: ${cfg.text} !important;
      }
      h1, h2, h3, h4, h5, h6 {
        color: ${cfg.heading} !important;
        font-weight: 600 !important;
        background-color: transparent !important;
      }
      a, a * {
        color: ${cfg.link} !important;
        text-decoration: underline !important;
      }
      img, svg {
        max-width: 100% !important;
        height: auto !important;
      }
      pre {
        background-color: transparent !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        overflow-x: auto !important;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        background-color: transparent !important;
      }
      :not(pre) > code {
        background-color: rgba(255, 255, 255, 0.1) !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        color: #38bdf8 !important;
      }

      /* Dark Mode Syntax Highlighting (Pygments, Highlight.js, Prism, O'Reilly) */
      code.kn, code.k, code.kd, code.kp, code.kr, code.kt, code.kc,
      span.kn, span.k, span.kd, span.kp, span.kr, span.kt, span.kc,
      .token.keyword, .hljs-keyword,
      code.keyword, span.keyword {
        color: #38bdf8 !important;
        font-weight: 600 !important;
      }
      code.nn, code.nc, code.ne, code.na,
      span.nn, span.nc, span.ne, span.na,
      .token.class-name, .hljs-title.class_,
      code.class, span.class {
        color: #67e8f9 !important;
        font-weight: 600 !important;
      }
      code.nf, code.fm, code.py,
      span.nf, span.fm, span.py,
      .token.function, .hljs-function, .hljs-title.function_,
      code.function, span.function {
        color: #c084fc !important;
      }
      code.s, code.s1, code.s2, code.sb, code.sc, code.sd, code.se, code.sh, code.si, code.sx, code.ss, code.sa, code.dl,
      span.s, span.s1, span.s2, span.sb, span.sc, span.sd, span.se, span.sh, span.si, span.sx, span.ss, span.sa, span.dl,
      .token.string, .hljs-string,
      code.string, span.string {
        color: #fb923c !important;
      }
      code.c, code.c1, code.cm, code.cp, code.cs, code.ch,
      span.c, span.c1, span.cm, span.cp, span.cs, span.ch,
      .token.comment, .hljs-comment,
      code.comment, span.comment {
        color: #94a3b8 !important;
        font-style: italic !important;
      }
      code.m, code.mf, code.mh, code.mi, code.mo, code.il,
      span.m, span.mf, span.mh, span.mi, span.mo, span.il,
      .token.number, .hljs-number,
      code.number, span.number {
        color: #facc15 !important;
      }
      code.nb, code.bp,
      span.nb, span.bp,
      .token.builtin, .hljs-built_in,
      code.builtin, span.builtin {
        color: #2dd4bf !important;
      }
      code.nd, span.nd,
      .token.decorator, .hljs-meta {
        color: #a78bfa !important;
        font-weight: 600 !important;
      }
      code.o, code.ow,
      span.o, span.ow,
      .token.operator, .hljs-operator,
      code.operator, span.operator {
        color: #93c5fd !important;
      }
      code.p, span.p,
      .token.punctuation, .hljs-punctuation,
      code.delimiter, span.delimiter {
        color: #cbd5e1 !important;
      }
      code.type, span.type, .token.type, .hljs-type, code.constant, span.constant, .token.constant {
        color: #4ade80 !important;
      }
      code.vm, span.vm {
        color: #2dd4bf !important;
      }
      code.n, code.nx, code.nv, code.vc, code.vg, code.vi,
      span.n, span.nx, span.nv, span.vc, span.vg, span.vi,
      .token.variable, .hljs-variable,
      code.identifier, span.identifier {
        color: #f1f5f9 !important;
      }
      code.err, code.gr, span.err, span.gr {
        color: #f87171 !important;
      }

      /* O'Reilly and author named color classes adapted for dark mode */
      .navy, code.navy, span.navy { color: #60a5fa !important; }
      .blue, code.blue, span.blue { color: #38bdf8 !important; }
      .green, .forestgreen, .darkgreen, code.green, code.forestgreen, code.darkgreen, span.green, span.forestgreen, span.darkgreen { color: #4ade80 !important; }
      .limegreen, code.limegreen, span.limegreen { color: #86efac !important; }
      .darkorange, .orangered, code.darkorange, code.orangered, span.darkorange, span.orangered { color: #fb923c !important; }
      .darkred, .red, .sienna, code.darkred, code.red, code.sienna, span.darkred, span.red, span.sienna { color: #f87171 !important; }
      .gold, .darkgoldenrod, code.gold, code.darkgoldenrod, span.gold, span.darkgoldenrod { color: #facc15 !important; }
      .salmon, code.salmon, span.salmon { color: #fca5a5 !important; }
      .steelblue, .royalblue, code.steelblue, code.royalblue, span.steelblue, span.royalblue { color: #60a5fa !important; }
      .purple, .indigo, code.purple, code.indigo, span.purple, span.indigo { color: #c084fc !important; }
      .deeppink, .magenta, .fuschia, code.deeppink, code.magenta, code.fuschia, span.deeppink, span.magenta, span.fuschia { color: #f472b6 !important; }
      .teal, .darkcyan, code.teal, code.darkcyan, span.teal, span.darkcyan { color: #2dd4bf !important; }
      .mediumslateblue, code.mediumslateblue, span.mediumslateblue { color: #a78bfa !important; }
      .chocolate, code.chocolate, span.chocolate { color: #fb923c !important; }
      .olive, code.olive, span.olive { color: #a3e635 !important; }

      /* O'Reilly semantic syntax classes */
      code.character, span.character { color: #a3e635 !important; }
      code.conditional, span.conditional { color: #86efac !important; }
      code.debug, span.debug { color: #f87171 !important; }
      code.define, span.define { color: #facc15 !important; }
      code.exception, span.exception { color: #fca5a5 !important; }
      code.float, span.float { color: #60a5fa !important; }
      code.include, span.include { color: #c084fc !important; }
      code.label, span.label { color: #f472b6 !important; }
      code.macro, span.macro { color: #fb923c !important; }
      code.preCondit, code.preProc, span.preCondit, span.preProc { color: #2dd4bf !important; }
      code.repeat, span.repeat { color: #c084fc !important; }
      code.special, code.specialchar, span.special, span.specialchar { color: #f472b6 !important; }
      code.specialcomment, span.specialcomment { color: #4ade80 !important; font-style: italic !important; }
      code.statement, span.statement { color: #4ade80 !important; }
      code.storageclass, span.storageclass { color: #e879f9 !important; }
      code.structure, span.structure { color: #fb923c !important; }

      /* Callouts, Notes, Warnings */
      div.warning h3, div[data-type="warning"] h6, div[data-type="caution"] h6, div[data-type="important"] h6 { color: #f87171 !important; }
      div.tip h3, div[data-type="tip"] h6 { color: #34d399 !important; }
      div.note h3, div[data-type="note"] h6 { color: #38bdf8 !important; }
      span.lineannotation { color: #f87171 !important; }

      /* MathML & Math Equations - Override dangerous viewport units (vw/vh) that blow up in epub.js paginated iframes */
      math,
      #sbo-rt-content math,
      div[data-type="equation"] math,
      div.equation math,
      .equation math,
      math[display="block"] {
        font-size: 1.15em !important;
        max-width: 100% !important;
        line-height: normal !important;
      }
      math[display="inline"],
      p math,
      li math {
        font-size: 1em !important;
      }
      math, math * {
        color: inherit !important;
      }
      div[data-type="equation"],
      div.equation,
      div.informalequation {
        max-width: 100% !important;
        overflow-x: auto !important;
      }

      /* Keyboard keys, shortcuts, and keycaps (e.g. CTRL-Z, CTRL-D) */
      kbd,
      .keycap,
      .keystroke,
      .keysym,
      .key,
      span.keycap,
      span.keystroke,
      #sbo-rt-content .keycap,
      #sbo-rt-content .keystroke {
        color: #f8fafc !important;
        background-color: #1e293b !important;
        border: 1px solid #475569 !important;
        border-radius: 4px !important;
        padding: 1px 5px !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        font-size: 0.85em !important;
        display: inline-block !important;
        line-height: normal !important;
        vertical-align: baseline !important;
      }
      span.boxedtext,
      #sbo-rt-content span.boxedtext {
        color: #f8fafc !important;
        border-color: #475569 !important;
      }
    `;
  }

  // Light or Sepia theme
  return `
    html, body {
      background-color: ${cfg.bg} !important;
      color: ${cfg.text} !important;
      font-family: ${cfg.fontFamily} !important;
      line-height: 1.8 !important;
      margin: 0 !important;
      padding: 0 !important;
      font-weight: 400 !important;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    #book-content, #sbo-rt-content, .epub-container {
      margin: 0 !important;
      padding: 0 !important;
      max-width: 100% !important;
    }
    div, p, li, blockquote, dd, dt, article, section, label, header, footer, nav, table, tbody, thead, tr, td, th, caption {
      background-color: transparent !important;
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${cfg.heading} !important;
      font-weight: 600 !important;
      background-color: transparent !important;
    }
    a, a * {
      color: ${cfg.link} !important;
      text-decoration: underline !important;
    }
    img, svg {
      max-width: 100% !important;
      height: auto !important;
    }
    pre {
      background-color: ${isSepia ? 'rgba(67, 52, 34, 0.06)' : 'rgba(0, 0, 0, 0.03)'} !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
      border-radius: 6px;
      padding: 12px 16px;
      overflow-x: auto !important;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
      background-color: transparent !important;
    }
    :not(pre) > code {
      background-color: ${isSepia ? 'rgba(67, 52, 34, 0.08)' : 'rgba(0, 0, 0, 0.05)'} !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      color: ${isSepia ? '#9333ea' : '#0284c7'};
    }

    /* Fallback syntax highlighting for light / sepia (applied if author stylesheet did not define them) */
    code.kn, code.k, code.kd, code.kp, code.kr, code.kt, span.kn, span.k, span.kd, span.kp, span.kr, span.kt {
      color: ${isSepia ? '#0369a1' : '#0284c7'};
      font-weight: 600;
    }
    code.nn, code.nc, code.ne, code.na, span.nn, span.nc, span.ne, span.na {
      color: ${isSepia ? '#0c4a6e' : '#0369a1'};
      font-weight: 600;
    }
    code.nf, code.fm, span.nf, span.fm {
      color: ${isSepia ? '#7e22ce' : '#9333ea'};
    }
    code.s, code.s1, code.s2, code.sb, code.sc, code.sd, span.s, span.s1, span.s2, span.sb, span.sc, span.sd {
      color: ${isSepia ? '#9a3412' : '#c2410c'};
    }
    code.c, code.c1, code.cm, code.cp, code.cs, span.c, span.c1, span.cm, span.cp, span.cs {
      color: ${isSepia ? '#78716c' : '#64748b'};
      font-style: italic;
    }
    code.m, code.mf, code.mh, code.mi, code.mo, span.m, span.mf, span.mh, span.mi, span.mo {
      color: ${isSepia ? '#854d0e' : '#b45309'};
    }
    code.nb, code.bp, span.nb, span.bp {
      color: ${isSepia ? '#115e59' : '#0f766e'};
    }
    code.nd, span.nd {
      color: ${isSepia ? '#6b21a8' : '#7c3aed'};
      font-weight: 600;
    }
    code.p, span.p {
      color: ${isSepia ? '#44403c' : '#334155'};
    }

    /* MathML & Math Equations - Override dangerous viewport units (vw/vh) that blow up in epub.js paginated iframes */
    math,
    #sbo-rt-content math,
    div[data-type="equation"] math,
    div.equation math,
    .equation math,
    math[display="block"] {
      font-size: 1.15em !important;
      max-width: 100% !important;
      line-height: normal !important;
    }
    math[display="inline"],
    p math,
    li math {
      font-size: 1em !important;
    }
    div[data-type="equation"],
    div.equation,
    div.informalequation {
      max-width: 100% !important;
      overflow-x: auto !important;
    }

    /* Keyboard keys, shortcuts, and keycaps */
    kbd,
    .keycap,
    .keystroke,
    .keysym,
    .key,
    span.keycap,
    span.keystroke,
    #sbo-rt-content .keycap,
    #sbo-rt-content .keystroke {
      color: ${isSepia ? '#292014' : '#0f172a'} !important;
      background-color: ${isSepia ? '#f4e6cd' : '#f1f5f9'} !important;
      border: 1px solid ${isSepia ? '#d4c3a3' : '#cbd5e1'} !important;
      border-radius: 4px !important;
      padding: 1px 5px !important;
      box-shadow: 0 1px 2px ${isSepia ? 'rgba(67, 52, 34, 0.12)' : 'rgba(0, 0, 0, 0.08)'} !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
      font-size: 0.85em !important;
      display: inline-block !important;
      line-height: normal !important;
      vertical-align: baseline !important;
    }
    span.boxedtext,
    #sbo-rt-content span.boxedtext {
      color: ${isSepia ? '#292014' : '#0f172a'} !important;
      border-color: ${isSepia ? '#d4c3a3' : '#cbd5e1'} !important;
    }
  `;
}

export const applyThemeToDoc = (doc, themeName) => {
  if (!doc) return;
  const cfg = EPUB_THEMES[themeName] || EPUB_THEMES.dark;
  const isDark = themeName === 'dark';

  // Remove any conflicting epubjs theme style tags
  try {
    const existingEpubStyles = doc.querySelectorAll(
      '#epubjs-inserted-css-dark, #epubjs-inserted-css-light, #epubjs-inserted-css-sepia, #epubjs-inserted-css-default'
    );
    existingEpubStyles.forEach(el => el.remove());
  } catch {}

  // Create or update dedicated custom theme style element
  let styleTag = doc.getElementById('epub-custom-theme-style');
  if (!styleTag) {
    styleTag = doc.createElement('style');
    styleTag.id = 'epub-custom-theme-style';
    doc.head?.appendChild(styleTag);
  }

  styleTag.textContent = buildThemeCss(themeName, cfg);

  // Direct element-level properties for instant consistency
  try {
    if (doc.documentElement) {
      doc.documentElement.style.setProperty('background-color', cfg.bg, 'important');
      doc.documentElement.style.setProperty('color', cfg.text, 'important');
    }
    if (doc.body) {
      doc.body.style.setProperty('background-color', cfg.bg, 'important');
      doc.body.style.setProperty('color', cfg.text, 'important');
      doc.body.classList.remove('dark', 'light', 'sepia');
      doc.body.classList.add(themeName);
    }
  } catch {}

  // DOM Enhancements: color contrast adaptation, unstyled code tokenization, and viewport unit fixes
  const runDomEnhancements = () => {
    try {
      if (isDark) {
        adaptDocumentColorsForDarkMode(doc, cfg.text);
      } else {
        restoreDocumentColors(doc);
      }
      highlightUnstyledCodeBlocks(doc);
      fixEpubViewportUnits(doc);
    } catch {}
  };

  runDomEnhancements();
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', runDomEnhancements, { once: true });
  }
};
