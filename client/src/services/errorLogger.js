/**
 * Universal Error Logger and Diagnostic Subsystem for Uzi Library.
 * Captures, stores, formats, and transmits frontend and native error telemetry.
 */

const STORAGE_KEY_ERRORS = 'uzi_error_logs';
const MAX_STORED_ERRORS = 20;

export function getErrorLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ERRORS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearErrorLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY_ERRORS);
    if (typeof window !== 'undefined' && window.AndroidApp?.clearErrorLogs) {
      window.AndroidApp.clearErrorLogs();
    }
  } catch {}
}

export function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
  const errorStack = error?.stack || null;
  const errorName = error?.name || 'Error';

  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    name: errorName,
    message: errorMessage,
    stack: errorStack,
    componentStack: context.componentStack || null,
    source: context.source || 'frontend',
    url: typeof window !== 'undefined' ? window.location.href : '',
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} (dpr ${window.devicePixelRatio || 1})` : '',
    extra: context.extra || null,
  };

  try {
    const existing = getErrorLogs();
    const updated = [record, ...existing].slice(0, MAX_STORED_ERRORS);
    localStorage.setItem(STORAGE_KEY_ERRORS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to persist error in localStorage:', err);
  }

  // Transmit to Android native bridge if running inside the APK
  try {
    if (typeof window !== 'undefined' && window.AndroidApp?.reportError) {
      window.AndroidApp.reportError(JSON.stringify(record));
    }
  } catch (err) {
    console.warn('Failed to report error to AndroidApp bridge:', err);
  }

  return record;
}

export function generateDiagnosticReport(specificError = null) {
  const logs = getErrorLogs();
  const primaryError = specificError || logs[0];
  const now = new Date().toISOString();

  let nativeLogs = '';
  try {
    if (typeof window !== 'undefined' && window.AndroidApp?.getErrorLogs) {
      nativeLogs = window.AndroidApp.getErrorLogs() || '';
    }
  } catch {}

  const sections = [
    `=== UZI LIBRARY DIAGNOSTIC REPORT ===`,
    `Generated at: ${now}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
    `Network: ${typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}`,
    `Platform: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
    `Is Android APK: ${typeof window !== 'undefined' && Boolean(window.AndroidApp) ? 'Yes' : 'No'}`,
    ``,
  ];

  if (primaryError) {
    sections.push(
      `--- PRIMARY ERROR ---`,
      `Time: ${primaryError.timestamp}`,
      `Source: ${primaryError.source}`,
      `Type: ${primaryError.name}`,
      `Message: ${primaryError.message}`,
      primaryError.stack ? `Stack:\n${primaryError.stack}` : `Stack: N/A`,
      primaryError.componentStack ? `Component Stack:\n${primaryError.componentStack}` : null,
      ``,
    );
  } else {
    sections.push(`No recent frontend errors captured.\n`);
  }

  if (nativeLogs) {
    sections.push(
      `--- NATIVE ANDROID LOGS ---`,
      nativeLogs,
      ``,
    );
  }

  if (logs.length > 1) {
    sections.push(
      `--- RECENT FRONTEND ERRORS HISTORY (${logs.length} entries) ---`,
      ...logs.slice(1, 6).map((log, i) => `[#${i + 2} ${log.timestamp}] [${log.source}] ${log.name}: ${log.message}`),
      ``,
    );
  }

  return sections.filter(Boolean).join('\n');
}

/**
 * Initializes global window listeners for unhandled errors and rejected promises.
 */
export function initGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    // Avoid double logging if the error was handled by React ErrorBoundary
    if (event.error?.__uziHandled) return;
    logError(event.error || event.message, {
      source: 'uncaught_error',
      extra: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logError(reason || 'Unhandled Promise Rejection', {
      source: 'unhandled_rejection',
    });
  });
}
