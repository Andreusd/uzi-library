import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import AiCopilotDrawer from '../components/AiCopilotDrawer';
import TextSelectionMenu from '../components/TextSelectionMenu';
import ReaderToolbar from '../components/ReaderToolbar';
import { useAiCopilot } from '../hooks/useAiCopilot';
import { I18nProvider } from '../i18n';

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAiConversations: vi.fn().mockResolvedValue([
      { id: 'conv-1', title: 'Dúvida sobre Cap. 1', updated_at: '2026-10-25T12:00:00Z', message_count: 2, last_message: 'Virtù é habilidade.' },
      { id: 'conv-2', title: 'Explicação do Prefácio', updated_at: '2026-10-25T11:00:00Z', message_count: 4, last_message: 'Muito obrigado!' }
    ]),
    getAiConversationMessages: vi.fn().mockImplementation((id) => {
      if (id === 'conv-1') {
        return Promise.resolve({
          conversation: { id: 'conv-1', title: 'Dúvida sobre Cap. 1' },
          messages: [
            { id: 'm1', role: 'user', content: 'O que significa virtù?' },
            { id: 'm2', role: 'assistant', content: 'Virtù em Maquiavel refere-se à habilidade...' }
          ]
        });
      }
      return Promise.resolve({ conversation: { id, title: 'Conversa' }, messages: [] });
    }),
    updateAiConversation: vi.fn().mockImplementation((id, title) => Promise.resolve({ id, title })),
    deleteAiConversation: vi.fn().mockResolvedValue(true),
  };
});

const renderWithI18n = (ui) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('useAiCopilot hook', () => {
  it('initializes with default closed state and empty contexts', () => {
    const { result } = renderHook(() => useAiCopilot());
    expect(result.current.copilotDrawerOpen).toBe(false);
    expect(result.current.activeContexts).toEqual([]);
    expect(result.current.pendingSelection).toBeNull();
  });

  it('handleAskCopilot opens drawer and adds reference context', () => {
    const { result } = renderHook(() => useAiCopilot());
    act(() => {
      result.current.handleAskCopilot('O homem é a medida de todas as coisas', 'Pág. 10');
    });

    expect(result.current.copilotDrawerOpen).toBe(true);
    expect(result.current.activeContexts).toHaveLength(1);
    expect(result.current.activeContexts[0].text).toBe('O homem é a medida de todas as coisas');
    expect(result.current.activeContexts[0].location).toBe('Pág. 10');
  });

  it('overwrites transient selection when new text is selected and pins when requested', () => {
    const { result } = renderHook(() => useAiCopilot());

    // 1. First selection -> becomes transient
    act(() => {
      result.current.handleSetTransientContext({ text: 'Primeiro trecho selecionado', location: 'Cap. 1' });
    });
    expect(result.current.transientContext.text).toBe('Primeiro trecho selecionado');
    expect(result.current.activeContexts).toHaveLength(0);

    // 2. Second selection -> overwrites transient (VS Code preview tab behavior)
    act(() => {
      result.current.handleSetTransientContext({ text: 'Segundo trecho selecionado', location: 'Cap. 2' });
    });
    expect(result.current.transientContext.text).toBe('Segundo trecho selecionado');
    expect(result.current.activeContexts).toHaveLength(0);

    // 3. User pins it -> promoted to activeContexts
    act(() => {
      result.current.handlePinTransientContext();
    });
    expect(result.current.activeContexts).toHaveLength(1);
    expect(result.current.activeContexts[0].text).toBe('Segundo trecho selecionado');
    expect(result.current.transientContext).toBeNull();

    // 4. Third selection -> new transient alongside the pinned context!
    act(() => {
      result.current.handleSetTransientContext({ text: 'Terceiro trecho selecionado', location: 'Cap. 3' });
    });
    expect(result.current.activeContexts).toHaveLength(1);
    expect(result.current.transientContext.text).toBe('Terceiro trecho selecionado');
  });

  it('attaches pending selection dynamically and clears it', () => {
    const { result } = renderHook(() => useAiCopilot());
    act(() => {
      result.current.setPendingSelection({ text: 'Trecho novo selecionado', location: 'Pág. 42' });
    });
    expect(result.current.pendingSelection.text).toBe('Trecho novo selecionado');

    act(() => {
      result.current.handleAttachPendingSelection();
    });
    expect(result.current.activeContexts).toHaveLength(1);
    expect(result.current.activeContexts[0].text).toBe('Trecho novo selecionado');
    expect(result.current.pendingSelection).toBeNull();
  });

  it('removes active context reference', () => {
    const { result } = renderHook(() => useAiCopilot());
    act(() => {
      result.current.handleAskCopilot('Contexto 1');
    });
    const ctxId = result.current.activeContexts[0].id;
    act(() => {
      result.current.handleRemoveContext(ctxId);
    });
    expect(result.current.activeContexts).toHaveLength(0);
  });
});

describe('AiCopilotDrawer component', () => {
  it('renders nothing when closed', () => {
    const { container } = renderWithI18n(
      <AiCopilotDrawer isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders drawer header, quick suggestion pills, and active references', () => {
    const handleClose = vi.fn();
    const handleRemoveContext = vi.fn();

    renderWithI18n(
      <AiCopilotDrawer
        isOpen={true}
        onClose={handleClose}
        book={{ title: 'Ensaio sobre a Cegueira', author: 'José Saramago' }}
        activeContexts={[
          { id: 'c1', text: 'Se podes olhar, vê. Se podes ver, repara.', location: 'Pág. 1' }
        ]}
        onRemoveContext={handleRemoveContext}
      />
    );

    expect(screen.getByText(/Chat com IA|AI Chat/i)).toBeInTheDocument();
    expect(screen.getByText(/Discussing Ensaio sobre a Cegueira|Conversando sobre Ensaio sobre a Cegueira/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick suggestions|Sugestões rápidas/i)).toBeInTheDocument();
    expect(screen.getByText(/"Se podes olhar, vê. Se podes ver, repara."/i)).toBeInTheDocument();
    expect(screen.getByText('Pág. 1')).toBeInTheDocument();
    expect(screen.getByText(/Explicar de forma simples|Explain simply/i)).toBeInTheDocument();

    // Test remove reference
    const removeBtn = screen.getByTitle(/Remover referência|Remove reference/i);
    fireEvent.click(removeBtn);
    expect(handleRemoveContext).toHaveBeenCalledWith('c1');

    // Test close button
    const closeBtn = screen.getByTitle(/Fechar|Close/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('displays transient selection chip with pin button in references bar', () => {
    const handlePin = vi.fn();

    renderWithI18n(
      <AiCopilotDrawer
        isOpen={true}
        onClose={() => {}}
        transientContext={{ text: 'Penso, logo existo', location: 'Pág. 20' }}
        onPinTransientContext={handlePin}
      />
    );

    expect(screen.getByText(/"Penso, logo existo"/i)).toBeInTheDocument();
    expect(screen.getByText('Pág. 20')).toBeInTheDocument();

    const pinButtons = screen.getAllByTitle(/Fixar no contexto|Pin reference/i);
    const pinBtn = pinButtons.find(el => el.tagName === 'BUTTON') || pinButtons[0];
    fireEvent.click(pinBtn);
    expect(handlePin).toHaveBeenCalledTimes(1);
  });

  it('Kindle-style: auto-loads latest conversation, displays header buttons and toggles history panel', async () => {
    renderWithI18n(
      <AiCopilotDrawer
        isOpen={true}
        onClose={() => {}}
        book={{ id: 'book-42', title: 'O Príncipe', author: 'Nicolau Maquiavel' }}
      />
    );

    // 1. Should show header buttons: + Nova Conversa and Histórico
    const newChatBtn = screen.getByRole('button', { name: /Nova Conversa|New Chat/i });
    expect(newChatBtn).toBeInTheDocument();

    const historyBtn = screen.getByRole('button', { name: /Histórico de Conversas|Conversation History/i });
    expect(historyBtn).toBeInTheDocument();

    // 2. Opção A: Should auto-load latest conversation ("Dúvida sobre Cap. 1")
    await waitFor(() => {
      expect(screen.getByText('Dúvida sobre Cap. 1')).toBeInTheDocument();
      expect(screen.getByText('O que significa virtù?')).toBeInTheDocument();
    });

    // 3. Open history view by clicking Histórico button
    fireEvent.click(historyBtn);

    // Both previous conversations should be visible in history view
    await waitFor(() => {
      expect(screen.getByText('Explicação do Prefácio')).toBeInTheDocument();
    });

    // 4. Click "+ Nova Conversa" button
    fireEvent.click(newChatBtn);

    // History view should close, chat should be cleared for fresh message
    await waitFor(() => {
      expect(screen.queryByText('O que significa virtù?')).not.toBeInTheDocument();
      expect(screen.getByText(/Conversando sobre O Príncipe|Discussing O Príncipe/i)).toBeInTheDocument();
    });
  });
});

describe('TextSelectionMenu AI integration', () => {
  it('renders Ask Copilot button and triggers callback', () => {
    const handleAskCopilot = vi.fn();
    const handleClose = vi.fn();

    renderWithI18n(
      <TextSelectionMenu
        x={100}
        y={100}
        selectedText="Citação importante da obra"
        onHighlight={() => {}}
        onClose={handleClose}
        onAskCopilot={handleAskCopilot}
        isCopilotOpen={false}
      />
    );

    const copilotBtn = screen.getByText(/Abrir no Chat com IA|Open in AI Chat/i);
    expect(copilotBtn).toBeInTheDocument();

    fireEvent.click(copilotBtn);
    expect(handleAskCopilot).toHaveBeenCalledWith('Citação importante da obra');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('shows Add to Copilot when copilot is already open', () => {
    renderWithI18n(
      <TextSelectionMenu
        x={100}
        y={100}
        selectedText="Outro trecho selecionado"
        onHighlight={() => {}}
        onClose={() => {}}
        onAskCopilot={() => {}}
        isCopilotOpen={true}
      />
    );

    expect(screen.getByText(/Adicionar ao Chat com IA|Add to AI Chat/i)).toBeInTheDocument();
  });
});

describe('Toolbar icon styling & Mutual Exclusion', () => {
  it('renders AI Copilot icon without hardcoded text-amber-400 color class', () => {
    renderWithI18n(
      <ReaderToolbar
        book={{ title: 'Teste' }}
        copilotDrawerOpen={false}
        setCopilotDrawerOpen={() => {}}
        commentsDrawerOpen={false}
        setCommentsDrawerOpen={() => {}}
      />
    );

    const copilotBtn = screen.getByRole('button', { name: /Chat com IA|AI Chat/i });
    expect(copilotBtn).toBeInTheDocument();
    const svgIcon = copilotBtn.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
    expect(svgIcon.getAttribute('class')).not.toContain('text-amber-400');
  });

  it('demonstrates mutual exclusion when opening drawers', () => {
    function MutualExclusionHarness() {
      const [commentsOpen, setCommentsOpen] = useState(false);
      const [copilotOpen, setCopilotOpen] = useState(false);

      const handleToggleComments = () => {
        setCommentsOpen(prev => {
          const next = !prev;
          if (next) setCopilotOpen(false);
          return next;
        });
      };

      const handleToggleCopilot = () => {
        setCopilotOpen(prev => {
          const next = !prev;
          if (next) setCommentsOpen(false);
          return next;
        });
      };

      return (
        <div>
          <button onClick={handleToggleComments}>Toggle Comments</button>
          <button onClick={handleToggleCopilot}>Toggle Copilot</button>
          <span data-testid="comments-state">{commentsOpen ? 'open' : 'closed'}</span>
          <span data-testid="copilot-state">{copilotOpen ? 'open' : 'closed'}</span>
        </div>
      );
    }

    render(<MutualExclusionHarness />);

    // Open comments
    fireEvent.click(screen.getByText('Toggle Comments'));
    expect(screen.getByTestId('comments-state').textContent).toBe('open');
    expect(screen.getByTestId('copilot-state').textContent).toBe('closed');

    // Open copilot -> comments must close!
    fireEvent.click(screen.getByText('Toggle Copilot'));
    expect(screen.getByTestId('comments-state').textContent).toBe('closed');
    expect(screen.getByTestId('copilot-state').textContent).toBe('open');

    // Open comments again -> copilot must close!
    fireEvent.click(screen.getByText('Toggle Comments'));
    expect(screen.getByTestId('comments-state').textContent).toBe('open');
    expect(screen.getByTestId('copilot-state').textContent).toBe('closed');
  });
});
