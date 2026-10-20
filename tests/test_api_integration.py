import os
import sys
import tempfile
import shutil
import unittest
from fastapi.testclient import TestClient

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.main import app
from server.scanner import LibraryScanner
from server.config import ConfigManager
from server.users import UserManager
from server.covers import CoverManager
from server.lookup import LookupManager
from server.deps import (
    set_scanner_override,
    set_user_mgr_override,
    set_cover_mgr_override,
    set_lookup_mgr_override,
    reset_overrides,
)

class BaseAPITestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.cache_dir = os.path.join(self.temp_dir, ".cache")
        os.makedirs(self.cache_dir, exist_ok=True)

        # Create mock library directories and files
        self.books_dir = os.path.join(self.temp_dir, "MyLibrary")
        self.scifi_dir = os.path.join(self.books_dir, "Sci-Fi")
        self.history_dir = os.path.join(self.books_dir, "History")
        os.makedirs(self.scifi_dir, exist_ok=True)
        os.makedirs(self.history_dir, exist_ok=True)

        # Create dummy book files
        self.dune_path = os.path.join(self.scifi_dir, "Dune_Chronicles.pdf")
        with open(self.dune_path, "wb") as f:
            f.write(b"%PDF-1.4 mock content for dune")

        self.foundation_path = os.path.join(self.scifi_dir, "Foundation_Series.epub")
        with open(self.foundation_path, "wb") as f:
            f.write(b"PK\x03\x04 mock epub content for foundation")

        self.rome_path = os.path.join(self.history_dir, "Ancient_Rome.pdf")
        with open(self.rome_path, "wb") as f:
            f.write(b"%PDF-1.4 mock content for rome")

        # Initialize isolated managers
        self.config_path = os.path.join(self.cache_dir, "config.json")
        self.config_mgr = ConfigManager(config_path=self.config_path)
        self.lib = self.config_mgr.add_library("Main Test Library", self.books_dir, set_active=True)
        self.library_id = self.lib["id"]

        self.scanner = LibraryScanner(
            config_mgr=self.config_mgr,
            aliases_path=os.path.join(self.cache_dir, "shelf_aliases.json"),
            icons_path=os.path.join(self.cache_dir, "shelf_icons.json"),
            metadata_cache_path=os.path.join(self.cache_dir, "metadata_cache.json")
        )
        self.cover_mgr = CoverManager(cache_dir=os.path.join(self.cache_dir, "covers"))
        self.user_mgr = UserManager(cache_dir=self.cache_dir)
        self.lookup_mgr = LookupManager(cache_file=os.path.join(self.cache_dir, "lookups.json"))

        # Apply overrides
        set_scanner_override(self.scanner)
        set_user_mgr_override(self.user_mgr)
        set_cover_mgr_override(self.cover_mgr)
        set_lookup_mgr_override(self.lookup_mgr)

        self.client = TestClient(app)

    def tearDown(self):
        reset_overrides()
        shutil.rmtree(self.temp_dir, ignore_errors=True)


class TestLibrariesAPI(BaseAPITestCase):
    def test_list_libraries(self):
        resp = self.client.get("/api/libraries")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("libraries", data)
        self.assertEqual(len(data["libraries"]), 1)
        lib = data["libraries"][0]
        self.assertEqual(lib["name"], "Main Test Library")
        self.assertTrue(lib["valid"])
        self.assertEqual(lib["book_count"], 3)
        self.assertEqual(lib["folder_count"], 2)

    def test_add_library_success_and_validation(self):
        # Create second valid directory
        new_dir = os.path.join(self.temp_dir, "SecondLibrary")
        os.makedirs(new_dir, exist_ok=True)
        with open(os.path.join(new_dir, "Book2.pdf"), "wb") as f:
            f.write(b"%PDF-1.4 mock")

        resp = self.client.post("/api/libraries", json={"name": "Second Lib", "path": new_dir, "set_active": True})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(len(data["libraries"]), 2)
        self.assertEqual(data["active_library_id"], data["library"]["id"])

        # Invalid path should return 400
        bad_resp = self.client.post("/api/libraries", json={"name": "Bad", "path": os.path.join(self.temp_dir, "nonexistent")})
        self.assertEqual(bad_resp.status_code, 400)

    def test_update_library(self):
        resp = self.client.put(f"/api/libraries/{self.library_id}", json={"name": "Renamed Library"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["library"]["name"], "Renamed Library")

        # 404 for nonexistent library
        bad_resp = self.client.put("/api/libraries/lib_unknown", json={"name": "No"})
        self.assertEqual(bad_resp.status_code, 404)

    def test_set_active_and_delete_library(self):
        # Adding a second library first
        new_dir = os.path.join(self.temp_dir, "Lib2")
        os.makedirs(new_dir, exist_ok=True)
        add_res = self.client.post("/api/libraries", json={"name": "Lib 2", "path": new_dir}).json()
        lib2_id = add_res["library"]["id"]

        # Switch active
        act_resp = self.client.post("/api/libraries/active", json={"library_id": lib2_id})
        self.assertEqual(act_resp.status_code, 200)
        self.assertEqual(act_resp.json()["active_library_id"], lib2_id)

        # Delete original library
        del_resp = self.client.delete(f"/api/libraries/{self.library_id}")
        self.assertEqual(del_resp.status_code, 200)
        remaining = del_resp.json()["libraries"]
        self.assertEqual(len(remaining), 1)
        self.assertEqual(remaining[0]["id"], lib2_id)

        # Deleting the only remaining library returns 400
        del_last_resp = self.client.delete(f"/api/libraries/{lib2_id}")
        self.assertEqual(del_last_resp.status_code, 400)

    def test_rescan_library(self):
        resp = self.client.post("/api/libraries/rescan")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["books_count"], 3)
        self.assertEqual(data["folders_count"], 2)


class TestSettingsAPI(BaseAPITestCase):
    def test_get_settings(self):
        resp = self.client.get("/api/settings")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(os.path.normpath(data["library_path"]), os.path.normpath(self.books_dir))
        self.assertTrue(data["validation"]["valid"])

    def test_display_settings(self):
        resp = self.client.post("/api/settings/display", json={"show_file_extension": True})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["show_file_extension"])

        resp2 = self.client.post("/api/settings/display", json={"show_file_extension": False})
        self.assertEqual(resp2.status_code, 200)
        self.assertFalse(resp2.json()["show_file_extension"])

    def test_validate_settings_path(self):
        resp = self.client.post("/api/settings/validate", json={"path": self.books_dir})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["valid"])

        resp_bad = self.client.post("/api/settings/validate", json={"path": "/nonexistent/path/xyz"})
        self.assertEqual(resp_bad.status_code, 200)
        self.assertFalse(resp_bad.json()["valid"])


class TestFoldersAPI(BaseAPITestCase):
    def test_list_folders_and_shelves(self):
        resp = self.client.get("/api/folders")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_folders"], 2)
        self.assertEqual(data["total_books"], 3)
        folder_names = [f["name"] for f in data["folders"]]
        folder_ids = [f["id"] for f in data["folders"]]
        self.assertIn("Sci Fi", folder_names)
        self.assertIn("Sci-Fi", folder_ids)
        self.assertIn("History", folder_names)

        # /api/shelves alias
        resp_shelves = self.client.get("/api/shelves")
        self.assertEqual(resp_shelves.status_code, 200)
        self.assertEqual(resp_shelves.json()["total_shelves"], 2)

    def test_rename_and_icon_folder(self):
        resp = self.client.post("/api/folders/rename", json={
            "folder_id": "Sci-Fi",
            "custom_name": "Science Fiction Classics",
            "library_id": self.library_id
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["name"], "Science Fiction Classics")

        # Set custom icon
        resp_icon = self.client.post("/api/folders/icon", json={
            "folder_id": "Sci-Fi",
            "icon": "rocket",
            "library_id": self.library_id
        })
        self.assertEqual(resp_icon.status_code, 200)
        self.assertEqual(resp_icon.json()["icon"], "rocket")


class TestBooksAPI(BaseAPITestCase):
    def test_list_books(self):
        resp = self.client.get("/api/books")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 3)
        titles = [b["title"] for b in data["books"]]
        self.assertIn("Dune Chronicles", titles)
        self.assertIn("Foundation Series", titles)
        self.assertIn("Ancient Rome", titles)

        # Enriched fields check
        book = data["books"][0]
        self.assertIn("progress", book)
        self.assertIn("cover_url", book)
        self.assertIn("is_favorite", book)
        self.assertIn("tags", book)

    def test_list_books_folder_filter(self):
        resp = self.client.get("/api/books?folder=Sci-Fi")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 2)
        for b in data["books"]:
            self.assertEqual(b["folder"], "Sci-Fi")

    def test_list_books_search_query(self):
        resp = self.client.get("/api/books?query=dune")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["books"][0]["title"], "Dune Chronicles")

    def test_list_books_sorting(self):
        # Sort title_desc
        resp = self.client.get("/api/books?sort=title_desc")
        self.assertEqual(resp.status_code, 200)
        titles = [b["title"] for b in resp.json()["books"]]
        self.assertEqual(titles, sorted(titles, reverse=True))

        # Sort title_asc
        resp_asc = self.client.get("/api/books?sort=title_asc")
        self.assertEqual(resp_asc.status_code, 200)
        titles_asc = [b["title"] for b in resp_asc.json()["books"]]
        self.assertEqual(titles_asc, sorted(titles_asc))

    def test_list_books_format_filtering(self):
        # All books
        resp_all = self.client.get("/api/books")
        self.assertEqual(resp_all.status_code, 200)
        self.assertEqual(resp_all.json()["count"], 3)

        # PDF only
        resp_pdf = self.client.get("/api/books?format=pdf")
        self.assertEqual(resp_pdf.status_code, 200)
        pdf_books = resp_pdf.json()["books"]
        self.assertEqual(len(pdf_books), 2)
        for b in pdf_books:
            self.assertEqual(b["format"], "pdf")

        # EPUB only
        resp_epub = self.client.get("/api/books?format=epub")
        self.assertEqual(resp_epub.status_code, 200)
        epub_books = resp_epub.json()["books"]
        self.assertEqual(len(epub_books), 1)
        self.assertEqual(epub_books[0]["format"], "epub")
        self.assertEqual(epub_books[0]["title"], "Foundation Series")

    def test_get_single_book_and_stream(self):
        books = self.client.get("/api/books").json()["books"]
        dune = next(b for b in books if "Dune" in b["title"])

        resp = self.client.get(f"/api/book/{dune['id']}")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], dune["id"])
        self.assertEqual(data["format"], "pdf")

        # Stream book file
        file_resp = self.client.get(f"/api/book-file/{dune['id']}")
        self.assertEqual(file_resp.status_code, 200)
        self.assertEqual(file_resp.headers["content-type"], "application/pdf")
        self.assertTrue(len(file_resp.content) > 0)

        # Nonexistent book returns 404
        not_found = self.client.get("/api/book/nonexistent_123")
        self.assertEqual(not_found.status_code, 404)


class TestProgressAndFavoritesAPI(BaseAPITestCase):
    def test_progress_lifecycle(self):
        books = self.client.get("/api/books").json()["books"]
        book_id = books[0]["id"]

        # Save progress
        save_resp = self.client.post("/api/progress", json={
            "book_id": book_id,
            "page": 15,
            "total_pages": 150,
            "zoom": 1.25,
            "invert_colors": True
        })
        self.assertEqual(save_resp.status_code, 200)
        prog = save_resp.json()["progress"]
        self.assertEqual(prog["page"], 15)
        self.assertEqual(prog["percent"], 10.0)

        # Check continue-reading
        cont_resp = self.client.get("/api/continue-reading")
        self.assertEqual(cont_resp.status_code, 200)
        cont_books = cont_resp.json()["books"]
        self.assertTrue(any(b["id"] == book_id for b in cont_books))

        # Update zoom and night-mode endpoints
        z_resp = self.client.post("/api/book/zoom", json={"book_id": book_id, "zoom": 1.5})
        self.assertEqual(z_resp.status_code, 200)
        self.assertEqual(z_resp.json()["record"]["zoom"], 1.5)

        nm_resp = self.client.post("/api/book/night-mode", json={"book_id": book_id, "invert_colors": False})
        self.assertEqual(nm_resp.status_code, 200)
        self.assertFalse(nm_resp.json()["record"]["invert_colors"])

        # Mark completed then reset to not_started
        stat_resp = self.client.post("/api/book/status", json={"book_id": book_id, "status": "completed"})
        self.assertEqual(stat_resp.status_code, 200)
        self.assertEqual(stat_resp.json()["progress"]["status"], "completed")

        reset_resp = self.client.post("/api/book/status", json={"book_id": book_id, "status": "not_started"})
        self.assertEqual(reset_resp.status_code, 200)
        self.assertEqual(reset_resp.json()["progress"]["status"], "not_started")

    def test_favorites_lifecycle(self):
        books = self.client.get("/api/books").json()["books"]
        book_id = books[0]["id"]

        # Toggle on
        t1 = self.client.post("/api/favorites/toggle", json={"book_id": book_id})
        self.assertEqual(t1.status_code, 200)
        self.assertTrue(t1.json()["is_favorite"])

        # Check list favorites
        fav_list = self.client.get("/api/favorites").json()
        self.assertEqual(fav_list["count"], 1)
        self.assertEqual(fav_list["books"][0]["id"], book_id)

        # Toggle off
        t2 = self.client.post("/api/favorites/toggle", json={"book_id": book_id})
        self.assertEqual(t2.status_code, 200)
        self.assertFalse(t2.json()["is_favorite"])
        self.assertEqual(self.client.get("/api/favorites").json()["count"], 0)


class TestTagsAPI(BaseAPITestCase):
    def test_tags_lifecycle_and_filtering(self):
        books = self.client.get("/api/books").json()["books"]
        book_id = books[0]["id"]

        # Create tag
        create_resp = self.client.post("/api/tags", json={
            "name": "Classics",
            "color": "rose",
            "library_id": self.library_id
        })
        self.assertEqual(create_resp.status_code, 200)
        tag = create_resp.json()["tag"]
        tag_id = tag["id"]
        self.assertEqual(tag["name"], "Classics")

        # Assign tag to book
        assign_resp = self.client.post(f"/api/books/{book_id}/tags/toggle", json={"tag_id": tag_id})
        self.assertEqual(assign_resp.status_code, 200)
        self.assertTrue(assign_resp.json()["is_assigned"])

        # Verify book has tag
        b_tags = self.client.get(f"/api/books/{book_id}/tags").json()["tags"]
        self.assertEqual(len(b_tags), 1)
        self.assertEqual(b_tags[0]["name"], "Classics")

        # Filter books by tag
        filtered = self.client.get(f"/api/books?tag={tag_id}").json()
        self.assertEqual(filtered["count"], 1)
        self.assertEqual(filtered["books"][0]["id"], book_id)

        # Update tag
        up_resp = self.client.put(f"/api/tags/{tag_id}", json={"name": "Masterpieces"})
        self.assertEqual(up_resp.status_code, 200)
        self.assertEqual(up_resp.json()["tag"]["name"], "Masterpieces")

        # Delete tag
        del_resp = self.client.delete(f"/api/tags/{tag_id}")
        self.assertEqual(del_resp.status_code, 200)
        empty_tags = self.client.get(f"/api/books/{book_id}/tags").json()["tags"]
        self.assertEqual(len(empty_tags), 0)


class TestAnnotationsAPI(BaseAPITestCase):
    def test_annotations_crud(self):
        books = self.client.get("/api/books").json()["books"]
        book_id = books[0]["id"]

        # Create annotation
        add_resp = self.client.post("/api/annotations", json={
            "book_id": book_id,
            "page": 3,
            "text": "The spice must flow.",
            "comment": "Iconic quote",
            "color": "yellow"
        })
        self.assertEqual(add_resp.status_code, 200)
        ann = add_resp.json()["annotation"]
        ann_id = ann["id"]
        self.assertEqual(ann["text"], "The spice must flow.")

        # Get annotations
        list_resp = self.client.get(f"/api/annotations/{book_id}")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(list_resp.json()["annotations"]), 1)

        # Update annotation
        update_resp = self.client.put(f"/api/annotations/{book_id}/{ann_id}", json={
            "comment": "Revised note on Arrakis"
        })
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["annotation"]["comment"], "Revised note on Arrakis")

        # Delete annotation
        del_resp = self.client.delete(f"/api/annotations/{book_id}/{ann_id}")
        self.assertEqual(del_resp.status_code, 200)
        self.assertEqual(len(self.client.get(f"/api/annotations/{book_id}").json()["annotations"]), 0)


class TestUsersAndIsolationAPI(BaseAPITestCase):
    def test_users_crud(self):
        # Register user
        reg_resp = self.client.post("/api/users", json={"username": "Alice"})
        self.assertEqual(reg_resp.status_code, 200)
        users = [u["username"] for u in reg_resp.json()["users"]]
        self.assertIn("Alice", users)

        # Current user via X-User header
        cur_resp = self.client.get("/api/users/current", headers={"X-User": "Alice"})
        self.assertEqual(cur_resp.status_code, 200)
        self.assertEqual(cur_resp.json()["user"]["username"], "Alice")

        # Delete user
        del_resp = self.client.delete("/api/users/Alice")
        self.assertEqual(del_resp.status_code, 200)
        self.assertEqual(del_resp.json()["status"], "ok")

    def test_user_scoping_isolation(self):
        """Verify that Alice and Bob have strictly isolated reading progress, favorites, and annotations."""
        books = self.client.get("/api/books").json()["books"]
        book_id = books[0]["id"]

        # Alice favorites the book and adds progress
        self.client.post("/api/favorites/toggle", json={"book_id": book_id}, headers={"X-User": "Alice"})
        self.client.post("/api/progress", json={"book_id": book_id, "page": 42, "total_pages": 100}, headers={"X-User": "Alice"})
        self.client.post("/api/annotations", json={"book_id": book_id, "page": 1, "text": "Alice note"}, headers={"X-User": "Alice"})

        # Bob checks his favorites, progress, annotations -> should be empty / default
        bob_favs = self.client.get("/api/favorites", headers={"X-User": "Bob"}).json()
        self.assertEqual(bob_favs["count"], 0)

        bob_book = self.client.get(f"/api/book/{book_id}", headers={"X-User": "Bob"}).json()
        self.assertFalse(bob_book["is_favorite"])
        self.assertEqual(bob_book["progress"]["page"], 1)
        self.assertEqual(len(bob_book["annotations"]), 0)

        # Alice checks hers -> populated
        alice_favs = self.client.get("/api/favorites", headers={"X-User": "Alice"}).json()
        self.assertEqual(alice_favs["count"], 1)

        alice_book = self.client.get(f"/api/book/{book_id}", headers={"X-User": "Alice"}).json()
        self.assertTrue(alice_book["is_favorite"])
        self.assertEqual(alice_book["progress"]["page"], 42)
        self.assertEqual(len(alice_book["annotations"]), 1)


class TestLookupAPI(BaseAPITestCase):
    def test_define_word(self):
        resp = self.client.get("/api/lookup/define?word=novel")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["word"], "novel")

        # Empty word returns 400
        bad_resp = self.client.get("/api/lookup/define?word=  ")
        self.assertEqual(bad_resp.status_code, 400)

    def test_translate_text(self):
        resp = self.client.post("/api/lookup/translate", json={"text": "hello", "target_lang": "pt"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["original_text"], "hello")

        # GET convenience endpoint
        get_resp = self.client.get("/api/lookup/translate?text=world&target=pt")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["original_text"], "world")


if __name__ == "__main__":
    unittest.main()
