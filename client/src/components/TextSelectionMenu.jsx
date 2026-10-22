import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, Copy, Check, X, BookOpen, Languages, 
  Volume2, ChevronLeft, Loader2, ExternalLink,
  Headphones, Globe 
} from 'lucide-react';
import { useI18n } from '../i18n';

const COLORS = [
  { id: 'yellow', bg: 'bg-amber-400', ring: 'focus:ring-amber-400', name: 'colorYellow' },
  { id: 'green', bg: 'bg-emerald-400', ring: 'focus:ring-emerald-400', name: 'colorGreen' },
  { id: 'blue', bg: 'bg-sky-400', ring: 'focus:ring-sky-400', name: 'colorBlue' },
  { id: 'purple', bg: 'bg-purple-400', ring: 'focus:ring-purple-400', name: 'colorPurple' },
  { id: 'rose', bg: 'bg-rose-400', ring: 'focus:ring-rose-400', name: 'colorRose' },
];

const TARGET_LANGUAGES = [
  { code: 'pt', label: 'PT', name: 'Português' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Español' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
];

export default function TextSelectionMenu({ 
  x, 
  y, 
  selectedText, 
  onHighlight, 
  onClose,
  onReadAloud
}) {
  const { t, lang: uiLang } = useI18n();
  const menuRef = useRef(null);

  // Views: 'main' | 'comment' | 'define' | 'translate'
  const [view, setView] = useState('main');
  const [commentText, setCommentText] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');

  // Definition state
  const [defLoading, setDefLoading] = useState(false);
  const [defData, setDefData] = useState(null);
  const [defError, setDefError] = useState(null);

  // Translation state
  const defaultTargetLang = uiLang === 'pt' ? 'pt' : 'en';
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [transLoading, setTransLoading] = useState(false);
  const [transData, setTransData] = useState(null);
  const [transError, setTransError] = useState(null);
  const [transCopied, setTransCopied] = useState(false);

  // Clean word for dictionary lookup
  const cleanWord = (selectedText || '').trim().replace(/^[^\w\u00C0-\u017F]+|[^\w\u00C0-\u017F]+$/g, '');

  // Text-to-Speech handler
  const handleSpeak = useCallback((text, langCode = 'en-US') => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Cancel any ongoing speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Close on outside click or escape
  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates dynamically based on current view size
  const getMenuDimensions = useCallback(() => {
    switch (view) {
      case 'define':
        return { width: 330, height: 380 };
      case 'translate':
        return { width: 330, height: 360 };
      case 'comment':
        return { width: 280, height: 260 };
      default:
        return { width: 240, height: onReadAloud ? 295 : 255 };
    }
  }, [view, onReadAloud]);

  const { width: menuWidth, height: menuHeight } = getMenuDimensions();
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 768;

  // Center horizontally over target coordinates, and position above selection when space permits
  const posX = Math.max(12, Math.min(x - menuWidth / 2, winW - menuWidth - 12));
  const posY = y - menuHeight - 12 >= 12
    ? (y - menuHeight - 12)
    : Math.max(12, Math.min(y + 24, winH - menuHeight - 12));

  // Ensure DOM element stays strictly within viewport boundaries even if dynamic content expands
  useLayoutEffect(() => {
    if (menuRef.current && typeof window !== 'undefined') {
      const rect = menuRef.current.getBoundingClientRect();
      const bottomOverflow = rect.bottom - (window.innerHeight - 12);
      if (bottomOverflow > 0) {
        menuRef.current.style.top = `${Math.max(12, rect.top - bottomOverflow)}px`;
      }
      const rightOverflow = rect.right - (window.innerWidth - 12);
      if (rightOverflow > 0) {
        menuRef.current.style.left = `${Math.max(12, rect.left - rightOverflow)}px`;
      }
      if (rect.top < 12) {
        menuRef.current.style.top = '12px';
      }
      if (rect.left < 12) {
        menuRef.current.style.left = '12px';
      }
    }
  });

  const handleSearchWeb = () => {
    if (selectedText && selectedText.trim()) {
      const query = selectedText.trim();
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
    }
  };

  const handleColorClick = (colorId) => {
    onHighlight(colorId, '');
    onClose();
  };

  const handleSaveComment = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onHighlight(selectedColor, commentText.trim());
    onClose();
  };

  // Fetch word definition
  const fetchDefinition = useCallback((wordToLookup) => {
    const targetWord = wordToLookup || cleanWord;
    if (!targetWord) return;

    setDefLoading(true);
    setDefError(null);
    setDefData(null);

    const lookupLang = uiLang === 'pt' ? 'pt' : 'en';
    fetch(`/api/lookup/define?word=${encodeURIComponent(targetWord)}&lang=${encodeURIComponent(lookupLang)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load definition');
        return res.json();
      })
      .then((data) => {
        setDefData(data);
      })
      .catch((err) => {
        setDefError(err.message || 'Lookup failed');
      })
      .finally(() => {
        setDefLoading(false);
      });
  }, [cleanWord, uiLang]);

  // Fetch translation
  const fetchTranslation = useCallback((target = targetLang) => {
    if (!selectedText || !selectedText.trim()) return;

    setTransLoading(true);
    setTransError(null);
    setTransData(null);

    fetch('/api/lookup/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: selectedText.trim(),
        target_lang: target,
        source_lang: 'auto'
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error('Translation failed');
        return res.json();
      })
      .then((data) => {
        setTransData(data);
      })
      .catch((err) => {
        setTransError(err.message || 'Translation failed');
      })
      .finally(() => {
        setTransLoading(false);
      });
  }, [selectedText, targetLang]);

  const handleOpenDefine = () => {
    setView('define');
    fetchDefinition(cleanWord);
  };

  const handleOpenTranslate = () => {
    setView('translate');
    fetchTranslation(targetLang);
  };

  const handleSwitchTargetLang = (code) => {
    setTargetLang(code);
    fetchTranslation(code);
  };

  const handleSaveDefinitionAsNote = () => {
    if (!defData || !defData.entries || defData.entries.length === 0) return;
    const firstEntry = defData.entries[0];
    const firstDef = firstEntry.definitions?.[0] || '';
    const noteText = `[${t('definition')}: ${defData.word} (${firstEntry.partOfSpeech})]\n${firstDef}`;
    onHighlight(selectedColor, noteText);
    onClose();
  };

  const handleSaveTranslationAsNote = () => {
    if (!transData || !transData.translated_text) return;
    const noteText = `[${t('translation')}: ${transData.source_lang?.toUpperCase()} → ${transData.target_lang?.toUpperCase()}]\n${transData.translated_text}`;
    onHighlight(selectedColor, noteText);
    onClose();
  };

  const handleCopyTranslation = () => {
    if (transData?.translated_text) {
      navigator.clipboard.writeText(transData.translated_text).then(() => {
        setTransCopied(true);
        setTimeout(() => setTransCopied(false), 1500);
      });
    }
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className={`fixed z-50 bg-neutral-900/95 backdrop-blur-xl border border-neutral-750 rounded-xl shadow-2xl p-2.5 text-xs text-neutral-200 select-none animate-in fade-in zoom-in-95 duration-100 max-h-[calc(100vh-24px)] overflow-y-auto reader-settings-scroll ${
        view === 'define' || view === 'translate' ? 'w-[330px]' : view === 'comment' ? 'w-[280px]' : 'w-60'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. MAIN QUICK ACTION VIEW */}
      {view === 'main' && (
        <div className="space-y-2">
          {/* Quick Color Swatches */}
          <div className="px-1 pt-0.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              {t('highlight')}
            </span>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleColorClick(c.id)}
                  className={`w-5 h-5 rounded-full ${c.bg} hover:scale-115 transition-transform shadow-xs cursor-pointer border border-white/20`}
                  title={c.id}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-800/80 my-1" />

          {/* Define Button */}
          <button
            onClick={handleOpenDefine}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-neutral-800/90 text-neutral-200 hover:text-white transition text-left cursor-pointer group"
          >
            <BookOpen className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="font-medium">{t('define')}</span>
            {cleanWord && (
              <span className="ml-auto text-[10px] text-neutral-400 truncate max-w-[90px] font-mono opacity-80">
                "{cleanWord}"
              </span>
            )}
          </button>

          {/* Translate Button */}
          <button
            onClick={handleOpenTranslate}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-neutral-800/90 text-neutral-200 hover:text-white transition text-left cursor-pointer group"
          >
            <Languages className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="font-medium">{t('translate')}</span>
            <span className="ml-auto text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {targetLang}
            </span>
          </button>

          {/* Search on Google Button */}
          <button
            onClick={handleSearchWeb}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-neutral-800/90 text-neutral-200 hover:text-white transition text-left cursor-pointer group"
          >
            <Globe className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
            <span className="font-medium">{t('searchWeb')}</span>
            <ExternalLink className="w-3 h-3 text-neutral-500 ml-auto group-hover:text-neutral-300 transition-colors shrink-0" />
          </button>

          {/* Add Note Button */}
          <button
            onClick={() => setView('comment')}
            className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-neutral-800/90 text-neutral-200 hover:text-white transition text-left cursor-pointer group"
          >
            <MessageSquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
            <span>{t('addComment')}</span>
          </button>

          {/* Read Aloud Button */}
          {onReadAloud && (
            <button
              onClick={() => {
                onReadAloud(selectedText);
                onClose();
              }}
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 hover:bg-neutral-800/90 text-neutral-200 hover:text-white transition text-left cursor-pointer group"
            >
              <Headphones className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform shrink-0" />
              <span>{t('readAloud')}</span>
            </button>
          )}
        </div>
      )}

      {/* 2. DEFINE WORD VIEW */}
      {view === 'define' && (
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <button
              onClick={() => setView('main')}
              className="p-1 -ml-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition cursor-pointer"
              title={t('back')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('definition')}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 -mr-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {defLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
              <span className="text-[11px]">{t('definingWord')}</span>
            </div>
          ) : defError || !defData || !defData.entries || defData.entries.length === 0 ? (
            <div className="py-4 px-1 text-center space-y-3">
              <p className="text-neutral-400 text-xs leading-relaxed">
                {t('noDefinitionFound', { word: cleanWord || selectedText })}
              </p>
              <button
                onClick={handleOpenTranslate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium transition cursor-pointer"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{t('translate')}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Word Title + Pronunciation */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-neutral-100 capitalize">
                    {defData.word}
                  </span>
                  {defData.source && (
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {defData.source}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleSpeak(defData.word, defData.language === 'pt' ? 'pt-BR' : 'en-US')}
                  className="p-1 text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 rounded-md transition cursor-pointer"
                  title={t('listenAudio')}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable Definitions List */}
              <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 text-xs scrollbar-thin scrollbar-thumb-neutral-700">
                {defData.entries.map((entry, idx) => (
                  <div key={idx} className="space-y-1 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80">
                    <div className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/20 uppercase tracking-wide">
                      {entry.partOfSpeech}
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-neutral-300 pt-1 leading-relaxed">
                      {entry.definitions.map((def, dIdx) => (
                        <li key={dIdx} className="text-neutral-200">
                          <span>{def}</span>
                          {entry.examples && entry.examples[dIdx] && (
                            <p className="text-[11px] text-neutral-400 italic pl-3 border-l border-neutral-750 mt-0.5">
                              "{entry.examples[dIdx]}"
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800">
                <button
                  onClick={handleSaveDefinitionAsNote}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('saveAsNote')}</span>
                </button>
                <button
                  onClick={handleOpenTranslate}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1"
                  title={t('translate')}
                >
                  <Languages className="w-3.5 h-3.5 text-emerald-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. TRANSLATE TEXT VIEW */}
      {view === 'translate' && (
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <button
              onClick={() => setView('main')}
              className="p-1 -ml-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition cursor-pointer"
              title={t('back')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
              <Languages className="w-3.5 h-3.5" />
              <span>{t('translation')}</span>
            </div>
            {/* Target Language Pills */}
            <div className="flex items-center gap-1">
              {TARGET_LANGUAGES.map((tl) => (
                <button
                  key={tl.code}
                  onClick={() => handleSwitchTargetLang(tl.code)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    targetLang === tl.code
                      ? 'bg-emerald-500 text-neutral-950 shadow-xs'
                      : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                  title={tl.name}
                >
                  {tl.label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1 -mr-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {transLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              <span className="text-[11px]">{t('translatingText')}</span>
            </div>
          ) : transError || !transData || !transData.translated_text ? (
            <div className="py-4 px-1 text-center space-y-2">
              <p className="text-neutral-400 text-xs">
                {t('translationFailed')}
              </p>
              <button
                onClick={() => fetchTranslation(targetLang)}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Original snippet */}
              <div className="px-2 py-1.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 text-[11px] text-neutral-400 max-h-16 overflow-y-auto italic line-clamp-2">
                "{transData.original_text}"
              </div>

              {/* Translation Output Card */}
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-neutral-100 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                  <span>
                    {t('detectedLanguage', { lang: (transData.source_lang || 'auto').toUpperCase() })} → {targetLang.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleSpeak(transData.translated_text, targetLang === 'pt' ? 'pt-BR' : targetLang === 'es' ? 'es-ES' : targetLang === 'fr' ? 'fr-FR' : 'en-US')}
                    className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 rounded transition cursor-pointer"
                    title={t('listenAudio')}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-neutral-100 max-h-36 overflow-y-auto leading-relaxed select-text font-normal">
                  {transData.translated_text}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-neutral-800">
                <button
                  onClick={handleSaveTranslationAsNote}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('saveAsNote')}</span>
                </button>
                <button
                  onClick={handleCopyTranslation}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
                  title={t('copyTranslation')}
                >
                  {transCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. COMMENT INPUT FORM VIEW */}
      {view === 'comment' && (
        <form onSubmit={handleSaveComment} className="space-y-2 p-1">
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => setView('main')}
              className="p-1 -ml-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition cursor-pointer"
              title={t('back')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('addComment')}</span>
            </span>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedColor(c.id)}
                  className={`w-4 h-4 rounded-full ${c.bg} transition-all cursor-pointer ${
                    selectedColor === c.id ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSaveComment(e);
              }
            }}
            placeholder={t('addCommentPlaceholder')}
            rows={3}
            className="w-full p-2 text-xs bg-neutral-950 border border-neutral-750 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            autoFocus
          />

          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setView('main')}
              className="px-2.5 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center gap-1 cursor-pointer"
              title={`${t('saveComment')} (Ctrl+Enter)`}
            >
              <Check className="w-3 h-3" />
              <span>{t('saveComment')}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
