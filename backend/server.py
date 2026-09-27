from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os, json, uuid, secrets, logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any
import bcrypt, jwt, requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger("rmalbum")
logging.basicConfig(level=logging.INFO)

JWT_ALG = "HS256"
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = os.environ["APP_NAME"]
storage_key: Optional[str] = None
now = lambda: datetime.now(timezone.utc).isoformat()


# ---------- auth ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(user_id: str, email: str, kind: str, delta: timedelta) -> str:
    return jwt.encode({"sub": user_id, "email": email, "type": kind, "exp": datetime.now(timezone.utc) + delta}, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


def set_auth_cookies(resp: Response, user: dict):
    resp.set_cookie("access_token", make_token(user["id"], user["email"], "access", timedelta(hours=12)), httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    resp.set_cookie("refresh_token", make_token(user["id"], user["email"], "refresh", timedelta(days=7)), httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u.get("name", ""), "role": u.get("role", "user")}


async def current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Accesso richiesto")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessione scaduta")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token non valido")
    if payload.get("type") != "access":
        raise HTTPException(401, "Token non valido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Utente non trovato")
    return user


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = ""


@api.post("/auth/register")
async def register(body: Credentials, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email già registrata")
    user = {"id": str(uuid.uuid4()), "email": email, "name": body.name, "role": "user", "password_hash": hash_password(body.password), "created_at": now()}
    await db.users.insert_one(user)
    set_auth_cookies(response, user)
    return public_user(user)


@api.post("/auth/login")
async def login(body: Credentials, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and datetime.fromisoformat(att["last"]) > datetime.now(timezone.utc) - timedelta(minutes=15):
        raise HTTPException(429, "Troppi tentativi: riprova tra 15 minuti")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"last": now()}}, upsert=True)
        raise HTTPException(401, "Email o password non corretti")
    await db.login_attempts.delete_one({"identifier": ident})
    set_auth_cookies(response, user)
    return public_user(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "Accesso richiesto")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token non valido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if payload.get("type") != "refresh" or not user:
        raise HTTPException(401, "Token non valido")
    set_auth_cookies(response, user)
    return public_user(user)


# ---------- catalogo ----------
@api.get("/catalog")
async def catalog():
    families = await db.material_families.find({}, {"_id": 0}).to_list(100)
    variants = await db.material_variants.find({}, {"_id": 0}).sort("code", 1).to_list(1000)
    return {"families": families, "variants": variants}


# ---------- object storage ----------
def init_storage(force=False):
    global storage_key
    if storage_key and not force:
        return storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    r.raise_for_status()
    storage_key = r.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), "Content-Type": content_type}, data=data, timeout=120)
    if r.status_code == 404:
        r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True), "Content-Type": content_type}, data=data, timeout=120)
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


@api.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File non trovato")
    data, ct = get_object(path)
    return Response(content=data, media_type=rec.get("content_type", ct), headers={"Cache-Control": "public, max-age=31536000, immutable"})


# ---------- configurazioni ----------
class ConfigBody(BaseModel):
    name: str
    projectId: str
    projectName: str = ""
    album: dict
    materials: dict
    box: dict
    previews: dict = {}
    notes: str = ""


def strip(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def owned_config(config_id: str, user: dict) -> dict:
    cfg = await db.album_configs.find_one({"id": config_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(404, "Configurazione non trovata")
    if cfg["ownerId"] != user["id"]:
        raise HTTPException(403, "Non sei il proprietario di questa configurazione")
    return cfg


@api.get("/configs")
async def list_configs(user=Depends(current_user)):
    return await db.album_configs.find({"ownerId": user["id"]}, {"_id": 0, "published": 0}).sort("updatedAt", -1).to_list(500)


@api.post("/configs")
async def create_config(body: ConfigBody, user=Depends(current_user)):
    cfg = {**body.model_dump(), "id": str(uuid.uuid4()), "ownerId": user["id"], "published": None, "shareToken": None, "shareRevoked": False, "shareExpiresAt": None, "createdAt": now(), "updatedAt": now()}
    await db.album_configs.insert_one(cfg)
    return strip(cfg)


@api.get("/configs/{config_id}")
async def get_config(config_id: str, user=Depends(current_user)):
    return await owned_config(config_id, user)


@api.put("/configs/{config_id}")
async def update_config(config_id: str, body: ConfigBody, user=Depends(current_user)):
    await owned_config(config_id, user)
    await db.album_configs.update_one({"id": config_id}, {"$set": {**body.model_dump(), "updatedAt": now()}})
    return await db.album_configs.find_one({"id": config_id}, {"_id": 0})


@api.delete("/configs/{config_id}")
async def delete_config(config_id: str, user=Depends(current_user)):
    await owned_config(config_id, user)
    await db.album_configs.delete_one({"id": config_id})
    return {"ok": True}


@api.post("/configs/{config_id}/previews/{kind}")
async def upload_preview(config_id: str, kind: str, file: UploadFile = File(...), user=Depends(current_user)):
    if kind not in ("coverFront", "boxInterior"):
        raise HTTPException(400, "Tipo anteprima non valido")
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Formato immagine non supportato")
    await owned_config(config_id, user)
    data = await file.read()
    if len(data) > 4_000_000:
        raise HTTPException(413, "Anteprima troppo grande (max 4 MB)")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    path = f"{APP_NAME}/previews/{user['id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, file.content_type)
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "content_type": file.content_type, "size": result["size"], "ownerId": user["id"], "configId": config_id, "kind": kind, "is_deleted": False, "created_at": now()})
    url = f"/api/files/{result['path']}"
    await db.album_configs.update_one({"id": config_id}, {"$set": {f"previews.{kind}": url, "updatedAt": now()}})
    return {"url": url}


PUBLIC_FIELDS = ("name", "projectName", "album", "materials", "box", "previews", "notes")


@api.post("/configs/{config_id}/publish")
async def publish(config_id: str, body: dict = {}, user=Depends(current_user)):
    cfg = await owned_config(config_id, user)
    snapshot = {k: cfg.get(k) for k in PUBLIC_FIELDS}
    snapshot["publishedAt"] = now()
    token = cfg.get("shareToken") if cfg.get("shareToken") and not cfg.get("shareRevoked") else secrets.token_urlsafe(32)
    days = body.get("expiresInDays")
    expires = (datetime.now(timezone.utc) + timedelta(days=int(days))).isoformat() if days else None
    await db.album_configs.update_one({"id": config_id}, {"$set": {"published": snapshot, "shareToken": token, "shareRevoked": False, "shareExpiresAt": expires, "updatedAt": now()}})
    return {"shareToken": token, "publishedAt": snapshot["publishedAt"], "shareExpiresAt": expires}


@api.post("/configs/{config_id}/revoke")
async def revoke(config_id: str, user=Depends(current_user)):
    await owned_config(config_id, user)
    await db.album_configs.update_one({"id": config_id}, {"$set": {"shareRevoked": True, "updatedAt": now()}})
    return {"ok": True}


@api.get("/share/{token}")
async def share(token: str):
    cfg = await db.album_configs.find_one({"shareToken": token}, {"_id": 0})
    if not cfg or cfg.get("shareRevoked") or not cfg.get("published"):
        raise HTTPException(404, "Link non valido o revocato")
    if cfg.get("shareExpiresAt") and datetime.fromisoformat(cfg["shareExpiresAt"]) < datetime.now(timezone.utc):
        raise HTTPException(410, "Link scaduto")
    codes = {c["code"] for c in cfg["published"]["materials"].values() if c}
    variants = await db.material_variants.find({"code": {"$in": list(codes)}}, {"_id": 0}).to_list(50)
    families = await db.material_families.find({}, {"_id": 0}).to_list(100)
    return {**cfg["published"], "variants": variants, "families": families}


# ---------- startup ----------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.album_configs.create_index("shareToken")
    await db.album_configs.create_index("ownerId")
    data = json.load(open(ROOT_DIR / "catalog" / "catalog.json"))
    for f in data["families"]:
        await db.material_families.update_one({"id": f["id"]}, {"$set": f}, upsert=True)
    for v in data["variants"]:
        await db.material_variants.update_one({"code": v["code"]}, {"$set": v}, upsert=True)
    email, pwd = os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": email, "name": "Studio", "role": "admin", "password_hash": hash_password(pwd), "created_at": now()})
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})


@app.on_event("startup")
async def startup():
    await seed()
    try:
        init_storage()
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.mount("/api/assets/catalog", StaticFiles(directory=ROOT_DIR / "catalog" / "assets"), name="catalog-assets")
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o and o != "*"] or ["http://localhost:3000"], allow_origin_regex=r"https://.*\.emergentagent\.com|http://localhost:\d+", allow_methods=["*"], allow_headers=["*"])
