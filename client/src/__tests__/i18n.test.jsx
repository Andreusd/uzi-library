import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider, useI18n, translate, getStoredLang } from '../i18n';

const TestConsumer = ({ translationKey = 'appTitle', params = {}, onReady }) => {
  const i18n = useI18n();
  React.useEffect(() => {
    if (onReady) onReady(i18n);
  }, [i18n, onReady]);

  return (
    <div>
      <span data-testid="translated">{i18n.t(translationKey, params)}</span>
      <span data-testid="current-lang">{i18n.lang}</span>
      <button onClick={() => i18n.setLang('pt')}>To Portuguese</button>
    </div>
  );
};

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders default English translation', () => {
    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    expect(screen.getByTestId('translated').textContent).toBe('Uzi Library');
    expect(screen.getByTestId('current-lang').textContent).toBe('en');
  });

  it('interpolates parameters correctly', () => {
    render(
      <I18nProvider>
        <TestConsumer
          translationKey="shelfCount"
          params={{ books: 42, folders: 7 }}
        />
      </I18nProvider>
    );

    expect(screen.getByTestId('translated').textContent).toBe('42 books • 7 folders');
  });

  it('switches language and persists to localStorage', () => {
    render(
      <I18nProvider>
        <TestConsumer translationKey="appTitle" />
      </I18nProvider>
    );

    act(() => {
      screen.getByText('To Portuguese').click();
    });

    expect(screen.getByTestId('current-lang').textContent).toBe('pt');
    expect(screen.getByTestId('translated').textContent).toBe('Uzi Library');
    expect(localStorage.getItem('uzi_library_lang')).toBe('pt');
  });

  it('returns key itself when key does not exist', () => {
    render(
      <I18nProvider>
        <TestConsumer translationKey="nonexistent_secret_key" />
      </I18nProvider>
    );

    expect(screen.getByTestId('translated').textContent).toBe('nonexistent_secret_key');
  });

  it('throws error when useI18n is used outside I18nProvider', () => {
    // Suppress console.error during expected throw
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => render(<TestConsumer />)).toThrow(
      'useI18n must be used within an I18nProvider'
    );

    console.error = originalError;
  });

  it('translates reader settings keys properly in en and pt without fallback to key', () => {
    let i18nInstance;
    render(
      <I18nProvider>
        <TestConsumer onReady={(inst) => { i18nInstance = inst; }} />
      </I18nProvider>
    );

    const readerKeys = [
      'floatingSideButtons',
      'floatingSideButtonsDesc',
      'upDownPageFlip',
      'upDownPageFlipDesc',
      'mouseWheelPageFlip',
      'mouseWheelPageFlipDesc',
      'chapterScrollMode',
      'chapterScrollModeDesc',
      'singlePageSetting',
      'singlePageSettingDesc',
      'readingMode',
      'readingModeDual',
      'readingModeSingle',
      'readingModeChapterScroll',
      'dualPageSetting',
      'dualPageSettingDesc',
      'bookTexture',
      'bookTextureDesc',
      'verticalScrollMode',
      'verticalScrollDesc',
      'continuousPageSpacing',
      'continuousPageSpacingDesc',
      'keepHeaderPinned',
      'keepHeaderPinnedDesc',
      'floatingButtons',
      'verticalKeysFlip',
      'paperTexture',
      'continuousScroll',
      'pageSpacing',
      'pinHeader',
      'pagesPerDay',
      'pagesPerDay_one',
    ];

    // English
    readerKeys.forEach(k => {
      const translated = i18nInstance.t(k);
      expect(translated).not.toBe(k);
      expect(translated.length).toBeGreaterThan(0);
    });

    // Portuguese
    act(() => {
      i18nInstance.setLang('pt');
    });

    readerKeys.forEach(k => {
      const translated = i18nInstance.t(k);
      expect(translated).not.toBe(k);
      expect(translated.length).toBeGreaterThan(0);
    });
  });

  it('provides translate helper and exposes language property with key parity for newly added keys', () => {
    let i18nInstance;
    render(
      <I18nProvider>
        <TestConsumer onReady={(inst) => { i18nInstance = inst; }} />
      </I18nProvider>
    );

    expect(i18nInstance.language).toBe('en');

    const newKeys = [
      'page',
      'pages',
      'pages_one',
      'pagesToday',
      'pagesTotal',
      'readBooksCountShort',
      'loading',
      'chapter',
      'book',
      'thisBook',
      'finished',
      'confirm',
      'deleteConfirmPrompt',
      'updateApiKey',
      'failedToSaveKey',
      'failedToRemoveKey',
      'failedToLoadMessages',
      'show',
      'hide',
      'geminiFlashStable',
      'geminiFlashFallback',
      'doubleClick',
      'timeAgoNow',
      'timeAgoMin',
      'timeAgoHours',
      'timeAgoYesterday',
      'timeAgoDays',
      'diagnosticsAndErrorReport',
      'copyDiagnostics',
      'diagnosticsCopied',
      'noRecentErrors',
      'errorsRecordedCount',
      'clearLogs',
      'errorOpeningBook',
      'errorRenderingBook',
      'appErrorTitle',
      'appErrorDesc',
      'errorUnknown',
      'noStackTrace',
      'reloadApp',
      'goToHome',
      'technicalDetails',
      'tryAgain',
    ];

    ['en', 'pt', 'es', 'fr'].forEach(lang => {
      newKeys.forEach(key => {
        const val = translate(key, { count: 5, title: 'BookTitle' }, lang);
        expect(val).toBeDefined();
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
      });
    });

    expect(translate('pages', {}, 'pt')).toBe('páginas');
    expect(translate('finished', {}, 'pt')).toBe('Concluído');
    expect(translate('finished', {}, 'en')).toBe('Completed');
    expect(translate('chapter', {}, 'pt')).toBe('Capítulo');
    expect(translate('chapter', {}, 'en')).toBe('Chapter');
    expect(translate('book', {}, 'pt')).toBe('Livro');
    expect(translate('book', {}, 'en')).toBe('Book');
    expect(translate('timeAgoMin', { count: 12 }, 'en')).toBe('12m ago');
    expect(translate('timeAgoMin', { count: 12 }, 'pt')).toBe('12m atrás');
    expect(translate('errorRenderingBook', { title: 'Dune' }, 'en')).toBe('An error occurred while rendering "Dune".');
  });
});
