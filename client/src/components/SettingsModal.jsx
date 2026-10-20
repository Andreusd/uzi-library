import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, Folder, CheckCircle, AlertCircle, AlertTriangle, 
  X, Plus, Trash2, Edit3, Check, Globe, ShieldCheck, ArrowRight, Sliders, RefreshCw
} from 'lucide-react';
import { useI18n } from '../i18n';
import { FlagUS, FlagBR, FlagES, FlagFR } from './FlagIcons';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onLibraryChanged,
  showFileExtension,
  onToggleFileExtension,
  bookAnimations,
  onToggleBookAnimations
}) {
  const { t, lang, setLang } = useI18n();
  const [libraries, setLibraries] = useState([]);
  const [activeLibraryId, setActiveLibraryId] = useState('');
  const [_loading, setLoading] = useState(true);

  // Local fallback for showFileExtension
  const [localShowFileExtension, setLocalShowFileExtension] = useState(() => {
    try {
      const saved = localStorage.getItem('show_file_extension');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const isShowExt = showFileExtension !== undefined ? showFileExtension : localShowFileExtension;

  const handleToggleShowFileExtension = (e) => {
    const val = e.target.checked;
    setLocalShowFileExtension(val);
    try {
      localStorage.setItem('show_file_extension', String(val));
    } catch {}
    if (onToggleFileExtension) {
      onToggleFileExtension(val);
    }
    fetch('/api/settings/display', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_file_extension: val })
    }).catch(() => {});
  };

  // Local fallback for bookAnimations
  const [localBookAnimations, setLocalBookAnimations] = useState(() => {
    try {
      const saved = localStorage.getItem('book_animations');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const isAnimations = bookAnimations !== undefined ? bookAnimations : localBookAnimations;

  const handleToggleBookAnimations = (e) => {
    const val = e.target.checked;
    setLocalBookAnimations(val);
    try {
      localStorage.setItem('book_animations', String(val));
    } catch {}
    if (onToggleBookAnimations) {
      onToggleBookAnimations(val);
    }
    fetch('/api/settings/display', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_animations: val })
    }).catch(() => {});
  };

  // Add Library form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPath, setAddPath] = useState('');
  const [addSetActive, setAddSetActive] = useState(true);
  const [addValidation, setAddValidation] = useState(null);
  const [addValidating, setAddValidating] = useState(false);
  const [adding, setAdding] = useState(false);

  // Edit Library state
  const [editingLibId, setEditingLibId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [editValidation, setEditValidation] = useState(null);
  const [_editValidating, setEditValidating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Deleting library state
  const [deletingId, setDeletingId] = useState(null);

  // Rescan state
  const [rescanning, setRescanning] = useState(false);
  const [rescanningLibId, setRescanningLibId] = useState(null);
  const [rescanFeedback, setRescanFeedback] = useState(null);

  const debounceAddRef = useRef(null);
  const debounceEditRef = useRef(null);

  // Fetch libraries on open
  const loadLibraries = () => {
    setLoading(true);
    fetch('/api/libraries')
      .then(res => res.json())
      .then(data => {
        setLibraries(data.libraries || []);
        setActiveLibraryId(data.active_library_id || '');
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load libraries:', err);
        setLoading(false);
      });
  };

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setShowAddForm(false);
      setEditingLibId(null);
      setAddName('');
      setAddPath('');
      setAddValidation(null);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/libraries')
      .then(res => res.json())
      .then(data => {
        if (!active) return;
        setLibraries(data.libraries || []);
        setActiveLibraryId(data.active_library_id || '');
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        console.error('Failed to load libraries:', err);
        setLoading(false);
      });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  // Live validation for Add Library
  const handleAddPathChange = (value) => {
    setAddPath(value);
    if (debounceAddRef.current) clearTimeout(debounceAddRef.current);
    if (!value.trim()) {
      setAddValidation(null);
      setAddValidating(false);
      return;
    }

    setAddValidating(true);
    debounceAddRef.current = setTimeout(() => {
      fetch('/api/settings/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: value.trim() })
      })
      .then(res => res.json())
      .then(data => {
        setAddValidation(data);
        setAddValidating(false);
        // Autofill name from folder basename if user hasn't typed a name yet
        if (!addName.trim() && data.normalized_path) {
          const parts = data.normalized_path.replace(/\\/g, '/').split('/').filter(Boolean);
          if (parts.length > 0) {
            setAddName(parts[parts.length - 1]);
          }
        }
      })
      .catch(() => setAddValidating(false));
    }, 350);
  };

  // Submit Add Library
  const handleAddLibrary = (e) => {
    e.preventDefault();
    if (!addPath.trim()) return;

    setAdding(true);
    fetch('/api/libraries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addName.trim() || undefined,
        path: addPath.trim(),
        set_active: addSetActive
      })
    })
    .then(res => res.json())
    .then(data => {
      setAdding(false);
      if (data.status === 'ok') {
        setShowAddForm(false);
        setAddName('');
        setAddPath('');
        setAddValidation(null);
        loadLibraries();
        if (onLibraryChanged) {
          onLibraryChanged(data.active_library_id);
        }
      } else {
        alert(data.detail || 'Failed to add library');
      }
    })
    .catch(err => {
      console.error('Error adding library:', err);
      setAdding(false);
    });
  };

  // Switch Active Library
  const handleSetActive = (libId) => {
    fetch('/api/libraries/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library_id: libId })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'ok') {
        setActiveLibraryId(libId);
        loadLibraries();
        if (onLibraryChanged) {
          onLibraryChanged(libId);
        }
      }
    })
    .catch(err => console.error('Failed to set active library:', err));
  };

  // Start Editing Library
  const startEditing = (lib) => {
    setEditingLibId(lib.id);
    setEditName(lib.name);
    setEditPath(lib.path);
    setEditValidation(null);
  };

  // Live validation for Edit Library
  const handleEditPathChange = (value) => {
    setEditPath(value);
    if (debounceEditRef.current) clearTimeout(debounceEditRef.current);
    if (!value.trim()) {
      setEditValidation(null);
      setEditValidating(false);
      return;
    }

    setEditValidating(true);
    debounceEditRef.current = setTimeout(() => {
      fetch('/api/settings/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: value.trim() })
      })
      .then(res => res.json())
      .then(data => {
        setEditValidation(data);
        setEditValidating(false);
      })
      .catch(() => setEditValidating(false));
    }, 350);
  };

  // Save Edit Library
  const handleSaveEdit = (libId) => {
    setSavingEdit(true);
    fetch(`/api/libraries/${encodeURIComponent(libId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        path: editPath.trim()
      })
    })
    .then(res => res.json())
    .then(data => {
      setSavingEdit(false);
      if (data.status === 'ok') {
        setEditingLibId(null);
        loadLibraries();
        if (onLibraryChanged) {
          onLibraryChanged(activeLibraryId);
        }
      } else {
        alert(data.detail || 'Failed to update library');
      }
    })
    .catch(err => {
      console.error('Error saving library edits:', err);
      setSavingEdit(false);
    });
  };

  // Delete Library
  const handleDeleteLibrary = (lib) => {
    if (libraries.length <= 1) {
      alert(t('cannotDeleteOnlyLibrary'));
      return;
    }

    const confirmMsg = t('deleteLibraryConfirm', { name: lib.name });
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(lib.id);
    fetch(`/api/libraries/${encodeURIComponent(lib.id)}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      setDeletingId(null);
      if (data.status === 'ok') {
        loadLibraries();
        if (onLibraryChanged) {
          onLibraryChanged(data.active_library_id);
        }
      }
    })
    .catch(err => {
      console.error('Failed to delete library:', err);
      setDeletingId(null);
    });
  };

  // Rescan Library (Active, Specific, or All)
  const handleRescan = (targetLibId = null) => {
    if (targetLibId) {
      setRescanningLibId(targetLibId);
    } else {
      setRescanning(true);
    }
    setRescanFeedback(null);

    const url = targetLibId
      ? `/api/libraries/${encodeURIComponent(targetLibId)}/rescan`
      : '/api/libraries/rescan';

    fetch(url, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (targetLibId) {
          setRescanningLibId(null);
        } else {
          setRescanning(false);
        }
        if (data.status === 'ok') {
          loadLibraries();
          if (onLibraryChanged) {
            onLibraryChanged(activeLibraryId || data.library_id);
          }
          const totalBooks = data.books_count !== undefined 
            ? data.books_count 
            : (data.stats && Object.values(data.stats).reduce((acc, s) => acc + (s.books || 0), 0));
          setRescanFeedback({
            type: 'success',
            message: t('rescanSuccess', { books: totalBooks ?? 'OK' })
          });
          setTimeout(() => setRescanFeedback(null), 4000);
        } else {
          setRescanFeedback({
            type: 'error',
            message: data.detail || 'Failed to rescan'
          });
        }
      })
      .catch(err => {
        console.error('Failed to rescan library:', err);
        if (targetLibId) {
          setRescanningLibId(null);
        } else {
          setRescanning(false);
        }
        setRescanFeedback({
          type: 'error',
          message: 'Error communicating with server'
        });
      });
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      data-testid="settings-modal-backdrop"
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100">{t('settingsTitle')}</h3>
              <p className="text-[11px] text-neutral-400">{t('settingsSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Language Selection */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('languageLabel')}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { code: 'en', label: 'English (US)', Flag: FlagUS },
                { code: 'pt', label: 'Português (Brasil)', Flag: FlagBR },
                { code: 'es', label: 'Español (España)', Flag: FlagES },
                { code: 'fr', label: 'Français (France)', Flag: FlagFR },
              ].map(({ code, label, Flag }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    lang === code
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300 ring-1 ring-amber-500/40'
                      : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Flag className="w-5 h-3.5 shadow-xs" />
                    <span>{label}</span>
                  </div>
                  {lang === code && <Check className="w-3.5 h-3.5 text-amber-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Display Preferences */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('displayPreferences')}</span>
            </label>
            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-200 block">
                    {t('showFileExtension')}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.2 text-[8px] font-bold rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 uppercase">
                      EPUB
                    </span>
                    <span className="px-1.5 py-0.2 text-[8px] font-bold rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 uppercase">
                      PDF
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-neutral-400 block mt-0.5">
                  {t('showFileExtensionDesc')}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isShowExt}
                  onChange={handleToggleShowFileExtension}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 border border-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:border-amber-500" />
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-neutral-200 block">
                  {t('bookAnimations')}
                </span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">
                  {t('bookAnimationsDesc')}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={isAnimations}
                  onChange={handleToggleBookAnimations}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 border border-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:border-amber-500" />
              </label>
            </div>
          </div>

          {/* Manage Libraries Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('libraries')}</span>
                </label>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {t('booksIsolatedNotice')}
                </p>
              </div>

              {!showAddForm && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRescan()}
                    disabled={rescanning || rescanningLibId !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    title={t('rescanLibrary')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${rescanning ? 'animate-spin' : ''}`} />
                    <span>{rescanning ? t('rescanning') : t('rescanLibrary')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addLibrary')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Rescan feedback banner */}
            {rescanFeedback && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
                rescanFeedback.type === 'success'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              }`}>
                {rescanFeedback.type === 'success' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{rescanFeedback.message}</span>
              </div>
            )}

            {/* Add Library Expandable Form */}
            {showAddForm && (
              <form onSubmit={handleAddLibrary} className="p-4 rounded-xl bg-neutral-950/80 border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                  <span className="text-xs font-bold text-amber-400">{t('addNewLibrary')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddValidation(null);
                    }}
                    className="p-1 rounded text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">{t('libraryName')}</label>
                    <input
                      type="text"
                      placeholder={t('libraryNamePlaceholder')}
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-300 mb-1">{t('libraryPath')}</label>
                    <input
                      type="text"
                      placeholder={t('libraryPathPlaceholder')}
                      value={addPath}
                      onChange={(e) => handleAddPathChange(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 font-mono focus:outline-none focus:border-amber-500"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Validation Status Preview */}
                {addValidating && (
                  <p className="text-[11px] text-amber-400 animate-pulse">Verifying directory...</p>
                )}
                {addValidation && !addValidating && (
                  <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    addValidation.valid && addValidation.book_count > 0
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                      : addValidation.exists && addValidation.book_count === 0
                      ? 'bg-amber-950/20 border-amber-500/40 text-amber-300'
                      : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                  }`}>
                    {addValidation.valid && addValidation.book_count > 0 ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span className="text-[11px]">
                      {addValidation.valid && addValidation.book_count > 0
                        ? t('validFolder', { books: addValidation.book_count, folders: addValidation.folder_count })
                        : addValidation.error === 'no_pdfs_found'
                        ? t('noPdfsFound')
                        : addValidation.error === 'not_a_directory'
                        ? t('notADirectory')
                        : t('pathNotFound')}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={addSetActive}
                      onChange={(e) => setAddSetActive(e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    <span>{t('setActive')}</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={adding || (addValidation && !addValidation.valid)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-neutral-950 font-semibold text-xs hover:bg-amber-400 disabled:opacity-50 transition cursor-pointer"
                    >
                      {adding ? 'Saving...' : t('addLibrary')}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Libraries List */}
            <div className="space-y-2">
              {libraries.map((lib) => {
                const isActive = lib.id === activeLibraryId;
                const isEditing = editingLibId === lib.id;

                if (isEditing) {
                  return (
                    <div key={lib.id} className="p-3.5 rounded-xl bg-neutral-950 border border-amber-500/40 space-y-3">
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-0.5">{t('libraryName')}</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-neutral-400 mb-0.5">{t('libraryPath')}</label>
                          <input
                            type="text"
                            value={editPath}
                            onChange={(e) => handleEditPathChange(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      {editValidation && (
                        <p className={`text-[10px] ${editValidation.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {editValidation.valid 
                            ? t('validFolder', { books: editValidation.book_count, folders: editValidation.folder_count })
                            : editValidation.error}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingLibId(null)}
                          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(lib.id)}
                          disabled={savingEdit}
                          className="px-3 py-1 bg-amber-500 text-neutral-950 rounded-lg text-xs font-semibold hover:bg-amber-400 transition"
                        >
                          {savingEdit ? 'Saving...' : t('saveName')}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={lib.id}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isActive 
                        ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20' 
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-100 truncate">{lib.name}</span>
                        {isActive && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            {t('activeBadge')}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] font-mono text-neutral-400 truncate mt-0.5" title={lib.path}>
                        {lib.path}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                        {lib.valid ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            {t('validFolder', { books: lib.book_count, folders: lib.folder_count })}
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            {lib.error || t('pathNotFound')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRescan(lib.id)}
                        disabled={rescanningLibId === lib.id || rescanning}
                        className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        title={t('rescanLibrary')}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${rescanningLibId === lib.id ? 'animate-spin text-amber-400' : ''}`} />
                      </button>

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSetActive(lib.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 transition cursor-pointer flex items-center gap-1"
                          title={t('switchLibrary')}
                        >
                          <span>{t('setActive')}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEditing(lib)}
                        className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition"
                        title={t('editLibrary')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {libraries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLibrary(lib)}
                          disabled={deletingId === lib.id}
                          className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                          title={t('deleteLibrary')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl flex items-center gap-2.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{t('librarySafe')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800/80 bg-neutral-900 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition cursor-pointer"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
