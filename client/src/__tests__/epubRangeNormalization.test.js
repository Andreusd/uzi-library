import { describe, it, expect } from 'vitest';
import { normalizeRangeToTextNodes, sanitizeCfiRange } from '../utils/epubLocationUtils';

describe('EPUB Range Normalization & CFI Sanitization', () => {
  it('normalizes DOM Range when startContainer and endContainer are Element nodes (paragraph selection)', () => {
    // Simulate <p>Um sistema com IA dentro precisa se defender da própria IA.</p>
    const p = document.createElement('p');
    const textNode = document.createTextNode('Um sistema com IA dentro precisa se defender da própria IA.');
    p.appendChild(textNode);
    document.body.appendChild(p);

    // When triple-clicking or selecting entire paragraph, browser creates Range on element:
    const range = document.createRange();
    range.setStart(p, 0); // before child 0
    range.setEnd(p, 1);   // after child 0

    expect(range.startContainer.nodeType).toBe(Node.ELEMENT_NODE);
    expect(range.endContainer.nodeType).toBe(Node.ELEMENT_NODE);
    expect(range.startOffset).toBe(0);
    expect(range.endOffset).toBe(1);

    const normalized = normalizeRangeToTextNodes(range, document);

    // Should normalize to TextNode with true character offsets!
    expect(normalized.startContainer.nodeType).toBe(Node.TEXT_NODE);
    expect(normalized.endContainer.nodeType).toBe(Node.TEXT_NODE);
    expect(normalized.startContainer).toBe(textNode);
    expect(normalized.endContainer).toBe(textNode);
    expect(normalized.startOffset).toBe(0);
    expect(normalized.endOffset).toBe(59);

    document.body.removeChild(p);
  });

  it('preserves Range when containers are already TextNodes', () => {
    const textNode = document.createTextNode('Texto de teste');
    document.body.appendChild(textNode);

    const range = document.createRange();
    range.setStart(textNode, 2);
    range.setEnd(textNode, 8);

    const normalized = normalizeRangeToTextNodes(range, document);
    expect(normalized.startContainer).toBe(textNode);
    expect(normalized.endContainer).toBe(textNode);
    expect(normalized.startOffset).toBe(2);
    expect(normalized.endOffset).toBe(8);

    document.body.removeChild(textNode);
  });

  it('sanitizes 1-character bug CFI when text is longer', () => {
    const buggyCfi = 'epubcfi(/6/24!/4/2[sec-ch07]/24[zero-e-nada]/22[engenharia-defensiva]/12/2,/1:0,/1:1)';
    const text = 'Um sistema com IA dentro precisa se defender da própria IA.';

    const sanitized = sanitizeCfiRange(buggyCfi, text);
    expect(sanitized).toBe('epubcfi(/6/24!/4/2[sec-ch07]/24[zero-e-nada]/22[engenharia-defensiva]/12/2,/1:0,/1:59)');
  });

  it('leaves correct multi-character CFIs untouched', () => {
    const validCfi = 'epubcfi(/6/14!/4/2[sec-ch02]/18/14/10,/1:77,/1:225)';
    const text = 'O agente esquece...';

    const sanitized = sanitizeCfiRange(validCfi, text);
    expect(sanitized).toBe(validCfi);
  });

  it('handles single-character selections legitimately', () => {
    const singleCharCfi = 'epubcfi(/6/2!/4/2,/1:0,/1:1)';
    const text = 'A';

    const sanitized = sanitizeCfiRange(singleCharCfi, text);
    expect(sanitized).toBe(singleCharCfi);
  });
});
