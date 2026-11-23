import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

/**
 * Tokenizes inline markdown:
 * - Inline code: `code`
 * - Bold + Italic: ***text*** or ___text___
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Strikethrough: ~~text~~
 * - Links: [label](url)
 */
export function tokenizeInline(text) {
  if (!text) return [];
  const tokens = [];
  const tokenRegex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|\*(?!\s)[^*]+(?<!\s)\*|_(?!\s)[^_]+(?<!\s)_)/g;

  let lastIndex = 0;
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) });
    } else if ((raw.startsWith('***') && raw.endsWith('***')) || (raw.startsWith('___') && raw.endsWith('___'))) {
      tokens.push({ type: 'bold-italic', value: raw.slice(3, -3) });
    } else if ((raw.startsWith('**') && raw.endsWith('**')) || (raw.startsWith('__') && raw.endsWith('__'))) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('~~') && raw.endsWith('~~')) {
      tokens.push({ type: 'del', value: raw.slice(2, -2) });
    } else if (raw.startsWith('[') && raw.includes('](') && raw.endsWith(')')) {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push({ type: 'link', text: linkMatch[1], href: linkMatch[2] });
      } else {
        tokens.push({ type: 'text', value: raw });
      }
    } else if ((raw.startsWith('*') && raw.endsWith('*')) || (raw.startsWith('_') && raw.endsWith('_'))) {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: 'text', value: raw });
    }
    lastIndex = match.index + raw.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return tokens;
}

export function InlineMarkdown({ text }) {
  if (!text) return null;
  const tokens = tokenizeInline(text);
  return (
    <>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'code':
            return (
              <code key={idx} className="px-1.5 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono text-[11px]">
                {token.value}
              </code>
            );
          case 'bold-italic':
            return (
              <strong key={idx} className="font-semibold italic text-neutral-100">
                {token.value}
              </strong>
            );
          case 'bold':
            return (
              <strong key={idx} className="font-semibold text-neutral-100">
                {token.value}
              </strong>
            );
          case 'italic':
            return (
              <em key={idx} className="italic text-neutral-300">
                {token.value}
              </em>
            );
          case 'del':
            return (
              <del key={idx} className="line-through text-neutral-400">
                {token.value}
              </del>
            );
          case 'link':
            return (
              <a
                key={idx}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 underline hover:text-amber-300 transition-colors"
              >
                {token.text}
              </a>
            );
          default:
            return token.value;
        }
      })}
    </>
  );
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden font-mono text-[11px] shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400 font-semibold uppercase">
        <span>{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
          title="Copiar código"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copiar</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-neutral-200 leading-normal">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MarkdownTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto my-2.5 rounded-lg border border-neutral-800">
      <table className="w-full text-[11px] text-left border-collapse">
        {headers && headers.length > 0 && (
          <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-200 font-semibold">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-1.5 font-semibold">
                  <InlineMarkdown text={h} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-neutral-850">
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-neutral-900/40">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3 py-1.5 text-neutral-300">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heading({ level, text }) {
  switch (level) {
    case 1:
      return (
        <h1 className="text-sm font-bold text-amber-300 mt-3 mb-1.5 pb-1 border-b border-neutral-800 tracking-tight">
          <InlineMarkdown text={text} />
        </h1>
      );
    case 2:
      return (
        <h2 className="text-[13px] font-semibold text-amber-400 mt-2.5 mb-1 pb-0.5 border-b border-neutral-800/60">
          <InlineMarkdown text={text} />
        </h2>
      );
    case 3:
      return (
        <h3 className="text-xs font-semibold text-neutral-100 mt-2 mb-1">
          <InlineMarkdown text={text} />
        </h3>
      );
    default:
      return (
        <h4 className="text-xs font-medium text-neutral-200 mt-1.5 mb-0.5">
          <InlineMarkdown text={text} />
        </h4>
      );
  }
}

export function parseMarkdownBlocks(content) {
  if (!content) return [];
  const tokens = [];

  // Separate code blocks
  let remaining = content;
  const sections = [];
  while (true) {
    const startIdx = remaining.indexOf('```');
    if (startIdx === -1) {
      if (remaining) sections.push({ type: 'text', content: remaining });
      break;
    }
    if (startIdx > 0) {
      sections.push({ type: 'text', content: remaining.slice(0, startIdx) });
    }
    const endIdx = remaining.indexOf('```', startIdx + 3);
    if (endIdx === -1) {
      // Unclosed code block (e.g. while streaming)
      sections.push({ type: 'code', content: remaining.slice(startIdx + 3) });
      break;
    } else {
      sections.push({ type: 'code', content: remaining.slice(startIdx + 3, endIdx) });
      remaining = remaining.slice(endIdx + 3);
    }
  }

  for (const sec of sections) {
    if (sec.type === 'code') {
      const inner = sec.content;
      const firstNewline = inner.indexOf('\n');
      let lang = '';
      let code = inner;
      if (firstNewline !== -1) {
        const potentialLang = inner.slice(0, firstNewline).trim();
        if (potentialLang && !potentialLang.includes(' ')) {
          lang = potentialLang;
          code = inner.slice(firstNewline + 1);
        }
      }
      tokens.push({ type: 'code', lang, code: code.replace(/\r\n/g, '\n').trimEnd() });
      continue;
    }

    const lines = sec.content.replace(/\r\n/g, '\n').split('\n');
    let currentList = null;
    let currentQuote = null;
    let currentParagraph = [];
    let tableLines = [];

    function flushParagraph() {
      if (currentParagraph.length > 0) {
        tokens.push({ type: 'paragraph', text: currentParagraph.join(' ') });
        currentParagraph = [];
      }
    }
    function flushList() {
      if (currentList) {
        tokens.push(currentList);
        currentList = null;
      }
    }
    function flushQuote() {
      if (currentQuote) {
        tokens.push(currentQuote);
        currentQuote = null;
      }
    }
    function flushTable() {
      if (tableLines.length >= 2) {
        const headerLine = tableLines[0].trim();
        const headers = headerLine.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        const rows = [];
        for (let i = 2; i < tableLines.length; i++) {
          const rowLine = tableLines[i].trim();
          if (!rowLine) continue;
          rows.push(rowLine.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
        }
        tokens.push({ type: 'table', headers, rows });
      } else if (tableLines.length > 0) {
        for (const tl of tableLines) currentParagraph.push(tl);
        flushParagraph();
      }
      tableLines = [];
    }
    function flushAll() {
      flushTable();
      flushParagraph();
      flushList();
      flushQuote();
    }

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const trimmed = line.trim();

      if (!trimmed) {
        flushAll();
        continue;
      }

      // Check table row
      if (trimmed.startsWith('|') && trimmed.includes('|', 1)) {
        flushParagraph();
        flushList();
        flushQuote();
        tableLines.push(trimmed);
        continue;
      } else if (tableLines.length > 0) {
        flushTable();
      }

      // Headings: # to ######
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        flushAll();
        tokens.push({
          type: 'heading',
          level: headingMatch[1].length,
          text: headingMatch[2].trim()
        });
        continue;
      }

      // Horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushAll();
        tokens.push({ type: 'hr' });
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('>')) {
        flushParagraph();
        flushList();
        const quoteText = trimmed.replace(/^>\s*/, '');
        if (!currentQuote) {
          currentQuote = { type: 'blockquote', lines: [quoteText] };
        } else {
          currentQuote.lines.push(quoteText);
        }
        continue;
      } else {
        flushQuote();
      }

      // Unordered list
      const ulMatch = trimmed.match(/^([-*+])\s+(.*)$/);
      if (ulMatch) {
        flushParagraph();
        if (!currentList || currentList.type !== 'ul') {
          flushList();
          currentList = { type: 'ul', items: [ulMatch[2]] };
        } else {
          currentList.items.push(ulMatch[2]);
        }
        continue;
      }

      // Ordered list
      const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (olMatch) {
        flushParagraph();
        if (!currentList || currentList.type !== 'ol') {
          flushList();
          currentList = { type: 'ol', items: [olMatch[2]] };
        } else {
          currentList.items.push(olMatch[2]);
        }
        continue;
      }

      // Paragraph line continuation
      currentParagraph.push(trimmed);
    }
    flushAll();
  }
  return tokens;
}

export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={`space-y-2 text-xs leading-relaxed break-words select-text ${className}`}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return <Heading key={idx} level={block.level} text={block.text} />;
          case 'paragraph':
            return (
              <p key={idx} className="text-neutral-200">
                <InlineMarkdown text={block.text} />
              </p>
            );
          case 'code':
            return <CodeBlock key={idx} lang={block.lang} code={block.code} />;
          case 'table':
            return <MarkdownTable key={idx} headers={block.headers} rows={block.rows} />;
          case 'blockquote':
            return (
              <blockquote key={idx} className="border-l-2 border-amber-500/60 pl-3 py-1 my-2 text-neutral-300 italic bg-amber-500/5 rounded-r text-xs space-y-1">
                {block.lines.map((l, i) => (
                  <p key={i}>
                    <InlineMarkdown text={l} />
                  </p>
                ))}
              </blockquote>
            );
          case 'ul':
            return (
              <ul key={idx} className="list-disc list-outside space-y-1 pl-4 my-1.5 text-neutral-200">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx}>
                    <InlineMarkdown text={item} />
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="list-decimal list-outside space-y-1 pl-4 my-1.5 text-neutral-200">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx}>
                    <InlineMarkdown text={item} />
                  </li>
                ))}
              </ol>
            );
          case 'hr':
            return <hr key={idx} className="my-2.5 border-neutral-800" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
