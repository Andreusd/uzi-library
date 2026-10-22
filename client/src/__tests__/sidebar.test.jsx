import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../components/Sidebar';
import { I18nProvider } from '../i18n';

describe('Sidebar component', () => {
  const defaultShelves = [
    { id: 'Sci-Fi', name: 'Science Fiction', book_count: 8, icon: 'Rocket' },
    { id: 'History', name: 'World History', book_count: 4, icon: 'Bookmark' },
  ];

  const defaultLibraries = [
    { id: 'lib_1', name: 'Main Library', path: '/books/main' },
    { id: 'lib_2', name: 'Secondary Library', path: '/books/secondary' },
  ];

  const renderSidebar = (customProps = {}) => {
    const props = {
      shelves: defaultShelves,
      totalBooks: 12,
      favoriteCount: 3,
      continueReadingCount: 2,
      readCount: 5,
      selectedShelf: null,
      onSelectShelf: vi.fn(),
      onShelfContextMenu: vi.fn(),
      isOpen: true,
      onClose: vi.fn(),
      libraries: defaultLibraries,
      activeLibraryId: 'lib_1',
      onSwitchLibrary: vi.fn(),
      onSelectAllLibraries: vi.fn(),
      onOpenSettings: vi.fn(),
      tags: [{ id: 'tag_1', name: 'Favorites Tag', color: 'rose', count: 2 }],
      onOpenTagManager: vi.fn(),
      currentUser: 'Alex',
      ...customProps,
    };

    return {
      ...render(
        <I18nProvider>
          <Sidebar {...props} />
        </I18nProvider>
      ),
      props,
    };
  };

  it('renders library title, total book and shelf counts', () => {
    renderSidebar();
    expect(screen.getByText('Uzi Library')).toBeInTheDocument();
    expect(screen.getByText('12 books • 2 folders')).toBeInTheDocument();
  });

  it('renders home, continue reading, and favorites items with counts', () => {
    renderSidebar();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Continue Reading')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // favorite count badge
    expect(screen.getByText('5')).toBeInTheDocument(); // read count badge
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // count badges
  });

  it('calls onSelectShelf when clicking navigation items', () => {
    const { props } = renderSidebar();

    fireEvent.click(screen.getByText('Continue Reading'));
    expect(props.onSelectShelf).toHaveBeenCalledWith('continue-reading');

    fireEvent.click(screen.getByText('Favorites'));
    expect(props.onSelectShelf).toHaveBeenCalledWith('favorites');

    fireEvent.click(screen.getByText('Completed'));
    expect(props.onSelectShelf).toHaveBeenCalledWith('read-books');

    fireEvent.click(screen.getByText('Science Fiction'));
    expect(props.onSelectShelf).toHaveBeenCalledWith('Sci-Fi');
  });

  it('filters folders and shelves dynamically based on search input', () => {
    renderSidebar();

    const searchInput = screen.getByPlaceholderText(/filter folders/i);
    fireEvent.change(searchInput, { target: { value: 'science' } });

    expect(screen.getByText('Science Fiction')).toBeInTheDocument();
    expect(screen.queryByText('World History')).not.toBeInTheDocument();
  });

  it('opens library switcher dropdown and triggers library change', () => {
    const { props } = renderSidebar();

    // Click active library button to open dropdown
    const libSwitcherBtn = screen.getByText('Main Library');
    fireEvent.click(libSwitcherBtn);

    // Click secondary library
    const secondaryLibBtn = screen.getByText('Secondary Library');
    fireEvent.click(secondaryLibBtn);

    expect(props.onSwitchLibrary).toHaveBeenCalledWith('lib_2');
  });

  it('renders current active user badge', () => {
    renderSidebar({ currentUser: 'Alex' });
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('collapses and hides sidebar when isOpen is false', () => {
    const { container } = renderSidebar({ isOpen: false });
    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('-translate-x-full');
    expect(aside).toHaveClass('opacity-0');
    expect(aside).toHaveClass('pointer-events-none');
    expect(aside).toHaveClass('lg:w-0');
  });
});
