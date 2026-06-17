"""TubeKit backend API tests"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tubekit-studio.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@tubekit.app"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------- Auth tests ----------------
class TestAuth:
    def test_register_new_user(self, session):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "pass1234", "name": "Tester"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and len(d["token"]) > 10
        assert d["user"]["email"] == email
        assert "id" in d["user"]

    def test_login_admin_success(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == ADMIN_EMAIL
        assert isinstance(d["token"], str)

    def test_login_bad_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == ADMIN_EMAIL
        assert "password_hash" not in d
        assert "_id" not in d


# ---------------- Protected without token ----------------
class TestProtected:
    @pytest.mark.parametrize("path,method", [
        ("/api/seo/generate", "post"),
        ("/api/ideas/generate", "post"),
        ("/api/thumbnail/generate", "post"),
        ("/api/thumbnail/save", "post"),
        ("/api/thumbnail/list", "get"),
        ("/api/dashboard/stats", "get"),
        ("/api/history/list", "get"),
    ])
    def test_requires_auth(self, session, path, method):
        fn = getattr(session, method)
        r = fn(f"{BASE_URL}{path}", json={} if method == "post" else None, timeout=30)
        assert r.status_code == 401


# ---------------- SEO tests ----------------
class TestSEO:
    def test_seo_generate_tr(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/seo/generate", headers=auth_headers,
                         json={"topic": "Python ile YouTube botu yapma", "keywords": "python,youtube", "audience": "geliştiriciler", "language": "tr"},
                         timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("titles"), list) and len(d["titles"]) == 5
        assert isinstance(d.get("description"), str) and len(d["description"]) > 30
        assert isinstance(d.get("tags"), list) and len(d["tags"]) >= 5
        assert isinstance(d.get("hashtags"), list) and len(d["hashtags"]) >= 1

    def test_seo_generate_en(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/seo/generate", headers=auth_headers,
                         json={"topic": "How to make a YouTube intro", "language": "en"},
                         timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["titles"]) == 5
        assert isinstance(d["description"], str)


# ---------------- Ideas tests ----------------
class TestIdeas:
    def test_ideas_tr(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/ideas/generate", headers=auth_headers,
                         json={"niche": "yazılım eğitimi", "language": "tr", "count": 5}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("ideas"), list) and len(d["ideas"]) >= 3
        first = d["ideas"][0]
        for k in ["title", "hook", "format", "estimated_views"]:
            assert k in first

    def test_ideas_en(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/ideas/generate", headers=auth_headers,
                         json={"niche": "fitness", "language": "en", "count": 4}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["ideas"]) >= 3


# ---------------- Thumbnail tests ----------------
class TestThumbnail:
    def test_thumbnail_save_and_list(self, session, auth_headers):
        # tiny 1x1 png base64
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        # With data prefix
        r1 = session.post(f"{BASE_URL}/api/thumbnail/save", headers=auth_headers,
                          json={"image_data": f"data:image/png;base64,{png_b64}", "title": "TEST_thumb1", "source": "editor"}, timeout=30)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("ok") is True

        # Without prefix
        r2 = session.post(f"{BASE_URL}/api/thumbnail/save", headers=auth_headers,
                          json={"image_data": png_b64, "title": "TEST_thumb2", "source": "editor"}, timeout=30)
        assert r2.status_code == 200

        # List
        r3 = session.get(f"{BASE_URL}/api/thumbnail/list", headers=auth_headers, timeout=30)
        assert r3.status_code == 200
        items = r3.json()["items"]
        assert isinstance(items, list) and len(items) >= 2
        assert items[0]["image"].startswith("data:image/")

    def test_thumbnail_generate_ai(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/thumbnail/generate", headers=auth_headers,
                         json={"prompt": "a cat coding python on laptop", "style": "vibrant", "title_text": "PY CAT", "language": "en"},
                         timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert d["image"].startswith("data:image/")
        assert len(d["image"]) > 500


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_stats(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["thumbnails", "seo_drafts", "idea_sessions", "recent_thumbnails", "recent_history"]:
            assert k in d
        assert isinstance(d["thumbnails"], int)
        assert isinstance(d["recent_thumbnails"], list)
