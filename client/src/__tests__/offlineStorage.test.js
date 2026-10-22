import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  initDB,
  formatBytes,
  isBookOffline,
  saveBookOffline,
  removeBookOffline,
  getOfflineBook,
  getOfflineBookBlob,
  getOfflineBooksList,
  getOfflineStorageStats,
  saveOfflineProgress,
  syncPendingProgress,
} from '../services/offlineStorage';

describe('offlineStorage Service', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
  });

  it('formatBytes formats bytes accurately', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(1572864)).toBe('1.5 MB');
    expect(formatBytes(1073741824)).toBe('1 GB');
  });

  it('initializes IndexedDB database properly', async () => {
    const db = await initDB();
    expect(db.name).toBe('uzi_library_offline');
    expect(db.objectStoreNames.contains('books')).toBe(true);
    expect(db.objectStoreNames.contains('progress_queue')).toBe(true);
  });

  it('saves book offline, retrieves it, and lists it', async () => {
    const mockBook = {
      id: 'book-offline-1',
      title: 'Deep Learning with Python',
      author: 'François Chollet',
      format: 'epub',
      filename: 'deep-learning.epub',
      shelf_display: 'AI & Data',
      tags: ['ai', 'python'],
      progress: { percent: 15, status: 'in_progress' },
    };

    // Mock fetch for /api/book-file and /api/cover
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const coverBytes = new Uint8Array([9, 8, 7]);

    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/book-file/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          arrayBuffer: () => Promise.resolve(fileBytes.buffer),
          blob: () => Promise.resolve(new Blob([fileBytes], { type: 'application/epub+zip' })),
        });
      }
      if (url.includes('/api/cover/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          arrayBuffer: () => Promise.resolve(coverBytes.buffer),
          blob: () => Promise.resolve(new Blob([coverBytes], { type: 'image/jpeg' })),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    // Verify not offline before save
    const beforeSave = await isBookOffline('book-offline-1');
    expect(beforeSave).toBe(false);

    // Save offline
    const onProgress = vi.fn();
    const saved = await saveBookOffline(mockBook, onProgress);
    expect(saved.id).toBe('book-offline-1');
    expect(saved.size).toBe(5);
    expect(saved.size_formatted).toBe('5 B');
    expect(onProgress).toHaveBeenCalled();

    // Verify isBookOffline is now true
    const afterSave = await isBookOffline('book-offline-1');
    expect(afterSave).toBe(true);

    // Retrieve offline book
    const retrieved = await getOfflineBook('book-offline-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved.title).toBe('Deep Learning with Python');
    expect(retrieved.fileBuffer).toBeDefined();
    expect(retrieved.coverBuffer).toBeDefined();

    // Retrieve blob
    const blobOnly = await getOfflineBookBlob('book-offline-1');
    expect(blobOnly).toBeInstanceOf(Blob);
    expect(blobOnly.size).toBe(5);

    // List offline books
    const list = await getOfflineBooksList();
    expect(list.length).toBeGreaterThanOrEqual(1);
    const item = list.find((b) => b.id === 'book-offline-1');
    expect(item).toBeDefined();
    expect(item.is_offline).toBe(true);
    expect(item.has_cover).toBe(true);
    expect(item.fileBlob).toBeUndefined(); // Verify heavy blob is omitted from list projection

    // Check stats
    const stats = await getOfflineStorageStats();
    expect(stats.count).toBeGreaterThanOrEqual(1);
    expect(stats.totalBytes).toBeGreaterThanOrEqual(5);

    // Remove offline book
    await removeBookOffline('book-offline-1');
    const afterRemove = await isBookOffline('book-offline-1');
    expect(afterRemove).toBe(false);
  });

  it('queues offline progress and syncs when online', async () => {
    const bookId = 'book-progress-test';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });

    await saveOfflineProgress(bookId, {
      percent: 42,
      page: 84,
      status: 'in_progress',
    });

    await syncPendingProgress();

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/progress', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        book_id: bookId,
        cfi: undefined,
        page: 84,
        percent: 42,
        status: 'in_progress',
      }),
    }));
  });
});
