import os
import sys
import tempfile
import shutil
import unittest

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.scanner import clean_title, format_size, format_shelf_name, compute_book_id, LibraryScanner
from server.config import ConfigManager
from server.users import UserManager
from server.progress import ProgressTracker
from server.favorites import FavoritesManager
from server.tags import TagsManager
from server.annotations import AnnotationsManager

class TestScannerUtils(unittest.TestCase):
    def test_clean_title(self):
        self.assertEqual(clean_title("The_Art_of_Computer_Programming.pdf"), "The Art of Computer Programming")
        self.assertEqual(clean_title("Clean__Code___A_Handbook.epub"), "Clean Code A Handbook")
        self.assertEqual(clean_title("SimpleBook.pdf"), "SimpleBook")

    def test_format_size(self):
        self.assertEqual(format_size(500), "500 B")
        self.assertEqual(format_size(1024), "1.0 KB")
        self.assertEqual(format_size(1024 * 1024 * 5), "5.0 MB")
        self.assertEqual(format_size(1024 * 1024 * 1024 * 2), "2.0 GB")

    def test_format_shelf_name(self):
        self.assertEqual(format_shelf_name("_general"), "General")
        self.assertEqual(format_shelf_name("Computer-Science"), "Computer Science")
        self.assertEqual(format_shelf_name("Science Fiction"), "Science Fiction")

    def test_compute_book_id(self):
        id1 = compute_book_id("Science", "physics.pdf", "default")
        id2 = compute_book_id("Science", "physics.pdf", "default")
        self.assertEqual(id1, id2)
        self.assertEqual(len(id1), 16)

        # Scoped library id changes hash
        id3 = compute_book_id("Science", "physics.pdf", "lib_abc123")
        self.assertNotEqual(id1, id3)


class TestConfigManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, "config.json")
        self.mgr = ConfigManager(config_path=self.config_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_add_and_get_libraries(self):
        books_dir = os.path.join(self.temp_dir, "MyBooks")
        os.makedirs(books_dir, exist_ok=True)

        lib = self.mgr.add_library("Test Library", books_dir, set_active=True)
        self.assertEqual(lib["name"], "Test Library")
        self.assertEqual(os.path.normpath(lib["path"]), os.path.normpath(books_dir))

        libs = self.mgr.get_libraries()
        self.assertTrue(any(l["id"] == lib["id"] for l in libs))
        self.assertEqual(self.mgr.get_active_library_id(), lib["id"])

    def test_validate_path(self):
        # Empty path
        res = ConfigManager.validate_path("")
        self.assertFalse(res["valid"])
        self.assertEqual(res["error"], "path_empty")

        # Nonexistent path
        res = ConfigManager.validate_path(os.path.join(self.temp_dir, "nonexistent"))
        self.assertFalse(res["valid"])
        self.assertEqual(res["error"], "path_not_found")

        # Valid empty directory
        empty_dir = os.path.join(self.temp_dir, "empty")
        os.makedirs(empty_dir, exist_ok=True)
        res = ConfigManager.validate_path(empty_dir)
        self.assertTrue(res["valid"])
        self.assertEqual(res["book_count"], 0)


class TestUserManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.mgr = UserManager(cache_dir=self.temp_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_normalize_username(self):
        slug, display = UserManager.normalize_username("  Alex Dev  ")
        self.assertEqual(slug, "alex dev")
        self.assertEqual(display, "Alex Dev")

        slug_empty, display_empty = UserManager.normalize_username("")
        self.assertEqual(slug_empty, "default")
        self.assertEqual(display_empty, "Default")

    def test_touch_and_list_users(self):
        self.mgr.touch_user("Alice")
        self.mgr.touch_user("Bob")

        users = self.mgr.list_users()
        usernames = [u["username"] for u in users]
        self.assertIn("Alice", usernames)
        self.assertIn("Bob", usernames)

    def test_delete_user(self):
        self.mgr.touch_user("Charlie")
        deleted = self.mgr.delete_user("Charlie")
        self.assertTrue(deleted)
        users = self.mgr.list_users()
        self.assertNotIn("Charlie", [u["username"] for u in users])

    def test_get_user_profile(self):
        # Test getting an existing user
        self.mgr.touch_user("Diana")
        profile = self.mgr.get_user_profile("Diana")
        self.assertEqual(profile["username"], "Diana")
        self.assertEqual(profile["slug"], "diana")
        self.assertIn("created_at", profile)
        self.assertIn("last_active", profile)

        # Test getting a non-existent user (should return a default-like profile)
        profile2 = self.mgr.get_user_profile("Eve")
        self.assertEqual(profile2["username"], "Eve")
        self.assertEqual(profile2["slug"], "eve")
        self.assertIn("created_at", profile2)
        self.assertIn("last_active", profile2)

        # Test edge case with empty username
        profile3 = self.mgr.get_user_profile("")
        self.assertEqual(profile3["username"], "Default")
        self.assertEqual(profile3["slug"], "default")


class TestProgressTracker(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.data_path = os.path.join(self.temp_dir, "progress.json")
        self.tracker = ProgressTracker(data_path=self.data_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_set_and_get_progress(self):
        rec = self.tracker.set_progress("book_123", page=10, total_pages=50)
        self.assertEqual(rec["page"], 10)
        self.assertEqual(rec["total_pages"], 50)
        self.assertEqual(rec["percent"], 20.0)

        saved = self.tracker.get_progress("book_123")
        self.assertIsNotNone(saved)
        self.assertEqual(saved["page"], 10)

    def test_reset_and_mark_completed(self):
        self.tracker.set_progress("book_abc", page=25, total_pages=100)
        completed = self.tracker.mark_completed("book_abc", total_pages=100)
        self.assertEqual(completed["percent"], 100.0)
        self.assertEqual(completed["status"], "completed")

        reset = self.tracker.reset_progress("book_abc")
        self.assertEqual(reset["page"], 1)
        self.assertEqual(reset["percent"], 0.0)
        self.assertEqual(reset["status"], "not_started")


class TestFavoritesAndTags(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.fav_path = os.path.join(self.temp_dir, "fav.json")
        self.tags_path = os.path.join(self.temp_dir, "tags.json")
        self.fav_mgr = FavoritesManager(data_path=self.fav_path)
        self.tags_mgr = TagsManager(data_path=self.tags_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_favorites_toggle(self):
        self.assertFalse(self.fav_mgr.is_favorite("b1"))
        toggled_on = self.fav_mgr.toggle_favorite("b1")
        self.assertTrue(toggled_on)
        self.assertTrue(self.fav_mgr.is_favorite("b1"))

        toggled_off = self.fav_mgr.toggle_favorite("b1")
        self.assertFalse(toggled_off)
        self.assertFalse(self.fav_mgr.is_favorite("b1"))

    def test_tags_lifecycle(self):
        tag = self.tags_mgr.create_tag("Fiction", color="rose", library_id="lib_1")
        self.assertEqual(tag["name"], "Fiction")
        self.assertEqual(tag["color"], "rose")

        # Assign tag to book
        assigned = self.tags_mgr.toggle_book_tag("book_1", tag["id"])
        self.assertTrue(assigned)
        book_tags = self.tags_mgr.get_book_tags("book_1")
        self.assertEqual(len(book_tags), 1)
        self.assertEqual(book_tags[0]["name"], "Fiction")

        # Delete tag
        self.tags_mgr.delete_tag(tag["id"])
        self.assertEqual(len(self.tags_mgr.get_book_tags("book_1")), 0)


class TestAnnotationsManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.ann_path = os.path.join(self.temp_dir, "ann.json")
        self.mgr = AnnotationsManager(storage_path=self.ann_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_annotations_crud(self):
        ann = self.mgr.add_annotation("book_1", {
            "page": 5,
            "text": "Highlighted sentence",
            "comment": "Key note",
            "color": "yellow"
        })
        self.assertTrue(ann["id"].startswith("ann_"))
        self.assertEqual(ann["text"], "Highlighted sentence")

        # Update
        updated = self.mgr.update_annotation("book_1", ann["id"], {"comment": "Revised note"})
        self.assertEqual(updated["comment"], "Revised note")

        # List
        items = self.mgr.get_annotations("book_1")
        self.assertEqual(len(items), 1)

        # Delete
        deleted = self.mgr.delete_annotation("book_1", ann["id"])
        self.assertTrue(deleted)
        self.assertEqual(len(self.mgr.get_annotations("book_1")), 0)


class TestDeps(unittest.TestCase):
    def test_singleton_providers(self):
        from server.deps import get_scanner, get_cover_mgr, get_lookup_mgr, get_user_mgr
        s1 = get_scanner()
        s2 = get_scanner()
        self.assertIs(s1, s2)
        self.assertIsNotNone(s1)

        c1 = get_cover_mgr()
        c2 = get_cover_mgr()
        self.assertIs(c1, c2)

        l1 = get_lookup_mgr()
        l2 = get_lookup_mgr()
        self.assertIs(l1, l2)

        u1 = get_user_mgr()
        u2 = get_user_mgr()
        self.assertIs(u1, u2)

    def test_get_request_user(self):
        from server.deps import get_request_user
        from unittest.mock import MagicMock

        # Header with x-user
        req_header = MagicMock()
        req_header.headers = {"x-user": "alice"}
        req_header.query_params = {}
        self.assertEqual(get_request_user(req_header), "alice")

        # Header with X-User
        req_cap_header = MagicMock()
        req_cap_header.headers = {"X-User": "bob"}
        req_cap_header.query_params = {}
        self.assertEqual(get_request_user(req_cap_header), "bob")

        # Query param fallback
        req_query = MagicMock()
        req_query.headers = {}
        req_query.query_params = {"user": "charlie"}
        self.assertEqual(get_request_user(req_query), "charlie")

        # Empty / default fallback
        req_empty = MagicMock()
        req_empty.headers = {}
        req_empty.query_params = {}
        self.assertEqual(get_request_user(req_empty), "default")

    def test_overrides(self):
        from server.deps import get_scanner, set_scanner_override
        original = get_scanner()
        mock_scanner = object()
        set_scanner_override(mock_scanner)
        self.assertIs(get_scanner(), mock_scanner)
        set_scanner_override(original)
        self.assertIs(get_scanner(), original)


if __name__ == "__main__":
    unittest.main()
