import os
import re
import threading
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from .database import get_db
from .progress import ProgressTracker
from .favorites import FavoritesManager
from .annotations import AnnotationsManager
from .tags import TagsManager

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".cache"))

class UserManager:
    """
    Manages multi-user isolation stored in SQLite library.db.
    Usernames are case-insensitive.
    Provides user-scoped instances of:
      - ProgressTracker (tracking / reading progress)
      - FavoritesManager (book favorites)
      - AnnotationsManager (highlights & comments)
      - TagsManager (virtual tags & book tags)
    """

    def __init__(self, cache_dir: str = CACHE_DIR, db_path: Optional[str] = None):
        self.cache_dir = cache_dir
        self.db_path = db_path or cache_dir
        self.db = get_db(self.db_path)
        self.users_dir = os.path.join(self.cache_dir, "users")
        os.makedirs(self.users_dir, exist_ok=True)
        self._lock = threading.RLock()

        self._trackers: Dict[str, ProgressTracker] = {}
        self._favorites: Dict[str, FavoritesManager] = {}
        self._annotations: Dict[str, AnnotationsManager] = {}
        self._tags: Dict[str, TagsManager] = {}

    @staticmethod
    def normalize_username(username: Optional[str]) -> Tuple[str, str]:
        """
        Normalizes a username case-insensitively.
        Returns:
            slug: Lowercase identifier (e.g. 'alex')
            display_name: The trimmed original username as typed
        """
        raw = (username or "").strip()
        if not raw:
            return "default", "Default"

        slug = re.sub(r'[\/\\:*?"<>|\x00-\x1f]', '_', raw).strip(' ._-').lower()
        if not slug:
            slug = "default"
        return slug, raw

    def get_tracker(self, username: Optional[str]) -> ProgressTracker:
        slug, display = self.normalize_username(username)
        with self._lock:
            if slug not in self._trackers:
                self.db.touch_user(slug, display)
                self._trackers[slug] = ProgressTracker(data_path=self.db_path, user_slug=slug, db=self.db)
            return self._trackers[slug]

    def get_favorites_mgr(self, username: Optional[str]) -> FavoritesManager:
        slug, display = self.normalize_username(username)
        with self._lock:
            if slug not in self._favorites:
                self.db.touch_user(slug, display)
                self._favorites[slug] = FavoritesManager(data_path=self.db_path, user_slug=slug, db=self.db)
            return self._favorites[slug]

    def get_annotations_mgr(self, username: Optional[str]) -> AnnotationsManager:
        slug, display = self.normalize_username(username)
        with self._lock:
            if slug not in self._annotations:
                self.db.touch_user(slug, display)
                self._annotations[slug] = AnnotationsManager(storage_path=self.db_path, user_slug=slug, db=self.db)
            return self._annotations[slug]

    def get_tags_mgr(self, username: Optional[str]) -> TagsManager:
        slug, display = self.normalize_username(username)
        with self._lock:
            if slug not in self._tags:
                self.db.touch_user(slug, display)
                self._tags[slug] = TagsManager(data_path=self.db_path, user_slug=slug, db=self.db)
            return self._tags[slug]

    def touch_user(self, username: Optional[str]) -> Dict[str, Any]:
        """Registers or activates a user and returns their profile."""
        slug, display = self.normalize_username(username)
        with self._lock:
            u = self.db.touch_user(slug, display)
            return {
                "username": u["display_name"],
                "slug": u["slug"],
                "created_at": u["created_at"],
                "last_active": u["last_active_at"]
            }

    def get_user_profile(self, username: Optional[str]) -> Dict[str, Any]:
        slug, display = self.normalize_username(username)
        with self._lock:
            u = self.db.get_user(slug)
            if u:
                return {
                    "username": u["display_name"],
                    "slug": u["slug"],
                    "created_at": u["created_at"],
                    "last_active": u["last_active_at"]
                }
            return {
                "username": display,
                "slug": slug,
                "created_at": datetime.now().isoformat(),
                "last_active": datetime.now().isoformat()
            }

    def list_users(self) -> List[Dict[str, Any]]:
        """Returns all configured user profiles, sorted by last_active descending."""
        with self._lock:
            rows = self.db.get_users()
            return [
                {
                    "username": r["display_name"],
                    "slug": r["slug"],
                    "created_at": r["created_at"],
                    "last_active": r["last_active_at"]
                }
                for r in rows
            ]

    def delete_user(self, username: Optional[str]) -> bool:
        """Deletes a user and all their scoped data from SQLite."""
        slug, _ = self.normalize_username(username)
        if not slug or slug in (".", "..", "users"):
            return False

        with self._lock:
            self._trackers.pop(slug, None)
            self._favorites.pop(slug, None)
            self._annotations.pop(slug, None)
            self._tags.pop(slug, None)
            return self.db.delete_user(slug)
