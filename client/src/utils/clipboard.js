/**
 * Universal clipboard utility supporting both Secure Contexts (HTTPS/localhost)
 * and insecure contexts (LAN HTTP, e.g. http://andreusd-fedora.local:8000).
 */
export async function copyToClipboard(text) {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  // 1. Try modern async Clipboard API if available and allowed
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText rejected, attempting fallback:', err);
    }
  }

  // 2. Fallback: invisible textarea with document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.fontSize = '12pt';
      textarea.style.border = '0';
      textarea.style.padding = '0';
      textarea.style.margin = '0';
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = (window.pageYOffset || document.documentElement.scrollTop || 0) + 'px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);

      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) return true;
    } catch (err) {
      console.warn('Fallback document.execCommand copy failed:', err);
    }
  }

  return false;
}
