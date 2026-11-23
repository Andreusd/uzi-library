import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarkdownRenderer, { tokenizeInline, parseMarkdownBlocks } from '../components/MarkdownRenderer';

describe('MarkdownRenderer component', () => {
  it('renders nothing when content is empty', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders headings (H1, H2, H3, H4) without literal # symbols', () => {
    const markdown = `# Title 1\n## Title 2\n### 1. What is it?\n#### Detail point`;
    render(<MarkdownRenderer content={markdown} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Title 1');

    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2).toHaveTextContent('Title 2');

    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3).toHaveTextContent('1. What is it?');

    const h4 = screen.getByRole('heading', { level: 4 });
    expect(h4).toHaveTextContent('Detail point');

    // Ensure raw ### tags are not visible
    expect(screen.queryByText(/###/)).not.toBeInTheDocument();
  });

  it('renders the exact markdown snippet from user screenshot correctly', () => {
    const screenshotText = `Based on the text snippet provided, the **Ryzen AI Max+ 395** refers to a high-performance computer processor.

Here is a breakdown of what it is:

### 1. What is it? AMD Processor:
It is part of AMD upcoming lineup.

### 2. Key Features: Local AI Execution:
It includes a powerful NPU.`;

    render(<MarkdownRenderer content={screenshotText} />);

    expect(screen.getByRole('heading', { level: 3, name: /1\. What is it\? AMD Processor:/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /2\. Key Features: Local AI Execution:/i })).toBeInTheDocument();
    expect(screen.getByText(/Ryzen AI Max\+ 395/i)).toBeInTheDocument();
    expect(screen.queryByText(/###/)).not.toBeInTheDocument();
  });

  it('renders unordered and ordered lists', () => {
    const md = `- Item A\n- Item B\n\n1. First\n2. Second`;
    render(<MarkdownRenderer content={md} />);

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders blockquote and horizontal rule', () => {
    const md = `> This is a quote\n\n---`;
    const { container } = render(<MarkdownRenderer content={md} />);

    expect(screen.getByText('This is a quote')).toBeInTheDocument();
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(container.querySelector('hr')).toBeInTheDocument();
  });

  it('renders markdown tables', () => {
    const md = `| Column 1 | Column 2 |\n| --- | --- |\n| Value A | Value B |`;
    render(<MarkdownRenderer content={md} />);

    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('Column 2')).toBeInTheDocument();
    expect(screen.getByText('Value A')).toBeInTheDocument();
    expect(screen.getByText('Value B')).toBeInTheDocument();
  });

  it('renders code blocks with copy button', () => {
    const md = "```javascript\nconst x = 42;\n```";
    render(<MarkdownRenderer content={md} />);

    expect(screen.getByText(/javascript/i)).toBeInTheDocument();
    expect(screen.getByText('const x = 42;')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();
  });

  it('renders inline formatting: bold, italic, bold-italic, code, del, links', () => {
    const md = `Test **bold**, *italic*, ***bold-italic***, \`inline code\`, ~~strike~~, and [Google](https://google.com).`;
    render(<MarkdownRenderer content={md} />);

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('bold-italic').tagName).toBe('STRONG');
    expect(screen.getByText('inline code').tagName).toBe('CODE');
    expect(screen.getByText('strike').tagName).toBe('DEL');

    const link = screen.getByRole('link', { name: 'Google' });
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
