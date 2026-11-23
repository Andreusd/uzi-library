import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import TtsPlayerBar from '../components/TtsPlayerBar';
import * as api from '../api';

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.voice = null;
    this.lang = '';
    this.onend = null;
    this.onerror = null;
  }
}

class MockAudio {
  constructor() {
    this.src = '';
    this.playbackRate = 1.0;
    this.onended = null;
    this.onerror = null;
    this.currentTime = 0;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
}

describe('TtsPlayerBar with AI Voices Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    window.speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn().mockReturnValue([
        { voiceURI: 'local-voice-1', name: 'Local English Voice', lang: 'en-US', default: true },
        { voiceURI: 'local-voice-2', name: 'Local Portuguese Voice', lang: 'pt-BR', default: false }
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    window.Audio = MockAudio;
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-audio-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly and loads AI voices from API', async () => {
    vi.spyOn(api, 'getAiTtsVoices').mockResolvedValue({
      available: true,
      voices: [
        { id: 'Aoede', name: 'Aoede (Melodic & Expressive)', gender: 'female', description: 'Melodic' },
        { id: 'Puck', name: 'Puck (Energetic & Dynamic)', gender: 'male', description: 'Energetic' }
      ]
    });

    render(
      <TtsPlayerBar
        isOpen={true}
        onClose={vi.fn()}
        text="Chapter One. It was a bright cold day in April, and the clocks were striking thirteen."
        mode="page"
        pageNumber={1}
        totalPages={10}
      />,
      { wrapper }
    );

    // Verify it renders the text snippet
    expect(screen.getByText(/Chapter One/i)).toBeDefined();

    // Open voice dropdown
    const voiceButton = screen.getByTitle(/voice|voz/i);
    fireEvent.click(voiceButton);

    // Check that AI voices section and AI voices appear
    await waitFor(() => {
      expect(screen.getByText(/AI Voices \(Gemini\)|Vozes IA/i)).toBeDefined();
      expect(screen.getByText(/Aoede/i)).toBeDefined();
      expect(screen.getByText(/Puck/i)).toBeDefined();
    });
  });

  it('selecting an AI voice switches voice to ai:voiceId and triggers prebuffering', async () => {
    vi.spyOn(api, 'getAiTtsVoices').mockResolvedValue({
      available: true,
      voices: [
        { id: 'Aoede', name: 'Aoede (Melodic & Expressive)', gender: 'female', description: 'Melodic' }
      ]
    });
    const fetchBlobSpy = vi.spyOn(api, 'fetchAiTtsAudioBlob').mockResolvedValue(new Blob(['mock-audio'], { type: 'audio/wav' }));

    render(
      <TtsPlayerBar
        isOpen={true}
        onClose={vi.fn()}
        text={"First paragraph to read.\n\nSecond paragraph to prebuffer."}
        mode="page"
        pageNumber={1}
        totalPages={10}
      />,
      { wrapper }
    );

    const voiceButton = screen.getByTitle(/voice|voz/i);
    fireEvent.click(voiceButton);

    await waitFor(() => {
      expect(screen.getByText(/Aoede/i)).toBeDefined();
    });

    const aoedeBtn = screen.getByText(/Aoede/i).closest('button');
    fireEvent.click(aoedeBtn);

    // Verify localStorage set
    expect(localStorage.getItem('reader_tts_voice_uri')).toBe('ai:Aoede');

    await waitFor(() => {
      expect(fetchBlobSpy).toHaveBeenCalledWith('First paragraph to read.', 'Aoede');
    });
  });
});
