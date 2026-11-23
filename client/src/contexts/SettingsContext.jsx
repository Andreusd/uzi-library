import React, { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, setCurrentUser as setStorageUser } from '../api';
import { SettingsContext } from './settingsContext';

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('app_theme') || 'default';
    } catch {
      return 'default';
    }
  });

  const [mode, setModeState] = useState(() => {
    try {
      return localStorage.getItem('app_mode') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [showFileExtension, setShowFileExtensionState] = useState(() => {
    try {
      const saved = localStorage.getItem('show_file_extension');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [bookAnimations, setBookAnimationsState] = useState(() => {
    try {
      const saved = localStorage.getItem('book_animations');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [sidebarOpen, setSidebarOpenState] = useState(() => {
    try {
      const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
      const key = isDesktop ? 'sidebar_open_desktop' : 'sidebar_open_mobile';
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return saved === 'true';
      }
      return isDesktop;
    } catch {}
    return false;
  });

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app_theme', newTheme);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
      document.documentElement.setAttribute('data-mode', mode);
    }
  }, [mode]);

  const setMode = useCallback((newMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem('app_mode', newMode);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-mode', newMode);
    }
  }, [theme]);

  const setShowFileExtension = useCallback((enabled) => {
    setShowFileExtensionState(enabled);
    try {
      localStorage.setItem('show_file_extension', String(enabled));
    } catch {}
  }, []);

  const setBookAnimations = useCallback((enabled) => {
    setBookAnimationsState(enabled);
    try {
      localStorage.setItem('book_animations', String(enabled));
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpenState((prev) => {
      const next = !prev;
      try {
        const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
        const key = isDesktop ? 'sidebar_open_desktop' : 'sidebar_open_mobile';
        localStorage.setItem(key, String(next));
      } catch {}
      return next;
    });
  }, []);

  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser());

  const setCurrentUser = useCallback((username) => {
    setStorageUser(username);
    setCurrentUserState((username || '').trim());
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-mode', mode);
    }
  }, [theme, mode]);

  useEffect(() => {
    const handleModeEvent = (e) => {
      if (e.detail?.mode && (e.detail.mode === 'dark' || e.detail.mode === 'light')) {
        setModeState(e.detail.mode);
      }
    };
    window.addEventListener('app_mode_change', handleModeEvent);
    return () => window.removeEventListener('app_mode_change', handleModeEvent);
  }, []);

  useEffect(() => {
    const handleUserChanged = (e) => {
      setCurrentUserState((e.detail?.user || '').trim());
    };
    window.addEventListener('uzi_library_user_changed', handleUserChanged);
    window.addEventListener('book_library_user_changed', handleUserChanged);
    return () => {
      window.removeEventListener('uzi_library_user_changed', handleUserChanged);
      window.removeEventListener('book_library_user_changed', handleUserChanged);
    };
  }, []);

  const value = {
    theme,
    setTheme,
    mode,
    setMode,
    showFileExtension,
    setShowFileExtension,
    bookAnimations,
    setBookAnimations,
    sidebarOpen,
    setSidebarOpen: setSidebarOpenState,
    toggleSidebar,
    currentUser,
    setCurrentUser,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
