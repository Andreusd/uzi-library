/**
 * Lightweight link service to handle PDF internal links (e.g. Table of Contents)
 * and external hyperlinks for PDF.js.
 */
export class SimpleLinkService {
  constructor() {
    this.pdfDoc = null;
    this.onNavigate = null;
    this._page = 1;
    this.rotation = 0;
  }

  setDocument(pdfDoc) {
    this.pdfDoc = pdfDoc;
  }

  setNavigate(onNavigate) {
    this.onNavigate = onNavigate;
  }

  get page() {
    return this._page;
  }

  setPage(val) {
    this._page = val;
  }

  set page(val) {
    this._page = val;
    if (this.onNavigate && typeof val === 'number') {
      this.onNavigate(val);
    }
  }

  get pagesCount() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  getDestinationHash(_dest) {
    return '#';
  }

  getAnchorUrl(hash) {
    return hash || '#';
  }

  setHash(_hash) {}

  executeNamedAction(action) {
    if (!this.onNavigate) return;
    if (action === 'NextPage') {
      this.onNavigate('next');
    } else if (action === 'PrevPage') {
      this.onNavigate('prev');
    } else if (action === 'FirstPage') {
      this.onNavigate(1);
    } else if (action === 'LastPage' && this.pdfDoc) {
      this.onNavigate(this.pdfDoc.numPages);
    }
  }

  addLinkAttributes(link, url, newWindow = true) {
    link.href = url;
    link.target = newWindow ? '_blank' : '_self';
    link.rel = 'noopener noreferrer nofollow';
  }

  async goToDestination(dest, options = {}) {
    if (!this.pdfDoc || !this.onNavigate) return;
    try {
      let explicitDest = dest;
      if (typeof dest === 'string') {
        explicitDest = await this.pdfDoc.getDestination(dest);
      }
      if (!explicitDest) return;

      const destRef = explicitDest[0];
      let pageIndex = -1;

      if (typeof destRef === 'object' && destRef !== null) {
        pageIndex = await this.pdfDoc.getPageIndex(destRef);
      } else if (typeof destRef === 'number') {
        pageIndex = destRef;
      }

      if (typeof pageIndex === 'number' && pageIndex >= 0) {
        this.onNavigate(pageIndex + 1, options);
      }
    } catch (e) {
      console.error('Failed to navigate to destination:', e);
    }
  }
}
