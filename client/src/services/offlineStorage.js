/**
 * Offline storage service using IndexedDB.
 * Manages downloaded book files (EPUB/PDF), covers, metadata, and offline progress synchronization.
 */

const DB_NAME = 'uzi_library_offline';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';
const STORE_QUEUE = 'progress_queue';

let dbPromise = null;

/**
 * Formats byte count to human-readable string.
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Initializes and caches the IndexedDB connection.
 */
export function initDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Store 1: Books (id, metadata, blobs)
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        const bookStore = db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        bookStore.createIndex('format', 'format', { unique: false });
        bookStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // Store 2: Offline Progress Queue (to sync with server when back online)
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'book_id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      dbPromise = null;
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/**
 * Dispatches a global event so UI components (navbar, badges, lists) know offline state changed.
 */
function notifyOfflineUpdated(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('uzi-offline-updated', { detail }));
  }
}

/**
 * Checks if a book is downloaded and available offline.
 */
export async function isBookOffline(bookId) {
  if (!bookId) return false;
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.getKey(bookId);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Downloads a book (binary file + cover + metadata) and stores it in IndexedDB.
 */
export async function saveBookOffline(book, onProgress = null) {
  if (!book || !book.id) throw new Error('Invalid book metadata');

  const db = await initDB();

  // 1. Fetch file binary
  onProgress?.({ stage: 'file', percent: 10 });
  const fileUrl = `/api/book-file/${encodeURIComponent(book.id)}`;
  const fileResp = await fetch(fileUrl);
  if (!fileResp.ok) throw new Error(`Failed to download book file: HTTP ${fileResp.status}`);
  const fileBuffer = await fileResp.arrayBuffer();

  onProgress?.({ stage: 'cover', percent: 70 });

  // 2. Fetch cover if available
  let coverBuffer = null;
  let coverMimeType = 'image/jpeg';
  try {
    const coverUrl = `/api/cover/${encodeURIComponent(book.id)}`;
    const coverResp = await fetch(coverUrl);
    if (coverResp.ok) {
      coverMimeType = coverResp.headers.get('content-type') || 'image/jpeg';
      coverBuffer = await coverResp.arrayBuffer();
    }
  } catch {
    // Non-critical: book can be saved without cover
  }

  onProgress?.({ stage: 'saving', percent: 90 });

  const isEpub = book.format === 'epub' || book.filename?.toLowerCase().endsWith('.epub');
  const mimeType = isEpub ? 'application/epub+zip' : 'application/pdf';

  // 3. Assemble record
  const record = {
    id: book.id,
    title: book.title || 'Untitled Book',
    author: book.author || '',
    format: book.format || (isEpub ? 'epub' : 'pdf'),
    filename: book.filename || `${book.title}.${isEpub ? 'epub' : 'pdf'}`,
    size: fileBuffer.byteLength,
    size_formatted: formatBytes(fileBuffer.byteLength),
    shelf: book.shelf || '',
    shelf_display: book.shelf_display || '',
    folder_display: book.folder_display || '',
    description: book.description || '',
    tags: Array.isArray(book.tags) ? book.tags : [],
    fileBuffer,
    mimeType,
    coverBuffer,
    coverMimeType,
    downloadedAt: Date.now(),
    progress: book.progress || { percent: 0, status: 'not_started' },
  };

  // 4. Save to IndexedDB
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readwrite');
    const store = tx.objectStore(STORE_BOOKS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  onProgress?.({ stage: 'complete', percent: 100 });
  notifyOfflineUpdated({ action: 'saved', bookId: book.id });
  return record;
}

/**
 * Removes a book from offline storage.
 */
export async function removeBookOffline(bookId) {
  if (!bookId) return;
  const db = await initDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readwrite');
    const store = tx.objectStore(STORE_BOOKS);
    const req = store.delete(bookId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  notifyOfflineUpdated({ action: 'removed', bookId });
}

/**
 * Retrieves the full book record including fileBlob from IndexedDB.
 */
export async function getOfflineBook(bookId) {
  if (!bookId) return null;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readonly');
    const store = tx.objectStore(STORE_BOOKS);
    const req = store.get(bookId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves only the book file as Blob from IndexedDB.
 */
export async function getOfflineBookBlob(bookId) {
  const book = await getOfflineBook(bookId);
  if (!book?.fileBuffer) return null;
  return new Blob([book.fileBuffer], { type: book.mimeType || 'application/octet-stream' });
}

/**
 * Retrieves the raw ArrayBuffer of the book file from IndexedDB.
 * Ideal for direct instantiation in epub.js and PDF.js.
 */
export async function getOfflineBookArrayBuffer(bookId) {
  const book = await getOfflineBook(bookId);
  return book?.fileBuffer || null;
}

/**
 * Retrieves lightweight list of all offline books for library UI (without heavy blobs).
 */
export async function getOfflineBooksList() {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        // Project lightweight metadata objects without heavy fileBlob
        const list = records.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          format: b.format,
          filename: b.filename,
          size: b.size,
          size_formatted: b.size_formatted,
          shelf: b.shelf,
          shelf_display: b.shelf_display,
          folder_display: b.folder_display,
          description: b.description,
          tags: b.tags,
          downloadedAt: b.downloadedAt,
          progress: b.progress,
          is_offline: true,
          cover_url: `/api/cover/${b.id}`,
          has_cover: Boolean(b.coverBuffer),
        }));
        resolve(list);
      };

      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Gets a blob for the offline cover of a book, or null if none.
 */
export async function getOfflineCoverBlob(bookId) {
  const book = await getOfflineBook(bookId);
  if (!book?.coverBuffer) return null;
  return new Blob([book.coverBuffer], { type: book.coverMimeType || 'image/jpeg' });
}

/**
 * Calculates total storage usage of offline books.
 */
export async function getOfflineStorageStats() {
  try {
    const list = await getOfflineBooksList();
    const count = list.length;
    const totalBytes = list.reduce((acc, b) => acc + (b.size || 0), 0);
    return {
      count,
      totalBytes,
      formattedSize: formatBytes(totalBytes),
    };
  } catch {
    return { count: 0, totalBytes: 0, formattedSize: '0 B' };
  }
}

/**
 * Queues reading progress update while offline and updates local book record.
 */
export async function saveOfflineProgress(bookId, progressData) {
  if (!bookId) return;

  try {
    const db = await initDB();

    // 1. Update progress in offline books store if stored
    const book = await getOfflineBook(bookId);
    if (book) {
      book.progress = {
        ...book.progress,
        ...progressData,
        updated_at: Date.now(),
      };
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      tx.objectStore(STORE_BOOKS).put(book);
    }

    // 2. Queue for server sync
    const queueTx = db.transaction(STORE_QUEUE, 'readwrite');
    const queueStore = queueTx.objectStore(STORE_QUEUE);
    const queueEntry = {
      book_id: bookId,
      ...progressData,
      queued_at: Date.now(),
    };
    queueStore.put(queueEntry);

    // 3. If currently online, attempt immediate sync
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncPendingProgress().catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to save offline progress:', err);
  }
}

/**
 * Flushes all queued offline progress records to the server.
 */
export async function syncPendingProgress() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  try {
    const db = await initDB();

    // Read all queued items
    const queuedItems = await new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (queuedItems.length === 0) return;

    // Send each queued progress update to the backend
    for (const item of queuedItems) {
      try {
        const resp = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            book_id: item.book_id,
            cfi: item.cfi,
            page: item.page,
            percent: item.percent,
            status: item.status,
          }),
        });

        if (resp.ok) {
          // Remove from queue upon success
          const delTx = db.transaction(STORE_QUEUE, 'readwrite');
          delTx.objectStore(STORE_QUEUE).delete(item.book_id);
        }
      } catch {
        // Break on network error, will retry on next online event
        break;
      }
    }
  } catch (err) {
    console.warn('Error syncing pending progress:', err);
  }
}

// Auto-sync listener when browser reconnects to network
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingProgress().catch(() => {});
  });
}
