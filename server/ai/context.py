import os
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
from bs4 import BeautifulSoup

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
