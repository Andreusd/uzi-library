import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import EpubViewer from '../components/EpubViewer';

// Mock epubjs
vi.mock('epubjs', () => {
  return {
    default: vi.fn(() => {
      const mockRendition = {
        display: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        themes: {
          select: vi.fn(),
          fontSize: vi.fn(),
          register: vi.fn(),
        },
        hooks: {
          content: {
            register: vi.fn(),
          },
        },
        destroy: vi.fn(),
        resize: vi.fn(),
        currentLocation: vi.fn().mockReturnValue({ start: { cfi: 'epubcfi(/6/2)' } }),
      };

      return {
        renderTo: vi.fn().mockReturnValue(mockRendition),
        ready: Promise.resolve(),
        loaded: {
          navigation: Promise.resolve({ toc: [] }),
          metadata: Promise.resolve({ title: 'Test EPUB' }),
        },
        locations: {
          generate: vi.fn().mockResolvedValue([]),
          total: 100,
          length: vi.fn().mockReturnValue(100),
          save: vi.fn().mockReturnValue('mock-locations'),
          load: vi.fn(),
          cfiFromPercentage: vi.fn(),
          percentageFromCfi: vi.fn().mockReturnValue(0.2),
          locationFromCfi: vi.fn().mockReturnValue(20),
        },
        spine: {
          items: [],
          get: vi.fn(),
        },
        destroy: vi.fn(),
      };
    }),
    EpubCFI: vi.fn(),
  };
});

describe('EpubViewer component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('/api/epub/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ status: 'ok', annotations: [], progress: {} }),
      });
    }));
  });

  it('mounts without throwing ReferenceError for handleKeyDownRef or fontSizeRef', async () => {
    const mockBook = {
      id: 99,
      title: 'How to Solve It',
      author: 'George Polya',
      format: 'epub',
      progress: {
        cfi: 'epubcfi(/6/2[cover]!/4/1:0)',
        percent: 15,
      },
    };

    render(
      <I18nProvider>
        <EpubViewer book={mockBook} onClose={vi.fn()} onProgressUpdate={vi.fn()} />
      </I18nProvider>
    );

    // Book title should be visible in the viewer header
    expect(screen.getByText('How to Solve It')).toBeInTheDocument();

    // Verify it doesn't display the error fallback screen with "handleKeyDownRef is not defined"
    await waitFor(() => {
      expect(screen.queryByText(/handleKeyDownRef is not defined/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Unable to Open EPUB/i)).not.toBeInTheDocument();
    });
  });

  it('renders bottom progress bar smoothly based on page progress', async () => {
    const mockBook = {
      id: 101,
      title: 'Progress Bar Test Book',
      format: 'epub',
      progress: {
        page: 5,
        total_pages: 100,
        percent: 5,
      },
    };

    const { container } = render(
      <I18nProvider>
        <EpubViewer book={mockBook} onClose={vi.fn()} onProgressUpdate={vi.fn()} />
      </I18nProvider>
    );

    await waitFor(() => {
      const progressBar = container.querySelector('footer div.bg-amber-500');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar.style.width).toMatch(/%$/);
      const widthVal = parseFloat(progressBar.style.width);
      expect(widthVal).toBeGreaterThanOrEqual(5);
    });
  });
});
