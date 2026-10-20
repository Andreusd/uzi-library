import { useState, useEffect, useCallback } from 'react';
import { booksApi, foldersApi, librariesApi, tagsApi } from '../api';
import { useI18n } from '../i18n';

/**
 * Custom hook managing library data, shelves, books, favorites, tags,
 * continue-reading status, and routing synchronization.
 */
export function useLibraryData({ setCurrentUser, modals, router }) {
  const { t } = useI18n();
  const { route, navigateToShelf: routerNavigateToShelf, navigateToBook, navigateToLibraries } = router;

  const [shelves, setShelves] = useState([]);
  const [totalBooks, setTotalBooks] = useState(0);
  const [libraries, setLibraries] = useState([]);
  const [activeLibraryId, setActiveLibraryId] = useState(() => route.libraryId || '');
  const [selectedShelf, setSelectedShelf] = useState(() => route.shelfId);
  const [books, setBooks] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortBy, setSortBy] = useState('title_asc');
  const [formatFilter, setFormatFilter] = useState('all');
  const [activeBook, setActiveBook] = useState(null);
  const [routeLoading, setRouteLoading] = useState(() => Boolean(route.bookId));

  const [prevRouteKey, setPrevRouteKey] = useState(() => `${route.libraryId || ''}_${route.shelfId || ''}_${route.bookId || ''}`);
  const currentRouteKey = `${route.libraryId || ''}_${route.shelfId || ''}_${route.bookId || ''}`;

  if (currentRouteKey !== prevRouteKey) {
    setPrevRouteKey(currentRouteKey);
    if (!route.libraryId && !route.bookId) {
      setActiveLibraryId('');
      setSelectedShelf(null);
      setActiveBook(null);
      setShelves([]);
      setBooks([]);
      setContinueReading([]);
      setFavorites([]);
      setFavoriteIds(new Set());
      setTags([]);
    } else {
      if (route.libraryId && route.libraryId !== activeLibraryId) {
        setActiveLibraryId(route.libraryId);
      }
      if (route.bookId) {
        if (!activeBook || activeBook.id !== route.bookId) {
          setRouteLoading(true);
        }
      } else {
        if (activeBook) {
          setActiveBook(null);
        }
        setSelectedShelf(route.shelfId);
        setSearchQuery('');
      }
    }
  }

  const bookParamsKey = `${activeLibraryId}_${selectedShelf}_${debouncedQuery}_${sortBy}_${formatFilter}`;
  const [prevBookParamsKey, setPrevBookParamsKey] = useState(bookParamsKey);
  if (bookParamsKey !== prevBookParamsKey) {
    setPrevBookParamsKey(bookParamsKey);
    if (activeLibraryId) {
      setLoading(true);
    }
  }

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Libraries
  const loadLibraries = useCallback(() => {
    librariesApi.getLibraries()
      .then(data => {
        setLibraries(data.libraries || []);
      })
      .catch(err => console.error('Failed to load libraries:', err));
  }, []);

  // Load Shelves & Totals
  const loadShelves = useCallback((libId) => {
    const targetLib = libId !== undefined ? libId : activeLibraryId;
    if (!targetLib) return;
    foldersApi.getFolders(targetLib)
      .then(data => {
        setShelves(data.shelves || data.folders || []);
        setTotalBooks(data.total_books || 0);
      })
      .catch(err => console.error('Failed to load shelves:', err));
  }, [activeLibraryId]);

  // Load Continue Reading
  const loadContinueReading = useCallback((libId, fmt) => {
    const targetLib = libId !== undefined ? libId : activeLibraryId;
    if (!targetLib) return;
    const formatToUse = fmt !== undefined ? fmt : formatFilter;
    booksApi.getContinueReading(targetLib, formatToUse !== 'all' ? formatToUse : undefined)
      .then(data => {
        setContinueReading(data.books || []);
      })
      .catch(err => console.error('Failed to load continue reading:', err));
  }, [activeLibraryId, formatFilter]);

  // Load Favorites
  const loadFavorites = useCallback((libId, fmt) => {
    const targetLib = libId !== undefined ? libId : activeLibraryId;
    if (!targetLib) return;
    const formatToUse = fmt !== undefined ? fmt : formatFilter;
    booksApi.getFavorites(targetLib, formatToUse !== 'all' ? formatToUse : undefined)
      .then(data => {
        setFavorites(data.books || []);
        setFavoriteIds(new Set(data.favorite_ids || []));
      })
      .catch(err => console.error('Failed to load favorites:', err));
  }, [activeLibraryId, formatFilter]);

  // Load Virtual Tags
  const loadTags = useCallback((libId) => {
    const targetLib = libId !== undefined ? libId : activeLibraryId;
    if (!targetLib) return;
    tagsApi.getTags(targetLib)
      .then(data => {
        setTags(data.tags || []);
      })
      .catch(err => console.error('Failed to load tags:', err));
  }, [activeLibraryId]);

  // Handle Book Tags Updated from Modal
  const handleBookTagsUpdated = useCallback((bookId, updatedTags) => {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, tags: updatedTags } : b));
    setContinueReading(prev => prev.map(b => b.id === bookId ? { ...b, tags: updatedTags } : b));
    setFavorites(prev => prev.map(b => b.id === bookId ? { ...b, tags: updatedTags } : b));
    setActiveBook(prev => (prev && prev.id === bookId ? { ...prev, tags: updatedTags } : prev));
  }, []);

  // Load Books
  const loadBooks = useCallback((libId, targetShelf, fmt) => {
    const targetLib = libId !== undefined ? libId : activeLibraryId;
    if (!targetLib) return;
    const shelfToUse = targetShelf !== undefined ? targetShelf : selectedShelf;
    const formatToUse = fmt !== undefined ? fmt : formatFilter;
    const params = {
      library_id: targetLib,
      sort: sortBy,
    };
    if (formatToUse && formatToUse !== 'all') {
      params.format = formatToUse;
    }
    if (shelfToUse && shelfToUse.startsWith('tag:')) {
      params.tag = shelfToUse.slice(4);
    } else if (shelfToUse && shelfToUse !== 'folders' && shelfToUse !== 'tags' && shelfToUse !== 'all-books') {
      params.shelf = shelfToUse;
    }
    if (debouncedQuery && shelfToUse !== 'folders' && shelfToUse !== 'tags') {
      params.query = debouncedQuery;
    }

    booksApi.getBooks(params)
      .then(data => {
        setBooks(data.books || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load books:', err);
        setLoading(false);
      });
  }, [activeLibraryId, selectedShelf, debouncedQuery, sortBy, formatFilter]);

  // Handle User Change (persists to storage and reloads user-specific data)
  const handleUserChange = useCallback((newUsername) => {
    setCurrentUser(newUsername);
    if (activeLibraryId) {
      loadContinueReading(activeLibraryId);
      loadFavorites(activeLibraryId);
      loadTags(activeLibraryId);
      loadBooks(activeLibraryId);
    }
  }, [activeLibraryId, setCurrentUser, loadContinueReading, loadFavorites, loadTags, loadBooks]);

  // Select Library from selector screen
  const selectLibrary = useCallback((libraryId) => {
    setActiveLibraryId(libraryId);
    setSelectedShelf(null);
    setSearchQuery('');
    routerNavigateToShelf(null, libraryId);
    loadShelves(libraryId);
    loadBooks(libraryId, null);
    loadContinueReading(libraryId);
    loadFavorites(libraryId);
    loadTags(libraryId);
  }, [routerNavigateToShelf, loadShelves, loadBooks, loadContinueReading, loadFavorites, loadTags]);

  // Return to All Libraries selection screen
  const selectAllLibraries = useCallback(() => {
    setActiveLibraryId('');
    setSelectedShelf(null);
    setActiveBook(null);
    setSearchQuery('');
    navigateToLibraries();
    loadLibraries();
    loadTags('');
  }, [navigateToLibraries, loadLibraries, loadTags]);

  // Switch Active Library
  const switchLibrary = useCallback((libraryId) => {
    selectLibrary(libraryId);
  }, [selectLibrary]);

  // Toggle Favorite
  const handleToggleFavorite = useCallback((targetBook) => {
    if (!targetBook) return;
    booksApi.toggleFavorite(targetBook.id)
      .then(data => {
        if (data.status === 'ok') {
          const nextIds = new Set(data.favorite_ids || []);
          setFavoriteIds(nextIds);
          setBooks(prev => {
            const updated = prev.map(b => b.id === targetBook.id ? { ...b, is_favorite: data.is_favorite } : b);
            if (selectedShelf === 'favorites') {
              return updated.filter(b => b.is_favorite);
            }
            if (selectedShelf && selectedShelf !== 'continue-reading') {
              return [...updated].sort((a, b) => {
                const aFav = nextIds.has(a.id) ? 0 : 1;
                const bFav = nextIds.has(b.id) ? 0 : 1;
                return aFav - bFav;
              });
            }
            return updated;
          });
          setContinueReading(prev => prev.map(b => b.id === targetBook.id ? { ...b, is_favorite: data.is_favorite } : b));
          loadFavorites(activeLibraryId);
        }
      })
      .catch(err => console.error('Failed to toggle favorite:', err));
  }, [loadFavorites, selectedShelf, activeLibraryId]);

  // Navigate to shelf and update browser URL
  const navigateToShelf = useCallback((shelfId) => {
    setSelectedShelf(shelfId);
    setSearchQuery('');
    routerNavigateToShelf(shelfId, activeLibraryId);
  }, [activeLibraryId, routerNavigateToShelf]);

  // Open reader and update browser route
  const openReader = useCallback((targetBook, originRect = null) => {
    if (!targetBook) return;
    setActiveBook({ ...targetBook, _originRect: originRect });
    const targetLib = activeLibraryId || targetBook.library_id || 'default';
    if (!activeLibraryId && targetBook.library_id) {
      setActiveLibraryId(targetBook.library_id);
    }
    navigateToBook(targetBook.id, targetLib);
  }, [activeLibraryId, navigateToBook]);

  // Close reader and return to current shelf route
  const closeReader = useCallback(() => {
    setActiveBook(null);
    routerNavigateToShelf(selectedShelf, activeLibraryId);
    loadContinueReading(activeLibraryId);
    loadFavorites(activeLibraryId);
  }, [selectedShelf, activeLibraryId, routerNavigateToShelf, loadContinueReading, loadFavorites]);

  // Synchronize route state with URL router
  useEffect(() => {
    if (!route.libraryId && !route.bookId) {
      loadLibraries();
      return;
    }

    if (route.bookId) {
      if (!activeBook || activeBook.id !== route.bookId) {
        booksApi.getBook(route.bookId)
          .then(book => {
            if (book && book.id) {
              setActiveBook(book);
              const targetLib = route.libraryId || book.library_id || 'default';
              if (!activeLibraryId) {
                setActiveLibraryId(targetLib);
              }
              setSelectedShelf(prev => prev || book.shelf || null);
            }
          })
          .catch(err => {
            console.error('Failed to load book from route:', err);
            setActiveBook(null);
            routerNavigateToShelf(selectedShelf, route.libraryId || activeLibraryId);
          })
          .finally(() => {
            setRouteLoading(false);
          });
      }
    } else {
      if (activeBook) {
        loadContinueReading(route.libraryId || activeLibraryId);
        loadFavorites(route.libraryId || activeLibraryId);
        loadTags(route.libraryId || activeLibraryId);
      }
    }
  }, [
    route.bookId,
    route.libraryId,
    activeBook,
    activeLibraryId,
    loadLibraries,
    routerNavigateToShelf,
    selectedShelf,
    loadContinueReading,
    loadFavorites,
    loadTags
  ]);

  useEffect(() => {
    loadLibraries();
  }, [loadLibraries]);

  useEffect(() => {
    if (activeLibraryId) {
      loadShelves(activeLibraryId);
      loadContinueReading(activeLibraryId);
      loadFavorites(activeLibraryId);
      loadTags(activeLibraryId);
    }
  }, [activeLibraryId, formatFilter, loadShelves, loadContinueReading, loadFavorites, loadTags]);

  useEffect(() => {
    if (activeLibraryId) {
      loadBooks(activeLibraryId, selectedShelf);
    }
  }, [activeLibraryId, selectedShelf, debouncedQuery, sortBy, formatFilter, loadBooks]);

  // Handle book progress update from Reader or status change
  const handleProgressUpdate = useCallback((bookId, newProgress) => {
    setBooks(prev => prev.map(b => (b.id === bookId ? { ...b, progress: newProgress } : b)));
    setContinueReading(prev => {
      const isNotReading = !newProgress || 
        newProgress.status === 'not_started' || 
        newProgress.status === 'completed' || 
        ((newProgress.page || 1) <= 1 && !newProgress.cfi && (newProgress.percent || 0) <= 0.5) || 
        (newProgress.percent || 0) >= 100;

      if (isNotReading) {
        return prev.filter(b => b.id !== bookId);
      }
      return prev.map(b => (b.id === bookId ? { ...b, progress: newProgress } : b));
    });
  }, []);

  // Mark status handler (not_started / completed)
  const handleMarkStatus = useCallback((targetBook, status) => {
    if (status === 'not_started') {
      const resetProgress = {
        page: 1,
        total_pages: targetBook.progress?.total_pages || 1,
        percent: 0,
        status: 'not_started',
        cfi: null
      };
      handleProgressUpdate(targetBook.id, resetProgress);
    } else if (status === 'completed') {
      const totalPages = targetBook.progress?.total_pages || 1;
      const completedProgress = {
        page: totalPages,
        total_pages: totalPages,
        percent: 100,
        status: 'completed'
      };
      handleProgressUpdate(targetBook.id, completedProgress);
    }

    booksApi.updateStatus(targetBook.id, status)
      .then(data => {
        if (data.status === 'ok') {
          handleProgressUpdate(targetBook.id, data.progress);
          loadContinueReading();
        }
      })
      .catch(err => {
        console.error('Failed to update book status:', err);
        loadContinueReading();
        loadBooks();
      });
  }, [handleProgressUpdate, loadContinueReading, loadBooks]);

  // Save renamed shelf
  const handleSaveShelfName = useCallback((shelfId, customName) => {
    foldersApi.renameFolder({ shelf_id: shelfId, custom_name: customName, library_id: activeLibraryId })
      .then(data => {
        if (data.status === 'ok') {
          setShelves(data.shelves || data.folders || []);
          modals.closeRenameModal();
          loadBooks();
        }
      })
      .catch(err => console.error('Failed to rename shelf:', err));
  }, [activeLibraryId, modals, loadBooks]);

  // Reset shelf name to original
  const handleResetShelfName = useCallback((shelf) => {
    handleSaveShelfName(shelf.id, '');
  }, [handleSaveShelfName]);

  // Save shelf icon
  const handleSaveShelfIcon = useCallback((shelfId, iconName) => {
    foldersApi.setFolderIcon({ shelf_id: shelfId, icon: iconName, library_id: activeLibraryId })
      .then(data => {
        if (data.status === 'ok') {
          setShelves(data.shelves || data.folders || []);
          modals.closeIconModal();
        }
      })
      .catch(err => console.error('Failed to save shelf icon:', err));
  }, [activeLibraryId, modals]);

  const handleLibraryChanged = useCallback((newActiveId) => {
    loadLibraries();
    if (newActiveId && newActiveId !== activeLibraryId) {
      selectLibrary(newActiveId);
    } else if (activeLibraryId) {
      loadShelves(activeLibraryId);
      loadBooks(activeLibraryId);
      loadContinueReading(activeLibraryId);
      loadFavorites(activeLibraryId);
      loadTags(activeLibraryId);
    }
  }, [activeLibraryId, loadLibraries, selectLibrary, loadShelves, loadBooks, loadContinueReading, loadFavorites, loadTags]);

  // Find active shelf or tag metadata
  const currentShelfObj = shelves.find(s => s.id === selectedShelf);
  const isTagFilter = Boolean(selectedShelf && selectedShelf.startsWith('tag:'));
  const activeTagId = isTagFilter ? selectedShelf.slice(4) : null;
  const currentTagObj = isTagFilter ? tags.find(t => t.id === activeTagId) : null;
  const activeLibraryObj = libraries.find(l => l.id === activeLibraryId);

  // Dynamic Browser Tab Title
  useEffect(() => {
    if (activeBook) {
      document.title = `${activeBook.title} - ${t('appTitle')}`;
    } else if (selectedShelf === 'continue-reading') {
      document.title = `${t('continueReading')} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (selectedShelf === 'favorites') {
      document.title = `${t('favorites')} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (selectedShelf === 'folders') {
      document.title = `${t('folders')} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (selectedShelf === 'tags') {
      document.title = `${t('tags')} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (selectedShelf === 'all-books') {
      document.title = `${t('allBooksLibrary')} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (isTagFilter && currentTagObj) {
      document.title = `${currentTagObj.name} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (currentShelfObj) {
      document.title = `${currentShelfObj.name} - ${activeLibraryObj?.name || t('appTitle')}`;
    } else if (activeLibraryObj) {
      document.title = `${activeLibraryObj.name} - ${t('appTitle')}`;
    } else {
      document.title = `${t('selectLibraryTitle')} - ${t('appTitle')}`;
    }
  }, [activeBook, selectedShelf, currentShelfObj, isTagFilter, currentTagObj, activeLibraryObj, t]);

  return {
    // State
    shelves,
    totalBooks,
    libraries,
    activeLibraryId,
    selectedShelf,
    books,
    continueReading,
    favorites,
    favoriteIds,
    tags,
    loading,
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    sortBy,
    setSortBy,
    formatFilter,
    setFormatFilter,
    activeBook,
    routeLoading,

    // Computed
    currentShelfObj,
    isTagFilter,
    activeTagId,
    currentTagObj,
    activeLibraryObj,

    // Actions
    loadLibraries,
    loadShelves,
    loadBooks,
    loadContinueReading,
    loadFavorites,
    loadTags,
    selectLibrary,
    selectAllLibraries,
    switchLibrary,
    navigateToShelf,
    openReader,
    closeReader,
    handleToggleFavorite,
    handleProgressUpdate,
    handleMarkStatus,
    handleSaveShelfName,
    handleResetShelfName,
    handleSaveShelfIcon,
    handleBookTagsUpdated,
    handleLibraryChanged,
    handleUserChange,
  };
}
