import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { SettingsProvider } from '../contexts/SettingsContext.jsx';
import AppNavbar from '../components/AppNavbar';
import LibrarySelector from '../components/LibrarySelector';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import * as offlineStorage from '../services/offlineStorage';

const wrapper = ({ children }) => (
  <I18nProvider>
    <SettingsProvider>
      {children}
    </SettingsProvider>
  </I18nProvider>
);

describe('Offline Mode Subsystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('useNetworkStatus Hook', () => {
    it('initializes online status from navigator.onLine', () => {
      const { result } = renderHook(() => useNetworkStatus());
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('updates isOffline when offline window event fires', () => {
      const { result } = renderHook(() => useNetworkStatus());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOffline).toBe(true);
      expect(result.current.isServerReachable).toBe(false);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(result.current.isOnline).toBe(true);
    });

    it('reacts to uzi_server_reachability custom events', () => {
      const { result } = renderHook(() => useNetworkStatus());

      act(() => {
        window.dispatchEvent(new CustomEvent('uzi_server_reachability', { detail: { reachable: false } }));
      });

      expect(result.current.isServerReachable).toBe(false);
      expect(result.current.isOffline).toBe(true);

      act(() => {
        window.dispatchEvent(new CustomEvent('uzi_server_reachability', { detail: { reachable: true } }));
      });

      expect(result.current.isServerReachable).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });
  });

  describe('AppNavbar Offline Indicator', () => {
    it('renders offline indicator badge when isOffline is true', () => {
      const libraryData = {
        selectedShelf: null,
        activeLibraryId: 'lib-1',
        activeLibraryObj: { name: 'Main Library' },
        isOffline: true,
        searchQuery: '',
      };

      const { container } = render(
        <I18nProvider>
          <SettingsProvider>
            <AppNavbar libraryData={libraryData} isOffline={true} />
          </SettingsProvider>
        </I18nProvider>
      );

      // Badge must be present
      expect(screen.getByText(/Offline/i)).toBeInTheDocument();
      expect(container.querySelector('.lucide-wifi-off')).toBeInTheDocument();
    });

    it('does not render offline indicator badge when isOffline is false', () => {
      const libraryData = {
        selectedShelf: null,
        activeLibraryId: 'lib-1',
        activeLibraryObj: { name: 'Main Library' },
        isOffline: false,
        searchQuery: '',
      };

      const { container } = render(
        <I18nProvider>
          <SettingsProvider>
            <AppNavbar libraryData={libraryData} isOffline={false} />
          </SettingsProvider>
        </I18nProvider>
      );

      expect(container.querySelector('.lucide-wifi-off')).toBeNull();
    });
  });

  describe('LibrarySelector Offline Support', () => {
    it('displays offline banner and button when offline with downloaded books', () => {
      const onSelectOffline = vi.fn();

      render(
        <I18nProvider>
          <LibrarySelector
            libraries={[{ id: 'lib-1', name: 'Cached Tech Books', book_count: 5 }]}
            currentUser="TestUser"
            isOffline={true}
            offlineBooksCount={3}
            onSelectOffline={onSelectOffline}
          />
        </I18nProvider>
      );

      // Offline badge in header
      expect(screen.getAllByText(/Offline/i).length).toBeGreaterThan(0);

      // Offline notice
      expect(screen.getByText(/Server unreachable|Servidor desconectado/i)).toBeInTheDocument();

      // Action button to access offline books (View Offline Books in EN)
      const offlineBtn = screen.getByRole('button', { name: /View Offline Books|Ver Livros Offline/i });
      expect(offlineBtn).toBeInTheDocument();

      fireEvent.click(offlineBtn);
      expect(onSelectOffline).toHaveBeenCalledTimes(1);
    });

    it('displays offline-specific empty state when libraries array is empty and offline', () => {
      const onSelectOffline = vi.fn();
      const onRetryReachability = vi.fn();

      render(
        <I18nProvider>
          <LibrarySelector
            libraries={[]}
            currentUser="TestUser"
            isOffline={true}
            offlineBooksCount={2}
            onSelectOffline={onSelectOffline}
            onRetryReachability={onRetryReachability}
          />
        </I18nProvider>
      );

      // Should not prompt "No libraries configured / configure folder" when offline
      expect(screen.queryByText(/No libraries configured|Nenhuma biblioteca configurada/i)).toBeNull();

      // Should show offline empty state with reconnect button
      const retryBtn = screen.getByRole('button', { name: /Tentar Reconectar|Reconnect|Retry/i });
      expect(retryBtn).toBeInTheDocument();
      fireEvent.click(retryBtn);
      expect(onRetryReachability).toHaveBeenCalledTimes(1);
    });
  });

  describe('Offline Books Projection in useLibraryData', () => {
    it('loads books from getOfflineBooksList when isOffline is true', async () => {
      const sampleOfflineBooks = [
        { id: 'off-1', title: 'Clean Architecture', author: 'Robert C. Martin', format: 'pdf', is_offline: true },
        { id: 'off-2', title: 'Design Patterns', author: 'Gang of Four', format: 'epub', is_offline: true },
      ];

      vi.spyOn(offlineStorage, 'getOfflineBooksList').mockResolvedValue(sampleOfflineBooks);

      // Mock fetch failing to simulate offline server unreachability
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const { useLibraryData } = await import('../hooks/useLibraryData');
      const router = {
        route: { libraryId: 'lib-1' },
        navigateToShelf: vi.fn(),
        navigateToBook: vi.fn(),
        navigateToLibraries: vi.fn(),
      };

      let result;
      await act(async () => {
        const rendered = renderHook(
          () => useLibraryData({ setCurrentUser: vi.fn(), modals: {}, router }),
          { wrapper }
        );
        result = rendered.result;
      });

      // Trigger offline event
      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOffline).toBe(true);

      await act(async () => {
        result.current.loadBooks('lib-1');
      });

      expect(result.current.books).toHaveLength(2);
      expect(result.current.books[0].title).toBe('Clean Architecture');
      expect(result.current.books[1].title).toBe('Design Patterns');
    });
  });
});
