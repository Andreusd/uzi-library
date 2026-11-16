import os
import sys
from datetime import datetime, date, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.main import app
from server.database import Database
from server.routers.activity import get_database
from tests.test_api_integration import BaseAPITestCase

class TestReadingActivityAPI(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.db_path = os.path.join(self.cache_dir, "test_activity.db")
        self.db = Database(self.db_path)
        app.dependency_overrides[get_database] = lambda: self.db

    def tearDown(self):
        app.dependency_overrides.pop(get_database, None)
        super().tearDown()

    def test_goal_get_and_set(self):
        # Default goal is 10
        res = self.client.get("/api/activity/goal")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["daily_pages_goal"], 10)

        # Update goal to 25
        res = self.client.put("/api/activity/goal", json={"daily_pages_goal": 25})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["daily_pages_goal"], 25)

        # Check that it persisted
        res = self.client.get("/api/activity/goal")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["daily_pages_goal"], 25)

    def test_record_activity_and_deduplication(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Record pages 1, 2, 3
        res = self.client.post("/api/activity/record", json={
            "book_id": "book-1",
            "date": today,
            "pages": [1, 2, 3],
            "reading_time_seconds": 90,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()["record"]
        self.assertEqual(data["pages_read"], 3)
        self.assertEqual(data["reading_time_seconds"], 90)

        # Record pages 2, 3, 4 (2 and 3 are duplicates, only 4 is new -> total 4)
        res = self.client.post("/api/activity/record", json={
            "book_id": "book-1",
            "date": today,
            "pages": [2, 3, 4],
            "reading_time_seconds": 60,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()["record"]
        self.assertEqual(data["pages_read"], 4)
        self.assertEqual(data["reading_time_seconds"], 150)

    def test_streak_calculation(self):
        today = datetime.now(timezone.utc).date()
        d_minus_2 = (today - timedelta(days=2)).strftime("%Y-%m-%d")
        d_minus_1 = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        d_today = today.strftime("%Y-%m-%d")

        # Record activity for 3 consecutive days
        self.client.post("/api/activity/record", json={"book_id": "b1", "date": d_minus_2, "pages": [1, 2]})
        self.client.post("/api/activity/record", json={"book_id": "b1", "date": d_minus_1, "pages": [3, 4]})
        self.client.post("/api/activity/record", json={"book_id": "b1", "date": d_today, "pages": [5, 6, 7, 8, 9, 10, 11]})

        res = self.client.get(f"/api/activity?today={d_today}")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        stats = body["stats"]

        self.assertEqual(stats["current_streak"], 3)
        self.assertEqual(stats["best_streak"], 3)
        self.assertEqual(stats["pages_today"], 7)
        self.assertEqual(stats["total_pages"], 11)
        self.assertEqual(stats["goal_met_today"], False)  # 7 < 10

    def test_activity_for_specific_date(self):
        date_str = "2026-11-15"
        self.client.post("/api/activity/record", json={"book_id": "dune", "date": date_str, "pages": [1, 2, 3]})
        self.client.post("/api/activity/record", json={"book_id": "foundation", "date": date_str, "pages": [10, 11]})

        res = self.client.get(f"/api/activity/day?date={date_str}")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["date"], date_str)
        self.assertEqual(len(body["books"]), 2)
        book_ids = {b["book_id"] for b in body["books"]}
        self.assertEqual(book_ids, {"dune", "foundation"})

    def test_user_isolation(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # Default user reads 5 pages
        self.client.post("/api/activity/record", json={"book_id": "b1", "date": today, "pages": [1, 2, 3, 4, 5]})

        # Touch user alice in user_mgr
        self.user_mgr.touch_user("alice")

        # User Alice reads 20 pages
        self.client.post(
            "/api/activity/record",
            json={"book_id": "b1", "date": today, "pages": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]},
            headers={"X-User": "alice"}
        )

        res_default = self.client.get("/api/activity")
        self.assertEqual(res_default.json()["stats"]["pages_today"], 5)

        res_alice = self.client.get("/api/activity", headers={"X-User": "alice"})
        self.assertEqual(res_alice.json()["stats"]["pages_today"], 20)
