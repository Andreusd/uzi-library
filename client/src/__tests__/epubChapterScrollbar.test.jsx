import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import EpubChapterScrollbar from '../components/EpubChapterScrollbar';

describe('EpubChapterScrollbar', () => {
  let mockViewerRef;
  let mockContainer;

  beforeEach(() => {
    mockContainer = {
      clientHeight: 500,
      scrollHeight: 2000,
      scrollTop: 300,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockViewerRef = {
      current: {
        querySelector: vi.fn((sel) => (sel === '.epub-container' ? mockContainer : null)),
        clientHeight: 500,
        scrollHeight: 2000,
        scrollTop: 300,
      },
    };
  });

  it('renders nothing when chapterScrollModeEnabled is false', () => {
    const { container } = render(
      <EpubChapterScrollbar
        viewerRef={mockViewerRef}
        chapterScrollModeEnabled={false}
        theme="dark"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders scrollbar attached to viewport edge when chapterScrollModeEnabled is true', () => {
    const { container } = render(
      <EpubChapterScrollbar
        viewerRef={mockViewerRef}
        chapterScrollModeEnabled={true}
        theme="dark"
      />
    );
    const scrollbar = container.querySelector('[aria-hidden="true"]');
    expect(scrollbar).toBeTruthy();
    expect(scrollbar.className).toContain('fixed');
    expect(scrollbar.className).toContain('right-1');
  });

  it('matches dark theme styles with sleek natural thumb', () => {
    const { container } = render(
      <EpubChapterScrollbar
        viewerRef={mockViewerRef}
        chapterScrollModeEnabled={true}
        theme="dark"
      />
    );
    const thumb = container.querySelector('[aria-hidden="true"] > div');
    expect(thumb.className).toContain('bg-neutral-400/50');
  });

  it('matches sepia theme styles with warm brown thumb', () => {
    const { container } = render(
      <EpubChapterScrollbar
        viewerRef={mockViewerRef}
        chapterScrollModeEnabled={true}
        theme="sepia"
      />
    );
    const thumb = container.querySelector('[aria-hidden="true"] > div');
    expect(thumb.className).toContain('bg-[#8c6b4f]/45');
  });

  it('matches light theme styles with neutral thumb', () => {
    const { container } = render(
      <EpubChapterScrollbar
        viewerRef={mockViewerRef}
        chapterScrollModeEnabled={true}
        theme="light"
      />
    );
    const thumb = container.querySelector('[aria-hidden="true"] > div');
    expect(thumb.className).toContain('bg-neutral-500/40');
  });
});
