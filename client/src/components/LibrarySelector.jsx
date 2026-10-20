import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Library, Folder, BookOpen, Plus, ArrowRight, Settings, 
  AlertTriangle, User, Users, Edit2, Check, Sparkles, Trash2
} from 'lucide-react';
import { useI18n } from '../i18n';
import AppLogo from './AppLogo';
import LanguageSelector from './LanguageSelector';

export default function LibrarySelector({
  libraries = [],
  onSelectLibrary,
  onOpenSettings,
  onAddNewLibrary,
  currentUser = '',
  onUserChange
}) {
  const { t } = useI18n();
  const [prevUser, setPrevUser] = useState(currentUser);
  const [isEditingUser, setIsEditingUser] = useState(!currentUser);
  const [usernameInput, setUsernameInput] = useState(currentUser || '');
  const [existingUsers, setExistingUsers] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef(null);

  if (currentUser !== prevUser) {
    setPrevUser(currentUser);
    setUsernameInput(currentUser || '');
    if (!currentUser) {
      setIsEditingUser(true);
    }
  }

  // Load existing users from backend
  const loadUsers = useCallback(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.users)) {
          setExistingUsers(data.users);
          if (!currentUser && data.users.length > 0 && !usernameInput) {
            setUsernameInput(data.users[0].username);
          }
        }
      })
      .catch(() => {});
  }, [currentUser, usernameInput]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSaveUser = (nameToSave) => {
    const clean = (nameToSave !== undefined ? nameToSave : usernameInput).trim();
    if (!clean) {
      setErrorMessage(t('userRequired'));
      inputRef.current?.focus();
      return;
    }

    setErrorMessage('');
    setIsEditingUser(false);
    if (onUserChange) {
      onUserChange(clean);
    }

    // Register / touch user on backend
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: clean })
    })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.users)) {
          setExistingUsers(data.users);
        }
      })
      .catch(() => {});
  };

  const handleSelectExistingUser = (name) => {
    setUsernameInput(name);
    handleSaveUser(name);
  };

  const handleConfirmDelete = async (usernameToDelete) => {
    if (!usernameToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(usernameToDelete)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data && Array.isArray(data.users)) {
        setExistingUsers(data.users);
      } else {
        loadUsers();
      }

      // If deleted user was current active user
      if (currentUser && currentUser.toLowerCase() === usernameToDelete.toLowerCase()) {
        if (onUserChange) {
          onUserChange('');
        }
        setUsernameInput('');
        setIsEditingUser(true);
      } else if (usernameInput && usernameInput.toLowerCase() === usernameToDelete.toLowerCase()) {
        setUsernameInput('');
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      setErrorMessage(t('error') || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  };

  const matchingExistingUser = existingUsers.find(
    (u) => usernameInput && u.slug === usernameInput.trim().toLowerCase()
  );

  const handleLibraryClick = (libraryId) => {
    if (!currentUser) {
      setIsEditingUser(true);
      setErrorMessage(t('userRequired'));
      inputRef.current?.focus();
      return;
    }
    onSelectLibrary(libraryId);
  };

  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-y-auto lg:overflow-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Header Bar */}
      <header className="h-15 sm:h-16 px-6 sm:px-8 border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <AppLogo className="w-9 h-9" />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-neutral-100 tracking-tight leading-tight">
              {t('appTitle')}
            </h1>
            <p className="text-[11px] text-neutral-400 font-medium">
              {t('libraries')}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Active User Chip / Switcher */}
          {currentUser && !isEditingUser ? (
            <button
              onClick={() => {
                setIsEditingUser(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 text-neutral-200 hover:text-amber-300 transition text-xs font-medium cursor-pointer shadow-xs group"
              title={t('switchUser')}
            >
              <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <User className="w-2.5 h-2.5" />
              </div>
              <span className="font-semibold tracking-wide truncate max-w-[140px] sm:max-w-[180px]">
                {currentUser}
              </span>
              <Edit2 className="w-3 h-3 text-neutral-500 group-hover:text-amber-400 transition-colors ml-0.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                setIsEditingUser(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition text-xs font-semibold cursor-pointer shadow-xs"
              title={t('whoIsReading')}
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('whoIsReading')}</span>
            </button>
          )}

          {/* Language Switcher with Flags */}
          <LanguageSelector />

          {/* Settings / Manage Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-amber-400 hover:border-amber-500/30 transition shadow-xs cursor-pointer"
            title={t('settings')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body (spacious max-w-[1400px], fits viewport without scrollbar) */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 sm:px-10 py-6 sm:py-8 lg:py-10 flex flex-col justify-center">
        {/* User Selection Banner (prominent if no user or when editing) */}
        {isEditingUser ? (
          <div className="max-w-md w-full mx-auto mb-4 p-4 sm:p-5 rounded-xl bg-neutral-900/95 border border-amber-500/40 shadow-xl backdrop-blur-md relative overflow-hidden animate-in fade-in duration-200 shrink-0">
            {userToDelete ? (
              <div className="animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-100">
                      {t('deleteUserTitle', { name: userToDelete })}
                    </h3>
                    <p className="text-[11px] text-rose-400 font-medium">
                      {t('deleteUserConfirmDesc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setUserToDelete(null)}
                    className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleConfirmDelete(userToDelete)}
                    className="py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg shadow-md shadow-rose-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDeleting ? '...' : t('deleteUserBtn')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-100">{t('whoIsReading')}</h3>
                    <p className="text-[11px] text-neutral-400">{t('enterUsername')}</p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveUser();
                  }}
                  className="space-y-2.5"
                >
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder={t('usernamePlaceholder')}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-750 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-500 outline-hidden transition shadow-inner"
                      autoFocus
                      maxLength={32}
                    />
                  </div>

                  {errorMessage && (
                    <div className="text-xs text-rose-400 flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Quick Select from Existing Users */}
                  {existingUsers.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 mb-1.5">
                        <Users className="w-3 h-3 text-amber-500/70" />
                        <span>{t('recentUsers')}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                        {existingUsers.map((u) => {
                          const isSelected = currentUser && u.slug === currentUser.toLowerCase();
                          return (
                            <div
                              key={u.slug}
                              className={`group/user pl-2 pr-1 py-0.5 rounded-md text-[11px] font-medium transition flex items-center gap-1 border ${
                                isSelected
                                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                                  : 'bg-neutral-800/70 hover:bg-neutral-800 border-neutral-700/60 text-neutral-300 hover:text-neutral-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectExistingUser(u.username)}
                                className="flex items-center gap-1.5 cursor-pointer text-left focus:outline-hidden"
                                title={u.username}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shrink-0" />
                                <span className="truncate max-w-[110px]">{u.username}</span>
                                {isSelected && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserToDelete(u.username);
                                }}
                                className="p-0.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/20 transition opacity-60 group-hover/user:opacity-100 cursor-pointer"
                                title={t('deleteUser')}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('startReading')}</span>
                    </button>
                    {matchingExistingUser && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete(matchingExistingUser.username)}
                        className="py-2 px-2.5 bg-neutral-800 hover:bg-rose-950/40 border border-neutral-750 hover:border-rose-500/40 text-neutral-400 hover:text-rose-400 text-xs rounded-lg transition cursor-pointer"
                        title={t('deleteUser')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {currentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingUser(false);
                          setUsernameInput(currentUser);
                          setErrorMessage('');
                        }}
                        className="py-2 px-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg transition cursor-pointer"
                      >
                        {t('cancel')}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        ) : null}

        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8 shrink-0">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-100 tracking-tight leading-tight">
            {t('selectLibraryTitle')}
          </h2>

          <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
            {currentUser ? (
              <span className="inline-flex items-center gap-2 text-neutral-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{t('currentUser', { name: currentUser })}</span>
                <span className="text-neutral-600">•</span>
                <button
                  onClick={() => setIsEditingUser(true)}
                  className="text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer ml-0.5"
                >
                  {t('changeUser')}
                </button>
              </span>
            ) : (
              t('selectLibrarySubtitle')
            )}
          </p>
        </div>

        {/* Libraries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {libraries.map((lib) => {
            const hasCovers = lib.sample_covers && lib.sample_covers.length > 0;
            const bookCount = lib.book_count || 0;
            const folderCount = lib.folder_count || 0;
            const isValid = lib.valid !== false;

            return (
              <div
                key={lib.id}
                onClick={() => handleLibraryClick(lib.id)}
                className="group relative bg-neutral-900/70 hover:bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 rounded-2xl p-5 sm:p-6 transition-all duration-300 shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 flex flex-col justify-between cursor-pointer overflow-hidden isolate"
              >
                {/* Visual Cover Preview Stack */}
                <div className="w-full h-44 sm:h-48 md:h-52 mb-4 relative rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-center overflow-hidden isolate">
                  {hasCovers ? (
                    <div className="relative w-full h-full flex items-center justify-center p-3">
                      {lib.sample_covers.slice(0, 4).map((coverUrl, idx) => {
                        const total = Math.min(lib.sample_covers.length, 4);
                        const rotations = [-8, -3, 3, 8];
                        const xOffsets = [-30, -10, 10, 30];
                        const zIndexes = [10, 20, 30, 40];

                        const rot = total === 1 ? 0 : rotations[idx] || 0;
                        const xOff = total === 1 ? 0 : xOffsets[idx] || 0;
                        const zIdx = zIndexes[idx] || 10;

                        return (
                          <div
                            key={idx}
                            style={{
                              transform: `translateX(${xOff}px) rotate(${rot}deg)`,
                              zIndex: zIdx,
                            }}
                            className="absolute w-20 sm:w-22 md:w-24 aspect-[1/1.45] rounded-md shadow-2xl transition-transform duration-300 group-hover:scale-105 border border-white/10 overflow-hidden bg-neutral-900"
                          >
                            <img
                              src={coverUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/60 to-transparent pointer-events-none" />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-neutral-600">
                      <Folder className="w-12 h-12 text-neutral-700 group-hover:text-amber-500/60 transition-colors" />
                      <span className="text-xs text-neutral-500 font-medium">
                        {isValid ? t('noBooksFound') : t('pathNotFound')}
                      </span>
                    </div>
                  )}

                  {/* Format tag badge */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-900/90 text-neutral-300 border border-neutral-750 backdrop-blur-md">
                      PDF • EPUB
                    </span>
                  </div>
                </div>

                {/* Library Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-100 group-hover:text-amber-300 transition-colors truncate leading-snug">
                      {lib.name}
                    </h3>
                    <p 
                      className="text-xs font-mono text-neutral-400 mt-1 truncate flex items-center gap-1.5" 
                      title={lib.path}
                    >
                      <Folder className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span className="truncate">{lib.path}</span>
                    </p>
                  </div>

                  {/* Statistics Badges */}
                  <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 text-neutral-300 text-xs font-medium">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      {bookCount === 1 ? t('bookCountBadge_one') : t('bookCountBadge', { count: bookCount })}
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/80 text-neutral-300 text-xs font-medium">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      {folderCount === 1 ? t('folderCountBadge_one') : t('folderCountBadge', { count: folderCount })}
                    </span>

                    {!isValid && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        {lib.error || 'Error'}
                      </span>
                    )}
                  </div>

                  {/* Open Library Button */}
                  <div className="mt-4 pt-3.5 border-t border-neutral-800/80">
                    <button
                      type="button"
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-neutral-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 border border-amber-500/30 group-hover:border-amber-500/60 shadow-xs cursor-pointer"
                    >
                      <span>{t('openLibrary')}</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add New Library Card */}
          <div
            onClick={onAddNewLibrary || onOpenSettings}
            className="group border-2 border-dashed border-neutral-800 hover:border-amber-500/50 bg-neutral-900/30 hover:bg-neutral-900/60 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer min-h-[350px] lg:min-h-[390px]"
          >
            <div className="w-14 h-14 rounded-2xl bg-neutral-800 group-hover:bg-amber-500/20 border border-neutral-700 group-hover:border-amber-500/40 flex items-center justify-center text-neutral-400 group-hover:text-amber-400 transition-all duration-300 shadow-lg mb-3.5">
              <Plus className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-200 group-hover:text-amber-300 transition-colors">
              {t('addNewLibraryCard')}
            </h3>
            <p className="text-xs text-neutral-400 max-w-[220px] mt-1.5 leading-relaxed">
              {t('addNewLibraryCardDesc')}
            </p>
          </div>
        </div>

        {/* Empty state if no libraries exist */}
        {libraries.length === 0 && (
          <div className="text-center py-10 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-3">
              <Library className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-neutral-100">{t('noLibrariesTitle')}</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-4 leading-relaxed">
              {t('noLibrariesDesc')}
            </p>
            <button
              onClick={onAddNewLibrary || onOpenSettings}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addNewLibrary')}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
