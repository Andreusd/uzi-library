import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import ShelfHeader from '../components/ShelfHeader';
import FolderDropOverlay from '../components/FolderDropOverlay';
import UploadToast from '../components/UploadToast';
import { useFolderUpload } from '../hooks/useFolderUpload';
import { booksApi } from '../api';
import { I18nProvider } from '../i18n';

vi.mock('../api', () => ({
  booksApi: {
    uploadBook: vi.fn(),
  },
}));

const wrapper = ({ children }) => <I18nProvider>{children}</I18nProvider>;

describe('Folder Book Upload & Drag and Drop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ShelfHeader Upload Button', () => {
    it('renders the upload button when isFolderPage is true and triggers onUploadClick', () => {
      const onUploadClick = vi.fn();
      render(
        <ShelfHeader
          selectedShelf="ai-folder"
          shelves={[{ id: 'ai-folder', name: 'Artificial Intelligence' }]}
          currentShelfObj={{ id: 'ai-folder', name: 'Artificial Intelligence' }}
          books={[]}
          isFolderPage={true}
          onUploadClick={onUploadClick}
        />,
        { wrapper }
      );

      const uploadBtn = screen.getByTestId('upload-book-btn');
      expect(uploadBtn).toBeDefined();
      fireEvent.click(uploadBtn);
      expect(onUploadClick).toHaveBeenCalledTimes(1);
    });

    it('does not render the upload button when isFolderPage is false', () => {
      render(
        <ShelfHeader
          selectedShelf="favorites"
          shelves={[]}
          currentShelfObj={null}
          books={[]}
          isFolderPage={false}
          onUploadClick={vi.fn()}
        />,
        { wrapper }
      );

      expect(screen.queryByTestId('upload-book-btn')).toBeNull();
    });
  });

  describe('FolderDropOverlay', () => {
    it('renders overlay when isDragging is true and shows folder name', () => {
      render(
        <FolderDropOverlay
          isDragging={true}
          folderName="Machine Learning"
        />,
        { wrapper }
      );

      expect(screen.getByTestId('folder-drop-overlay')).toBeDefined();
      expect(screen.getByText(/Machine Learning/i)).toBeDefined();
    });

    it('returns null when isDragging is false', () => {
      const { container } = render(
        <FolderDropOverlay
          isDragging={false}
          folderName="Machine Learning"
        />,
        { wrapper }
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('UploadToast', () => {
    it('renders uploading status properly', () => {
      render(
        <UploadToast
          uploadStatus={{
            status: 'uploading',
            filename: 'deep_learning.pdf',
            message: 'Uploading deep_learning.pdf...',
          }}
          onDismiss={vi.fn()}
        />
      );

      expect(screen.getByTestId('upload-toast')).toBeDefined();
      expect(screen.getByText('deep_learning.pdf')).toBeDefined();
      expect(screen.getByText('Uploading deep_learning.pdf...')).toBeDefined();
    });

    it('renders error status and allows dismissal', () => {
      const onDismiss = vi.fn();
      render(
        <UploadToast
          uploadStatus={{
            status: 'error',
            filename: 'bad.txt',
            message: 'Only PDF and EPUB files are supported.',
          }}
          onDismiss={onDismiss}
        />
      );

      expect(screen.getByText('bad.txt')).toBeDefined();
      expect(screen.getByText('Only PDF and EPUB files are supported.')).toBeDefined();

      const closeBtn = screen.getByLabelText(/dismiss notification/i);
      fireEvent.click(closeBtn);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('useFolderUpload hook', () => {
    it('rejects unsupported file formats with error toast', async () => {
      const { result } = renderHook(
        () =>
          useFolderUpload({
            isFolderPage: true,
            currentShelfObj: { id: 'math', name: 'Math' },
            books: [],
          }),
        { wrapper }
      );

      const fakeFile = new File(['text content'], 'notes.txt', { type: 'text/plain' });

      await act(async () => {
        await result.current.handleFiles([fakeFile]);
      });

      expect(result.current.uploadStatus).not.toBeNull();
      expect(result.current.uploadStatus.status).toBe('error');
      expect(result.current.uploadStatus.message).toMatch(/PDF.*EPUB/i);
      expect(booksApi.uploadBook).not.toHaveBeenCalled();
    });

    it('rejects name collisions when a book with the same filename exists in the folder', async () => {
      const existingBooks = [
        { id: 'b1', filename: 'Calculus_Early_Transcendentals.pdf', title: 'Calculus' },
      ];

      const { result } = renderHook(
        () =>
          useFolderUpload({
            isFolderPage: true,
            currentShelfObj: { id: 'math', name: 'Math' },
            books: existingBooks,
          }),
        { wrapper }
      );

      const duplicateFile = new File(['dummy'], 'calculus_early_transcendentals.pdf', {
        type: 'application/pdf',
      });

      await act(async () => {
        await result.current.handleFiles([duplicateFile]);
      });

      expect(result.current.uploadStatus).not.toBeNull();
      expect(result.current.uploadStatus.status).toBe('error');
      expect(result.current.uploadStatus.message).toMatch(/already exists/i);
      expect(booksApi.uploadBook).not.toHaveBeenCalled();
    });

    it('successfully uploads valid PDF and calls onUploadSuccess', async () => {
      booksApi.uploadBook.mockResolvedValueOnce({ status: 'ok', book_id: 'b99' });
      const onUploadSuccess = vi.fn();

      const { result } = renderHook(
        () =>
          useFolderUpload({
            isFolderPage: true,
            currentShelfObj: { id: 'math', name: 'Math' },
            activeLibraryId: 'lib1',
            books: [],
            onUploadSuccess,
          }),
        { wrapper }
      );

      const validFile = new File(['%PDF-1.4 dummy'], 'Linear_Algebra.pdf', {
        type: 'application/pdf',
      });

      await act(async () => {
        await result.current.handleFiles([validFile]);
      });

      expect(booksApi.uploadBook).toHaveBeenCalledTimes(1);
      const passedFormData = booksApi.uploadBook.mock.calls[0][0];
      expect(passedFormData instanceof FormData).toBe(true);
      expect(passedFormData.get('folder_id')).toBe('math');
      expect(passedFormData.get('library_id')).toBe('lib1');

      expect(result.current.uploadStatus).not.toBeNull();
      expect(result.current.uploadStatus.status).toBe('success');
      expect(onUploadSuccess).toHaveBeenCalledTimes(1);
    });

    it('does not process files if isFolderPage is false', async () => {
      const { result } = renderHook(
        () =>
          useFolderUpload({
            isFolderPage: false,
            currentShelfObj: null,
            books: [],
          }),
        { wrapper }
      );

      const validFile = new File(['%PDF-1.4 dummy'], 'test.pdf', {
        type: 'application/pdf',
      });

      await act(async () => {
        await result.current.handleFiles([validFile]);
      });

      expect(booksApi.uploadBook).not.toHaveBeenCalled();
      expect(result.current.uploadStatus).toBeNull();
    });
  });
});
