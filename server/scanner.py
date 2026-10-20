import os
import re
import hashlib
import zipfile
import html
import threading
from typing import List, Dict, Any, Optional, Tuple

from .config import ConfigManager
from .database import get_db, Database

BOOK_EXTENSIONS = ('.pdf', '.epub')

def format_size(bytes_size: int) -> str:
    """Format file size in human-readable units."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.1f} {unit}" if unit != 'B' else f"{bytes_size} B"
        bytes_size /= 1024.0
    return f"{bytes_size:.1f} TB"

def clean_title(filename: str) -> str:
    """Derives a clean display title from the PDF filename."""
    name, _ = os.path.splitext(filename)
    name = re.sub(r'[_]+', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def format_shelf_name(shelf_dir: str) -> str:
    """Converts a directory name like 'Algoritmos-e-Estruturas' into 'Algoritmos e Estruturas'."""
    if shelf_dir == "_general":
        return "General"
    return shelf_dir.replace('-', ' ').strip()

format_folder_name = format_shelf_name

def compute_book_id(shelf: str, filename: str, library_id: str = "default") -> str:
    """
    Returns a deterministic, URL-safe book ID.
    If library_id is 'default' (or empty), keeps the legacy hash formula.
    """
    if not library_id or library_id == "default":
        raw = f"{shelf}:::{filename}"
    else:
        raw = f"{library_id}:::{shelf}:::{filename}"
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()[:16]

class LibraryScanner:
    def __init__(
        self,
        config_mgr: Optional[ConfigManager] = None,
        aliases_path: Optional[str] = None,
        icons_path: Optional[str] = None,
        metadata_cache_path: Optional[str] = None,
        index_cache_path: Optional[str] = None,
        db: Optional[Database] = None
    ):
        self.config_mgr = config_mgr or ConfigManager()
        self.db = db or getattr(self.config_mgr, "db", None) or get_db(metadata_cache_path or index_cache_path)
        self._lock = threading.RLock()

    @property
    def library_path(self) -> str:
        """Returns the filesystem path of the currently active library."""
        return self.config_mgr.get_library_path()

    def set_library_path(self, new_path: str) -> str:
        """Sets and persists a new book library folder path for active library."""
        with self._lock:
            saved = self.config_mgr.set_library_path(new_path)
            self.invalidate_cache()
            return saved

    def _resolve_library(self, library_id: Optional[str] = None) -> Tuple[str, str]:
        """Resolves (library_id, library_path) from given ID or active library."""
        if library_id:
            lib = self.config_mgr.get_library_by_id(library_id)
            if lib and lib.get("path"):
                return lib["id"], lib["path"]
            return library_id, ""

        active = self.config_mgr.get_active_library()
        if active and active.get("path"):
            return active["id"], active["path"]

        path = self.config_mgr.get_library_path()
        return "default", path

    def _get_epub_metadata(self, epub_path: str, mtime: float) -> Dict[str, Any]:
        cache_key = f"{epub_path}:::{mtime}"
        cached = self.db.get_epub_metadata(cache_key)
        if cached and cached.get("spine_count", 0) > 0:
            return cached

        meta = {"title": "", "author": "", "description": "", "publisher": "", "date": "", "spine_count": 0}
        try:
            with zipfile.ZipFile(epub_path, 'r') as z:
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

                if opf_path:
                    opf_text = z.read(opf_path).decode('utf-8', errors='ignore')
                    m_title = re.search(r'<dc:title[^>]*>([^<]+)</dc:title>', opf_text, re.IGNORECASE)
                    if m_title:
                        meta['title'] = html.unescape(m_title.group(1).strip())
                    m_author = re.search(r'<dc:creator[^>]*>([^<]+)</dc:creator>', opf_text, re.IGNORECASE)
                    if m_author:
                        meta['author'] = html.unescape(m_author.group(1).strip())
                    m_desc = re.search(r'<dc:description[^>]*>([\s\S]*?)</dc:description>', opf_text, re.IGNORECASE)
                    if m_desc:
                        clean_desc = re.sub(r'<[^>]+>', ' ', m_desc.group(1))
                        meta['description'] = html.unescape(re.sub(r'\s+', ' ', clean_desc)).strip()
                    m_pub = re.search(r'<dc:publisher[^>]*>([^<]+)</dc:publisher>', opf_text, re.IGNORECASE)
                    if m_pub:
                        meta['publisher'] = html.unescape(m_pub.group(1).strip())
                    m_date = re.search(r'<dc:date[^>]*>([^<]+)</dc:date>', opf_text, re.IGNORECASE)
                    if m_date:
                        meta['date'] = html.unescape(m_date.group(1).strip())
                    spine_items = re.findall(r'<itemref\b', opf_text, re.IGNORECASE)
                    meta['spine_count'] = len(spine_items)
        except Exception as e:
            print(f"Error reading EPUB metadata from {epub_path}: {e}")

        self.db.set_epub_metadata(cache_key, meta)
        return meta

    def estimate_epub_percent(self, epub_path: str, cfi: str) -> Optional[float]:
        """Estimates reading percentage from EPUB spine index in CFI."""
        if not epub_path or not os.path.isfile(epub_path) or not cfi:
            return None
        match = re.search(r'/6/(\d+)!', cfi)
        if not match:
            return None
        try:
            child_num = int(match.group(1))
            spine_index = max(0, (child_num // 2) - 1)
            mtime = os.path.getmtime(epub_path)
            meta = self._get_epub_metadata(epub_path, mtime)
            sc = meta.get("spine_count", 0)
            if sc > 0:
                return round(min(100.0, max(0.0, (spine_index / sc) * 100.0)), 1)
        except Exception as e:
            print(f"Error estimating epub percent: {e}")
        return None

    def set_shelf_icon(self, shelf_id: str, icon_name: str, library_id: Optional[str] = None) -> str:
        lib_id, _ = self._resolve_library(library_id)
        return self.db.set_folder_icon(lib_id, shelf_id, icon_name)

    set_folder_icon = set_shelf_icon

    def get_shelf_icon(self, shelf_id: str, library_id: Optional[str] = None) -> str:
        lib_id, _ = self._resolve_library(library_id)
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT icon FROM folders WHERE library_id = ? AND id = ?", (lib_id, shelf_id)).fetchone()
            if row and row["icon"]:
                return row["icon"]
            return ""

    get_folder_icon = get_shelf_icon

    def set_shelf_alias(self, shelf_id: str, custom_name: str, library_id: Optional[str] = None) -> str:
        lib_id, _ = self._resolve_library(library_id)
        return self.db.set_folder_alias(lib_id, shelf_id, custom_name)

    set_folder_alias = set_shelf_alias

    def get_shelf_display_name(self, shelf_id: str, library_id: Optional[str] = None) -> str:
        lib_id, _ = self._resolve_library(library_id)
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT custom_name, original_name FROM folders WHERE library_id = ? AND id = ?", (lib_id, shelf_id)).fetchone()
            if row and row["custom_name"]:
                return row["custom_name"]
            if row and row["original_name"]:
                return row["original_name"]
            return format_shelf_name(shelf_id)

    get_folder_display_name = get_shelf_display_name

    def _scan_disk(self, lib_id: str, lib_path: str):
        """Scans the physical directory on disk and persists catalog structures into SQLite."""
        if not lib_path or not os.path.isdir(lib_path):
            self.db.save_catalog(lib_id, [], [])
            return

        try:
            entries = sorted(os.listdir(lib_path))
        except Exception:
            self.db.save_catalog(lib_id, [], [])
            return

        folders = []
        books = []

        # Check for direct books in root directory
        root_books = [f for f in entries if f.lower().endswith(BOOK_EXTENSIONS) and os.path.isfile(os.path.join(lib_path, f))]
        if root_books:
            sample_covers = [
                f"/api/cover/{compute_book_id('_general', f, lib_id)}"
                for f in root_books[:4]
            ]
            folders.append({
                "id": "_general",
                "original_name": "General",
                "folder": "_general",
                "shelf": "_general",
                "book_count": len(root_books),
                "library_id": lib_id,
                "sample_covers": sample_covers,
                "icon": "BookOpen"
            })
            for fname in root_books:
                full_path = os.path.join(lib_path, fname)
                try:
                    stat = os.stat(full_path)
                    size = stat.st_size
                    mtime = stat.st_mtime
                except Exception:
                    size = 0
                    mtime = 0

                is_epub = fname.lower().endswith('.epub')
                meta = self._get_epub_metadata(full_path, mtime) if is_epub else {}
                title = meta.get("title") or clean_title(fname)
                author = meta.get("author", "")
                book_id = compute_book_id("_general", fname, lib_id)
                books.append({
                    "id": book_id,
                    "library_id": lib_id,
                    "title": title,
                    "author": author,
                    "format": "epub" if is_epub else "pdf",
                    "filename": fname,
                    "shelf": "_general",
                    "folder": "_general",
                    "size_bytes": size,
                    "size_formatted": format_size(size),
                    "modified_time": mtime,
                    "path": full_path,
                    "description": meta.get("description", ""),
                    "publisher": meta.get("publisher", ""),
                    "published_date": meta.get("date", ""),
                })

        for entry in entries:
            shelf_dir = os.path.join(lib_path, entry)
            if not os.path.isdir(shelf_dir):
                continue

            try:
                filenames = sorted(os.listdir(shelf_dir))
            except Exception:
                filenames = []

            book_files = [f for f in filenames if f.lower().endswith(BOOK_EXTENSIONS)]
            book_count = len(book_files)
            if book_count > 0:
                orig_name = format_shelf_name(entry)
                sample_covers = [
                    f"/api/cover/{compute_book_id(entry, f, lib_id)}"
                    for f in book_files[:4]
                ]
                folders.append({
                    "id": entry,
                    "original_name": orig_name,
                    "folder": entry,
                    "shelf": entry,
                    "book_count": book_count,
                    "library_id": lib_id,
                    "sample_covers": sample_covers,
                    "icon": ""
                })

                for fname in book_files:
                    full_path = os.path.join(shelf_dir, fname)
                    try:
                        stat = os.stat(full_path)
                        size = stat.st_size
                        mtime = stat.st_mtime
                    except Exception:
                        size = 0
                        mtime = 0

                    is_epub = fname.lower().endswith('.epub')
                    meta = self._get_epub_metadata(full_path, mtime) if is_epub else {}
                    title = meta.get("title") or clean_title(fname)
                    author = meta.get("author", "")
                    book_id = compute_book_id(entry, fname, lib_id)

                    books.append({
                        "id": book_id,
                        "library_id": lib_id,
                        "title": title,
                        "author": author,
                        "format": "epub" if is_epub else "pdf",
                        "filename": fname,
                        "shelf": entry,
                        "folder": entry,
                        "size_bytes": size,
                        "size_formatted": format_size(size),
                        "modified_time": mtime,
                        "path": full_path,
                        "description": meta.get("description", ""),
                        "publisher": meta.get("publisher", ""),
                        "published_date": meta.get("date", ""),
                    })

        self.db.save_catalog(lib_id, folders, books)

    def get_shelves(self, library_id: Optional[str] = None, force_scan: bool = False) -> List[Dict[str, Any]]:
        """Returns list of all folders with metadata and book counts for a library from SQLite."""
        lib_id, lib_path = self._resolve_library(library_id)
        if not lib_path or not os.path.isdir(lib_path):
            return []

        with self._lock:
            folders = self.db.get_folders(lib_id)
            if force_scan or not folders:
                self._scan_disk(lib_id, lib_path)
                folders = self.db.get_folders(lib_id)
            return folders

    get_folders = get_shelves

    def get_books(self, shelf_filter: Optional[str] = None, folder_filter: Optional[str] = None, library_id: Optional[str] = None, force_scan: bool = False) -> List[Dict[str, Any]]:
        """Returns all books strictly belonging to a library, optionally filtered by folder, from SQLite."""
        lib_id, lib_path = self._resolve_library(library_id)
        if not lib_path or not os.path.isdir(lib_path):
            return []

        active_filter = folder_filter or shelf_filter
        with self._lock:
            folders = self.db.get_folders(lib_id)
            if force_scan or not folders:
                self._scan_disk(lib_id, lib_path)

            books = self.db.get_books(lib_id, active_filter)
            return books

    def find_book(self, book_id: str, library_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Finds a specific book by ID from SQLite."""
        lib_id, _ = self._resolve_library(library_id) if library_id else (None, None)
        return self.db.find_book(book_id, lib_id)

    def invalidate_cache(self, library_id: Optional[str] = None):
        """Invalidates catalog for a library or all."""
        with self._lock:
            self.db.invalidate_catalog(library_id)

    def rescan_library(self, library_id: Optional[str] = None) -> Dict[str, Any]:
        """Forces physical disk scan to rebuild the SQLite catalog."""
        with self._lock:
            if library_id:
                lib_id, lib_path = self._resolve_library(library_id)
                self._scan_disk(lib_id, lib_path)
                folders = self.db.get_folders(lib_id)
                books = self.db.get_books(lib_id)
                return {lib_id: {"folders": len(folders), "books": len(books)}}
            else:
                stats = {}
                for lib in self.config_mgr.get_libraries():
                    lid = lib["id"]
                    lpath = lib["path"]
                    self._scan_disk(lid, lpath)
                    folders = self.db.get_folders(lid)
                    books = self.db.get_books(lid)
                    stats[lid] = {"folders": len(folders), "books": len(books)}
                return stats
