"""Backend tests for RMAlbum 3D module."""
import os, io, uuid, time, pytest, requests
from PIL import Image

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    pytest.skip(
        "Set REACT_APP_BACKEND_URL to run backend integration tests.",
        allow_module_level=True,
    )

API = f"{BASE}/api"
ADMIN = {
    "email": os.environ.get("RMALBUM_TEST_ADMIN_EMAIL", ""),
    "password": os.environ.get("RMALBUM_TEST_ADMIN_PASSWORD", ""),
}
requires_admin = pytest.mark.skipif(
    not all(ADMIN.values()),
    reason="Set RMALBUM_TEST_ADMIN_EMAIL and RMALBUM_TEST_ADMIN_PASSWORD.",
)


def _jpeg_bytes(color=(200, 100, 50)):
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color).save(buf, "JPEG")
    return buf.getvalue()


def _sample_config(name="TEST_cfg"):
    return {
        "name": name,
        "projectId": "proj-" + uuid.uuid4().hex[:8],
        "projectName": "TEST proj",
        "album": {"orientation": "quadrato", "spineCm": 2.5},
        "materials": {"cover": {"family": "tela", "code": "T122"}, "spine": None, "boxCExterior": None, "boxCInterior": None, "boxG": None},
        "box": {"type": "C", "wallCm": 2, "clearanceCm": 0.5, "plexiCm": 0.5, "interior": "fabric"},
        "previews": {},
        "notes": "",
    }


# ---------- catalog ----------
class TestCatalog:
    def test_catalog(self):
        r = requests.get(f"{API}/catalog")
        assert r.status_code == 200
        d = r.json()
        assert len(d["families"]) == 4
        assert len(d["variants"]) == 93
        t114 = [v for v in d["variants"] if v["code"] == "T114"]
        assert t114 and t114[0].get("outOfProduction") is True
        assert t114[0].get("colorHex") is None

    def test_asset_texture(self):
        for f in ("T122.jpg", "tela_texture.jpg"):
            r = requests.get(f"{API}/assets/catalog/{f}")
            assert r.status_code == 200, f
            assert r.headers["content-type"].startswith("image/jpeg")


# ---------- auth ----------
class TestAuth:
    @requires_admin
    def test_login_admin(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200, r.text
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == ADMIN["email"]

    @requires_admin
    def test_login_wrong(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN["email"], "password": "wrong!!!!"})
        assert r.status_code == 401

    def test_me_no_cookie(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register(self):
        email = f"tester_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "T"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email


# ---------- configs & ownership ----------
@pytest.fixture(scope="module")
def two_users():
    def new_user():
        s = requests.Session()
        email = f"tester_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "T"})
        assert r.status_code == 200, r.text
        return s, email
    return new_user(), new_user()


class TestConfigs:
    def test_configs_requires_auth(self):
        r = requests.get(f"{API}/configs")
        assert r.status_code == 401
        r = requests.post(f"{API}/configs", json=_sample_config())
        assert r.status_code == 401

    def test_ownership(self, two_users):
        (s1, e1), (s2, e2) = two_users
        r = s1.post(f"{API}/configs", json=_sample_config("TEST_own"))
        assert r.status_code == 200, r.text
        cid = r.json()["id"]

        # s2 cannot access
        for method, url in [("get", f"{API}/configs/{cid}"), ("put", f"{API}/configs/{cid}"), ("delete", f"{API}/configs/{cid}")]:
            kwargs = {"json": _sample_config("hack")} if method == "put" else {}
            r = getattr(s2, method)(url, **kwargs)
            assert r.status_code == 403, f"{method} {r.status_code}"

        # s2 list should not include s1's config
        r = s2.get(f"{API}/configs")
        assert r.status_code == 200
        assert all(c["id"] != cid for c in r.json())
        # s1 list should
        r = s1.get(f"{API}/configs")
        assert any(c["id"] == cid for c in r.json())


# ---------- publish/share ----------
class TestPublish:
    @pytest.fixture(scope="class")
    def owner_and_config(self):
        s = requests.Session()
        email = f"tester_{uuid.uuid4().hex[:8]}@example.com"
        s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "P"})
        r = s.post(f"{API}/configs", json=_sample_config("TEST_pub"))
        return s, r.json()["id"]

    def test_publish_creates_token(self, owner_and_config):
        s, cid = owner_and_config
        r = s.post(f"{API}/configs/{cid}/publish", json={})
        assert r.status_code == 200, r.text
        token = r.json()["shareToken"]
        assert token
        # public read
        r2 = requests.get(f"{API}/share/{token}")
        assert r2.status_code == 200
        d = r2.json()
        assert d["materials"]["cover"]["code"] == "T122"
        assert "variants" in d and "families" in d
        # save token for subsequent tests
        TestPublish.token1 = token

    def test_snapshot_not_updated_until_republish(self, owner_and_config):
        s, cid = owner_and_config
        # update material without republish
        new_body = _sample_config("TEST_pub")
        new_body["materials"]["cover"] = {"family": "tela", "code": "T101"}
        r = s.put(f"{API}/configs/{cid}", json=new_body)
        assert r.status_code == 200
        r = requests.get(f"{API}/share/{TestPublish.token1}")
        assert r.status_code == 200
        # snapshot should still show old T122
        assert r.json()["materials"]["cover"]["code"] == "T122"

    def test_revoke_then_share_404(self, owner_and_config):
        s, cid = owner_and_config
        r = s.post(f"{API}/configs/{cid}/revoke")
        assert r.status_code == 200
        r = requests.get(f"{API}/share/{TestPublish.token1}")
        assert r.status_code == 404

    def test_republish_creates_new_token(self, owner_and_config):
        s, cid = owner_and_config
        r = s.post(f"{API}/configs/{cid}/publish", json={})
        assert r.status_code == 200
        new_token = r.json()["shareToken"]
        assert new_token and new_token != TestPublish.token1
        # old token invalid
        r_old = requests.get(f"{API}/share/{TestPublish.token1}")
        assert r_old.status_code == 404
        # new works and reflects updated material (T101)
        r_new = requests.get(f"{API}/share/{new_token}")
        assert r_new.status_code == 200
        assert r_new.json()["materials"]["cover"]["code"] == "T101"

    def test_nonexistent_token(self):
        r = requests.get(f"{API}/share/{uuid.uuid4().hex}")
        assert r.status_code == 404


# ---------- previews ----------
class TestPreviews:
    @pytest.fixture(scope="class")
    def owner_config(self):
        s = requests.Session()
        email = f"tester_{uuid.uuid4().hex[:8]}@example.com"
        s.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "name": "Pv"})
        r = s.post(f"{API}/configs", json=_sample_config("TEST_prev"))
        return s, r.json()["id"]

    def test_upload_and_fetch(self, owner_config):
        s, cid = owner_config
        files = {"file": ("t.jpg", _jpeg_bytes(), "image/jpeg")}
        r = s.post(f"{API}/configs/{cid}/previews/coverFront", files=files)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        # public GET
        r2 = requests.get(f"{BASE}{url}")
        assert r2.status_code == 200
        assert r2.headers["content-type"].startswith("image/")

    def test_invalid_kind(self, owner_config):
        s, cid = owner_config
        files = {"file": ("t.jpg", _jpeg_bytes(), "image/jpeg")}
        r = s.post(f"{API}/configs/{cid}/previews/bogusKind", files=files)
        assert r.status_code == 400

    def test_invalid_type(self, owner_config):
        s, cid = owner_config
        files = {"file": ("t.txt", b"not an image", "text/plain")}
        r = s.post(f"{API}/configs/{cid}/previews/coverFront", files=files)
        assert r.status_code == 400
