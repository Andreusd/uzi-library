import os
import sys
import tempfile
import zipfile
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server.ai.context import clean_html_to_text, BookContextExtractor
from server.ai.manager import AIManager
from server.ai.providers import DummyProvider
from server.database import Database

def test_clean_html_to_text():
    html_sample = "<div><h1>Capítulo 1</h1><script>alert(1)</script><p>Texto de teste com <b>negrito</b>.</p></div>"
    clean = clean_html_to_text(html_sample)
    assert "Capítulo 1" in clean
    assert "Texto de teste com negrito." in clean
    assert "alert" not in clean

def test_ai_manager_build_prompt_context_book_specific(tmp_path):
    db_file = str(tmp_path / "test_library.db")
    db = Database(db_file)
    with db.get_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO libraries (id, name, path) VALUES ('lib1', 'Minha Biblioteca', '/books')")
        conn.execute("INSERT OR REPLACE INTO books (id, library_id, folder_id, title, author, format, filename, path) VALUES ('b1', 'lib1', 'Dev', 'Livro de Teste', 'Autor X', 'epub', 'teste.epub', '/books/teste.epub')")

    extractor = BookContextExtractor(db)
    manager = AIManager(provider=DummyProvider(), extractor=extractor)

    messages = [{"role": "user", "content": "O que podemos aprender neste capítulo?"}]
    contexts = [{"text": "Um trecho importante selecionado pelo leitor", "location": "Cap. 1"}]

    prompt = manager.build_prompt_context(
        messages=messages,
        book_id="b1",
        book_title="Livro de Teste",
        book_author="Autor X",
        location="Capítulo 1",
        contexts=contexts
    )

    assert "Active Book Reading Context" in prompt
    assert "Livro de Teste" in prompt
    assert "Autor X" in prompt
    assert "Um trecho importante selecionado pelo leitor" in prompt
    assert "Reader: O que podemos aprender neste capítulo?" in prompt

def test_extract_epub_context_structure(tmp_path):
    epub_path = str(tmp_path / "sample.epub")
    with zipfile.ZipFile(epub_path, "w") as zf:
        zf.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        zf.writestr("content.opf", '<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="ch1" href="ch1.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>')
        zf.writestr("ch1.html", "<html><body><h1>Capítulo 1</h1><p>Conteúdo do primeiro capítulo.</p></body></html>")

    extractor = BookContextExtractor()
    ctx = extractor.extract_epub_context(epub_path, location_hint="ch1.html")
    assert "current_chapter" in ctx
    assert "Conteúdo do primeiro capítulo." in ctx["current_chapter"]["text"]

def test_ai_manager_incremental_context_with_conversation_id():
    manager = AIManager(provider=DummyProvider())
    messages = [
        {"role": "user", "content": "Primeira pergunta"},
        {"role": "assistant", "content": "Primeira resposta"},
        {"role": "user", "content": "Segunda pergunta sobre o blog"}
    ]
    contexts = [{"text": "Novo trecho em destaque", "location": "Pág. 42"}]

    prompt = manager.build_prompt_context(
        messages=messages,
        conversation_id="conv-abc-123",
        book_title="Título do Livro",
        location="Capítulo 7",
        contexts=contexts
    )

    # In turn 2+ (with conversation_id), prompt must be lean and NOT repeat full metadata headers
    assert "Active Book Reading Context" not in prompt
    assert "Table of Contents" not in prompt
    assert "Novo trecho em destaque" in prompt
    assert "Current location: Capítulo 7" in prompt
    assert "Segunda pergunta sobre o blog" in prompt


def test_ai_manager_trimmed_focus_and_no_spoiler():
    class MockExtractor:
        def extract_context_for_book(self, book_id, location=None, page=None):
            return {
                "surrounding": {
                    "toc": ["Cap. 1", "Cap. 2", "Cap. 3"],
                    "current_chapter": {"title": "Capítulo 2", "text": "Texto do capítulo 2 em leitura."},
                    "prev_chapter": {"title": "Capítulo 1", "text": "Texto do capítulo 1 anterior."},
                    "next_chapter": {"title": "Capítulo 3", "text": "Texto do capítulo 3 com spoilers futuros."}
                }
            }

    manager = AIManager(provider=DummyProvider(), extractor=MockExtractor())

    # Case 1: Reader selected a specific snippet -> Focus on snippet and current chapter only; omit previous and next chapters
    prompt_with_selection = manager.build_prompt_context(
        messages=[{"role": "user", "content": "Explique este trecho"}],
        book_id="b1",
        book_title="Obra Mistério",
        contexts=[{"text": "Trecho crucial selecionado", "location": "Cap. 2"}]
    )
    assert "Trecho crucial selecionado" in prompt_with_selection
    assert "Current Reading Chapter / Section" in prompt_with_selection
    assert "Previous Chapter / Section" not in prompt_with_selection
    assert "Next Chapter / Section" not in prompt_with_selection
    assert "spoilers futuros" not in prompt_with_selection

    # Case 2: Reader asks general question without selections -> Current + previous chapter for continuity, but NEVER next chapter
    prompt_general = manager.build_prompt_context(
        messages=[{"role": "user", "content": "O que aconteceu até agora?"}],
        book_id="b1",
        book_title="Obra Mistério"
    )
    assert "Current Reading Chapter / Section" in prompt_general
    assert "Previous Chapter / Section" in prompt_general
    assert "Next Chapter / Section" not in prompt_general
    assert "spoilers futuros" not in prompt_general

def test_search_epub_text_and_antispoiler(tmp_path):
    epub_path = str(tmp_path / "search_test.epub")
    with zipfile.ZipFile(epub_path, "w") as zf:
        zf.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        zf.writestr("content.opf", '<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="ch1" href="ch1.html" media-type="application/xhtml+xml"/><item id="ch2" href="ch2.html" media-type="application/xhtml+xml"/><item id="ch3" href="ch3.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/><itemref idref="ch2"/><itemref idref="ch3"/></spine></package>')
        zf.writestr("ch1.html", "<html><body><h1>Capítulo 1</h1><p>Sherlock Holmes caminhava tranquilamente por Baker Street sob a névoa matinal.</p></body></html>")
        zf.writestr("ch2.html", "<html><body><h1>Capítulo 2</h1><p>O dr. Watson observou o violino enquanto Sherlock dedilhava notas melancólicas.</p></body></html>")
        zf.writestr("ch3.html", "<html><body><h1>Capítulo 3 (Spoiler)</h1><p>Sherlock descobriu que o assassino era Moriarty em pessoa.</p></body></html>")

    extractor = BookContextExtractor()

    # Case 1: Reader is in Chapter 1 -> can find mention in Chapter 1, but NOT in Chapter 2 or Chapter 3
    results_ch1 = extractor.search_epub_text(epub_path, query="Sherlock", location_hint="ch1.html")
    assert len(results_ch1) == 1
    assert "Baker Street" in results_ch1[0]["snippet"]
    assert "Capítulo 1" in results_ch1[0]["chapter"]

    # Case 2: Reader is in Chapter 2 -> can find mentions in Chapter 1 and Chapter 2, but NEVER in Chapter 3 (Moriarty)
    results_ch2 = extractor.search_epub_text(epub_path, query="Sherlock", location_hint="ch2.html")
    assert len(results_ch2) == 2
    chapters_found = [r["chapter"] for r in results_ch2]
    assert "Capítulo 1" in chapters_found
    assert "Capítulo 2" in chapters_found
    assert not any("Moriarty" in r["snippet"] for r in results_ch2)
    assert not any("Capítulo 3" in r["chapter"] for r in results_ch2)

    # Case 3: Searching for Moriarty while in Chapter 2 returns 0 results because Moriarty only appears in Chapter 3!
    results_moriarty = extractor.search_epub_text(epub_path, query="Moriarty", location_hint="ch2.html")
    assert len(results_moriarty) == 0

def test_search_book_text_dispatcher(tmp_path):
    db_file = str(tmp_path / "test_library.db")
    db = Database(db_file)
    epub_path = str(tmp_path / "dispatcher.epub")
    with zipfile.ZipFile(epub_path, "w") as zf:
        zf.writestr("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        zf.writestr("content.opf", '<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="c1" href="c1.html" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>')
        zf.writestr("c1.html", "<html><body><h1>Introdução</h1><p>Conceito de gravidade quântica explicado.</p></body></html>")

    with db.get_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO libraries (id, name, path) VALUES ('lib1', 'L', '/books')")
        conn.execute(f"INSERT OR REPLACE INTO books (id, library_id, folder_id, title, author, format, filename, path) VALUES ('b99', 'lib1', 'Sci', 'Física Moderna', 'Autor', 'epub', 'dispatcher.epub', '{epub_path}')")

    extractor = BookContextExtractor(db)
    res = extractor.search_book_text(book_id="b99", query="gravidade quântica", location_hint="c1.html")
    assert len(res) == 1
    assert "Conceito de gravidade quântica" in res[0]["snippet"]

