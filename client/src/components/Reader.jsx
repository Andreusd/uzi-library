import React from 'react';
import ReaderErrorBoundary from './ReaderErrorBoundary';
import EpubViewer from './EpubViewer';
import PdfViewer from './PdfViewer';

/**
 * Universal Reader switcher with error boundary.
 * Renders EpubViewer or PdfViewer directly so offline reading never fails
 * due to missing or interrupted dynamic chunk loading.
 */
export default function Reader(props) {
  const { book, showFileExtension } = props;
  const isEpub = book?.format === 'epub' || book?.filename?.toLowerCase().endsWith('.epub');

  const shouldShowExtension = showFileExtension !== undefined 
    ? Boolean(showFileExtension) 
    : (() => {
        try {
          return localStorage.getItem('show_file_extension') !== 'false';
        } catch {
          return true;
        }
      })();

  return (
    <ReaderErrorBoundary book={book} onClose={props.onClose}>
      {isEpub ? (
        <EpubViewer {...props} showFileExtension={shouldShowExtension} />
      ) : (
        <PdfViewer {...props} showFileExtension={shouldShowExtension} />
      )}
    </ReaderErrorBoundary>
  );
}
