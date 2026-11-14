from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)

def test_legacy_view_html():
    response = client.get("/legacy")
    assert response.status_code == 200
    assert "Uzi Library" in response.text
    assert "LEGACY" in response.text
    assert "<!DOCTYPE html>" in response.text
    assert "profile-select" in response.text

def test_legacy_view_with_user_selection():
    response = client.get("/legacy?user=Andreusd")
    assert response.status_code == 200
    assert "Andreusd" in response.text
    assert "uzi_user" in response.cookies or "set-cookie" in response.headers

def test_legacy_view_with_search_and_shelf():
    response = client.get("/legacy?q=test&shelf=__favorites__&sort=title_desc&user=Andreusd")
    assert response.status_code == 200
    assert "Uzi Library" in response.text

def test_root_redirect_for_ios_9():
    headers = {"User-Agent": "Mozilla/5.0 (iPad; CPU OS 9_3_6 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13G37 Safari/601.1"}
    response = client.get("/", headers=headers, follow_redirects=False)
    assert response.status_code in (302, 307)
    assert response.headers["location"] == "/legacy"

def test_root_serves_spa_for_modern():
    headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    response = client.get("/", headers=headers, follow_redirects=False)
    assert response.status_code == 200
    assert "Uzi Library" in response.text
