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

    assert "Contexto do Livro em Leitura" in prompt
    assert "Livro de Teste" in prompt
    assert "Autor X" in prompt
    assert "Um trecho importante selecionado pelo leitor" in prompt
    assert "Leitor: O que podemos aprender neste capítulo?" in prompt

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
    assert "Contexto do Livro em Leitura" not in prompt
    assert "Sumário da Obra" not in prompt
    assert "Novo trecho em destaque" in prompt
    assert "Localização atual: Capítulo 7" in prompt
    assert "Segunda pergunta sobre o blog" in prompt
