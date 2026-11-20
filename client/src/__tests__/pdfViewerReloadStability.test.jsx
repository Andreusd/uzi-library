import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import PdfViewer from '../components/PdfViewer';
import { I18nProvider } from '../i18n';
import * as pdfjsLib from 'pdfjs-dist';
import * as pdfPageUtils from '../utils/pdfPageUtils';

vi.mock('../services/offlineStorage', () => ({
  getOfflineBookArrayBuffer: vi.fn().mockResolvedValue(null),
  saveOfflineProgress: vi.fn().mockResolvedValue(null),
}));

vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  EventBus: class {
    on() {}
    off() {}
    dispatch() {}
  },
  PDFFindController: class {
    setDocument() {}
  },
  SimpleLinkService: class {
    setDocument() {}
    setPage() {}
    setNavigate() {}
  },
}));

vi.mock('pdfjs-dist/web/pdf_viewer.css', () => ({}));

vi.mock('pdfjs-dist', () => {
  const mockPage = {
    getViewport: vi.fn().mockReturnValue({ width: 600, height: 800 }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    getTextContent: vi.fn().mockResolvedValue({ items: [] }),
    getAnnotations: vi.fn().mockResolvedValue([]),
  };

  const mockDoc = {
    numPages: 50,
    fingerprints: ['doc_fp_test_123'],
    getPage: vi.fn().mockResolvedValue(mockPage),
    getOutline: vi.fn().mockResolvedValue([]),
  };

  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve(mockDoc),
      destroy: vi.fn(),
    }),
    TextLayer: vi.fn().mockImplementation(() => ({
      render: vi.fn().mockResolvedValue(),
      cancel: vi.fn(),
    })),
    AnnotationLayer: vi.fn().mockImplementation(() => ({
      render: vi.fn().mockResolvedValue(),
      cancel: vi.fn(),
    })),
  };
});

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

describe('PdfViewer stability and reload prevention during page flips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'ok', progress: {} }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not re-download PDF or clear page render cache when book progress updates on page flip', async () => {
    const clearCacheSpy = vi.spyOn(pdfPageUtils, 'clearPageRenderCache');
    const mockBook = {
      id: '19d8cb05bfd4bd6d',
      title: 'Designing Data-Intensive Applications',
      format: 'pdf',
      progress: { page: 10, total_pages: 50 },
    };

    const { rerender } = render(
      <PdfViewer
        book={mockBook}
        onClose={vi.fn()}
        onProgressUpdate={vi.fn()}
      />,
      { wrapper }
    );

    // Initial document load
    await waitFor(() => {
      expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    });

    clearCacheSpy.mockClear();

    // Simulate progress save updates in localStorage and parent state re-render
    localStorage.setItem(`book_page_${mockBook.id}`, '11');
    localStorage.setItem(`book_updated_at_${mockBook.id}`, new Date().toISOString());

    const updatedBook = {
      ...mockBook,
      progress: { page: 11, total_pages: 50 },
    };

    act(() => {
      rerender(
        <PdfViewer
          book={updatedBook}
          onClose={vi.fn()}
          onProgressUpdate={vi.fn()}
        />
      );
    });

    // Verify document was NOT re-downloaded and cache was NOT cleared
    expect(pdfjsLib.getDocument).toHaveBeenCalledTimes(1);
    expect(clearCacheSpy).not.toHaveBeenCalled();
  });
});
