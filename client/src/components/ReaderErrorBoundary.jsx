import React from 'react';
import { AlertTriangle, ArrowLeft, Download, RefreshCw, Copy, Check } from 'lucide-react';
import { logError, generateDiagnosticReport } from '../services/errorLogger';

export default class ReaderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
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
      source: 'reader_error_boundary',
      extra: {
        bookId: this.props.book?.id,
        bookTitle: this.props.book?.title,
        bookFormat: this.props.book?.format,
      },
    });
    console.error('Reader encountered an unhandled rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false });
  };

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
      console.warn('Failed to copy error report:', err);
    }
  };

  render() {
    if (this.state.hasError) {
      const { book, onClose } = this.props;
      const downloadUrl = book?.id ? `/api/book-file/${encodeURIComponent(book.id)}` : null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/95 text-neutral-100 p-4 sm:p-6 backdrop-blur-md select-none overflow-y-auto">
          <div className="max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center my-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Erro ao Abrir Livro / Unable to Open Book
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mb-4 max-w-sm leading-relaxed">
              Ocorreu um erro ao renderizar <span className="font-medium text-neutral-200">"{book?.title || 'este livro'}"</span>.
            </p>

            {this.state.error?.message && (
              <div className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-rose-300 text-left overflow-x-auto mb-5 max-h-28 select-text">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
              <button
                type="button"
                onClick={this.handleCopyReport}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Diagnóstico</span>
                  </>
                )}
              </button>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar à Biblioteca</span>
                </button>
              )}

              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Tentar Novamente</span>
              </button>

              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={book?.filename || 'book'}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo</span>
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
