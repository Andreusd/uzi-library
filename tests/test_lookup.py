import os
import sys
import json
import tempfile
import shutil
import unittest
from unittest.mock import patch, MagicMock

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.lookup import clean_html, sanitize_word, LookupManager
from server.database import Database

class TestLookupUtilities(unittest.TestCase):
    def test_clean_html(self):
        self.assertEqual(clean_html(""), "")
        self.assertEqual(clean_html(None), "")
        self.assertEqual(clean_html("<p>Hello <b>world</b>!</p>"), "Hello world!")
        self.assertEqual(clean_html("Tom &amp; Jerry &gt; Mickey"), "Tom & Jerry > Mickey")
        self.assertEqual(clean_html("  Lots   of    spaces   \n\t and lines "), "Lots of spaces and lines")

    def test_sanitize_word(self):
        self.assertEqual(sanitize_word(""), "")
        self.assertEqual(sanitize_word(None), "")
        self.assertEqual(sanitize_word("  hello  "), "hello")
        self.assertEqual(sanitize_word('"Hello,"'), "hello")
        self.assertEqual(sanitize_word("¿Aprender?!"), "aprender")
        self.assertEqual(sanitize_word("São Paulo"), "são paulo")


class TestLookupManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test_lookup.db")
        self.db = Database(self.db_path)
        self.mgr = LookupManager(cache_file=self.db_path, db=self.db)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_define_word_empty(self):
        res = self.mgr.define_word("")
        self.assertEqual(res.get("error"), "empty_word")

        res_none = self.mgr.define_word("   ")
        self.assertEqual(res_none.get("error"), "empty_word")

    def test_define_word_cache_hit(self):
        # Prepopulate cache in sqlite
        cached_payload = {
            "word": "algorithm",
            "language": "en",
            "entries": [
                {
                    "partOfSpeech": "Noun",
                    "definitions": ["A step-by-step problem-solving procedure."],
                    "examples": ["Euclid developed a famous algorithm."]
                }
            ],
            "source": "MockCache"
        }
        self.db.set_lookup("definition", "en:algorithm", cached_payload)

        # Lookup should hit cache without network
        res = self.mgr.define_word("Algorithm", lang="en")
        self.assertEqual(res["source"], "MockCache")
        self.assertEqual(res["word"], "algorithm")
        self.assertEqual(len(res["entries"]), 1)

    @patch("urllib.request.urlopen")
    def test_define_word_wiktionary_success(self, mock_urlopen):
        wiktionary_response = {
            "en": [
                {
                    "partOfSpeech": "noun",
                    "definitions": [
                        {"definition": "A computational procedure.", "examples": ["Fast algorithm."]}
                    ]
                }
            ]
        }
        mock_cm = MagicMock()
        mock_cm.status = 200
        mock_cm.read.return_value = json.dumps(wiktionary_response).encode("utf-8")
        mock_cm.__enter__.return_value = mock_cm
        mock_urlopen.return_value = mock_cm

        res = self.mgr.define_word("algorithm", lang="en")
        self.assertEqual(res["source"], "Wiktionary")
        self.assertEqual(res["word"], "algorithm")
        self.assertTrue(len(res["entries"]) > 0)
        self.assertEqual(res["entries"][0]["partOfSpeech"], "Noun")

        # Verify it was saved to cache
        cached = self.db.get_lookup("definition", "en:algorithm")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["source"], "Wiktionary")

    @patch("urllib.request.urlopen")
    def test_define_word_free_dictionary_fallback(self, mock_urlopen):
        # Wiktionary fails (raises Exception), FreeDictionaryAPI succeeds
        def urlopen_side_effect(req, *args, **kwargs):
            url = req.full_url if hasattr(req, "full_url") else str(req)
            if "wiktionary.org" in url:
                raise Exception("Wiktionary unavailable")
            mock_cm = MagicMock()
            mock_cm.status = 200
            free_dict_data = [
                {
                    "phonetic": "/ˈkəʊd/",
                    "meanings": [
                        {
                            "partOfSpeech": "noun",
                            "definitions": [{"definition": "A system of rules or symbols.", "example": "Morse code"}]
                        }
                    ]
                }
            ]
            mock_cm.read.return_value = json.dumps(free_dict_data).encode("utf-8")
            mock_cm.__enter__.return_value = mock_cm
            return mock_cm

        mock_urlopen.side_effect = urlopen_side_effect

        res = self.mgr.define_word("code", lang="en")
        self.assertEqual(res["source"], "FreeDictionaryAPI")
        self.assertEqual(res.get("phonetic"), "/ˈkəʊd/")
        self.assertEqual(len(res["entries"]), 1)

    @patch("urllib.request.urlopen")
    def test_define_word_datamuse_fallback(self, mock_urlopen):
        # Wiktionary and FreeDictionary fail, Datamuse succeeds
        def urlopen_side_effect(req, *args, **kwargs):
            url = req.full_url if hasattr(req, "full_url") else str(req)
            if "wiktionary.org" in url or "dictionaryapi.dev" in url:
                raise Exception("API error")
            mock_cm = MagicMock()
            mock_cm.status = 200
            datamuse_data = [
                {
                    "word": "byte",
                    "defs": ["n\ta sequence of 8 bits"]
                }
            ]
            mock_cm.read.return_value = json.dumps(datamuse_data).encode("utf-8")
            mock_cm.__enter__.return_value = mock_cm
            return mock_cm

        mock_urlopen.side_effect = urlopen_side_effect

        res = self.mgr.define_word("byte", lang="en")
        self.assertEqual(res["source"], "Datamuse")
        self.assertEqual(res["entries"][0]["partOfSpeech"], "Noun")
        self.assertEqual(res["entries"][0]["definitions"], ["a sequence of 8 bits"])

    @patch("urllib.request.urlopen")
    def test_define_word_all_fail_returns_not_found(self, mock_urlopen):
        mock_urlopen.side_effect = Exception("Network offline")

        res = self.mgr.define_word("nonexistentwordxyz", lang="en")
        self.assertEqual(res.get("error"), "not_found")
        self.assertEqual(res["entries"], [])

    def test_translate_text_empty(self):
        res = self.mgr.translate_text("")
        self.assertEqual(res.get("error"), "empty_text")

    def test_translate_text_cache_hit(self):
        cached = {
            "original_text": "Good morning",
            "translated_text": "Bom dia",
            "source_language": "en",
            "target_language": "pt",
            "source": "MockCache"
        }
        self.db.set_lookup("translation", "en:pt:Good morning", cached)

        res = self.mgr.translate_text("Good morning", target_lang="pt", source_lang="en")
        self.assertEqual(res["source"], "MockCache")
        self.assertEqual(res["translated_text"], "Bom dia")

    @patch("urllib.request.urlopen")
    def test_translate_text_mymemory_success(self, mock_urlopen):
        mymemory_data = {
            "responseStatus": 200,
            "responseData": {
                "translatedText": "Olá Mundo"
            }
        }
        mock_cm = MagicMock()
        mock_cm.status = 200
        mock_cm.read.return_value = json.dumps(mymemory_data).encode("utf-8")
        mock_cm.__enter__.return_value = mock_cm
        mock_urlopen.return_value = mock_cm

        res = self.mgr.translate_text("Hello World", target_lang="pt", source_lang="en")
        self.assertEqual(res["translated_text"], "Olá Mundo")
        self.assertEqual(res["source"], "MyMemory")

        # Verify cached
        cached = self.db.get_lookup("translation", "en:pt:Hello World")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["translated_text"], "Olá Mundo")
