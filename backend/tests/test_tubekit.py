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


# ---------------- Thumbnail DELETE + new fields tests (iteration 2) ----------------
PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="


@pytest.fixture(scope="session")
def test_user(session):
    """Register a fresh test user; return dict with email, password, token, id, headers."""
    email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
    password = "pass1234"
    r = session.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": "TEST_DeleteOwner"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    return {
        "email": email,
        "password": password,
        "token": d["token"],
        "id": d["user"]["id"],
        "headers": {"Authorization": f"Bearer {d['token']}", "Content-Type": "application/json"},
    }


class TestThumbnailDelete:
    """DELETE /api/thumbnail/{id} ownership + validation"""

    def test_delete_unauth_returns_401(self, session):
        # Any valid-shaped ObjectId, but unauth must short-circuit before resolving
        r = session.delete(f"{BASE_URL}/api/thumbnail/507f1f77bcf86cd799439011", timeout=30)
        assert r.status_code == 401, r.text

    def test_delete_invalid_id_returns_400(self, session, auth_headers):
        r = session.delete(f"{BASE_URL}/api/thumbnail/abc", headers=auth_headers, timeout=30)
        assert r.status_code == 400, r.text
        body = r.json()
        msg = body.get("detail") or body.get("message") or ""
        assert "Geçersiz id" in msg, f"Unexpected error body: {body}"

    def test_delete_nonexistent_id_returns_404(self, session, auth_headers):
        # Valid ObjectId shape but not present in DB
        r = session.delete(
            f"{BASE_URL}/api/thumbnail/507f1f77bcf86cd799439011",
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 404, r.text
        body = r.json()
        msg = body.get("detail") or body.get("message") or ""
        assert "Görsel bulunamadı" in msg, f"Unexpected error body: {body}"

    def test_owner_can_delete_and_listing_reflects(self, session, test_user):
        h = test_user["headers"]
        # Create
        r_save = session.post(
            f"{BASE_URL}/api/thumbnail/save",
            headers=h,
            json={
                "image_data": f"data:image/png;base64,{PNG_B64}",
                "title": "TEST_owner_delete",
                "source": "editor",
            },
            timeout=30,
        )
        assert r_save.status_code == 200, r_save.text
        thumb_id = r_save.json()["id"]

        # Confirm in list
        r_list = session.get(f"{BASE_URL}/api/thumbnail/list", headers=h, timeout=30)
        assert r_list.status_code == 200
        ids_before = [it["id"] for it in r_list.json()["items"]]
        assert thumb_id in ids_before

        # Delete
        r_del = session.delete(f"{BASE_URL}/api/thumbnail/{thumb_id}", headers=h, timeout=30)
        assert r_del.status_code == 200, r_del.text
        body = r_del.json()
        assert body.get("ok") is True
        assert body.get("id") == thumb_id

        # Confirm absent
        r_list2 = session.get(f"{BASE_URL}/api/thumbnail/list", headers=h, timeout=30)
        assert r_list2.status_code == 200
        ids_after = [it["id"] for it in r_list2.json()["items"]]
        assert thumb_id not in ids_after

        # Delete again -> 404
        r_del2 = session.delete(f"{BASE_URL}/api/thumbnail/{thumb_id}", headers=h, timeout=30)
        assert r_del2.status_code == 404

    def test_non_owner_admin_cannot_delete_others_thumbnail(self, session, test_user, auth_headers):
        # test_user creates a thumbnail
        h = test_user["headers"]
        r_save = session.post(
            f"{BASE_URL}/api/thumbnail/save",
            headers=h,
            json={
                "image_data": PNG_B64,
                "title": "TEST_owned_by_testuser",
                "source": "editor",
            },
            timeout=30,
        )
        assert r_save.status_code == 200, r_save.text
        thumb_id = r_save.json()["id"]

        # Admin (different user) attempts to delete -> must be 403
        r_del = session.delete(
            f"{BASE_URL}/api/thumbnail/{thumb_id}", headers=auth_headers, timeout=30
        )
        assert r_del.status_code == 403, r_del.text

        # Confirm doc still exists for owner
        r_list = session.get(f"{BASE_URL}/api/thumbnail/list", headers=h, timeout=30)
        assert r_list.status_code == 200
        ids = [it["id"] for it in r_list.json()["items"]]
        assert thumb_id in ids

        # Cleanup: owner deletes
        session.delete(f"{BASE_URL}/api/thumbnail/{thumb_id}", headers=h, timeout=30)


class TestThumbnailGenerateNewFields:
    """Validation/backward-compat for person_image + scene_images on /thumbnail/generate"""

    def test_generate_legacy_no_refs_still_works(self, session, auth_headers):
        # No person_image / scene_images / reference_images -> must NOT 422
        r = session.post(
            f"{BASE_URL}/api/thumbnail/generate",
            headers=auth_headers,
            json={"prompt": "cozy lo-fi study desk at night", "style": "lifestyle", "language": "en"},
            timeout=120,
        )
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
        d = r.json()
        assert "id" in d and d["image"].startswith("data:image/")

    def test_generate_with_person_image_validates(self, session, auth_headers):
        # Pass new person_image field; ensure no 422; allow upstream LLM 5xx but flag it
        r = session.post(
            f"{BASE_URL}/api/thumbnail/generate",
            headers=auth_headers,
            json={
                "prompt": "developer working on a futuristic coding setup",
                "style": "tech",
                "title_text": "DEV LIFE",
                "language": "en",
                "person_image": f"data:image/png;base64,{PNG_B64}",
            },
            timeout=180,
        )
        # 422 = validation failure on new field -> hard fail
        assert r.status_code != 422, f"Validation failure on person_image: {r.text}"
        if r.status_code == 200:
            d = r.json()
            assert "id" in d
            assert d["image"].startswith("data:image/")
        else:
            # Upstream LLM problem - acceptable per request, but report body
            print(f"[INFO] person_image generate non-200 (upstream allowed): {r.status_code} {r.text[:400]}")

    def test_generate_with_scene_images_validates(self, session, auth_headers):
        scenes = [f"data:image/png;base64,{PNG_B64}"] * 3
        r = session.post(
            f"{BASE_URL}/api/thumbnail/generate",
            headers=auth_headers,
            json={
                "prompt": "epic mountain landscape gaming setup",
                "style": "dramatic",
                "language": "en",
                "scene_images": scenes,
            },
            timeout=180,
        )
        assert r.status_code != 422, f"Validation failure on scene_images: {r.text}"
        if r.status_code != 200:
            print(f"[INFO] scene_images generate non-200 (upstream allowed): {r.status_code} {r.text[:400]}")

    def test_generate_with_person_and_scenes_combined(self, session, auth_headers):
        r = session.post(
            f"{BASE_URL}/api/thumbnail/generate",
            headers=auth_headers,
            json={
                "prompt": "person hiking through forest at sunset",
                "style": "vibrant",
                "language": "en",
                "person_image": PNG_B64,  # no data: prefix - exercise strip path
                "scene_images": [PNG_B64, f"data:image/png;base64,{PNG_B64}"],
            },
            timeout=180,
        )
        assert r.status_code != 422, f"Validation failure combined fields: {r.text}"
        if r.status_code != 200:
            print(f"[INFO] combined generate non-200 (upstream allowed): {r.status_code} {r.text[:400]}")


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
