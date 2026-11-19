import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

/**
 * Toast notification for book upload state (uploading, success, error).
 */
export default function UploadToast({ uploadStatus, onDismiss }) {
  if (!uploadStatus) return null;

  const { status, message, filename } = uploadStatus;

  const isUploading = status === 'uploading';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const borderColor = isUploading
    ? 'border-amber-500/40'
    : isSuccess
      ? 'border-emerald-500/40'
      : 'border-rose-500/40';

  return (
    <div
      data-testid="upload-toast"
      className={`fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] sm:w-auto bg-neutral-900/95 backdrop-blur-md border ${borderColor} rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200`}
    >
      <div className="shrink-0">
        {isUploading && <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />}
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        {isError && <AlertCircle className="w-5 h-5 text-rose-400" />}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        {filename && (
          <p className="text-xs font-semibold text-neutral-200 truncate">
            {filename}
          </p>
        )}
        <p className="text-xs text-neutral-300 mt-0.5 break-words">
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
