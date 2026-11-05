import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary';
import { logError, getErrorLogs, clearErrorLogs, generateDiagnosticReport } from '../services/errorLogger';

const CrashingComponent = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test crash in rendering');
  }
  return <div>Component loaded successfully</div>;
};

describe('GlobalErrorBoundary & ErrorLogger', () => {
  beforeEach(() => {
    localStorage.clear();
    clearErrorLogs();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error throws', () => {
    render(
      <GlobalErrorBoundary>
        <CrashingComponent shouldThrow={false} />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText('Component loaded successfully')).toBeDefined();
  });

  it('catches render error and displays error UI with diagnostic copy action', async () => {
    render(
      <GlobalErrorBoundary>
        <CrashingComponent shouldThrow={true} />
      </GlobalErrorBoundary>
    );

    // Verify error UI appeared
    expect(screen.getByText('Ocorreu um erro na aplicação')).toBeDefined();
    expect(screen.getByText('Test crash in rendering')).toBeDefined();
    expect(screen.getByText('Copiar Diagnóstico')).toBeDefined();
    expect(screen.getByText('Recarregar')).toBeDefined();
    expect(screen.getByText('Ir para Início')).toBeDefined();

    // Verify error was logged to errorLogger
    const logs = getErrorLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toBe('Test crash in rendering');
    expect(logs[0].source).toBe('global_error_boundary');
  });

  it('copies diagnostic report to clipboard when clicking copy button', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <GlobalErrorBoundary>
        <CrashingComponent shouldThrow={true} />
      </GlobalErrorBoundary>
    );

    const copyBtn = screen.getByText('Copiar Diagnóstico');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('=== UZI LIBRARY DIAGNOSTIC REPORT ===');
    expect(copiedText).toContain('Test crash in rendering');
    expect(screen.getByText('Diagnóstico Copiado!')).toBeDefined();
  });

  it('logs errors and generates diagnostic report properly', () => {
    const record = logError(new Error('Sample caught error'), { source: 'custom_source' });
    expect(record.message).toBe('Sample caught error');

    const logs = getErrorLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Sample caught error');

    const report = generateDiagnosticReport();
    expect(report).toContain('Sample caught error');
    expect(report).toContain('custom_source');
  });
});
