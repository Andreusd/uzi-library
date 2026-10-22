/**
 * API client utilities, centralized service modules, and fetch interceptor.
 */

export * from './types';

export const USER_STORAGE_KEY = 'uzi_library_user';

export function getCurrentUser() {
  try {
    return (localStorage.getItem(USER_STORAGE_KEY) || localStorage.getItem('book_library_user') || '').trim();
  } catch {
    return '';
  }
}

export function setCurrentUser(username) {
  try {
    const clean = (username || '').trim();
    if (clean) {
      localStorage.setItem(USER_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem('book_library_user');
    }
    // Dispatch event to notify any active components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('uzi_library_user_changed', { detail: { user: clean } }));
      window.dispatchEvent(new CustomEvent('book_library_user_changed', { detail: { user: clean } }));
    }
  } catch (e) {
    console.error('Failed to set current user in localStorage:', e);
  }
}

/**
 * Modern, centralized API fetch utility that automatically attaches
 * the active X-User header to backend requests.
 */
export async function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
  const user = getCurrentUser();
  if (user && !headers.has('X-User')) {
    headers.set('X-User', user);
  }
  return fetch(input, { ...init, headers });
}

/**
 * Common JSON request helper with automatic header injection and error handling.
 */
async function apiJson(url, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await apiFetch(url, { ...init, headers });
  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      if (errBody && (errBody.detail || errBody.error)) {
        errMsg = errBody.detail || errBody.error;
      }
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

/**
 * Books API
 */
export const booksApi = {
  getBooks: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        q.append(k, String(v));
      }
    });
    const qs = q.toString();
    return apiJson(`/api/books${qs ? `?${qs}` : ''}`);
  },

  getBook: (bookId) => apiJson(`/api/book/${encodeURIComponent(bookId)}`),

  saveProgress: (payload) =>
    apiJson('/api/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  saveZoom: (bookId, zoom) =>
    apiJson('/api/book/zoom', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, zoom }),
    }),

  saveNightMode: (bookId, invertColors) =>
    apiJson('/api/book/night-mode', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, invert_colors: invertColors }),
    }),

  updateStatus: (bookId, status) =>
    apiJson('/api/book/status', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId, status }),
    }),

  getContinueReading: (libraryId, format) => {
    const q = new URLSearchParams();
    if (libraryId) q.append('library_id', libraryId);
    if (format && format !== 'all') q.append('format', format);
    const qs = q.toString();
    return apiJson(`/api/continue-reading${qs ? `?${qs}` : ''}`);
  },

  getFavorites: (libraryId, format) => {
    const q = new URLSearchParams();
    if (libraryId) q.append('library_id', libraryId);
    if (format && format !== 'all') q.append('format', format);
    const qs = q.toString();
    return apiJson(`/api/favorites${qs ? `?${qs}` : ''}`);
  },

  getReadBooks: (libraryId, format) => {
    const q = new URLSearchParams();
    if (libraryId) q.append('library_id', libraryId);
    if (format && format !== 'all') q.append('format', format);
    const qs = q.toString();
    return apiJson(`/api/read-books${qs ? `?${qs}` : ''}`);
  },

  toggleFavorite: (bookId) =>
    apiJson('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId }),
    }),
};

/**
 * Folders & Shelves API
 */
export const foldersApi = {
  getFolders: (libraryId) => {
    const q = libraryId ? `?library_id=${encodeURIComponent(libraryId)}` : '';
    return apiJson(`/api/folders${q}`);
  },

  renameFolder: (payload) =>
    apiJson('/api/folders/rename', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  setFolderIcon: (payload) =>
    apiJson('/api/folders/icon', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/**
 * Libraries API
 */
export const librariesApi = {
  getLibraries: (libraryId) => {
    const q = libraryId ? `?library_id=${encodeURIComponent(libraryId)}` : '';
    return apiJson(`/api/libraries${q}`);
  },

  addLibrary: (payload) =>
    apiJson('/api/libraries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateLibrary: (libraryId, payload) =>
    apiJson(`/api/libraries/${encodeURIComponent(libraryId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteLibrary: (libraryId) =>
    apiJson(`/api/libraries/${encodeURIComponent(libraryId)}`, {
      method: 'DELETE',
    }),

  setActiveLibrary: (libraryId) =>
    apiJson('/api/libraries/active', {
      method: 'POST',
      body: JSON.stringify({ library_id: libraryId }),
    }),

  rescanLibrary: (libraryId) => {
    const url = libraryId
      ? `/api/libraries/${encodeURIComponent(libraryId)}/rescan`
      : '/api/libraries/rescan';
    return apiJson(url, { method: 'POST' });
  },
};

/**
 * Settings API
 */
export const settingsApi = {
  getSettings: (libraryId) => {
    const q = libraryId ? `?library_id=${encodeURIComponent(libraryId)}` : '';
    return apiJson(`/api/settings${q}`);
  },

  saveSettings: (libraryPath) =>
    apiJson('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ library_path: libraryPath }),
    }),

  validatePath: (path) =>
    apiJson('/api/settings/validate', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  updateDisplay: (showFileExtension) =>
    apiJson('/api/settings/display', {
      method: 'POST',
      body: JSON.stringify({ show_file_extension: showFileExtension }),
    }),
};

/**
 * Users API
 */
export const usersApi = {
  getUsers: () => apiJson('/api/users'),

  registerUser: (username) =>
    apiJson('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  getCurrentUserProfile: () => apiJson('/api/users/current'),

  deleteUser: (username) =>
    apiJson(`/api/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
    }),
};

/**
 * Virtual Tags API
 */
export const tagsApi = {
  getTags: (libraryId) => {
    const q = libraryId ? `?library_id=${encodeURIComponent(libraryId)}` : '';
    return apiJson(`/api/tags${q}`);
  },

  createTag: (payload) =>
    apiJson('/api/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTag: (tagId, payload, libraryId) => {
    const q = libraryId ? `?library_id=${encodeURIComponent(libraryId)}` : '';
    return apiJson(`/api/tags/${encodeURIComponent(tagId)}${q}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteTag: (tagId, libraryId) => {
    const q = libraryId ? `?library_id=${encodeURIComponent(libraryId)}` : '';
    return apiJson(`/api/tags/${encodeURIComponent(tagId)}${q}`, {
      method: 'DELETE',
    });
  },

  toggleBookTag: (bookId, tagId) =>
    apiJson(`/api/books/${encodeURIComponent(bookId)}/tags/toggle`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    }),

  setBookTags: (bookId, tagIds) =>
    apiJson(`/api/books/${encodeURIComponent(bookId)}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids: tagIds }),
    }),
};

/**
 * Annotations API
 */
export const annotationsApi = {
  getAnnotations: (bookId) => apiJson(`/api/annotations/${encodeURIComponent(bookId)}`),

  createAnnotation: (payload) =>
    apiJson('/api/annotations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAnnotation: (bookId, annotationId, payload) =>
    apiJson(`/api/annotations/${encodeURIComponent(bookId)}/${encodeURIComponent(annotationId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteAnnotation: (bookId, annotationId) =>
    apiJson(`/api/annotations/${encodeURIComponent(bookId)}/${encodeURIComponent(annotationId)}`, {
      method: 'DELETE',
    }),
};

/**
 * Word Lookup & Translation API
 */
export const lookupApi = {
  defineWord: (word, lang = 'en') =>
    apiJson(`/api/lookup/define?word=${encodeURIComponent(word)}&lang=${encodeURIComponent(lang)}`),

  translateText: (text, targetLang = 'pt', sourceLang = 'auto') =>
    apiJson('/api/lookup/translate', {
      method: 'POST',
      body: JSON.stringify({ text, target_lang: targetLang, source_lang: sourceLang }),
    }),
};

/**
 * Sets up a safe fetch interceptor on window.fetch as a backward-compatible
 * safety net to automatically inject the X-User header into /api endpoints.
 */
let isInterceptorSetup = false;

export function setupFetchInterceptor() {
  if (isInterceptorSetup || typeof window === 'undefined') return;
  isInterceptorSetup = true;

  const originalFetch = window.fetch;
  window.fetch = function (input, init = {}) {
    try {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof Request) {
        url = input.url;
      } else if (input && typeof input.href === 'string') {
        url = input.href;
      }

      const isApiRequest =
        url.startsWith('/api') ||
        url.includes('/api/') ||
        (typeof window !== 'undefined' && url.startsWith(`${window.location.origin}/api`));

      if (isApiRequest) {
        const user = getCurrentUser();
        if (user) {
          const headers = new Headers(init.headers || (input instanceof Request ? input.headers : {}));
          if (!headers.has('X-User')) {
            headers.set('X-User', user);
          }
          init = { ...init, headers };
        }
      }
    } catch (err) {
      console.warn('Error inside fetch interceptor:', err);
    }

    return originalFetch(input, init);
  };
}
