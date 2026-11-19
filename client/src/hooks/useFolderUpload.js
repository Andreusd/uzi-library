import { useState, useEffect, useRef, useCallback } from 'react';
import { booksApi } from '../api';
import { useI18n } from '../i18n';

/**
 * Custom hook managing book uploads via Drag & Drop and file picker.
 * Strictly active ONLY when viewing a physical folder page.
 */
export function useFolderUpload({
  isFolderPage,
  currentShelfObj,
  activeLibraryId,
  books = [],
  onUploadSuccess,
}) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { status: 'uploading' | 'success' | 'error', message: string, filename: string }
  const dragCounter = useRef(0);
  const statusTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const clearStatusTimeout = () => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
  };

  const setStatusWithTimeout = useCallback((statusObj, delayMs = 4000) => {
    clearStatusTimeout();
    setUploadStatus(statusObj);
    if (delayMs > 0) {
      statusTimeoutRef.current = setTimeout(() => {
        setUploadStatus(null);
      }, delayMs);
    }
  }, []);

  const dismissStatus = useCallback(() => {
    clearStatusTimeout();
    setUploadStatus(null);
  }, []);

  const handleFiles = useCallback(
    async (fileList) => {
      if (!isFolderPage || !currentShelfObj) {
        return;
      }
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      for (const file of files) {
        const lowerName = file.name.toLowerCase();
        const ext = lowerName.includes('.') ? lowerName.substring(lowerName.lastIndexOf('.')) : '';

        // 1. Format check: Only .pdf and .epub
        if (ext !== '.pdf' && ext !== '.epub') {
          setStatusWithTimeout(
            {
              status: 'error',
              message: t('uploadOnlyPdfEpub'),
              filename: file.name,
            },
            5000
          );
          return;
        }

        // 2. Name collision check against books in current folder
        const hasCollision = books.some(
          (b) => (b.filename || '').toLowerCase() === lowerName
        );
        if (hasCollision) {
          setStatusWithTimeout(
            {
              status: 'error',
              message: t('uploadFileConflict', { filename: file.name }),
              filename: file.name,
            },
            6000
          );
          return;
        }

        // 3. Perform upload
        setStatusWithTimeout(
          {
            status: 'uploading',
            message: t('uploadingBook', { filename: file.name }),
            filename: file.name,
          },
          0 // Keep active until done or error
        );

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder_id', currentShelfObj.id);
          const libId = activeLibraryId || currentShelfObj.library_id;
          if (libId) {
            formData.append('library_id', libId);
          }

          const res = await booksApi.uploadBook(formData);
          setStatusWithTimeout(
            {
              status: 'success',
              message: t('uploadSuccess', { filename: file.name }),
              filename: file.name,
            },
            4000
          );

          if (onUploadSuccess) {
            await onUploadSuccess(res);
          }
        } catch (err) {
          setStatusWithTimeout(
            {
              status: 'error',
              message: err.message || t('uploadError', { error: String(err) }),
              filename: file.name,
            },
            6000
          );
        }
      }
    },
    [isFolderPage, currentShelfObj, activeLibraryId, books, t, onUploadSuccess, setStatusWithTimeout]
  );

  const openFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const onFileInputChange = useCallback(
    (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  // Global drag-and-drop listener on window/document
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      if (!isFolderPage) return;
      dragCounter.current += 1;
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      if (!isFolderPage) {
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'none';
        }
        return;
      }
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      if (!isFolderPage) return;
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);

      if (!isFolderPage) {
        return;
      }

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      clearStatusTimeout();
    };
  }, [isFolderPage, handleFiles]);

  return {
    isDragging,
    uploadStatus,
    dismissStatus,
    handleFiles,
    openFilePicker,
    fileInputRef,
    onFileInputChange,
  };
}
