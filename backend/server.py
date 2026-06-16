from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import httpx
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

# ---------------- Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI(title="TubeKit API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tubekit")


# ---------------- Helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str, email: str, expires_minutes: int = 60 * 24 * 7) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = None
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(401, "User not found")
        user["id"] = str(user["_id"])
        del user["_id"]
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SEORequest(BaseModel):
    topic: str
    keywords: Optional[str] = ""
    audience: Optional[str] = ""
    language: str = "tr"
    # Optional advanced fields for more precise output
    video_format: Optional[str] = ""  # tutorial / vlog / review / story...
    duration: Optional[str] = ""  # short / 5-10 min / 15-30 min / long
    tone: Optional[str] = ""  # casual / energetic / educational / dramatic
    unique_angle: Optional[str] = ""  # what makes this video different
    cta: Optional[str] = ""  # specific call to action


class IdeaRequest(BaseModel):
    niche: str
    language: str = "tr"
    count: int = 6
    reference_urls: Optional[List[str]] = None  # YouTube video URLs to analyze


class ThumbnailRequest(BaseModel):
    prompt: str
    style: Optional[str] = "vibrant"
    title_text: Optional[str] = ""
    language: str = "tr"
    reference_image: Optional[str] = None  # legacy single (kept for back-compat)
    reference_images: Optional[List[str]] = None  # up to 3 base64/data URLs


class ThumbnailSave(BaseModel):
    image_data: str
    title: Optional[str] = ""
    source: str = "editor"


# ---------------- Auth Routes ----------------
@api.post("/auth/register")
async def register(data: RegisterIn):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Bu e-posta zaten kayıtlı")
    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name or email.split("@")[0],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    token = create_token(str(res.inserted_id), email)
    return {"token": token, "user": {"id": str(res.inserted_id), "email": email, "name": doc["name"]}}


@api.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Geçersiz e-posta veya şifre")
    token = create_token(str(user["_id"]), email)
    return {"token": token, "user": {"id": str(user["_id"]), "email": email, "name": user.get("name", "")}}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------------- LLM Helpers ----------------
def _new_chat(session_id: str, system: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("gemini", "gemini-2.5-flash")


def _extract_json(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass
    return None


# ---------------- YouTube helper ----------------
async def fetch_youtube_info(url: str) -> Optional[dict]:
    """Fetch title/author/thumbnail via YouTube oEmbed (no API key required)."""
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as c:
            r = await c.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"})
            if r.status_code == 200:
                d = r.json()
                return {
                    "title": d.get("title", ""),
                    "author": d.get("author_name", ""),
                    "thumbnail": d.get("thumbnail_url", ""),
                    "url": url,
                }
    except Exception:
        logger.exception("oembed failed for %s", url)
    return None


# ---------------- SEO Routes ----------------
@api.post("/seo/generate")
async def seo_generate(data: SEORequest, user=Depends(get_current_user)):
    lang = "Turkish" if data.language == "tr" else "English"
    system = f"You are an expert YouTube SEO strategist. Respond ONLY with valid JSON. Output language: {lang}."

    advanced_lines = []
    if data.video_format:
        advanced_lines.append(f"Video format: {data.video_format}")
    if data.duration:
        advanced_lines.append(f"Approx duration: {data.duration}")
    if data.tone:
        advanced_lines.append(f"Tone of voice: {data.tone}")
    if data.unique_angle:
        advanced_lines.append(f"Unique angle / what makes this video different: {data.unique_angle}")
    if data.cta:
        advanced_lines.append(f"Desired call-to-action: {data.cta}")
    advanced_block = ("\n" + "\n".join(advanced_lines)) if advanced_lines else ""

    prompt = f"""Generate YouTube SEO assets for a video.

Topic: {data.topic}
Target keywords: {data.keywords or 'auto-detect from topic'}
Audience: {data.audience or 'general'}{advanced_block}

Use ALL of the optional fields above to make the titles and description more precise and on-target. The titles must reflect the format and tone. The description must weave in the unique angle and end with the specific CTA if provided.

Return ONLY this JSON shape (no markdown, no commentary):
{{
  "titles": ["title 1 max 60 chars", "title 2", "title 3", "title 4", "title 5"],
  "description": "Engaging 3-paragraph YouTube description with hooks, value, and CTA. End with relevant hashtags on a new line.",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10"],
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"]
}}
All text fields must be in {lang}.
"""
    chat = _new_chat(f"seo-{uuid.uuid4()}", system)
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("seo gen failed")
        raise HTTPException(500, f"SEO üretimi başarısız: {str(e)[:120]}")
    parsed = _extract_json(resp)
    if not parsed:
        raise HTTPException(500, "Üretim başarısız oldu, tekrar deneyin")

    doc = {
        "user_id": user["id"], "type": "seo", "topic": data.topic,
        "language": data.language, "result": parsed,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.history.insert_one(doc)
    return {"id": str(res.inserted_id), **parsed}


# ---------------- Idea Routes ----------------
@api.post("/ideas/generate")
async def ideas_generate(data: IdeaRequest, user=Depends(get_current_user)):
    lang = "Turkish" if data.language == "tr" else "English"
    system = f"You are a viral YouTube content strategist. Respond ONLY with valid JSON. Output language: {lang}."
    count = max(3, min(data.count, 10))

    # Fetch metadata for any reference YouTube URLs
    reference_block = ""
    fetched_refs = []
    if data.reference_urls:
        clean_urls = [u.strip() for u in data.reference_urls if u and u.strip()][:5]
        for u in clean_urls:
            info = await fetch_youtube_info(u)
            if info:
                fetched_refs.append(info)
        if fetched_refs:
            lines = [f"- \"{r['title']}\" by {r['author']}" for r in fetched_refs]
            reference_block = (
                "\n\nReference videos the user wants similar ideas to. Analyze their titles, formats, and angles, then propose ideas in the SAME spirit but FRESH (not duplicates):\n"
                + "\n".join(lines)
            )

    prompt = f"""Brainstorm {count} fresh, click-worthy YouTube video ideas for the niche: {data.niche}.{reference_block}

Return ONLY this JSON shape:
{{
  "ideas": [
    {{
      "title": "catchy video title",
      "hook": "one-line hook explaining the angle",
      "format": "tutorial | vlog | list | story | experiment | review",
      "estimated_views": "low | medium | high"
    }}
  ]
}}
All text in {lang}. Generate exactly {count} ideas.
"""
    chat = _new_chat(f"ideas-{uuid.uuid4()}", system)
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("ideas gen failed")
        raise HTTPException(500, f"Fikir üretimi başarısız: {str(e)[:120]}")
    parsed = _extract_json(resp)
    if not parsed or "ideas" not in parsed:
        raise HTTPException(500, "Fikir üretimi başarısız oldu")

    doc = {
        "user_id": user["id"], "type": "ideas", "niche": data.niche,
        "language": data.language, "result": parsed,
        "references": fetched_refs,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.history.insert_one(doc)
    return {"id": str(res.inserted_id), "ideas": parsed["ideas"], "references": fetched_refs}


# ---------------- Thumbnail Routes ----------------
@api.post("/thumbnail/generate")
async def thumbnail_generate(data: ThumbnailRequest, user=Depends(get_current_user)):
    style_map = {
        "vibrant": "bold vibrant colors, high contrast, cinematic lighting",
        "minimal": "minimalist clean design, lots of negative space, modern",
        "dramatic": "dramatic dark cinematic lighting, moody atmosphere, film noir",
        "tech": "futuristic neon tech aesthetic, glowing accents, sci-fi",
        "lifestyle": "warm natural lighting, lifestyle photography, cozy",
    }
    style_desc = style_map.get(data.style, style_map["vibrant"])
    title_part = f' Include the text overlay "{data.title_text}" in bold large impactful typography.' if data.title_text else ""

    # Collect refs from either new multi field or legacy single field
    refs_raw: List[str] = []
    if data.reference_images:
        refs_raw.extend([r for r in data.reference_images if r])
    if data.reference_image:
        refs_raw.append(data.reference_image)
    refs_raw = refs_raw[:3]  # hard cap at 3

    # Normalize: strip data: prefix
    refs_clean: List[str] = []
    for r in refs_raw:
        refs_clean.append(r.split(",", 1)[-1] if r.startswith("data:") else r)

    n = len(refs_clean)
    if n == 0:
        final_prompt = (
            f"YouTube thumbnail, 16:9 widescreen aspect ratio, 1280x720, "
            f"eye-catching click-worthy design. Subject: {data.prompt}. "
            f"Style: {style_desc}. Composition: rule of thirds, expressive face if person, "
            f"dramatic contrast, high saturation, sharp focus.{title_part}"
        )
    elif n == 1:
        final_prompt = (
            f"Use the person/subject from the provided reference image and place them in a new YouTube thumbnail composition. "
            f"Keep the subject's face and identifying features clearly recognizable. "
            f"16:9 widescreen, 1280x720, eye-catching click-worthy design. "
            f"Scene/context: {data.prompt}. Style: {style_desc}. "
            f"Composition: rule of thirds, expressive face, dramatic contrast, high saturation, sharp focus.{title_part}"
        )
    else:
        final_prompt = (
            f"You are given {n} reference images. Creatively combine and remix elements from ALL of them — "
            f"main subject(s), background, mood, color palette, objects — into ONE new cohesive YouTube thumbnail. "
            f"Keep faces recognizable if people are present. "
            f"16:9 widescreen, 1280x720, eye-catching click-worthy design. "
            f"Scene/context the user wants: {data.prompt}. Style: {style_desc}. "
            f"Composition: rule of thirds, dramatic contrast, high saturation, sharp focus.{title_part}"
        )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"thumb-{uuid.uuid4()}",
        system_message="You are a YouTube thumbnail designer that produces eye-catching imagery.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    msg_kwargs = {"text": final_prompt}
    if refs_clean:
        msg_kwargs["file_contents"] = [ImageContent(r) for r in refs_clean]

    try:
        text, images = await chat.send_message_multimodal_response(UserMessage(**msg_kwargs))
    except Exception as e:
        logger.exception("thumbnail gen failed")
        raise HTTPException(500, f"Görsel üretimi başarısız: {str(e)[:120]}")

    if not images:
        raise HTTPException(500, "Görsel üretilemedi")

    img = images[0]
    image_b64 = img["data"]
    mime = img.get("mime_type", "image/png")

    doc = {
        "user_id": user["id"], "type": "thumbnail", "source": "ai",
        "prompt": data.prompt, "title": data.title_text or "",
        "image_data": image_b64, "mime_type": mime,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.thumbnails.insert_one(doc)
    return {
        "id": str(res.inserted_id),
        "image": f"data:{mime};base64,{image_b64}",
        "prompt": data.prompt,
    }


@api.post("/thumbnail/save")
async def thumbnail_save(data: ThumbnailSave, user=Depends(get_current_user)):
    img_data = data.image_data
    if img_data.startswith("data:"):
        img_data = img_data.split(",", 1)[-1]
    doc = {
        "user_id": user["id"], "type": "thumbnail", "source": data.source,
        "title": data.title, "image_data": img_data, "mime_type": "image/png",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.thumbnails.insert_one(doc)
    return {"id": str(res.inserted_id), "ok": True}


@api.get("/thumbnail/list")
async def thumbnail_list(user=Depends(get_current_user)):
    cursor = db.thumbnails.find({"user_id": user["id"]}).sort("created_at", -1).limit(50)
    items = []
    async for d in cursor:
        items.append({
            "id": str(d["_id"]),
            "title": d.get("title", ""),
            "source": d.get("source", "ai"),
            "image": f"data:{d.get('mime_type','image/png')};base64,{d['image_data']}",
            "created_at": d["created_at"],
        })
    return {"items": items}


@api.get("/history/list")
async def history_list(user=Depends(get_current_user)):
    cursor = db.history.find({"user_id": user["id"]}).sort("created_at", -1).limit(50)
    items = []
    async for d in cursor:
        items.append({
            "id": str(d["_id"]),
            "type": d.get("type"),
            "topic": d.get("topic") or d.get("niche", ""),
            "language": d.get("language", "tr"),
            "result": d.get("result"),
            "created_at": d.get("created_at"),
        })
    return {"items": items}


@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    thumb_count = await db.thumbnails.count_documents({"user_id": user["id"]})
    seo_count = await db.history.count_documents({"user_id": user["id"], "type": "seo"})
    ideas_count = await db.history.count_documents({"user_id": user["id"], "type": "ideas"})

    recent_thumbs = []
    async for d in db.thumbnails.find({"user_id": user["id"]}).sort("created_at", -1).limit(4):
        recent_thumbs.append({
            "id": str(d["_id"]),
            "title": d.get("title", ""),
            "image": f"data:{d.get('mime_type','image/png')};base64,{d['image_data']}",
            "created_at": d["created_at"],
        })

    recent_hist = []
    async for d in db.history.find({"user_id": user["id"]}).sort("created_at", -1).limit(5):
        recent_hist.append({
            "id": str(d["_id"]),
            "type": d.get("type"),
            "topic": d.get("topic") or d.get("niche", ""),
            "created_at": d.get("created_at"),
        })

    return {
        "thumbnails": thumb_count,
        "seo_drafts": seo_count,
        "idea_sessions": ideas_count,
        "recent_thumbnails": recent_thumbs,
        "recent_history": recent_hist,
    }


@api.get("/")
async def root():
    return {"name": "TubeKit API", "version": "1.0"}


# ---------------- App wiring ----------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@tubekit.app")
    admin_pwd = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_pwd),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin {admin_email}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
