import React from 'react';
import { AlertTriangle, Copy, Check, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { logError, generateDiagnosticReport } from '../services/errorLogger';

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (error) {
      error.__uziHandled = true;
    }
    logError(error, {
      componentStack: errorInfo?.componentStack,
      source: 'global_error_boundary',
    });
    this.setState({ errorInfo });
    console.error('GlobalErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  handleCopyReport = async () => {
    try {
      const report = generateDiagnosticReport(this.state.error);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = report;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (err) {
      console.warn('Failed to copy error report to clipboard:', err);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleResetHome = () => {
    try {
      window.history.pushState({}, '', '/');
    } catch {}
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false, showDetails: false });
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Erro desconhecido na interface.';
      const stack = this.state.error?.stack || this.state.errorInfo?.componentStack || 'Sem stack trace disponível.';

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 text-neutral-100 p-4 sm:p-6 select-none overflow-y-auto">
          <div className="max-w-xl w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 flex flex-col items-center text-center my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Warning Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 shadow-lg shadow-amber-500/5">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
              Ocorreu um erro na aplicação
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mb-5 max-w-md leading-relaxed">
              A interface do Uzi Library encontrou uma falha inesperada. Você pode copiar o relatório de diagnóstico para identificar o problema ou tentar recarregar.
            </p>

            {/* Error Message Box */}
            <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-rose-300 text-left overflow-x-auto mb-4 max-h-32 shadow-inner select-text">
              {errorMessage}
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full mb-4">
              <button
                type="button"
                onClick={this.handleCopyReport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Diagnóstico Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Diagnóstico</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recarregar</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetHome}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95"
              >
                <Home className="w-4 h-4" />
                <span>Ir para Início</span>
              </button>
            </div>

            {/* Expandable Technical Details */}
            <div className="w-full text-left mt-2 border-t border-neutral-800/60 pt-3">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="flex items-center justify-between w-full text-[11px] font-medium text-neutral-400 hover:text-neutral-200 py-1 transition cursor-pointer"
              >
                <span>Detalhes técnicos (Stack trace)</span>
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {this.state.showDetails && (
                <pre className="mt-2 w-full bg-neutral-950 p-3 rounded-xl border border-neutral-800/80 text-[10px] font-mono text-neutral-400 overflow-x-auto max-h-48 whitespace-pre-wrap select-text leading-relaxed">
                  {stack}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
