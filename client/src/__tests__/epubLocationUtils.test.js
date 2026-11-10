import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEffectiveProgress,
  getInitialCfi,
  getInitialPage,
  getInitialPercent,
  getInitialTotalPages,
  findChapterLabel
} from '../utils/epubLocationUtils';

describe('epubLocationUtils - Progress & Reload Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns server progress when local storage has nothing', () => {
    const book = {
      id: 'book123',
      progress: {
        cfi: 'epubcfi(/6/14[ch07]!/4/2/1:0)',
        page: 163,
        percent: 27,
        total_pages: 608,
        updated_at: '2026-11-10T10:00:00.000Z'
      }
    };

    expect(getInitialCfi(book)).toBe('epubcfi(/6/14[ch07]!/4/2/1:0)');
    expect(getInitialPage(book)).toBe(163);
    expect(getInitialPercent(book)).toBe(27);
    expect(getInitialTotalPages(book)).toBe(608);
  });

  it('prefers local progress when local storage has newer progress on tab refresh', () => {
    const book = {
      id: 'book123',
      progress: {
        cfi: 'epubcfi(/6/14[ch07]!/4/2/1:0)', // Stale page 163
        page: 163,
        percent: 27,
        total_pages: 608,
        updated_at: '2026-11-10T10:00:00.000Z'
      }
    };

    // User flipped to page 165 right before reload
    localStorage.setItem('book_cfi_book123', 'epubcfi(/6/14[ch07]!/4/6/1:0)');
    localStorage.setItem('book_page_book123', '165');
    localStorage.setItem('book_percent_book123', '27.5');
    localStorage.setItem('book_total_pages_book123', '608');
    localStorage.setItem('book_updated_at_book123', '2026-11-10T10:01:00.000Z');

    const effective = getEffectiveProgress(book);
    expect(effective.page).toBe(165);
    expect(effective.cfi).toBe('epubcfi(/6/14[ch07]!/4/6/1:0)');
    expect(effective.percent).toBe(27.5);
    expect(effective.totalPages).toBe(608);

    expect(getInitialCfi(book)).toBe('epubcfi(/6/14[ch07]!/4/6/1:0)');
    expect(getInitialPage(book)).toBe(165);
    expect(getInitialPercent(book)).toBe(27.5);
    expect(getInitialTotalPages(book)).toBe(608);
  });

  it('prefers server progress when another device read further ahead (newer server timestamp)', () => {
    const book = {
      id: 'book123',
      progress: {
        cfi: 'epubcfi(/6/20[ch10]!/4/2/1:0)',
        page: 250,
        percent: 41,
        total_pages: 608,
        updated_at: '2026-11-10T12:00:00.000Z' // Newer on phone
      }
    };

    // Stale local storage from previous session
    localStorage.setItem('book_cfi_book123', 'epubcfi(/6/14[ch07]!/4/6/1:0)');
    localStorage.setItem('book_page_book123', '165');
    localStorage.setItem('book_percent_book123', '27.5');
    localStorage.setItem('book_total_pages_book123', '608');
    localStorage.setItem('book_updated_at_book123', '2026-11-10T10:00:00.000Z');

    const effective = getEffectiveProgress(book);
    expect(effective.page).toBe(250);
    expect(effective.cfi).toBe('epubcfi(/6/20[ch10]!/4/2/1:0)');
    expect(effective.percent).toBe(41);
    expect(effective.totalPages).toBe(608);
  });

  it('prefers local progress when local page > server page and no timestamps present', () => {
    const book = {
      id: 'book123',
      progress: {
        cfi: 'epubcfi(/6/14[ch07]!/4/2/1:0)',
        page: 163,
        percent: 27,
      }
    };

    localStorage.setItem('book_cfi_book123', 'epubcfi(/6/14[ch07]!/4/6/1:0)');
    localStorage.setItem('book_page_book123', '165');
    localStorage.setItem('book_percent_book123', '27.5');

    expect(getInitialPage(book)).toBe(165);
    expect(getInitialCfi(book)).toBe('epubcfi(/6/14[ch07]!/4/6/1:0)');
  });

  it('handles null or invalid book gracefully', () => {
    expect(getInitialCfi(null)).toBeNull();
    expect(getInitialPage(null)).toBe(1);
    expect(getInitialPercent(null)).toBe(0);
    expect(getInitialTotalPages(null)).toBe(0);

    expect(getInitialCfi({})).toBeNull();
    expect(getInitialPage({})).toBe(1);
  });

  it('findChapterLabel resolves labels from flat and nested TOCs', () => {
    const toc = [
      { href: 'text/ch001.xhtml', label: 'Capítulo 1' },
      {
        href: 'text/ch002.xhtml',
        label: 'Capítulo 2',
        subitems: [
          { href: 'text/ch002.xhtml#sub1', label: 'Seção 2.1' }
        ]
      }
    ];

    expect(findChapterLabel(toc, 'text/ch001.xhtml')).toBe('Capítulo 1');
    expect(findChapterLabel(toc, 'text/ch002.xhtml#sub1')).toBe('Seção 2.1');
    expect(findChapterLabel(toc, 'text/unknown.xhtml')).toBe('');
    expect(findChapterLabel(null, 'text/ch001.xhtml')).toBe('');
  });
});
