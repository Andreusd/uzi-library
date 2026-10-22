import os
import threading
from datetime import datetime
from typing import Dict, Any, Optional, List
from .database import get_db, Database

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache"))
DATA_PATH = os.path.join(CACHE_DIR, "library.db")

class ProgressTracker:
    def __init__(self, data_path: str = DATA_PATH, user_slug: str = "default", db: Optional[Database] = None):
        self.data_path = data_path
        self.user_slug = user_slug
        self.db = db or get_db(data_path)
        self._lock = threading.RLock()

    def get_progress(self, book_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.db.get_progress(self.user_slug, book_id)

    def set_progress(
        self,
        book_id: str,
        page: int,
        total_pages: int,
        zoom: Optional[float] = None,
        invert_colors: Optional[bool] = None,
        cfi: Optional[str] = None,
        percent: Optional[float] = None
    ) -> Dict[str, Any]:
        with self._lock:
            existing = self.db.get_progress(self.user_slug, book_id) or {}
            current_zoom = round(zoom, 2) if zoom is not None else existing.get("zoom", 1.2)
            current_invert = bool(invert_colors) if invert_colors is not None else existing.get("invert_colors", False)
            current_cfi = cfi if cfi is not None else existing.get("cfi")

            # Determine percentage
            if percent is not None and percent > 0:
                pct = round(max(0.0, min(100.0, float(percent))), 1)
            elif percent == 0.0 and (not current_cfi or current_cfi.strip() == ""):
                pct = 0.0
            elif current_cfi and existing.get("percent", 0) > 0 and (percent is None or percent == 0.0):
                pct = existing.get("percent", 0.0)
            elif total_pages > 0 and page > 0:
                pct = round((page / max(total_pages, 1)) * 100, 1)
            elif percent is not None:
                pct = round(max(0.0, min(100.0, float(percent))), 1)
            else:
                pct = round((page / max(total_pages, 1)) * 100, 1)

            is_in_progress = (page > 1) or (pct > 0.5) or (current_cfi is not None and len(current_cfi) > 0)
            if not is_in_progress:
                record = {
                    "page": 1,
                    "total_pages": total_pages,
                    "percent": 0.0,
                    "zoom": current_zoom,
                    "invert_colors": current_invert,
                    "status": "not_started"
                }
                if current_cfi:
                    record["cfi"] = current_cfi
                return self.db.set_progress_record(self.user_slug, book_id, record)

            record = {
                "page": max(1, page),
                "total_pages": max(1, total_pages),
                "percent": pct,
                "zoom": current_zoom,
                "invert_colors": current_invert,
                "status": "in_progress",
                "updated_at": datetime.now().isoformat()
            }
            if current_cfi:
                record["cfi"] = current_cfi

            return self.db.set_progress_record(self.user_slug, book_id, record)

    def set_zoom(self, book_id: str, zoom: float) -> Dict[str, Any]:
        """Saves preferred zoom for a book, preserving reading progress and night mode."""
        with self._lock:
            existing = self.db.get_progress(self.user_slug, book_id) or {
                "page": 1,
                "total_pages": 1,
                "percent": 0.0,
                "status": "not_started"
            }
            existing["zoom"] = round(zoom, 2)
            return self.db.set_progress_record(self.user_slug, book_id, existing)

    def set_night_mode(self, book_id: str, invert_colors: bool) -> Dict[str, Any]:
        """Saves preferred night reading mode (invert colors) for a book, preserving reading progress and zoom."""
        with self._lock:
            existing = self.db.get_progress(self.user_slug, book_id) or {
                "page": 1,
                "total_pages": 1,
                "percent": 0.0,
                "status": "not_started"
            }
            existing["invert_colors"] = bool(invert_colors)
            return self.db.set_progress_record(self.user_slug, book_id, existing)

    def reset_progress(self, book_id: str) -> Dict[str, Any]:
        """Resets progress to page 1 but preserves preferred zoom, night mode, and total_pages."""
        with self._lock:
            existing = self.db.get_progress(self.user_slug, book_id) or {}
            zoom = existing.get("zoom", 1.2)
            invert = existing.get("invert_colors", False)
            total_pages = existing.get("total_pages", 1)
            record = {
                "page": 1,
                "total_pages": total_pages,
                "percent": 0.0,
                "zoom": zoom,
                "invert_colors": invert,
                "status": "not_started"
            }
            return self.db.set_progress_record(self.user_slug, book_id, record)

    def mark_completed(self, book_id: str, total_pages: int = 1) -> Dict[str, Any]:
        """Marks a book as 100% completed, preserving zoom and night mode."""
        with self._lock:
            existing = self.db.get_progress(self.user_slug, book_id) or {}
            zoom = existing.get("zoom", 1.2)
            invert = existing.get("invert_colors", False)
            record = {
                "page": total_pages,
                "total_pages": total_pages,
                "percent": 100.0,
                "zoom": zoom,
                "invert_colors": invert,
                "status": "completed",
                "updated_at": datetime.now().isoformat()
            }
            return self.db.set_progress_record(self.user_slug, book_id, record)

    def get_all(self) -> Dict[str, Any]:
        with self._lock:
            return self.db.get_all_progress(self.user_slug)

    def get_recent(self, limit: int = 8, include_completed: bool = False) -> List[Dict[str, Any]]:
        """Returns list of books sorted by most recently read."""
        with self._lock:
            return self.db.get_recent_progress(self.user_slug, limit=limit, include_completed=include_completed)

    def get_completed(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns list of read/completed books sorted by most recently updated."""
        with self._lock:
            return self.db.get_completed_progress(self.user_slug, limit=limit)
