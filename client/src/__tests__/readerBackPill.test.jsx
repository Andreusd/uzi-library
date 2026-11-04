import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import ReaderBackPill from '../components/ReaderBackPill';
import { SimpleLinkService } from '../utils/SimpleLinkService';

describe('ReaderBackPill component', () => {
  it('renders nothing when target is null or undefined', () => {
    const { container } = render(
      <I18nProvider>
        <ReaderBackPill target={null} onNavigateBack={vi.fn()} onDismiss={vi.fn()} />
      </I18nProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders back button with target page number', () => {
    const onNavigateBack = vi.fn();
    const onDismiss = vi.fn();

    render(
      <I18nProvider>
        <ReaderBackPill
          target={{ page: 42, cfi: 'epubcfi(/6/10)' }}
          onNavigateBack={onNavigateBack}
          onDismiss={onDismiss}
        />
      </I18nProvider>
    );

    const pill = screen.getByTestId('reader-back-pill');
    expect(pill).toBeInTheDocument();

    const navButton = screen.getByTestId('reader-back-pill-button');
    expect(navButton).toHaveTextContent(/42/);

    fireEvent.click(navButton);
    expect(onNavigateBack).toHaveBeenCalledTimes(1);

    const dismissBtn = screen.getByTestId('reader-back-pill-dismiss');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders fallback text when page is not available', () => {
    render(
      <I18nProvider>
        <ReaderBackPill
          target={{ cfi: 'epubcfi(/6/10)' }}
          onNavigateBack={vi.fn()}
          onDismiss={vi.fn()}
        />
      </I18nProvider>
    );

    const navButton = screen.getByTestId('reader-back-pill-button');
    expect(navButton.textContent.length).toBeGreaterThan(0);
    expect(navButton).not.toHaveTextContent(/undefined/);
  });

  it('supports dark, light, and sepia themes', () => {
    const { rerender } = render(
      <I18nProvider>
        <ReaderBackPill
          target={{ page: 10 }}
          onNavigateBack={vi.fn()}
          onDismiss={vi.fn()}
          theme="dark"
        />
      </I18nProvider>
    );
    expect(screen.getByTestId('reader-back-pill').className).toContain('bg-neutral-900');

    rerender(
      <I18nProvider>
        <ReaderBackPill
          target={{ page: 10 }}
          onNavigateBack={vi.fn()}
          onDismiss={vi.fn()}
          theme="light"
        />
      </I18nProvider>
    );
    expect(screen.getByTestId('reader-back-pill').className).toContain('bg-white');

    rerender(
      <I18nProvider>
        <ReaderBackPill
          target={{ page: 10 }}
          onNavigateBack={vi.fn()}
          onDismiss={vi.fn()}
          theme="sepia"
        />
      </I18nProvider>
    );
    expect(screen.getByTestId('reader-back-pill').className).toContain('bg-[#f4ecd8]');
  });
});

describe('SimpleLinkService in-text navigation options', () => {
  it('passes options through goToDestination to onNavigate callback', async () => {
    const service = new SimpleLinkService();
    const mockNavigate = vi.fn();
    service.setNavigate(mockNavigate);

    const mockDoc = {
      getDestination: vi.fn().mockResolvedValue([{ num: 10, gen: 0 }]),
      getPageIndex: vi.fn().mockResolvedValue(14), // 0-based page index 14 -> page 15
    };
    service.setDocument(mockDoc);

    // Call from PDF.js in-text link annotation (no options)
    await service.goToDestination('dest1');
    expect(mockNavigate).toHaveBeenCalledWith(15, {});

    // Call from Outline / TOC (with isOutline: true)
    await service.goToDestination('dest2', { isOutline: true });
    expect(mockNavigate).toHaveBeenCalledWith(15, { isOutline: true });
  });
});
