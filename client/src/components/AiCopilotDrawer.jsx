import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, X, Send, Square, Trash2, Copy, Check, 
  Plus, Pin, Loader2, Lightbulb, HelpCircle, BookOpen, 
  FileText, CornerDownLeft, AlertCircle, RotateCcw,
  History, Pencil, MessageSquare, Clock
} from 'lucide-react';
import { useI18n } from '../i18n';
import { 
  streamAiChat, 
  getAiConversations, 
  getAiConversationMessages, 
  updateAiConversation, 
  deleteAiConversation 
} from '../api';
import { useResizableDrawer } from '../hooks/useResizableDrawer';

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin}m atrás`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

/**
 * Lightweight formatting helper for assistant responses (code blocks, bold, lists, paragraphs).
 */
function FormattedMessage({ content }) {
  if (!content) return null;

  // Split code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs leading-relaxed break-words select-text">
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = firstLine && !firstLine.includes(' ') && lines.length > 1;
          const lang = hasLang ? firstLine : '';
          const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={idx} className="my-2 rounded-lg bg-neutral-950 border border-neutral-800 overflow-hidden font-mono text-[11px]">
              {lang && (
                <div className="px-3 py-1 bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400 font-semibold uppercase">
                  {lang}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-neutral-200">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Split paragraphs
        const paragraphs = part.split(/\n\s*\n/);
        return (
          <React.Fragment key={idx}>
            {paragraphs.map((p, pIdx) => {
              const trimmed = p.trim();
              if (!trimmed) return null;

              // Bullet points
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const items = trimmed.split(/\n[-*]\s+/).map(s => s.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
                return (
                  <ul key={pIdx} className="list-disc list-inside space-y-1 pl-1 text-neutral-200">
                    {items.map((it, iIdx) => (
                      <li key={iIdx}>
                        <InlineMarkdown text={it} />
                      </li>
                    ))}
                  </ul>
                );
              }

              // Numbered list
              if (/^\d+\.\s+/.test(trimmed)) {
                const items = trimmed.split(/\n\d+\.\s+/).map(s => s.replace(/^\d+\.\s+/, '').trim()).filter(Boolean);
                return (
                  <ol key={pIdx} className="list-decimal list-inside space-y-1 pl-1 text-neutral-200">
                    {items.map((it, iIdx) => (
                      <li key={iIdx}>
                        <InlineMarkdown text={it} />
                      </li>
                    ))}
                  </ol>
                );
              }

              return (
                <p key={pIdx} className="text-neutral-200">
                  <InlineMarkdown text={trimmed} />
                </p>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Handles bold (**text**), italic (*text*), and inline code (`code`).
 */
function InlineMarkdown({ text }) {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return (
    <>
      {parts.map((segment, idx) => {
        if (segment.startsWith('`') && segment.endsWith('`') && segment.length >= 2) {
          return (
            <code key={idx} className="px-1.5 py-0.5 rounded bg-neutral-800 text-amber-300 font-mono text-[11px]">
              {segment.slice(1, -1)}
            </code>
          );
        }
        if (segment.startsWith('**') && segment.endsWith('**') && segment.length >= 4) {
          return <strong key={idx} className="font-semibold text-neutral-100">{segment.slice(2, -2)}</strong>;
        }
        if (segment.startsWith('*') && segment.endsWith('*') && segment.length >= 2) {
          return <em key={idx} className="italic text-neutral-300">{segment.slice(1, -1)}</em>;
        }
        return segment;
      })}
    </>
  );
}

export default function AiCopilotDrawer({
  isOpen,
  onClose,
  book = null,
  currentLocation = null,
  activeContexts = [],
  onRemoveContext,
  onAddContext,
  transientContext = null,
  onPinTransientContext,
  onClearTransientContext,
  pendingSelection = null,
  onAttachPendingSelection,
  onClearPendingSelection
}) {
  const { t } = useI18n();
  const effectiveTransient = transientContext || pendingSelection;
  const handlePin = onPinTransientContext || onAttachPendingSelection;
  const handleClear = onClearTransientContext || onClearPendingSelection;

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [hasEntered, setHasEntered] = useState(false);

  // Scoped AI conversations
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Inline editing state for header title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  // Inline editing inside history list
  const [editingHistoryConvId, setEditingHistoryConvId] = useState(null);
  const [editingHistoryTitleValue, setEditingHistoryTitleValue] = useState('');

  // Delete confirmation inside history list
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Load conversations for the current book (Opção A - Kindle style auto-select latest)
  const loadConversations = useCallback(async (autoSelectLatest = true) => {
    if (!book?.id) {
      setConversations([]);
      setConversationId(null);
      setConversationTitle('');
      setMessages([]);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const list = await getAiConversations(book.id);
      setConversations(list);
      if (autoSelectLatest) {
        if (list.length > 0) {
          const latest = list[0];
          setConversationId(latest.id);
          setConversationTitle(latest.title);
          setIsLoadingMessages(true);
          const data = await getAiConversationMessages(latest.id);
          if (data && data.messages) {
            setMessages(data.messages);
          }
          setIsLoadingMessages(false);
        } else {
          setConversationId(null);
          setConversationTitle('');
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load AI conversations:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [book?.id]);

  useEffect(() => {
    if (isOpen && book?.id) {
      loadConversations(true);
    } else if (!isOpen) {
      setIsHistoryOpen(false);
      setIsEditingTitle(false);
      setConfirmDeleteId(null);
    }
  }, [isOpen, book?.id, loadConversations]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setHasEntered(true), 350);
      return () => clearTimeout(timer);
    } else {
      setHasEntered(false);
    }
  }, [isOpen]);

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom of conversation inside messages container only.
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      if (typeof messagesContainerRef.current.scrollTo === 'function') {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      } else {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen && messages.length > 0 && !isHistoryOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, isHistoryOpen, scrollToBottom]);

  // Select conversation from history
  const handleSelectConversation = async (conv) => {
    if (!conv) return;
    if (isStreaming) {
      handleStopGeneration();
    }
    setIsLoadingMessages(true);
    setChatError(null);
    setIsHistoryOpen(false);
    setIsEditingTitle(false);
    try {
      const data = await getAiConversationMessages(conv.id);
      if (data && data.messages) {
        setConversationId(conv.id);
        setConversationTitle(conv.title);
        setMessages(data.messages);
      }
    } catch (err) {
      setChatError('Falha ao carregar mensagens.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Start a fresh conversation
  const handleNewConversation = () => {
    if (isStreaming) {
      handleStopGeneration();
    }
    setConversationId(null);
    setConversationTitle('');
    setMessages([]);
    setChatError(null);
    setIsHistoryOpen(false);
    setIsEditingTitle(false);
  };

  // Inline header rename
  const handleStartEditingTitle = () => {
    if (!conversationId) return;
    setEditingTitleValue(conversationTitle || '');
    setIsEditingTitle(true);
  };

  const handleSaveHeaderTitle = async () => {
    const trimmed = editingTitleValue.trim();
    if (!trimmed || !conversationId) {
      setIsEditingTitle(false);
      return;
    }
    const updated = await updateAiConversation(conversationId, trimmed);
    if (updated) {
      setConversationTitle(updated.title);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title: updated.title } : c));
    }
    setIsEditingTitle(false);
  };

  // Inline rename in history list
  const handleSaveHistoryTitle = async (convId) => {
    const trimmed = editingHistoryTitleValue.trim();
    if (!trimmed) {
      setEditingHistoryConvId(null);
      return;
    }
    const updated = await updateAiConversation(convId, trimmed);
    if (updated) {
      if (conversationId === convId) {
        setConversationTitle(updated.title);
      }
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: updated.title } : c));
    }
    setEditingHistoryConvId(null);
  };

  // Delete conversation
  const handleDeleteConversation = async (convId) => {
    const ok = await deleteAiConversation(convId);
    if (ok) {
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (conversationId === convId) {
        handleNewConversation();
      }
    }
    setConfirmDeleteId(null);
  };

  // Handle send message
  const handleSendMessage = useCallback(async (customText = null) => {
    const textToSend = (customText !== null ? customText : inputValue).trim();
    if (!textToSend || isStreaming) return;

    setInputValue('');
    setChatError(null);

    const userMsg = { role: 'user', content: textToSend };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Prepare assistant placeholder message
    const assistantMsgIndex = updatedMessages.length;
    setMessages([...updatedMessages, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedResponse = '';

    await streamAiChat({
      messages: updatedMessages,
      conversationId: conversationId,
      bookId: book?.id || '',
      bookTitle: book?.title || '',
      bookAuthor: book?.author || '',
      location: currentLocation ? String(currentLocation) : '',
      contexts: [
        ...activeContexts.map(c => ({
          text: c.text,
          location: c.location || ''
        })),
        ...(effectiveTransient?.text ? [{
          text: effectiveTransient.text,
          location: effectiveTransient.location || ''
        }] : [])
      ],
      signal: controller.signal,
      onConversationId: (newConvId, newTitle) => {
        if (newConvId) {
          setConversationId(newConvId);
          if (newTitle) {
            setConversationTitle(newTitle);
          }
        }
      },
      onChunk: (chunk) => {
        accumulatedResponse += chunk;
        setMessages(prev => {
          const next = [...prev];
          if (next[assistantMsgIndex]) {
            next[assistantMsgIndex] = {
              ...next[assistantMsgIndex],
              content: accumulatedResponse
            };
          }
          return next;
        });
      },
      onDone: () => {
        setIsStreaming(false);
        abortControllerRef.current = null;
        loadConversations(false);
      },
      onError: (errMsg) => {
        setChatError(errMsg);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    });
  }, [inputValue, isStreaming, messages, book, currentLocation, activeContexts, conversationId, effectiveTransient, loadConversations]);

  // Stop generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  // Clear chat
  const handleClearChat = async () => {
    if (isStreaming) {
      handleStopGeneration();
    }
    if (conversationId) {
      await handleDeleteConversation(conversationId);
    } else {
      setMessages([]);
      setConversationId(null);
      setConversationTitle('');
      setChatError(null);
    }
  };

  // Copy assistant response
  const handleCopyMessage = (idx, content) => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  // Quick prompt buttons
  const quickPrompts = [
    { label: t('copilotQuickExplain'), icon: Lightbulb, prompt: t('copilotPromptExplain') },
    { label: t('copilotQuickExamples'), icon: BookOpen, prompt: t('copilotPromptExamples') },
    { label: t('copilotQuickMeaning'), icon: HelpCircle, prompt: t('copilotPromptMeaning') },
    { label: t('copilotQuickSummary'), icon: FileText, prompt: t('copilotPromptSummary') },
  ];

  const {
    width,
    isResizing,
    isCustomWidth,
    resetWidth,
    handleMouseDown,
    handleTouchStart,
  } = useResizableDrawer({
    storageKey: 'uzi-ai-chat-drawer-width',
    defaultWidth: 420,
    minWidth: 300,
    maxWidth: 900,
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen drag overlay to ensure smooth dragging across entire window and over iframes */}
      {isResizing && (
        <div 
          className="fixed inset-0 z-[99999] cursor-col-resize select-none bg-transparent"
          style={{ pointerEvents: 'auto' }}
        />
      )}

      <aside 
        style={{ width: `${width}px` }}
        onAnimationEnd={() => setHasEntered(true)}
        className={`
          fixed top-14 bottom-0 right-0 z-40 max-w-full bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-2xl shadow-black/80 select-none
          ${!hasEntered ? 'animate-slide-in-right' : ''}
          ${isResizing ? 'transition-none select-none' : 'transition-[width] duration-200 ease-in-out'}
        `}
        aria-label={t('aiCopilot')}
      >
        {/* Left Drag Handle for Resizing */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onDoubleClick={resetWidth}
          className="absolute -left-2 top-0 bottom-0 w-4 cursor-col-resize z-50 group flex items-center justify-center select-none touch-none"
          title={t('resetWidth')}
        >
          <div className={`w-[2px] h-10 rounded-full transition-all duration-150 ${
            isResizing 
              ? 'bg-amber-400 opacity-100 scale-y-125 shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
              : 'bg-neutral-700/60 group-hover:bg-amber-400 group-hover:scale-y-125'
          }`} />
        </div>

      {/* 1. Header */}
      <div className="h-12 px-3 border-b border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-900/90 backdrop-blur-md gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          {isEditingTitle ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveHeaderTitle();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
                autoFocus
                placeholder={t('conversationTitlePlaceholder')}
                className="w-full bg-neutral-950 border border-amber-500/50 rounded px-2 py-0.5 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                onClick={handleSaveHeaderTitle}
                className="p-1 rounded text-emerald-400 hover:bg-neutral-800 transition cursor-pointer shrink-0"
                title={t('confirm') || 'OK'}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsEditingTitle(false)}
                className="p-1 rounded text-neutral-400 hover:bg-neutral-800 transition cursor-pointer shrink-0"
                title={t('cancel')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="min-w-0 flex items-center gap-1.5 flex-1">
              <h2 className="text-xs font-bold text-neutral-100 uppercase tracking-wider truncate flex items-center gap-1.5">
                <span>{t('aiCopilot')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" title="Online" />
              </h2>
              {conversationTitle ? (
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <span className="text-neutral-600 font-normal shrink-0">/</span>
                  <span 
                    className="text-amber-400/90 text-xs font-medium truncate max-w-[140px] cursor-pointer hover:underline"
                    title={conversationTitle}
                    onDoubleClick={handleStartEditingTitle}
                  >
                    {conversationTitle}
                  </span>
                  <button
                    onClick={handleStartEditingTitle}
                    className="p-1 rounded text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 transition cursor-pointer shrink-0"
                    title={t('renameConversation')}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Button: + Nova Conversa */}
          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer"
            title={t('newConversation')}
            aria-label={t('newConversation')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('newConversation')}</span>
          </button>

          {/* Button: Histórico with Badge */}
          <button
            onClick={() => setIsHistoryOpen(prev => !prev)}
            className={`relative flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
              isHistoryOpen
                ? 'bg-neutral-800 text-amber-400 border-amber-500/40'
                : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 border-neutral-750'
            }`}
            title={t('conversationsHistory')}
            aria-label={t('conversationsHistory')}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('conversationsHistory')}</span>
            {conversations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-neutral-950 text-amber-400 border border-neutral-700">
                {conversations.length}
              </span>
            )}
          </button>

          {/* Reset width button */}
          <button
            onClick={resetWidth}
            disabled={!isCustomWidth}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              isCustomWidth
                ? 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
                : 'text-neutral-600 opacity-30 cursor-not-allowed'
            }`}
            title={t('resetWidth')}
            aria-label={t('resetWidth')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition cursor-pointer"
              title={conversationId ? t('deleteConversation') : t('clearChat')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body Area */}
      {isHistoryOpen ? (
        /* History View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-900/60">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                {t('conversationsHistory')} ({conversations.length})
              </h3>
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded bg-neutral-800 cursor-pointer transition"
            >
              {t('close')}
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-neutral-600 mx-auto opacity-50" />
              <p className="text-xs text-neutral-400">{t('noConversations')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => {
                const isActive = conv.id === conversationId;
                const isEditingThis = editingHistoryConvId === conv.id;
                const isConfirmingDelete = confirmDeleteId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`group rounded-xl border p-3 transition ${
                      isActive
                        ? 'bg-neutral-850 border-amber-500/40 shadow-sm'
                        : 'bg-neutral-850/60 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {isEditingThis ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingHistoryTitleValue}
                            onChange={(e) => setEditingHistoryTitleValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveHistoryTitle(conv.id);
                              if (e.key === 'Escape') setEditingHistoryConvId(null);
                            }}
                            autoFocus
                            className="w-full bg-neutral-950 border border-amber-500 rounded px-2 py-1 text-xs text-neutral-100 focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveHistoryTitle(conv.id)}
                            className="p-1 rounded text-emerald-400 hover:bg-neutral-800 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingHistoryConvId(null)}
                            className="p-1 rounded text-neutral-400 hover:bg-neutral-800 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleSelectConversation(conv)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-100 truncate group-hover:text-amber-400 transition">
                              {conv.title}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Ativa
                              </span>
                            )}
                          </div>
                          {conv.last_message && (
                            <p className="text-[11px] text-neutral-400 truncate mt-1">
                              {conv.last_message}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-neutral-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(conv.updated_at)}
                            </span>
                            {conv.message_count > 0 && (
                              <span>• {conv.message_count} {conv.message_count === 1 ? 'msg' : 'msgs'}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {!isEditingThis && (
                        <div className="flex items-center gap-1 shrink-0">
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-800/60 rounded px-1.5 py-0.5">
                              <span className="text-[10px] text-rose-300">Excluir?</span>
                              <button
                                onClick={() => handleDeleteConversation(conv.id)}
                                className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer"
                                title={t('deleteConversation')}
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                                title={t('cancel')}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingHistoryConvId(conv.id);
                                  setEditingHistoryTitleValue(conv.title);
                                }}
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 transition cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title={t('renameConversation')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(conv.id);
                                }}
                                className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title={t('deleteConversation')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 2. Active References / Context Bar (Pinned + Transient VS Code style) */}
          {(activeContexts.length > 0 || (effectiveTransient && effectiveTransient.text)) && (
            <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-950/70 shrink-0 space-y-1.5 max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Pin className="w-3 h-3 text-amber-400" />
                  <span>{t('activeReferences')} ({activeContexts.length + (effectiveTransient?.text ? 1 : 0)})</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {/* Pinned / Persistent Contexts */}
                {activeContexts.map((ctx) => (
                  <div
                    key={ctx.id}
                    className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-200 text-[11px] max-w-full transition shadow-xs"
                  >
                    <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    <span className="truncate max-w-[190px]" title={ctx.text}>
                      "{ctx.text}"
                    </span>
                    {ctx.location && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-neutral-800 font-mono text-amber-400 shrink-0">
                        {ctx.location}
                      </span>
                    )}
                    {onRemoveContext && (
                      <button
                        onClick={() => onRemoveContext(ctx.id)}
                        className="p-0.5 text-neutral-400 hover:text-rose-400 rounded transition cursor-pointer shrink-0"
                        title={t('removeReference')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Transient / Preview Context (Auto-captured on selection, overwritten on new selection) */}
                {effectiveTransient && effectiveTransient.text && (
                  <div
                    onDoubleClick={() => handlePin && handlePin()}
                    className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/15 border border-dashed border-amber-500/50 text-amber-200 text-[11px] max-w-full transition shadow-xs animate-fade-in"
                    title={`${t('pinReference')} (duplo clique)`}
                  >
                    <span className="truncate max-w-[190px] italic" title={effectiveTransient.text}>
                      "{effectiveTransient.text}"
                    </span>
                    {effectiveTransient.location && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 font-mono text-amber-300 shrink-0">
                        {effectiveTransient.location}
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 shrink-0 ml-0.5">
                      {handlePin && (
                        <button
                          type="button"
                          onClick={() => handlePin()}
                          className="p-0.5 text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 rounded transition cursor-pointer"
                          title={t('pinReference')}
                        >
                          <Pin className="w-3 h-3 fill-current" />
                        </button>
                      )}
                      {handleClear && (
                        <button
                          type="button"
                          onClick={() => handleClear()}
                          className="p-0.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded transition cursor-pointer"
                          title={t('clearTransient')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Chat Messages Scroll Area */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-750"
          >
            {isLoadingMessages ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
                <p className="text-xs text-neutral-400 italic">Carregando conversa...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-6 px-2 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                    {book?.title ? t('discussingBook', { title: book.title }) : t('aiCopilot')}
                  </h3>
                  <p className="text-[11px] text-neutral-400 leading-relaxed max-w-xs mx-auto">
                    {t('copilotPlaceholder')}
                  </p>
                </div>

                {/* Quick Action Pills */}
                <div className="pt-2 flex flex-col gap-2 text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 px-1">
                    {t('quickSuggestions')}
                  </span>
                  {quickPrompts.map((qp, idx) => {
                    const IconComponent = qp.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(qp.prompt)}
                        className="w-full p-2.5 rounded-xl bg-neutral-950/70 hover:bg-neutral-800/80 border border-neutral-800 hover:border-amber-500/30 text-neutral-200 text-xs flex items-center gap-2.5 transition group cursor-pointer text-left shadow-xs"
                      >
                        <IconComponent className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                        <span className="font-medium text-[11px] flex-1">{qp.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isCopied = copiedIdx === idx;

                return (
                  <div 
                    key={idx}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs select-text ${
                        isUser
                          ? 'bg-amber-600/20 text-neutral-100 border border-amber-500/30 rounded-tr-sm'
                          : 'bg-neutral-950/80 text-neutral-200 border border-neutral-800 rounded-tl-sm shadow-md w-full'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : (
                        <div className="space-y-2">
                          {!msg.content && isStreaming ? (
                            <div className="flex items-center gap-2 text-neutral-400 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              <span className="text-[11px] italic">{t('copilotTyping')}</span>
                            </div>
                          ) : (
                            <FormattedMessage content={msg.content} />
                          )}
                          {/* Copy action for assistant */}
                          {msg.content && !isStreaming && (
                            <div className="pt-2 flex items-center justify-end border-t border-neutral-850">
                              <button
                                onClick={() => handleCopyMessage(idx, msg.content)}
                                className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">{t('copied')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>{t('copy')}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {chatError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{chatError}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 5. Input Footer */}
          <div className="p-3 border-t border-neutral-800 bg-neutral-900/90 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-end gap-1.5 bg-neutral-950 border border-neutral-750 focus-within:border-amber-500 rounded-2xl p-1.5 transition shadow-inner"
            >
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={t('copilotPlaceholder')}
                rows={1}
                className="flex-1 bg-transparent text-neutral-100 text-xs placeholder-neutral-500 px-2 py-1 resize-none focus:outline-none max-h-32 min-h-[32px] leading-relaxed"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer shrink-0"
                  title={t('stopGeneration')}
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-neutral-950 font-bold transition cursor-pointer shrink-0 shadow-sm"
                  title={`${t('sendPrompt')} (Enter)`}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </aside>
    </>
  );
}
