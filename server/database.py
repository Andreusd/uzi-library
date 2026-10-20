import os
import sqlite3
import json
import threading
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache"))
DEFAULT_DB_PATH = os.path.join(CACHE_DIR, "library.db")

def resolve_db_path(path_or_dir: Optional[str]) -> str:
    """Resolves a filesystem path or directory into a valid SQLite database path."""
    if not path_or_dir:
        return DEFAULT_DB_PATH
    p = os.path.abspath(path_or_dir)
    if os.path.isdir(p):
        return os.path.join(p, "library.db")
    if p.endswith(".db") or p.endswith(".sqlite"):
        return p
    return os.path.join(os.path.dirname(p), "library.db")

class Database:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = resolve_db_path(db_path)
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._lock = threading.RLock()
        self._init_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def _init_schema(self):
        with self._lock, self.get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS libraries (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS folders (
                id TEXT NOT NULL,
                library_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                custom_name TEXT DEFAULT '',
                icon TEXT DEFAULT '',
                book_count INTEGER DEFAULT 0,
                sample_covers TEXT DEFAULT '[]',
                PRIMARY KEY (library_id, id)
            );

            CREATE TABLE IF NOT EXISTS folder_aliases (
                library_id TEXT NOT NULL,
                folder_id TEXT NOT NULL,
                custom_name TEXT NOT NULL,
                PRIMARY KEY (library_id, folder_id)
            );

            CREATE TABLE IF NOT EXISTS folder_icons (
                library_id TEXT NOT NULL,
                folder_id TEXT NOT NULL,
                icon TEXT NOT NULL,
                PRIMARY KEY (library_id, folder_id)
            );

            CREATE TABLE IF NOT EXISTS books (
                id TEXT NOT NULL,
                library_id TEXT NOT NULL,
                folder_id TEXT NOT NULL,
                title TEXT NOT NULL,
                author TEXT DEFAULT '',
                format TEXT NOT NULL,
                filename TEXT NOT NULL,
                size_bytes INTEGER DEFAULT 0,
                size_formatted TEXT DEFAULT '',
                modified_time REAL DEFAULT 0.0,
                path TEXT NOT NULL,
                description TEXT DEFAULT '',
                publisher TEXT DEFAULT '',
                published_date TEXT DEFAULT '',
                PRIMARY KEY (library_id, id)
            );

            CREATE TABLE IF NOT EXISTS epub_metadata (
                cache_key TEXT PRIMARY KEY,
                title TEXT DEFAULT '',
                author TEXT DEFAULT '',
                description TEXT DEFAULT '',
                publisher TEXT DEFAULT '',
                published_date TEXT DEFAULT '',
                spine_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS users (
                slug TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_active_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS reading_progress (
                user_slug TEXT NOT NULL,
                book_id TEXT NOT NULL,
                page INTEGER NOT NULL DEFAULT 1,
                total_pages INTEGER NOT NULL DEFAULT 1,
                percent REAL NOT NULL DEFAULT 0.0,
                zoom REAL NOT NULL DEFAULT 1.2,
                invert_colors INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'not_started',
                cfi TEXT,
                updated_at TEXT,
                PRIMARY KEY (user_slug, book_id)
            );

            CREATE TABLE IF NOT EXISTS favorites (
                user_slug TEXT NOT NULL,
                book_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_slug, book_id)
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                user_slug TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT 'amber',
                library_id TEXT NOT NULL DEFAULT 'default',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS book_tags (
                user_slug TEXT NOT NULL,
                book_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (user_slug, book_id, tag_id)
            );

            CREATE TABLE IF NOT EXISTS annotations (
                id TEXT PRIMARY KEY,
                user_slug TEXT NOT NULL,
                book_id TEXT NOT NULL,
                page INTEGER NOT NULL DEFAULT 1,
                cfi TEXT,
                chapter TEXT,
                text TEXT DEFAULT '',
                color TEXT DEFAULT 'yellow',
                comment TEXT DEFAULT '',
                rects TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lookups (
                lookup_type TEXT NOT NULL,
                lookup_key TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (lookup_type, lookup_key)
            );

            CREATE INDEX IF NOT EXISTS idx_books_folder ON books (library_id, folder_id);
            CREATE INDEX IF NOT EXISTS idx_progress_updated ON reading_progress (user_slug, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_favorites_created ON favorites (user_slug, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_tags_user_lib ON tags (user_slug, library_id, name);
            CREATE INDEX IF NOT EXISTS idx_book_tags_user_book ON book_tags (user_slug, book_id);
            CREATE INDEX IF NOT EXISTS idx_book_tags_user_tag ON book_tags (user_slug, tag_id);
            CREATE INDEX IF NOT EXISTS idx_annotations_book ON annotations (user_slug, book_id, page);
            """)

            # Seed default settings if empty
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('show_file_extension', '1')")
            conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('book_animations', '1')")

            # Seed default user if empty
            cur = conn.execute("SELECT count(*) FROM users")
            if cur.fetchone()[0] == 0:
                now = datetime.now().isoformat()
                conn.execute(
                    "INSERT OR IGNORE INTO users (slug, display_name, created_at, last_active_at) VALUES (?, ?, ?, ?)",
                    ("andreusd", "Andreusd", now, now)
                )

            # ONLY seed default library if this is the global production database
            if self.db_path == DEFAULT_DB_PATH:
                cur = conn.execute("SELECT count(*) FROM libraries")
                if cur.fetchone()[0] == 0:
                    target_path = "/home/andreusd/Documents/Livros/Livros-Tecnicos"
                    if not os.path.isdir(target_path):
                        for cand in [
                            os.path.expanduser("~/Documents/Livros/Livros-Tecnicos"),
                            os.path.expanduser("~/Books"),
                            os.path.expanduser("~/Documents/Books")
                        ]:
                            if os.path.isdir(cand):
                                target_path = cand
                                break
                    if os.path.isdir(target_path):
                        conn.execute(
                            "INSERT OR IGNORE INTO libraries (id, name, path) VALUES (?, ?, ?)",
                            ("default", "TechnicalBooks", target_path)
                        )

    # ----------------- Libraries & Settings -----------------
    def get_libraries(self) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute("SELECT id, name, path FROM libraries ORDER BY rowid ASC").fetchall()
            return [dict(r) for r in rows]

    def get_library(self, lib_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT id, name, path FROM libraries WHERE id = ?", (lib_id,)).fetchone()
            return dict(row) if row else None

    def add_library(self, lib_id: str, name: str, path: str) -> Dict[str, Any]:
        with self._lock, self.get_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO libraries (id, name, path) VALUES (?, ?, ?)", (lib_id, name, path))
            return {"id": lib_id, "name": name, "path": path}

    def update_library(self, lib_id: str, name: Optional[str] = None, path: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            cur = conn.execute("SELECT id, name, path FROM libraries WHERE id = ?", (lib_id,)).fetchone()
            if not cur:
                return None
            new_name = name.strip() if (name and name.strip()) else cur["name"]
            new_path = path.strip() if (path and path.strip()) else cur["path"]
            conn.execute("UPDATE libraries SET name = ?, path = ? WHERE id = ?", (new_name, new_path, lib_id))
            return {"id": lib_id, "name": new_name, "path": new_path}

    def delete_library(self, lib_id: str) -> bool:
        with self._lock, self.get_connection() as conn:
            cur = conn.execute("SELECT count(*) FROM libraries")
            if cur.fetchone()[0] <= 1:
                return False
            res = conn.execute("DELETE FROM libraries WHERE id = ?", (lib_id,))
            conn.execute("DELETE FROM folders WHERE library_id = ?", (lib_id,))
            conn.execute("DELETE FROM folder_aliases WHERE library_id = ?", (lib_id,))
            conn.execute("DELETE FROM folder_icons WHERE library_id = ?", (lib_id,))
            conn.execute("DELETE FROM books WHERE library_id = ?", (lib_id,))
            return res.rowcount > 0

    def get_setting(self, key: str, default: Any = None) -> Any:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
            if not row:
                return default
            val = row["value"]
            if val in ("1", "true", "True"):
                return True
            if val in ("0", "false", "False"):
                return False
            return val

    def set_setting(self, key: str, value: Any) -> Any:
        val_str = "1" if value is True else ("0" if value is False else str(value))
        with self._lock, self.get_connection() as conn:
            conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, val_str))
        return value

    # ----------------- Folders & Books (Catalog) -----------------
    def get_folder_alias(self, library_id: str, folder_id: str) -> str:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT custom_name FROM folder_aliases WHERE library_id = ? AND folder_id = ?", (library_id, folder_id)).fetchone()
            if row and row["custom_name"]:
                return row["custom_name"]
            row_f = conn.execute("SELECT custom_name, original_name FROM folders WHERE library_id = ? AND id = ?", (library_id, folder_id)).fetchone()
            if row_f and row_f["custom_name"]:
                return row_f["custom_name"]
            if row_f and row_f["original_name"]:
                return row_f["original_name"]
            return folder_id.replace('-', ' ').strip()

    def set_folder_alias(self, library_id: str, folder_id: str, custom_name: str) -> str:
        clean = custom_name.strip()
        with self._lock, self.get_connection() as conn:
            if clean:
                conn.execute("INSERT OR REPLACE INTO folder_aliases (library_id, folder_id, custom_name) VALUES (?, ?, ?)", (library_id, folder_id, clean))
                conn.execute("UPDATE folders SET custom_name = ? WHERE library_id = ? AND id = ?", (clean, library_id, folder_id))
            else:
                conn.execute("DELETE FROM folder_aliases WHERE library_id = ? AND folder_id = ?", (library_id, folder_id))
                conn.execute("UPDATE folders SET custom_name = '' WHERE library_id = ? AND id = ?", (library_id, folder_id))
            return self.get_folder_alias(library_id, folder_id)

    def get_folder_icon(self, library_id: str, folder_id: str) -> str:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT icon FROM folder_icons WHERE library_id = ? AND folder_id = ?", (library_id, folder_id)).fetchone()
            if row and row["icon"]:
                return row["icon"]
            row_f = conn.execute("SELECT icon FROM folders WHERE library_id = ? AND id = ?", (library_id, folder_id)).fetchone()
            if row_f and row_f["icon"]:
                return row_f["icon"]
            return "BookOpen" if folder_id == "_general" else ""

    def set_folder_icon(self, library_id: str, folder_id: str, icon: str) -> str:
        clean_icon = icon.strip() if icon and icon.strip().lower() != "folder" else ""
        with self._lock, self.get_connection() as conn:
            if clean_icon:
                conn.execute("INSERT OR REPLACE INTO folder_icons (library_id, folder_id, icon) VALUES (?, ?, ?)", (library_id, folder_id, clean_icon))
                conn.execute("UPDATE folders SET icon = ? WHERE library_id = ? AND id = ?", (clean_icon, library_id, folder_id))
            else:
                conn.execute("DELETE FROM folder_icons WHERE library_id = ? AND folder_id = ?", (library_id, folder_id))
                conn.execute("UPDATE folders SET icon = '' WHERE library_id = ? AND id = ?", (library_id, folder_id))
            return clean_icon

    def get_folders(self, library_id: str) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute(
                "SELECT id, library_id, original_name, custom_name, icon, book_count, sample_covers FROM folders WHERE library_id = ?",
                (library_id,)
            ).fetchall()
            results = []
            for r in rows:
                item = dict(r)
                fid = item["id"]
                item["sample_covers"] = json.loads(item.get("sample_covers") or "[]")
                item["folder"] = fid
                item["shelf"] = fid
                alias = self.get_folder_alias(library_id, fid)
                icon = self.get_folder_icon(library_id, fid)
                item["name"] = alias
                item["custom_name"] = alias if alias != item["original_name"] else ""
                item["icon"] = icon
                results.append(item)
            return results

    def save_catalog(self, library_id: str, folders: List[Dict[str, Any]], books: List[Dict[str, Any]]):
        with self._lock, self.get_connection() as conn:
            conn.execute("DELETE FROM folders WHERE library_id = ?", (library_id,))
            for f in folders:
                fid = f["id"]
                c_name = self.get_folder_alias(library_id, fid)
                c_icon = self.get_folder_icon(library_id, fid)
                conn.execute(
                    """INSERT OR REPLACE INTO folders 
                    (id, library_id, original_name, custom_name, icon, book_count, sample_covers)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        fid,
                        library_id,
                        f.get("original_name", fid),
                        c_name,
                        c_icon,
                        int(f.get("book_count", 0)),
                        json.dumps(f.get("sample_covers", []))
                    )
                )

            conn.execute("DELETE FROM books WHERE library_id = ?", (library_id,))
            for b in books:
                conn.execute(
                    """INSERT OR REPLACE INTO books
                    (id, library_id, folder_id, title, author, format, filename, size_bytes, size_formatted, modified_time, path, description, publisher, published_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        b["id"],
                        library_id,
                        b.get("folder") or b.get("shelf") or "_general",
                        b.get("title", ""),
                        b.get("author", ""),
                        b.get("format", "pdf"),
                        b.get("filename", ""),
                        int(b.get("size_bytes", 0)),
                        b.get("size_formatted", ""),
                        float(b.get("modified_time", 0.0)),
                        b.get("path", ""),
                        b.get("description", ""),
                        b.get("publisher", ""),
                        b.get("published_date", "")
                    )
                )

    def get_books(self, library_id: str, folder_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            query = "SELECT * FROM books WHERE library_id = ?"
            params: List[Any] = [library_id]
            if folder_filter:
                query += " AND folder_id = ?"
                params.append(folder_filter)
            query += " ORDER BY title COLLATE NOCASE ASC"

            rows = conn.execute(query, tuple(params)).fetchall()
            results = []
            for r in rows:
                b = dict(r)
                fid = b["folder_id"]
                disp = self.get_folder_alias(library_id, fid)
                b["shelf"] = fid
                b["shelf_display"] = disp
                b["folder"] = fid
                b["folder_display"] = disp
                results.append(b)
            return results

    def find_book(self, book_id: str, library_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            if library_id:
                row = conn.execute("SELECT * FROM books WHERE library_id = ? AND id = ?", (library_id, book_id)).fetchone()
                if row:
                    b = dict(row)
                    disp = self.get_folder_alias(b["library_id"], b["folder_id"])
                    b["shelf"] = b["folder_id"]
                    b["shelf_display"] = disp
                    b["folder"] = b["folder_id"]
                    b["folder_display"] = disp
                    return b

            row = conn.execute("SELECT * FROM books WHERE id = ? LIMIT 1", (book_id,)).fetchone()
            if row:
                b = dict(row)
                disp = self.get_folder_alias(b["library_id"], b["folder_id"])
                b["shelf"] = b["folder_id"]
                b["shelf_display"] = disp
                b["folder"] = b["folder_id"]
                b["folder_display"] = disp
                return b
            return None

    def invalidate_catalog(self, library_id: Optional[str] = None):
        with self._lock, self.get_connection() as conn:
            if library_id:
                conn.execute("DELETE FROM folders WHERE library_id = ?", (library_id,))
                conn.execute("DELETE FROM books WHERE library_id = ?", (library_id,))
            else:
                conn.execute("DELETE FROM folders")
                conn.execute("DELETE FROM books")

    # ----------------- EPUB Metadata Cache -----------------
    def get_epub_metadata(self, cache_key: str) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT * FROM epub_metadata WHERE cache_key = ?", (cache_key,)).fetchone()
            if row:
                d = dict(row)
                d.pop("cache_key", None)
                return d
            return None

    def set_epub_metadata(self, cache_key: str, meta: Dict[str, Any]):
        with self._lock, self.get_connection() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO epub_metadata (cache_key, title, author, description, publisher, published_date, spine_count)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    cache_key,
                    meta.get("title", ""),
                    meta.get("author", ""),
                    meta.get("description", ""),
                    meta.get("publisher", ""),
                    meta.get("date", meta.get("published_date", "")),
                    int(meta.get("spine_count", 0))
                )
            )

    # ----------------- Users -----------------
    def get_users(self) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute("SELECT slug, display_name, created_at, last_active_at FROM users ORDER BY last_active_at DESC").fetchall()
            return [dict(r) for r in rows]

    def get_user(self, slug: str) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT slug, display_name, created_at, last_active_at FROM users WHERE slug = ?", (slug,)).fetchone()
            return dict(row) if row else None

    def touch_user(self, slug: str, display_name: str) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        with self._lock, self.get_connection() as conn:
            existing = conn.execute("SELECT created_at FROM users WHERE slug = ?", (slug,)).fetchone()
            created_at = existing["created_at"] if existing else now
            conn.execute(
                "INSERT OR REPLACE INTO users (slug, display_name, created_at, last_active_at) VALUES (?, ?, ?, ?)",
                (slug, display_name, created_at, now)
            )
            return {"slug": slug, "display_name": display_name, "created_at": created_at, "last_active_at": now}

    def delete_user(self, slug: str) -> bool:
        with self._lock, self.get_connection() as conn:
            cur = conn.execute("DELETE FROM users WHERE slug = ?", (slug,))
            conn.execute("DELETE FROM reading_progress WHERE user_slug = ?", (slug,))
            conn.execute("DELETE FROM favorites WHERE user_slug = ?", (slug,))
            conn.execute("DELETE FROM tags WHERE user_slug = ?", (slug,))
            conn.execute("DELETE FROM book_tags WHERE user_slug = ?", (slug,))
            conn.execute("DELETE FROM annotations WHERE user_slug = ?", (slug,))
            return cur.rowcount > 0

    # ----------------- Reading Progress -----------------
    def get_progress(self, user_slug: str, book_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT * FROM reading_progress WHERE user_slug = ? AND book_id = ?", (user_slug, book_id)).fetchone()
            if not row:
                return None
            res = dict(row)
            res.pop("user_slug", None)
            res["invert_colors"] = bool(res.get("invert_colors", 0))
            return res

    def get_all_progress(self, user_slug: str) -> Dict[str, Any]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute("SELECT * FROM reading_progress WHERE user_slug = ?", (user_slug,)).fetchall()
            result = {}
            for r in rows:
                item = dict(r)
                b_id = item.pop("book_id")
                item.pop("user_slug", None)
                item["invert_colors"] = bool(item.get("invert_colors", 0))
                result[b_id] = item
            return result

    def set_progress_record(self, user_slug: str, book_id: str, record: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock, self.get_connection() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO reading_progress
                (user_slug, book_id, page, total_pages, percent, zoom, invert_colors, status, cfi, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_slug,
                    book_id,
                    int(record.get("page", 1)),
                    int(record.get("total_pages", 1)),
                    float(record.get("percent", 0.0)),
                    float(record.get("zoom", 1.2)),
                    1 if record.get("invert_colors") else 0,
                    str(record.get("status", "not_started")),
                    record.get("cfi"),
                    record.get("updated_at") or datetime.now().isoformat()
                )
            )
            return record

    def get_recent_progress(self, user_slug: str, limit: int = 8, include_completed: bool = False) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            query = "SELECT * FROM reading_progress WHERE user_slug = ? AND (page > 1 OR percent > 0.5 OR cfi IS NOT NULL)"
            params: List[Any] = [user_slug]
            if not include_completed:
                query += " AND percent < 100.0"
            query += " ORDER BY updated_at DESC LIMIT ?"
            params.append(limit)
            rows = conn.execute(query, tuple(params)).fetchall()
            results = []
            for r in rows:
                item = dict(r)
                item.pop("user_slug", None)
                item["invert_colors"] = bool(item.get("invert_colors", 0))
                results.append(item)
            return results

    # ----------------- Favorites -----------------
    def is_favorite(self, user_slug: str, book_id: str) -> bool:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT 1 FROM favorites WHERE user_slug = ? AND book_id = ?", (user_slug, book_id)).fetchone()
            return row is not None

    def get_favorite_ids(self, user_slug: str) -> List[str]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute("SELECT book_id FROM favorites WHERE user_slug = ? ORDER BY created_at DESC", (user_slug,)).fetchall()
            return [r["book_id"] for r in rows]

    def toggle_favorite(self, user_slug: str, book_id: str) -> bool:
        with self._lock, self.get_connection() as conn:
            if self.is_favorite(user_slug, book_id):
                conn.execute("DELETE FROM favorites WHERE user_slug = ? AND book_id = ?", (user_slug, book_id))
                return False
            else:
                conn.execute(
                    "INSERT INTO favorites (user_slug, book_id, created_at) VALUES (?, ?, ?)",
                    (user_slug, book_id, datetime.now().isoformat())
                )
                return True

    def set_favorite(self, user_slug: str, book_id: str, is_fav: bool) -> bool:
        with self._lock, self.get_connection() as conn:
            if is_fav:
                conn.execute(
                    "INSERT OR IGNORE INTO favorites (user_slug, book_id, created_at) VALUES (?, ?, ?)",
                    (user_slug, book_id, datetime.now().isoformat())
                )
                return True
            else:
                conn.execute("DELETE FROM favorites WHERE user_slug = ? AND book_id = ?", (user_slug, book_id))
                return False

    # ----------------- Tags -----------------
    def get_tags(self, user_slug: str, library_id: Optional[str] = None, book_ids_in_scope: Optional[set] = None) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            query = "SELECT * FROM tags WHERE user_slug = ?"
            params: List[Any] = [user_slug]
            if library_id is not None:
                query += " AND library_id = ?"
                params.append(library_id)
            query += " ORDER BY name COLLATE NOCASE ASC"
            rows = conn.execute(query, tuple(params)).fetchall()

            results = []
            for r in rows:
                tag = dict(r)
                tag.pop("user_slug", None)
                tid = tag["id"]
                if book_ids_in_scope is not None:
                    c_rows = conn.execute("SELECT book_id FROM book_tags WHERE user_slug = ? AND tag_id = ?", (user_slug, tid)).fetchall()
                    count = sum(1 for cr in c_rows if cr["book_id"] in book_ids_in_scope)
                else:
                    cur = conn.execute("SELECT count(*) FROM book_tags WHERE user_slug = ? AND tag_id = ?", (user_slug, tid))
                    count = cur.fetchone()[0]
                tag["book_count"] = count
                results.append(tag)
            return results

    def get_tag(self, user_slug: str, tag_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT * FROM tags WHERE user_slug = ? AND id = ?", (user_slug, tag_id)).fetchone()
            if not row:
                return None
            t = dict(row)
            t.pop("user_slug", None)
            return t

    def create_tag(self, user_slug: str, name: str, color: str = "amber", library_id: Optional[str] = None) -> Dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Tag name cannot be empty")
        lib_id = library_id.strip() if (library_id and library_id.strip()) else "default"

        with self._lock, self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM tags WHERE user_slug = ? AND library_id = ? AND lower(name) = lower(?)",
                (user_slug, lib_id, clean_name)
            ).fetchone()
            if row:
                t = dict(row)
                t.pop("user_slug", None)
                cur = conn.execute("SELECT count(*) FROM book_tags WHERE user_slug = ? AND tag_id = ?", (user_slug, t["id"]))
                t["book_count"] = cur.fetchone()[0]
                return t

            tag_id = f"tag_{uuid.uuid4().hex[:8]}"
            now = datetime.now().isoformat()
            conn.execute(
                "INSERT INTO tags (id, user_slug, name, color, library_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (tag_id, user_slug, clean_name, color, lib_id, now)
            )
            return {
                "id": tag_id,
                "name": clean_name,
                "color": color,
                "library_id": lib_id,
                "created_at": now,
                "book_count": 0
            }

    def update_tag(self, user_slug: str, tag_id: str, name: Optional[str] = None, color: Optional[str] = None) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT * FROM tags WHERE user_slug = ? AND id = ?", (user_slug, tag_id)).fetchone()
            if not row:
                return None
            new_name = name.strip() if (name and name.strip()) else row["name"]
            new_color = color if color else row["color"]
            conn.execute("UPDATE tags SET name = ?, color = ? WHERE user_slug = ? AND id = ?", (new_name, new_color, user_slug, tag_id))
            cur = conn.execute("SELECT count(*) FROM book_tags WHERE user_slug = ? AND tag_id = ?", (user_slug, tag_id))
            return {
                "id": tag_id,
                "name": new_name,
                "color": new_color,
                "library_id": row["library_id"],
                "created_at": row["created_at"],
                "book_count": cur.fetchone()[0]
            }

    def delete_tag(self, user_slug: str, tag_id: str) -> bool:
        with self._lock, self.get_connection() as conn:
            res = conn.execute("DELETE FROM tags WHERE user_slug = ? AND id = ?", (user_slug, tag_id))
            conn.execute("DELETE FROM book_tags WHERE user_slug = ? AND tag_id = ?", (user_slug, tag_id))
            return res.rowcount > 0

    def get_book_tags(self, user_slug: str, book_id: str) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute(
                """SELECT t.id, t.name, t.color, t.library_id, t.created_at
                FROM tags t
                JOIN book_tags bt ON t.id = bt.tag_id AND t.user_slug = bt.user_slug
                WHERE bt.user_slug = ? AND bt.book_id = ?
                ORDER BY t.name COLLATE NOCASE ASC""",
                (user_slug, book_id)
            ).fetchall()
            return [dict(r) for r in rows]

    def get_book_tag_ids(self, user_slug: str, book_id: str) -> List[str]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute("SELECT tag_id FROM book_tags WHERE user_slug = ? AND book_id = ?", (user_slug, book_id)).fetchall()
            return [r["tag_id"] for r in rows]

    def set_book_tags(self, user_slug: str, book_id: str, tag_ids: List[str]) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            conn.execute("DELETE FROM book_tags WHERE user_slug = ? AND book_id = ?", (user_slug, book_id))
            if tag_ids:
                placeholders = ",".join(["?"] * len(tag_ids))
                query = f"""
                    INSERT OR IGNORE INTO book_tags (user_slug, book_id, tag_id)
                    SELECT ?, ?, id FROM tags
                    WHERE user_slug = ? AND id IN ({placeholders})
                """
                params = [user_slug, book_id, user_slug] + tag_ids
                conn.execute(query, params)
            return self.get_book_tags(user_slug, book_id)

    def toggle_book_tag(self, user_slug: str, book_id: str, tag_id: str) -> bool:
        with self._lock, self.get_connection() as conn:
            tag_check = conn.execute("SELECT 1 FROM tags WHERE user_slug = ? AND id = ?", (user_slug, tag_id)).fetchone()
            if not tag_check:
                return False
            exists = conn.execute("SELECT 1 FROM book_tags WHERE user_slug = ? AND book_id = ? AND tag_id = ?", (user_slug, book_id, tag_id)).fetchone()
            if exists:
                conn.execute("DELETE FROM book_tags WHERE user_slug = ? AND book_id = ? AND tag_id = ?", (user_slug, book_id, tag_id))
                return False
            else:
                conn.execute("INSERT INTO book_tags (user_slug, book_id, tag_id) VALUES (?, ?, ?)", (user_slug, book_id, tag_id))
                return True

    def get_book_ids_for_tag(self, user_slug: str, tag_id: str) -> List[str]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute("SELECT book_id FROM book_tags WHERE user_slug = ? AND tag_id = ?", (user_slug, tag_id)).fetchall()
            return [r["book_id"] for r in rows]

    # ----------------- Annotations -----------------
    def get_annotations(self, user_slug: str, book_id: str) -> List[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM annotations WHERE user_slug = ? AND book_id = ? ORDER BY page ASC, created_at ASC",
                (user_slug, book_id)
            ).fetchall()
            results = []
            for r in rows:
                item = dict(r)
                item.pop("user_slug", None)
                item["rects"] = json.loads(item.get("rects") or "[]")
                results.append(item)
            return results

    def add_annotation(self, user_slug: str, book_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        ann_id = f"ann_{uuid.uuid4().hex[:12]}"
        now = datetime.now().isoformat()
        record = {
            "id": ann_id,
            "book_id": book_id,
            "page": int(data.get("page", 1)),
            "cfi": data.get("cfi"),
            "chapter": data.get("chapter"),
            "text": str(data.get("text", "")).strip(),
            "color": str(data.get("color", "yellow")),
            "comment": str(data.get("comment", "")).strip(),
            "rects": list(data.get("rects", [])),
            "created_at": now,
            "updated_at": now
        }
        with self._lock, self.get_connection() as conn:
            conn.execute(
                """INSERT INTO annotations (id, user_slug, book_id, page, cfi, chapter, text, color, comment, rects, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    ann_id,
                    user_slug,
                    book_id,
                    record["page"],
                    record["cfi"],
                    record["chapter"],
                    record["text"],
                    record["color"],
                    record["comment"],
                    json.dumps(record["rects"]),
                    now,
                    now
                )
            )
        return record

    def update_annotation(self, user_slug: str, book_id: str, annotation_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT * FROM annotations WHERE user_slug = ? AND book_id = ? AND id = ?", (user_slug, book_id, annotation_id)).fetchone()
            if not row:
                return None
            item = dict(row)
            item.pop("user_slug", None)
            item["rects"] = json.loads(item.get("rects") or "[]")

            if "comment" in data:
                item["comment"] = str(data["comment"]).strip()
            if "color" in data:
                item["color"] = str(data["color"])
            now = datetime.now().isoformat()
            item["updated_at"] = now

            conn.execute(
                "UPDATE annotations SET comment = ?, color = ?, updated_at = ? WHERE user_slug = ? AND id = ?",
                (item["comment"], item["color"], now, user_slug, annotation_id)
            )
            return item

    def delete_annotation(self, user_slug: str, book_id: str, annotation_id: str) -> bool:
        with self._lock, self.get_connection() as conn:
            res = conn.execute("DELETE FROM annotations WHERE user_slug = ? AND book_id = ? AND id = ?", (user_slug, book_id, annotation_id))
            return res.rowcount > 0

    # ----------------- Lookups -----------------
    def get_lookup(self, lookup_type: str, key: str) -> Optional[Dict[str, Any]]:
        with self._lock, self.get_connection() as conn:
            row = conn.execute("SELECT payload FROM lookups WHERE lookup_type = ? AND lookup_key = ?", (lookup_type, key)).fetchone()
            if row:
                return json.loads(row["payload"])
            return None

    def set_lookup(self, lookup_type: str, key: str, payload: Dict[str, Any]):
        with self._lock, self.get_connection() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO lookups (lookup_type, lookup_key, payload) VALUES (?, ?, ?)",
                (lookup_type, key, json.dumps(payload))
            )

_db_instances: Dict[str, Database] = {}
_db_lock = threading.Lock()

def get_db(db_path: Optional[str] = None) -> Database:
    """Returns singleton Database instance for a given path."""
    path = resolve_db_path(db_path)
    with _db_lock:
        if path not in _db_instances:
            _db_instances[path] = Database(path)
        return _db_instances[path]
