import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, Pause, Square, SkipBack, SkipForward, X, 
  Volume2, Gauge, Mic, Check, 
  ChevronUp, Minimize2, Maximize2, 
  Repeat, Headphones, Sparkles, Loader2
} from 'lucide-react';
import { useI18n } from '../i18n';
import { splitTextIntoReadableChunks, getAvailableVoices } from '../utils/textToSpeech';
import { getAiTtsVoices, fetchAiTtsAudioBlob } from '../api';

const RATE_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function TtsPlayerBar({
  tts,
  isOpen: propIsOpen,
  onClose: propOnClose,
  text: propText,
  mode: propMode,
  pageNumber: propPageNumber,
  _totalPages: propTotalPages,
  totalPages: propTotalPagesAlt,
  onNextPage: propOnNextPage,
  onPrevPage: propOnPrevPage,
  theme: propTheme,
  _bookTitle: propBookTitle,
  bookTitle: propBookTitleAlt,
}) {
  const isOpen = tts?.isOpen ?? tts?.ttsOpen ?? propIsOpen;
  const onClose = tts?.onClose ?? (tts?.setTtsOpen ? () => tts.setTtsOpen(false) : propOnClose);
  const text = tts?.text ?? tts?.ttsText ?? propText ?? '';
  const mode = tts?.mode ?? tts?.ttsMode ?? propMode ?? 'page';
  const pageNumber = tts?.pageNumber ?? tts?.ttsPageNumber ?? propPageNumber ?? 1;
  const _totalPages = tts?.totalPages ?? tts?._totalPages ?? propTotalPages ?? propTotalPagesAlt ?? 1;
  const onNextPage = tts?.onNextPage ?? propOnNextPage;
  const onPrevPage = tts?.onPrevPage ?? propOnPrevPage;
  const theme = tts?.theme ?? propTheme ?? 'dark';
  const _bookTitle = tts?.bookTitle ?? tts?._bookTitle ?? propBookTitle ?? propBookTitleAlt ?? '';

  const { t, lang: uiLang } = useI18n();

  const chunks = useMemo(() => splitTextIntoReadableChunks(text), [text]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [showRateMenu, setShowRateMenu] = useState(false);
  const [voices, setVoices] = useState([]);
  const [aiVoices, setAiVoices] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const audioRef = useRef(null);
  const prebufferCacheRef = useRef({});
  
  const [rate, setRate] = useState(() => {
    try {
      const saved = localStorage.getItem('reader_tts_rate');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 3.0) return parsed;
      }
    } catch {}
    return 1.0;
  });

  const [selectedVoiceUri, setSelectedVoiceUri] = useState(() => {
    try {
      return localStorage.getItem('reader_tts_voice_uri') || '';
    } catch {
      return '';
    }
  });

  const [autoAdvance, setAutoAdvance] = useState(() => {
    try {
      return localStorage.getItem('reader_tts_auto_advance') !== 'false';
    } catch {
      return true;
    }
  });

  const voiceMenuRef = useRef(null);
  const rateMenuRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const isPausedRef = useRef(isPaused);
  const chunksRef = useRef(chunks);
  const currentChunkIndexRef = useRef(currentChunkIndex);
  const autoAdvanceRef = useRef(autoAdvance);
  const rateRef = useRef(rate);
  const selectedVoiceUriRef = useRef(selectedVoiceUri);
  const voicesRef = useRef(voices);
  const modeRef = useRef(mode);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { chunksRef.current = chunks; }, [chunks]);
  useEffect(() => { currentChunkIndexRef.current = currentChunkIndex; }, [currentChunkIndex]);
  useEffect(() => { autoAdvanceRef.current = autoAdvance; }, [autoAdvance]);
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { selectedVoiceUriRef.current = selectedVoiceUri; }, [selectedVoiceUri]);
  useEffect(() => { voicesRef.current = voices; }, [voices]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Load and listen for available system voices
  useEffect(() => {
    const updateVoices = () => {
      const available = getAvailableVoices(uiLang);
      setVoices(available);
      voicesRef.current = available;
    };

    updateVoices();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      };
    }
  }, [uiLang]);

  // Fetch available AI Gemini voices
  useEffect(() => {
    let mounted = true;
    getAiTtsVoices()
      .then(res => {
        if (mounted && res && res.voices && res.voices.length > 0) {
          setAiVoices(res.voices);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const clearAudioCache = useCallback(() => {
    Object.values(prebufferCacheRef.current).forEach(url => {
      try { URL.revokeObjectURL(url); } catch {}
    });
    prebufferCacheRef.current = {};
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(e.target)) {
        setShowVoiceMenu(false);
      }
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target)) {
        setShowRateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const speakWithWebSpeech = useCallback((chunkText, index, onFinished) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      return;
    }

    const utterance = new window.SpeechSynthesisUtterance(chunkText);
    utterance.rate = rateRef.current;
    utterance.pitch = 1.0;

    const activeVoices = voicesRef.current;
    const currentUri = selectedVoiceUriRef.current;
    let chosenVoice = activeVoices.find(v => v.voiceURI === currentUri);
    if (!chosenVoice && activeVoices.length > 0) {
      const langPrefix = uiLang.slice(0, 2).toLowerCase();
      chosenVoice = activeVoices.find(v => v.lang.toLowerCase().startsWith(langPrefix)) || activeVoices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    }

    utterance.onend = () => {
      onFinished?.();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('SpeechSynthesis error:', e);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [uiLang]);

  // Speak a specific chunk index (Hybrid AI / Web Speech)
  const speakChunk = useCallback(async function playChunk(index) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }

    const activeChunks = chunksRef.current;
    if (!activeChunks || index >= activeChunks.length) {
      if (autoAdvanceRef.current && modeRef.current === 'page' && onNextPage) {
        setIsPlaying(true);
        setIsPaused(false);
        onNextPage();
      } else {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentChunkIndex(0);
      }
      return;
    }

    if (index < 0) index = 0;

    const chunkText = activeChunks[index];
    if (!chunkText || !chunkText.trim()) {
      playChunk(index + 1);
      return;
    }

    setCurrentChunkIndex(index);
    setIsPlaying(true);
    setIsPaused(false);

    const currentUri = selectedVoiceUriRef.current;
    const isAiVoice = currentUri && currentUri.startsWith('ai:');

    if (isAiVoice) {
      const voiceId = currentUri.replace('ai:', '');
      setIsAiLoading(true);
      setAiError('');

      try {
        let audioUrl = prebufferCacheRef.current[index];
        if (!audioUrl) {
          const blob = await fetchAiTtsAudioBlob(chunkText, voiceId);
          audioUrl = URL.createObjectURL(blob);
          prebufferCacheRef.current[index] = audioUrl;
        }

        setIsAiLoading(false);

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        const audio = audioRef.current;
        audio.src = audioUrl;
        audio.playbackRate = rateRef.current;

        audio.onended = () => {
          if (isPlayingRef.current && !isPausedRef.current) {
            playChunk(index + 1);
          }
        };

        audio.onerror = (e) => {
          console.warn('Audio playback error:', e);
          setIsAiLoading(false);
          speakWithWebSpeech(chunkText, index, () => {
            if (isPlayingRef.current && !isPausedRef.current) {
              playChunk(index + 1);
            }
          });
        };

        await audio.play();

        // Background Pre-buffering of next chunk:
        const nextIdx = index + 1;
        if (nextIdx < activeChunks.length && !prebufferCacheRef.current[nextIdx]) {
          const nextText = activeChunks[nextIdx];
          if (nextText && nextText.trim()) {
            fetchAiTtsAudioBlob(nextText, voiceId)
              .then(blob => {
                if (!prebufferCacheRef.current[nextIdx]) {
                  prebufferCacheRef.current[nextIdx] = URL.createObjectURL(blob);
                }
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.warn('AI TTS failed, falling back to system voice:', err);
        setIsAiLoading(false);
        setAiError(t('aiTtsError') || 'AI voice synthesis error. Falling back to system voice.');
        speakWithWebSpeech(chunkText, index, () => {
          if (isPlayingRef.current && !isPausedRef.current) {
            playChunk(index + 1);
          }
        });
      }
      return;
    }

    // Standard Web Speech API
    setIsAiLoading(false);
    speakWithWebSpeech(chunkText, index, () => {
      if (isPlayingRef.current && !isPausedRef.current) {
        playChunk(index + 1);
      }
    });
  }, [onNextPage, speakWithWebSpeech, t]);

  const [prevText, setPrevText] = useState(text);
  if (text !== prevText) {
    setPrevText(text);
    clearAudioCache();
    setCurrentChunkIndex(0);
  }

  // When new text arrives (e.g. initial open, page flip, or new selection):
  useEffect(() => {
    if (!isOpen) return;

    if (chunks.length > 0) {
      const timer = setTimeout(() => {
        speakChunk(0);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [chunks, isOpen, speakChunk]);

  // Stop speech when component unmounts or closes
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      clearAudioCache();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clearAudioCache]);

  const handlePlayPause = () => {
    const isAiVoice = selectedVoiceUriRef.current && selectedVoiceUriRef.current.startsWith('ai:');

    if (isAiVoice && audioRef.current && audioRef.current.src) {
      if (isPlaying && !isPaused) {
        audioRef.current.pause();
        setIsPaused(true);
      } else if (isPaused) {
        audioRef.current.play().catch(() => {});
        setIsPaused(false);
      } else {
        speakChunk(currentChunkIndexRef.current || 0);
      }
      return;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setTimeout(() => {
        if (window.speechSynthesis.paused) {
          speakChunk(currentChunkIndexRef.current);
        }
      }, 150);
    } else {
      speakChunk(currentChunkIndexRef.current || 0);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsAiLoading(false);
    setCurrentChunkIndex(0);
  };

  const handlePrevParagraph = () => {
    if (currentChunkIndex > 0) {
      speakChunk(currentChunkIndex - 1);
    } else if (onPrevPage && mode === 'page') {
      onPrevPage();
    }
  };

  const handleNextParagraph = () => {
    if (currentChunkIndex + 1 < chunks.length) {
      speakChunk(currentChunkIndex + 1);
    } else if (onNextPage && mode === 'page') {
      onNextPage();
    }
  };

  const handleRateChange = (newRate) => {
    setRate(newRate);
    rateRef.current = newRate;
    try {
      localStorage.setItem('reader_tts_rate', String(newRate));
    } catch {}
    setShowRateMenu(false);

    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }

    const isAiVoice = selectedVoiceUriRef.current && selectedVoiceUriRef.current.startsWith('ai:');
    if (!isAiVoice && isPlaying && !isPaused) {
      speakChunk(currentChunkIndexRef.current);
    }
  };

  const handleVoiceSelect = (voice) => {
    const uri = voice.voiceURI || (voice.id ? `ai:${voice.id}` : '');
    setSelectedVoiceUri(uri);
    selectedVoiceUriRef.current = uri;
    try {
      localStorage.setItem('reader_tts_voice_uri', uri);
    } catch {}
    setShowVoiceMenu(false);
    clearAudioCache();

    if (isPlaying && !isPaused) {
      speakChunk(currentChunkIndexRef.current);
    }
  };

  const toggleAutoAdvance = () => {
    setAutoAdvance(prev => {
      const next = !prev;
      try {
        localStorage.setItem('reader_tts_auto_advance', String(next));
      } catch {}
      return next;
    });
  };

  const handleClose = () => {
    handleStop();
    onClose?.();
  };

  if (!isOpen) return null;

  // Theming
  const isLight = theme === 'light';
  const isSepia = theme === 'sepia';

  const containerTheme = isLight
    ? 'bg-white/95 border-slate-200/90 text-slate-800 shadow-2xl shadow-slate-900/15'
    : isSepia
    ? 'bg-[#f7efe1]/95 border-[#dec8ad] text-[#3e2f1e] shadow-2xl shadow-black/25'
    : 'bg-zinc-950/92 border-zinc-800/90 text-zinc-100 shadow-2xl shadow-black/80';

  const btnHover = isLight
    ? 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
    : isSepia
    ? 'hover:bg-[#ebdec9] text-[#634c34] hover:text-[#2b1f13]'
    : 'hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100';

  const playBtnBg = isLight
    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/30'
    : isSepia
    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/30'
    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-lg shadow-amber-500/25';

  const badgeBg = isLight
    ? 'bg-slate-100 text-slate-700 border-slate-200'
    : isSepia
    ? 'bg-[#ecdcc5] text-[#4d3a27] border-[#d8c2a4]'
    : 'bg-zinc-900/90 text-zinc-300 border-zinc-800';

  const currentSnippet = chunks[currentChunkIndex] || '';

  // Current active voice label
  const isSelectedAi = Boolean(selectedVoiceUri && selectedVoiceUri.startsWith('ai:'));
  const selectedAiVoiceObj = isSelectedAi ? aiVoices.find(v => `ai:${v.id}` === selectedVoiceUri) : null;
  const activeVoiceObj = !isSelectedAi ? (voices.find(v => v.voiceURI === selectedVoiceUri) || voices[0]) : null;
  const voiceDisplayName = selectedAiVoiceObj
    ? `✨ ${selectedAiVoiceObj.id}`
    : activeVoiceObj
    ? activeVoiceObj.name.replace(/(Microsoft|Google|Apple)\s*/gi, '').slice(0, 16)
    : t('defaultVoice');

  // Minimized floating bubble
  if (isMinimized) {
    return (
      <div 
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 p-2 pr-3.5 rounded-full backdrop-blur-xl border ${containerTheme} animate-in fade-in zoom-in-95 select-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handlePlayPause}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${playBtnBg}`}
          title={isPlaying && !isPaused ? t('pauseSpeech') : t('playSpeech')}
        >
          {isAiLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPlaying && !isPaused ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex flex-col min-w-0 pr-1 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <span className="text-xs font-semibold truncate max-w-[120px] flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span>{t('readAloud')}</span>
          </span>
          <span className="text-[10px] opacity-75 font-mono">
            {chunks.length > 0 ? `${currentChunkIndex + 1} / ${chunks.length}` : '0 / 0'}
          </span>
        </div>

        <button
          onClick={() => setIsMinimized(false)}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${btnHover}`}
          title={t('expandPlayer')}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleClose}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${btnHover}`}
          title={t('stopSpeech')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Full Player Bar
  return (
    <div 
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 p-3 sm:px-4 rounded-3xl backdrop-blur-2xl border ${containerTheme} animate-in fade-in slide-in-from-bottom-3 duration-200 select-none w-[calc(100vw-32px)] max-w-xl shadow-2xl`}
      role="region"
      aria-label={t('readAloud')}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top row: Status info, Progress, Auto-advance, Minimize & Close */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            {isAiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            ) : (
              <Headphones className="w-3.5 h-3.5 animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-1.5 truncate text-[11px] sm:text-xs">
            <span className="font-semibold truncate">
              {mode === 'selection'
                ? t('readingSelection', { current: currentChunkIndex + 1, total: chunks.length || 1 })
                : t('readingPage', { page: pageNumber, current: currentChunkIndex + 1, total: chunks.length || 1 })}
            </span>
            {isSelectedAi && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-semibold flex items-center gap-0.5 shrink-0">
                <Sparkles className="w-2.5 h-2.5" /> AI
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Auto Advance Toggle */}
          {mode === 'page' && (
            <button
              type="button"
              onClick={toggleAutoAdvance}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors cursor-pointer ${
                autoAdvance 
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-500' 
                  : `border-transparent ${btnHover} opacity-60`
              }`}
              title={t('autoAdvancePageDesc')}
            >
              <Repeat className="w-3 h-3" />
              <span className="hidden sm:inline">{t('autoAdvancePage')}</span>
            </button>
          )}

          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${btnHover}`}
            title={t('minimize')}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${btnHover}`}
            title={t('stopSpeech')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Row: Live Subtitle / Currently spoken text snippet */}
      {currentSnippet && (
        <div className={`px-3 py-1.5 rounded-xl text-xs line-clamp-2 italic font-serif leading-relaxed opacity-90 transition-all ${badgeBg}`}>
          {isAiLoading ? (
            <span className="text-amber-500 font-sans not-italic flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin inline shrink-0" />
              <span>{t('generating') || 'Generating AI speech...'}</span>
            </span>
          ) : (
            `"${currentSnippet}"`
          )}
        </div>
      )}

      {/* Bottom Controls Row: Playback, Speed, Voices */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-700/30">
        {/* Left: Speed Rate Selector */}
        <div className="relative" ref={rateMenuRef}>
          <button
            type="button"
            onClick={() => setShowRateMenu(prev => !prev)}
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
              showRateMenu ? 'border-amber-500 text-amber-500' : `${badgeBg} ${btnHover}`
            }`}
            title={t('speed')}
          >
            <Gauge className="w-3.5 h-3.5 text-amber-500" />
            <span>{rate}x</span>
          </button>

          {showRateMenu && (
            <div className={`absolute bottom-full left-0 mb-2 p-1 rounded-xl border backdrop-blur-xl shadow-xl z-50 flex flex-col gap-0.5 min-w-[80px] animate-in fade-in zoom-in-95 ${containerTheme}`}>
              {RATE_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => handleRateChange(r)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-lg transition text-left flex items-center justify-between cursor-pointer ${
                    rate === r ? 'bg-amber-500 text-white font-bold' : btnHover
                  }`}
                >
                  <span>{r}x</span>
                  {rate === r && <Check className="w-3 h-3 ml-2" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center: Previous, Play/Pause, Next, Stop */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Previous Paragraph */}
          <button
            type="button"
            onClick={handlePrevParagraph}
            disabled={currentChunkIndex === 0 && (!onPrevPage || mode !== 'page')}
            className={`p-2 rounded-xl transition-colors disabled:opacity-30 cursor-pointer ${btnHover}`}
            title={t('prevParagraph')}
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            type="button"
            onClick={handlePlayPause}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all transform active:scale-95 cursor-pointer ${playBtnBg}`}
            title={isPlaying && !isPaused ? t('pauseSpeech') : t('playSpeech')}
          >
            {isAiLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-current" />
            ) : isPlaying && !isPaused ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next Paragraph */}
          <button
            type="button"
            onClick={handleNextParagraph}
            disabled={currentChunkIndex + 1 >= chunks.length && (!onNextPage || mode !== 'page')}
            className={`p-2 rounded-xl transition-colors disabled:opacity-30 cursor-pointer ${btnHover}`}
            title={t('nextParagraph')}
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Stop Button */}
          <button
            type="button"
            onClick={handleStop}
            disabled={!isPlaying && !isPaused}
            className={`p-2 rounded-xl transition-colors disabled:opacity-30 cursor-pointer ${btnHover}`}
            title={t('stopSpeech')}
          >
            <Square className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Voice Selector Dropdown */}
        <div className="relative" ref={voiceMenuRef}>
          <button
            type="button"
            onClick={() => setShowVoiceMenu(prev => !prev)}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 max-w-[130px] sm:max-w-[160px] truncate cursor-pointer ${
              showVoiceMenu ? 'border-amber-500 text-amber-500' : `${badgeBg} ${btnHover}`
            }`}
            title={t('voice')}
          >
            {isSelectedAi ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{voiceDisplayName}</span>
            <ChevronUp className="w-3 h-3 shrink-0 opacity-60 ml-0.5" />
          </button>

          {showVoiceMenu && (
            <div className={`absolute bottom-full right-0 mb-2 p-1.5 rounded-2xl border backdrop-blur-xl shadow-2xl z-50 flex flex-col gap-0.5 w-72 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 ${containerTheme}`}>
              {/* AI Voices Section */}
              {aiVoices.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 border-b border-neutral-700/40 mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{t('aiVoicesHeader') || 'AI Voices (Gemini)'}</span>
                  </div>
                  {aiVoices.map(av => {
                    const isSelected = selectedVoiceUri === `ai:${av.id}`;
                    return (
                      <button
                        key={av.id}
                        onClick={() => handleVoiceSelect({ voiceURI: `ai:${av.id}`, id: av.id })}
                        className={`w-full px-2.5 py-1.5 text-xs rounded-xl transition text-left flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected ? 'bg-amber-500/20 text-amber-500 font-semibold' : btnHover
                        }`}
                        title={av.description}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate">{av.name}</span>
                          </div>
                          {av.description && (
                            <div className="text-[10px] opacity-60 truncate mt-0.5">{av.description}</div>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* System Voices Section */}
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-700/40 mb-1 flex items-center justify-between">
                <span>{t('systemVoicesHeader') || 'System Voices'}</span>
                <span>{voices.length}</span>
              </div>
              {voices.length > 0 ? (
                voices.map(v => {
                  const isSelected = v.voiceURI === selectedVoiceUri || (!selectedVoiceUri && !isSelectedAi && v.default);
                  return (
                    <button
                      key={v.voiceURI || v.name}
                      onClick={() => handleVoiceSelect(v)}
                      className={`w-full px-2.5 py-1.5 text-xs rounded-xl transition text-left flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected ? 'bg-amber-500/20 text-amber-500 font-semibold' : btnHover
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{v.name}</div>
                        <div className="text-[10px] opacity-60 font-mono uppercase">{v.lang}</div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs opacity-60">
                  {t('ttsNotSupported')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
