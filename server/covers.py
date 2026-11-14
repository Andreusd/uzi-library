import os
import io
import threading
import zipfile
import posixpath
import re
import urllib.parse
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont
from typing import Optional

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache", "covers"))

class CoverManager:
    def __init__(self, cache_dir: str = CACHE_DIR):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        self._lock = threading.RLock()

    def get_cover_path(self, book_id: str) -> str:
        """Returns the file path for the cached cover image."""
        return os.path.join(self.cache_dir, f"{book_id}.webp")

    def get_jpeg_cover_path(self, book_id: str, original_file_path: Optional[str] = None, title: str = "") -> str:
        """Returns the file path for a cached JPEG cover image (for iOS < 14 / legacy clients)."""
        jpg_path = os.path.join(self.cache_dir, f"{book_id}.jpg")
        if os.path.exists(jpg_path) and os.path.getsize(jpg_path) > 0:
            return jpg_path

        webp_path = self.get_cover_path(book_id)
        if not (os.path.exists(webp_path) and os.path.getsize(webp_path) > 0):
            if original_file_path:
                webp_path = self.generate_cover(original_file_path, book_id, title)
            else:
                return webp_path

        with self._lock:
            if os.path.exists(jpg_path) and os.path.getsize(jpg_path) > 0:
                return jpg_path
            try:
                with Image.open(webp_path) as img:
                    rgb_img = img.convert("RGB")
                    rgb_img.save(jpg_path, "JPEG", quality=85)
                    return jpg_path
            except Exception as e:
                print(f"Error converting cover to JPEG for {book_id}: {e}")
                return webp_path

    def has_cover(self, book_id: str) -> bool:
        """Checks if a cached cover exists and is non-empty."""
        path = self.get_cover_path(book_id)
        return os.path.exists(path) and os.path.getsize(path) > 0

    def _extract_epub_cover_bytes(self, epub_path: str) -> Optional[bytes]:
        """Extracts embedded cover image bytes directly from an EPUB archive."""
        try:
            with zipfile.ZipFile(epub_path, 'r') as z:
                # 1. Container lookup
                try:
                    c_data = z.read('META-INF/container.xml').decode('utf-8', errors='ignore')
                    m_rf = re.search(r'full-path=["\']([^"\']+)["\']', c_data, re.IGNORECASE)
                    opf_path = m_rf.group(1) if m_rf else 'content.opf'
                except Exception:
                    opf_candidates = [n for n in z.namelist() if n.lower().endswith('.opf')]
                    opf_path = opf_candidates[0] if opf_candidates else ''

                if not opf_path or opf_path not in z.namelist():
                    for n in z.namelist():
                        if n.lower() == opf_path.lower():
                            opf_path = n
                            break

                if not opf_path:
                    return None

                opf_dir = posixpath.dirname(opf_path)
                opf_text = z.read(opf_path).decode('utf-8', errors='ignore')

                # Cover detection priority:
                # 1. meta name="cover" content="id"
                cover_id = None
                m_cov_meta = re.search(r'<meta[^>]+name=["\']cover["\'][^>]+content=["\']([^"\']+)["\']', opf_text, re.IGNORECASE)
                if not m_cov_meta:
                    m_cov_meta = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']cover["\']', opf_text, re.IGNORECASE)
                if m_cov_meta:
                    cover_id = m_cov_meta.group(1)

                cover_href = None
                if cover_id:
                    m_item = re.search(r'<item[^>]+id=["\']' + re.escape(cover_id) + r'["\'][^>]+href=["\']([^"\']+)["\']', opf_text, re.IGNORECASE)
                    if not m_item:
                        m_item = re.search(r'<item[^>]+href=["\']([^"\']+)["\'][^>]+id=["\']' + re.escape(cover_id) + r'["\']', opf_text, re.IGNORECASE)
                    if m_item:
                        cover_href = m_item.group(1)

                # 2. properties="cover-image"
                if not cover_href:
                    m_cov_prop = re.search(r'<item[^>]+properties=["\'][^"\']*cover-image[^"\']*["\'][^>]+href=["\']([^"\']+)["\']', opf_text, re.IGNORECASE)
                    if not m_cov_prop:
                        m_cov_prop = re.search(r'<item[^>]+href=["\']([^"\']+)["\'][^>]+properties=["\'][^"\']*cover-image[^"\']*["\']', opf_text, re.IGNORECASE)
                    if m_cov_prop:
                        cover_href = m_cov_prop.group(1)

                # 3. Fallback: item with id containing 'cover' and image media-type
                if not cover_href:
                    for m in re.finditer(r'<item\b([^>]+)>', opf_text, re.IGNORECASE):
                        tag_attrs = m.group(1)
                        if 'cover' in tag_attrs.lower() and 'image/' in tag_attrs.lower():
                            m_href = re.search(r'href=["\']([^"\']+)["\']', tag_attrs, re.IGNORECASE)
                            if m_href:
                                cover_href = m_href.group(1)
                                break

                # 4. Fallback: direct cover.(jpg|jpeg|png|webp) filename in archive
                if not cover_href:
                    for name in z.namelist():
                        base = posixpath.basename(name).lower()
                        if base in ('cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'):
                            cover_href = name
                            opf_dir = ''
                            break

                if cover_href:
                    cover_href = urllib.parse.unquote(cover_href)
                    full_cover_path = posixpath.normpath(posixpath.join(opf_dir, cover_href)) if opf_dir else cover_href
                    namelist = z.namelist()
                    if full_cover_path in namelist:
                        return z.read(full_cover_path)
                    for name in namelist:
                        if name.lower() == full_cover_path.lower():
                            return z.read(name)
        except Exception as e:
            print(f"Error extracting EPUB cover from {epub_path}: {e}")
        return None

    def generate_cover(self, file_path: str, book_id: str, title: str = "") -> str:
        """
        Renders the first page of a PDF or extracts cover image from an EPUB as a high quality WebP thumbnail.
        If the file cannot be rendered, generates a clean fallback book cover.
        """
        out_path = self.get_cover_path(book_id)
        if self.has_cover(book_id):
            return out_path

        with self._lock:
            if self.has_cover(book_id):
                return out_path

            is_epub = file_path.lower().endswith('.epub')

            if is_epub:
                try:
                    cover_bytes = self._extract_epub_cover_bytes(file_path)
                    if cover_bytes:
                        with Image.open(io.BytesIO(cover_bytes)) as img:
                            # Handle transparency or palette modes
                            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                                rgba = img.convert("RGBA")
                                bg = Image.new("RGB", rgba.size, (255, 255, 255))
                                bg.paste(rgba, mask=rgba.split()[3])
                                final_img = bg
                            elif img.mode != "RGB":
                                final_img = img.convert("RGB")
                            else:
                                final_img = img.copy()

                            # Downscale if massive to save memory & disk
                            final_img.thumbnail((600, 900), Image.Resampling.LANCZOS)
                            final_img.save(out_path, "WEBP", quality=85)
                            return out_path
                except Exception as e:
                    print(f"Error processing EPUB cover for {file_path}: {e}")
            else:
                try:
                    # Open PDF and render first page
                    pdf = pdfium.PdfDocument(file_path)
                    if len(pdf) > 0:
                        page = pdf[0]
                        # Scale 1.5 gives crisp ~450-600px width on standard 72 DPI PDF
                        image = page.render(scale=1.5).to_pil()
                        image.save(out_path, "WEBP", quality=85)
                        pdf.close()
                        return out_path
                    pdf.close()
                except Exception as e:
                    print(f"Error rendering cover for {file_path}: {e}")

            # Fallback placeholder cover
            self._create_fallback_cover(out_path, title or book_id, book_type="EPUB BOOK" if is_epub else "PDF BOOK")
            return out_path

    def _create_fallback_cover(self, out_path: str, title: str, book_type: str = "BOOK"):
        """Creates a stylized placeholder book cover if file rendering fails."""
        width, height = 400, 600
        img = Image.new("RGB", (width, height), color="#1e293b")
        draw = ImageDraw.Draw(img)

        # Draw decorative spine
        draw.rectangle([0, 0, 20, height], fill="#0f172a")

        # Draw book title snippet
        words = title[:60].split()
        lines = []
        current_line = []
        for w in words:
            current_line.append(w)
            if len(" ".join(current_line)) > 18:
                lines.append(" ".join(current_line))
                current_line = []
        if current_line:
            lines.append(" ".join(current_line))

        text = "\n".join(lines[:4])
        draw.multiline_text((40, 80), text, fill="#f8fafc", spacing=8)
        draw.text((40, height - 60), book_type.upper(), fill="#94a3b8")

        img.save(out_path, "WEBP", quality=80)

    def pre_cache_all(self, books: list):
        """Background thread worker to pre-render all covers."""
        def worker():
            for b in books:
                try:
                    if not self.has_cover(b["id"]):
                        self.generate_cover(b["path"], b["id"], b["title"])
                except Exception as e:
                    print(f"Background pre-cache error on {b.get('title')}: {e}")

        t = threading.Thread(target=worker, daemon=True)
        t.start()
