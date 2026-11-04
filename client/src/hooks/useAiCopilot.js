import { useState, useCallback } from 'react';

/**
 * Custom hook to manage AI Copilot drawer state, active reference contexts,
 * and dynamic selection capture (VS Code preview tab style).
 * 
 * - transientContext: Auto-captured immediately on text selection, overwritten when a new selection is made.
 *   Sent automatically to the AI model with any prompt without requiring manual pin.
 * - activeContexts: Pinned persistent contexts that stay across multiple selections.
 * - handlePinTransientContext: Promotes the current transient context to active pinned context.
 */
export function useAiCopilot() {
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);
  const [activeContexts, setActiveContexts] = useState([]);
  const [transientContext, setTransientContext] = useState(null);

  // Automatically update transient selection (overwrites previous transient, leaves pinned intact)
  const handleSetTransientContext = useCallback((selection) => {
    if (!selection || !selection.text || !selection.text.trim()) {
      return;
    }
    const clean = selection.text.trim();
    const loc = selection.location || '';

    // If text is already pinned, don't duplicate as transient
    setActiveContexts((pinned) => {
      if (pinned.some((p) => p.text === clean)) {
        return pinned;
      }
      return pinned;
    });

    setTransientContext({
      id: `transient_${Date.now()}`,
      text: clean,
      location: loc,
      isTransient: true,
    });
  }, []);

  // Pin the current transient context so it becomes persistent (VS Code style)
  const handlePinTransientContext = useCallback(() => {
    if (!transientContext?.text) return;
    const clean = transientContext.text.trim();
    const newContext = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: clean,
      location: transientContext.location || '',
    };

    setActiveContexts((prev) => {
      if (prev.some((c) => c.text === clean)) return prev;
      return [...prev, newContext];
    });

    setTransientContext(null);
  }, [transientContext]);

  // Remove a pinned context
  const handleRemoveContext = useCallback((id) => {
    setActiveContexts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Clear/dismiss the transient context
  const handleClearTransientContext = useCallback(() => {
    setTransientContext(null);
  }, []);

  // When user clicks "Open in AI Chat" or "Add to AI Chat" from context menu
  const handleAskCopilot = useCallback((text, location = '') => {
    if (!text || !text.trim()) return;
    const clean = text.trim();
    const newContext = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: clean,
      location: location || '',
    };

    setActiveContexts((prev) => {
      if (prev.some((c) => c.text === clean)) return prev;
      return [...prev, newContext];
    });

    setTransientContext((prev) => (prev?.text === clean ? null : prev));
    setCopilotDrawerOpen(true);
  }, []);

  return {
    copilotDrawerOpen,
    setCopilotDrawerOpen,
    activeContexts,
    setActiveContexts,
    transientContext,
    setTransientContext,
    handleSetTransientContext,
    handlePinTransientContext,
    handleClearTransientContext,
    handleAskCopilot,
    handleRemoveContext,
    // Backward compatibility aliases
    pendingSelection: transientContext,
    setPendingSelection: handleSetTransientContext,
    handleAttachPendingSelection: handlePinTransientContext,
    handleClearPendingSelection: handleClearTransientContext,
  };
}

export default useAiCopilot;
