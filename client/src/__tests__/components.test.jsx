import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShelfIcon from '../components/ShelfIcon';
import FolderCard from '../components/FolderCard';
import Reader from '../components/Reader';
import AppNavbar from '../components/AppNavbar';
import LibraryHome from '../components/LibraryHome';
import LibraryContent from '../components/LibraryContent';
import ShelfHeader from '../components/ShelfHeader';
import { I18nProvider } from '../i18n';
import { SettingsProvider } from '../contexts/SettingsContext.jsx';

// Mock EpubViewer and PdfViewer to test Reader format routing cleanly
vi.mock('../components/EpubViewer', () => ({
  default: (props) => (
    <div data-testid="mock-epub-viewer">
      <span>EPUB: {props.book?.title}</span>
      <span>Extension: {String(props.showFileExtension)}</span>
    </div>
  ),
}));

vi.mock('../components/PdfViewer', () => ({
  default: (props) => (
    <div data-testid="mock-pdf-viewer">
      <span>PDF: {props.book?.title}</span>
      <span>Extension: {String(props.showFileExtension)}</span>
    </div>
  ),
}));

describe('ShelfIcon component', () => {
  it('renders standard icon from ICON_MAP', () => {
    const { container } = render(<ShelfIcon icon="Brain" className="test-brain-class" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('test-brain-class');
  });

  it('falls back to default Folder icon for unknown icon name', () => {
    const { container } = render(<ShelfIcon icon="NonExistentIconName123" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('FolderCard component', () => {
  const mockFolder = {
    id: 'Science-Fiction',
    name: 'Science Fiction',
    icon: 'Rocket',
    book_count: 5,
  };

  const renderFolderCard = (props = {}) => {
    return render(
      <I18nProvider>
        <FolderCard folder={mockFolder} {...props} />
      </I18nProvider>
    );
  };

  it('renders folder name and book count', () => {
    renderFolderCard({ covers: ['/cover1.webp'] });
    expect(screen.getByText('Science Fiction')).toBeInTheDocument();
    expect(screen.getByText(/5 books/i)).toBeInTheDocument();
  });

  it('renders empty state placeholder when no covers available', () => {
    renderFolderCard({ covers: [] });
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('renders single cover correctly', () => {
    const { container } = renderFolderCard({ covers: ['/cover1.webp'] });
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', '/cover1.webp');
  });

  it('renders multiple stacked covers for 2 and 3+ books', () => {
    const { container: container2 } = renderFolderCard({ covers: ['/c1.webp', '/c2.webp'] });
    expect(container2.querySelectorAll('img')).toHaveLength(2);

    const { container: container3 } = renderFolderCard({ covers: ['/c1.webp', '/c2.webp', '/c3.webp'] });
    expect(container3.querySelectorAll('img')).toHaveLength(3);
  });

  it('triggers onSelectFolder callback on click', () => {
    const onSelect = vi.fn();
    renderFolderCard({ onSelectFolder: onSelect, covers: [] });

    fireEvent.click(screen.getByText('Science Fiction'));
    expect(onSelect).toHaveBeenCalledWith('Science-Fiction');
  });

  it('triggers onContextMenu callback on right-click', () => {
    const onContextMenu = vi.fn();
    renderFolderCard({ onContextMenu, covers: [] });

    fireEvent.contextMenu(screen.getByText('Science Fiction'));
    expect(onContextMenu).toHaveBeenCalled();
  });
});

describe('Reader component format routing', () => {
  it('routes to EpubViewer when book format is epub', async () => {
    const epubBook = {
      id: 'book_epub',
      title: 'Foundation',
      format: 'epub',
      path: '/books/foundation.epub',
    };

    render(<Reader book={epubBook} showFileExtension={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-epub-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('EPUB: Foundation')).toBeInTheDocument();
    expect(screen.getByText('Extension: true')).toBeInTheDocument();
  });

  it('routes to PdfViewer when book format is pdf', async () => {
    const pdfBook = {
      id: 'book_pdf',
      title: 'Clean Code',
      format: 'pdf',
      path: '/books/clean_code.pdf',
    };

    render(<Reader book={pdfBook} showFileExtension={false} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('mock-pdf-viewer')).toBeInTheDocument();
    });
    expect(screen.getByText('PDF: Clean Code')).toBeInTheDocument();
    expect(screen.getByText('Extension: false')).toBeInTheDocument();
  });
});

describe('AppNavbar component', () => {
  const renderNavbar = (props = {}) => {
    return render(
      <I18nProvider>
        <SettingsProvider>
          <AppNavbar
            libraryData={{
              activeLibraryId: 'main-lib',
              activeLibraryObj: { name: 'Main Library' },
              selectedShelf: 'all-books',
              searchQuery: '',
              sortBy: 'title_asc',
              formatFilter: 'all',
              ...props.libraryData,
            }}
            modals={{}}
            {...props}
          />
        </SettingsProvider>
      </I18nProvider>
    );
  };

  it('renders minimized search button by default', () => {
    renderNavbar();
    const searchBtn = screen.getByRole('button', { name: /search books by title/i });
    expect(searchBtn).toBeInTheDocument();
  });

  it('expands search input and allows typing', () => {
    const setSearchQuery = vi.fn();
    renderNavbar({ setSearchQuery });

    const searchBtn = screen.getByRole('button', { name: /search books by title/i });
    fireEvent.click(searchBtn);

    const input = screen.getByPlaceholderText(/search books/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'dune' } });
    expect(setSearchQuery).toHaveBeenCalledWith('dune');
  });

  it('renders sort selector and type filter next to it', () => {
    const setSortBy = vi.fn();
    const setFormatFilter = vi.fn();

    renderNavbar({ setSortBy, setFormatFilter });

    // Name ordering select
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);

    const sortSelect = selects[0];
    expect(sortSelect).toHaveValue('title_asc');
    fireEvent.change(sortSelect, { target: { value: 'title_desc' } });
    expect(setSortBy).toHaveBeenCalledWith('title_desc');

    // Type filter select
    const formatSelect = selects[1];
    expect(formatSelect).toHaveValue('all');

    fireEvent.change(formatSelect, { target: { value: 'pdf' } });
    expect(setFormatFilter).toHaveBeenCalledWith('pdf');

    fireEvent.change(formatSelect, { target: { value: 'epub' } });
    expect(setFormatFilter).toHaveBeenCalledWith('epub');
  });
});

describe('Format filtering across home sections', () => {
  const sampleBooks = [
    {
      id: 'b1',
      title: 'PDF Book 1',
      format: 'pdf',
      shelf: 'f1',
      tags: [{ id: 't1', name: 'SciFi' }],
      progress: { page: 5, total_pages: 100, percent: 5, status: 'reading' }
    },
    {
      id: 'b2',
      title: 'EPUB Book 1',
      format: 'epub',
      shelf: 'f2',
      tags: [{ id: 't2', name: 'Fantasy' }],
      progress: { page: 1, total_pages: 100, percent: 1, status: 'reading' }
    },
  ];
  const sampleShelves = [
    { id: 'f1', name: 'SciFi Shelf', book_count: 1 },
    { id: 'f2', name: 'Fantasy Shelf', book_count: 1 },
  ];
  const sampleTags = [
    { id: 't1', name: 'SciFi', color: 'amber', book_count: 1 },
    { id: 't2', name: 'Fantasy', color: 'purple', book_count: 1 },
  ];

  it('renders all home sections (continue reading, favorites, folders, tags) when formatFilter is pdf', () => {
    const pdfBooks = sampleBooks.filter(b => b.format === 'pdf');
    render(
      <I18nProvider>
        <LibraryHome
          selectedShelf={null}
          debouncedQuery=""
          formatFilter="pdf"
          continueReading={pdfBooks}
          favorites={pdfBooks}
          shelves={sampleShelves}
          tags={sampleTags}
          books={pdfBooks}
        />
      </I18nProvider>
    );

    // Continue reading and favorites should be rendered
    expect(screen.getByText(/continue reading/i)).toBeInTheDocument();
    expect(screen.getByText(/favorites/i)).toBeInTheDocument();
    // Folders should show the matching shelf
    expect(screen.getByText('SciFi Shelf')).toBeInTheDocument();
    // Non-matching shelf should be filtered out
    expect(screen.queryByText('Fantasy Shelf')).not.toBeInTheDocument();
    // Tags should show matching tag
    expect(screen.getAllByText('SciFi').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Fantasy')).not.toBeInTheDocument();
  });

  it('renders AllBooks section in LibraryContent when browsing root with formatFilter active', () => {
    const pdfBooks = sampleBooks.filter(b => b.format === 'pdf');
    render(
      <I18nProvider>
        <LibraryContent
          selectedShelf={null}
          debouncedQuery=""
          formatFilter="pdf"
          books={pdfBooks}
          shelves={sampleShelves}
          tags={sampleTags}
        />
      </I18nProvider>
    );

    // AllBooks component is rendered with header
    expect(screen.getByText(/all books/i)).toBeInTheDocument();
    expect(screen.getAllByText('PDF Book 1').length).toBeGreaterThan(0);
  });

  it('does not render ShelfHeader on root home view even when formatFilter is set', () => {
    const { container } = render(
      <I18nProvider>
        <ShelfHeader
          selectedShelf={null}
          debouncedQuery=""
          formatFilter="pdf"
          books={sampleBooks}
        />
      </I18nProvider>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders ShelfHeader with format badge when navigating a specific shelf with formatFilter', () => {
    render(
      <I18nProvider>
        <ShelfHeader
          selectedShelf="all-books"
          debouncedQuery=""
          formatFilter="pdf"
          books={sampleBooks.filter(b => b.format === 'pdf')}
        />
      </I18nProvider>
    );

    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('filters folders and tags by name in LibraryHome when debouncedQuery is present', () => {
    render(
      <I18nProvider>
        <LibraryHome
          selectedShelf={null}
          debouncedQuery="Fantasy"
          formatFilter="all"
          continueReading={[]}
          favorites={[]}
          shelves={sampleShelves}
          tags={sampleTags}
          books={sampleBooks}
        />
      </I18nProvider>
    );

    // Matching shelf and tag should be rendered
    expect(screen.getByText('Fantasy Shelf')).toBeInTheDocument();
    expect(screen.getAllByText('Fantasy').length).toBeGreaterThanOrEqual(1);

    // Non-matching shelf and tag should not be rendered
    expect(screen.queryByText('SciFi Shelf')).not.toBeInTheDocument();
    expect(screen.queryByText('SciFi')).not.toBeInTheDocument();
  });

  it('filters folders by custom_name or folder id in LibraryContent when viewing folders shelf', () => {
    const customShelves = [
      { id: 'folder-1', name: 'Work Docs', original_name: 'original_one', custom_name: 'Work Docs', book_count: 2 },
      { id: 'folder-2', name: 'Original Two', book_count: 3 },
    ];
    render(
      <I18nProvider>
        <LibraryContent
          selectedShelf="folders"
          debouncedQuery="original_one"
          shelves={customShelves}
          books={[]}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Work Docs')).toBeInTheDocument();
    expect(screen.queryByText('Original Two')).not.toBeInTheDocument();
  });

  it('suppresses full empty state in LibraryContent on root if matching folders or tags exist with 0 books', () => {
    const { container } = render(
      <I18nProvider>
        <LibraryContent
          selectedShelf={null}
          debouncedQuery="Fantasy"
          shelves={sampleShelves}
          tags={sampleTags}
          books={[]}
        />
      </I18nProvider>
    );

    // Should return null (suppressing the giant "No books found" container so LibraryHome can show the matching folder)
    expect(container.firstChild).toBeNull();
  });
});


