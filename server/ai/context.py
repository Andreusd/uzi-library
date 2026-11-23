import os
import re
import zipfile
import warnings
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

from ..database import get_db, Database

def clean_html_to_text(html_content: bytes | str) -> str:
    """Strips markup and normalizes whitespace for textual context consumption."""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        for tag in soup(['script', 'style', 'nav', 'header', 'footer']):
            tag.decompose()
        return ' '.join(soup.get_text().split())
    except Exception:
        return ''

def _extract_snippets(text: str, query: str, max_snippets: int = 2) -> List[str]:
    """Finds occurrences of query in text and extracts short, readable context snippets."""
    snippets = []
    if not text or not query:
        return snippets
    try:
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        for m in pattern.finditer(text):
            start = max(0, m.start() - 100)
            end = min(len(text), m.end() + 120)

            # Snap cleanly to whitespace
            if start > 0:
                sp = text.find(' ', start, min(start + 25, m.start()))
                if sp != -1:
                    start = sp + 1
            if end < len(text):
                sp = text.rfind(' ', max(m.end(), end - 25), end)
                if sp != -1:
                    end = sp

            snip = text[start:end].strip()
            prefix = "... " if start > 0 else ""
            suffix = " ..." if end < len(text) else ""
            snippets.append(f"{prefix}{snip}{suffix}")
            if len(snippets) >= max_snippets:
                break
    except Exception:
        pass
    return snippets

class BookContextExtractor:
    """
    Safely extracts structural context and surrounding chapters from the active book.
    """

    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()

    def extract_epub_context(
        self,
        epub_path: str,
        location_hint: Optional[str] = None,
        cfi_hint: Optional[str] = None,
        max_current_chars: int = 4000,
        max_surrounding_chars: int = 1500
    ) -> Dict[str, Any]:
        """Extracts TOC, current chapter, previous chapter, and next chapter from an EPUB file."""
        res: Dict[str, Any] = {
            "toc": [],
            "current_chapter": {"title": "", "text": ""},
            "prev_chapter": {"title": "", "text": ""},
            "next_chapter": {"title": "", "text": ""}
        }

        if not os.path.isfile(epub_path):
            return res

        try:
            with zipfile.ZipFile(epub_path, 'r') as zf:
                # 1. Parse container to locate OPF
                c_data = zf.read('META-INF/container.xml').decode('utf-8', errors='ignore')
                m_rf = re.search(r'full-path=["\']([^"\']+)["\']', c_data, re.IGNORECASE)
                opf_path = m_rf.group(1) if m_rf else 'content.opf'
                opf_dir = '/'.join(opf_path.split('/')[:-1])

                opf_bytes = zf.read(opf_path)
                root = ET.fromstring(opf_bytes)

                manifest: Dict[str, str] = {}
                for item in root.findall('.//{http://www.idpf.org/2007/opf}item'):
                    manifest[item.get('id', '')] = item.get('href', '')

                spine: List[str] = []
                for itemref in root.findall('.//{http://www.idpf.org/2007/opf}itemref'):
                    idref = itemref.get('idref', '')
                    if idref in manifest:
                        href = manifest[idref]
                        full_href = f"{opf_dir}/{href}" if opf_dir else href
                        spine.append(full_href)

                # 2. Extract Table of Contents (NCX / Nav)
                toc_titles = []
                for item in root.findall('.//{http://www.idpf.org/2007/opf}item'):
                    m_type = item.get('media-type', '')
                    props = item.get('properties', '')
                    if 'nav' in props or m_type == 'application/x-dtbncx+xml':
                        toc_href = item.get('href', '')
                        full_toc = f"{opf_dir}/{toc_href}" if opf_dir else toc_href
                        if full_toc in zf.namelist():
                            try:
                                toc_soup = BeautifulSoup(zf.read(full_toc), 'html.parser')
                                for a in toc_soup.find_all(['a', 'navLabel']):
                                    txt = a.get_text().strip()
                                    if txt and txt not in toc_titles:
                                        toc_titles.append(txt)
                            except Exception:
                                pass
                if toc_titles:
                    res["toc"] = toc_titles[:35]

                # 3. Locate current chapter index
                current_idx = -1
                if location_hint:
                    clean_hint = location_hint.split('#')[0].split('?')[0].strip()
                    for idx, path in enumerate(spine):
                        if clean_hint in path or path.endswith(clean_hint):
                            current_idx = idx
                            break

                # Fallback matching by sample text if CFI/hint not matched directly
                if current_idx == -1 and location_hint and len(location_hint) > 3:
                    hint_lower = location_hint.lower()
                    for idx, path in enumerate(spine):
                        if path in zf.namelist():
                            try:
                                sample = zf.read(path).decode('utf-8', errors='ignore')
                                if hint_lower in sample.lower():
                                    current_idx = idx
                                    break
                            except Exception:
                                pass

                # Fallback to start if completely unresolved
                if current_idx == -1 and spine:
                    current_idx = 0

                # 4. Extract current chapter text
                if 0 <= current_idx < len(spine):
                    cur_path = spine[current_idx]
                    cur_text = clean_html_to_text(zf.read(cur_path))
                    res["current_chapter"]["title"] = os.path.basename(cur_path)
                    res["current_chapter"]["text"] = cur_text[:max_current_chars]

                    # Previous chapter
                    if current_idx > 0:
                        prev_path = spine[current_idx - 1]
                        prev_text = clean_html_to_text(zf.read(prev_path))
                        res["prev_chapter"]["title"] = os.path.basename(prev_path)
                        res["prev_chapter"]["text"] = prev_text[-max_surrounding_chars:] if len(prev_text) > max_surrounding_chars else prev_text

                    # Next chapter
                    if current_idx + 1 < len(spine):
                        next_path = spine[current_idx + 1]
                        next_text = clean_html_to_text(zf.read(next_path))
                        res["next_chapter"]["title"] = os.path.basename(next_path)
                        res["next_chapter"]["text"] = next_text[:max_surrounding_chars]

        except Exception:
            pass

        return res

    def extract_pdf_context(
        self,
        pdf_path: str,
        page_hint: Optional[int] = 1,
        max_chars: int = 3500
    ) -> Dict[str, Any]:
        """Extracts surrounding page text from a PDF file."""
        res: Dict[str, Any] = {
            "toc": [],
            "current_chapter": {"title": "", "text": ""},
            "prev_chapter": {"title": "", "text": ""},
            "next_chapter": {"title": "", "text": ""}
        }

        if not os.path.isfile(pdf_path):
            return res

        try:
            import pypdfium2
            pdf = pypdfium2.PdfDocument(pdf_path)
            total_pages = len(pdf)
            if total_pages == 0:
                return res

            target_page = max(1, min(page_hint or 1, total_pages))
            target_idx = target_page - 1

            # Current page text
            cur_page = pdf[target_idx]
            cur_text = cur_page.get_textpage().get_text_range().strip()
            res["current_chapter"] = {
                "title": f"Página {target_page}",
                "text": cur_text[:max_chars]
            }

            # Previous page
            if target_idx > 0:
                prev_page = pdf[target_idx - 1]
                prev_text = prev_page.get_textpage().get_text_range().strip()
                res["prev_chapter"] = {
                    "title": f"Página {target_page - 1}",
                    "text": prev_text[-1200:] if len(prev_text) > 1200 else prev_text
                }

            # Next page
            if target_idx + 1 < total_pages:
                next_page = pdf[target_idx + 1]
                next_text = next_page.get_textpage().get_text_range().strip()
                res["next_chapter"] = {
                    "title": f"Página {target_page + 1}",
                    "text": next_text[:1200]
                }

            # Try PDF TOC bookmarks
            try:
                toc_items = []
                for item in pdf.get_toc():
                    if item.title:
                        toc_items.append(item.title.strip())
                if toc_items:
                    res["toc"] = toc_items[:30]
            except Exception:
                pass

        except Exception:
            pass

        return res

    def extract_context_for_book(
        self,
        book_id: Optional[str] = None,
        location: Optional[str] = None,
        page: Optional[int] = None
    ) -> Dict[str, Any]:
        """Extracts reading context strictly for the specific active book."""
        if not book_id:
            return {"surrounding": {}}

        book = self.db.find_book(book_id)
        if not book:
            return {"surrounding": {}}

        file_path = book.get("path") or ""
        fmt = book.get("format", "").lower()

        surrounding: Dict[str, Any] = {}
        if fmt == "epub":
            cfi = location if (location and location.startswith("epubcfi")) else None
            surrounding = self.extract_epub_context(file_path, location_hint=location, cfi_hint=cfi)
        elif fmt == "pdf":
            page_val = page or (int(location) if (location and location.isdigit()) else 1)
            surrounding = self.extract_pdf_context(file_path, page_hint=page_val)

        return {
            "book": book,
            "surrounding": surrounding
        }

    def search_epub_text(
        self,
        epub_path: str,
        query: str,
        location_hint: Optional[str] = None,
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Searches EPUB chapters up to the reader's current location for previous mentions of a query.
        Strictly anti-spoiler: never searches chapters beyond the current reading location.
        """
        results: List[Dict[str, Any]] = []
        clean_q = (query or "").strip()
        if not os.path.isfile(epub_path) or not clean_q:
            return results

        try:
            with zipfile.ZipFile(epub_path, 'r') as zf:
                c_data = zf.read('META-INF/container.xml').decode('utf-8', errors='ignore')
                m_rf = re.search(r'full-path=["\']([^"\']+)["\']', c_data, re.IGNORECASE)
                opf_path = m_rf.group(1) if m_rf else 'content.opf'
                opf_dir = '/'.join(opf_path.split('/')[:-1])

                opf_bytes = zf.read(opf_path)
                root = ET.fromstring(opf_bytes)

                manifest: Dict[str, str] = {}
                for item in root.findall('.//{http://www.idpf.org/2007/opf}item'):
                    manifest[item.get('id', '')] = item.get('href', '')

                spine: List[str] = []
                for itemref in root.findall('.//{http://www.idpf.org/2007/opf}itemref'):
                    idref = itemref.get('idref', '')
                    if idref in manifest:
                        href = manifest[idref]
                        full_href = f"{opf_dir}/{href}" if opf_dir else href
                        spine.append(full_href)

                # Map chapter hrefs to friendly TOC titles if available
                href_to_title: Dict[str, str] = {}
                for item in root.findall('.//{http://www.idpf.org/2007/opf}item'):
                    m_type = item.get('media-type', '')
                    props = item.get('properties', '')
                    if 'nav' in props or m_type == 'application/x-dtbncx+xml':
                        toc_href = item.get('href', '')
                        full_toc = f"{opf_dir}/{toc_href}" if opf_dir else toc_href
                        if full_toc in zf.namelist():
                            try:
                                toc_soup = BeautifulSoup(zf.read(full_toc), 'html.parser')
                                for a in toc_soup.find_all('a'):
                                    h = a.get('href', '')
                                    t = a.get_text().strip()
                                    if h and t:
                                        base_h = h.split('#')[0]
                                        href_to_title[base_h] = t
                                        href_to_title[os.path.basename(base_h)] = t
                                for navpoint in toc_soup.find_all(['navpoint', 'navPoint']):
                                    label = navpoint.find(['navlabel', 'navLabel'])
                                    content = navpoint.find('content')
                                    if label and content:
                                        src = content.get('src', '')
                                        t = label.get_text().strip()
                                        if src and t:
                                            base_s = src.split('#')[0]
                                            href_to_title[base_s] = t
                                            href_to_title[os.path.basename(base_s)] = t
                            except Exception:
                                pass

                # Locate current chapter index for Anti-Spoiler cutoff
                current_idx = -1
                if location_hint:
                    clean_hint = location_hint.split('#')[0].split('?')[0].strip()
                    clean_base = os.path.basename(clean_hint)
                    for idx, path in enumerate(spine):
                        if clean_hint in path or path.endswith(clean_hint) or os.path.basename(path) == clean_base:
                            current_idx = idx
                            break

                # If current index resolved, limit search up to current chapter
                search_spine = spine[:current_idx + 1] if current_idx >= 0 else spine

                for path in search_spine:
                    if path not in zf.namelist():
                        continue
                    try:
                        raw_bytes = zf.read(path)
                        text = clean_html_to_text(raw_bytes)
                        if not text:
                            continue

                        snippets = _extract_snippets(text, clean_q, max_snippets=2)
                        if not snippets:
                            continue

                        # Resolve friendly chapter title
                        base_name = os.path.basename(path)
                        title = href_to_title.get(base_name) or href_to_title.get(path)
                        if not title:
                            # Try <h1> or <title> in raw HTML
                            try:
                                sample = raw_bytes[:1500].decode('utf-8', errors='ignore')
                                m_h = re.search(r'<h[1-2][^>]*>(.*?)</h[1-2]>', sample, re.IGNORECASE | re.DOTALL)
                                if m_h:
                                    t = ' '.join(BeautifulSoup(m_h.group(1), 'html.parser').get_text().split())
                                    if t and len(t) < 60:
                                        title = t
                            except Exception:
                                pass
                        if not title:
                            clean_stem = os.path.splitext(base_name)[0].replace('_', ' ').replace('-', ' ').title()
                            title = clean_stem

                        for snip in snippets:
                            results.append({
                                "chapter": title,
                                "location": path,
                                "snippet": snip
                            })
                            if len(results) >= max_results:
                                return results
                    except Exception:
                        continue

        except Exception:
            pass

        return results

    def search_pdf_text(
        self,
        pdf_path: str,
        query: str,
        page_hint: Optional[int] = None,
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Searches PDF pages up to the reader's current page for previous mentions of a query.
        Strictly anti-spoiler: never searches pages beyond page_hint.
        """
        results: List[Dict[str, Any]] = []
        clean_q = (query or "").strip()
        if not os.path.isfile(pdf_path) or not clean_q:
            return results

        try:
            import pypdfium2
            pdf = pypdfium2.PdfDocument(pdf_path)
            total_pages = len(pdf)
            if total_pages == 0:
                return results

            max_page = min(page_hint or total_pages, total_pages)
            for p_num in range(1, max_page + 1):
                page_obj = pdf[p_num - 1]
                page_text = page_obj.get_textpage().get_text_range().strip()
                if not page_text:
                    continue

                snippets = _extract_snippets(page_text, clean_q, max_snippets=2)
                for snip in snippets:
                    results.append({
                        "page": p_num,
                        "chapter": f"Página {p_num}",
                        "snippet": snip
                    })
                    if len(results) >= max_results:
                        return results
        except Exception:
            pass
        return results

    def search_book_text(
        self,
        book_id: str,
        query: str,
        location_hint: Optional[str] = None,
        page_hint: Optional[int] = None,
        max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Main entry point for tool-based book search.
        Dispatches to EPUB or PDF search scoped up to the reader's current location.
        """
        if not book_id or not query or not query.strip():
            return []

        book = self.db.find_book(book_id)
        if not book:
            return []

        file_path = book.get("path") or ""
        fmt = book.get("format", "").lower()

        if fmt == "epub":
            return self.search_epub_text(
                file_path,
                query.strip(),
                location_hint=location_hint,
                max_results=max_results
            )
        elif fmt == "pdf":
            page_val = page_hint or (int(location_hint) if (location_hint and location_hint.isdigit()) else None)
            return self.search_pdf_text(
                file_path,
                query.strip(),
                page_hint=page_val,
                max_results=max_results
            )

        return []
