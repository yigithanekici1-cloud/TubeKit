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

import base64
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
    video_format: Optional[str] = ""
    duration: Optional[str] = ""
    tone: Optional[str] = ""
    unique_angle: Optional[str] = ""
    cta: Optional[str] = ""
    use_channel_context: Optional[bool] = False


class IdeaRequest(BaseModel):
    niche: str
    language: str = "tr"
    count: int = 6
    reference_urls: Optional[List[str]] = None
    use_channel_context: Optional[bool] = False


class ThumbnailRequest(BaseModel):
    prompt: str
    style: Optional[str] = "vibrant"
    title_text: Optional[str] = ""
    language: str = "tr"
    reference_image: Optional[str] = None
    reference_images: Optional[List[str]] = None
    use_channel_context: Optional[bool] = False


class ChannelProfileIn(BaseModel):
    description: Optional[str] = ""
    url: Optional[str] = ""
    name: Optional[str] = ""  # P3: optional channel name


class AutoProfilePatch(BaseModel):
    tone: Optional[str] = None
    audience: Optional[str] = None
    title_pattern: Optional[str] = None
    color_palette: Optional[str] = None
    themes: Optional[List[str]] = None
    summary: Optional[str] = None


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


async def fetch_channel_page(url: str) -> dict:
    """Scrape a YouTube channel page for basic meta + channel_id."""
    out = {"url": url, "title": "", "description": "", "channel_id": ""}
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as c:
            r = await c.get(url)
            if r.status_code == 200:
                html = r.text
                m1 = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', html)
                m2 = re.search(r'<meta\s+(?:property="og:description"|name="description")\s+content="([^"]+)"', html)
                m3 = re.search(r'"channelId":"(UC[\w-]{20,})"', html) or re.search(r'<meta\s+itemprop="(?:channelId|identifier)"\s+content="(UC[\w-]{20,})"', html)
                if m1:
                    out["title"] = m1.group(1)
                if m2:
                    out["description"] = m2.group(1)
                if m3:
                    out["channel_id"] = m3.group(1)
    except Exception:
        logger.exception("channel page scrape failed for %s", url)
    return out


async def fetch_channel_recent_videos(channel_id: str, limit: int = 10) -> List[dict]:
    """Fetch recent videos via YouTube RSS feed (no API key required)."""
    items: List[dict] = []
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as c:
            r = await c.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
            if r.status_code == 200:
                xml = r.text
                # entries: extract title + media:thumbnail url + published
                entries = re.findall(
                    r"<entry>(.*?)</entry>", xml, re.S
                )
                for e in entries[:limit]:
                    t = re.search(r"<title>([^<]+)</title>", e)
                    thumb = re.search(r'<media:thumbnail\s+url="([^"]+)"', e)
                    pub = re.search(r"<published>([^<]+)</published>", e)
                    if t:
                        items.append({
                            "title": t.group(1),
                            "thumbnail": thumb.group(1) if thumb else "",
                            "published": pub.group(1) if pub else "",
                        })
    except Exception:
        logger.exception("rss feed failed for %s", channel_id)
    return items


def _channel_context_block(profile: Optional[dict]) -> str:
    if not profile:
        return ""
    parts = []
    if profile.get("description"):
        parts.append(f"Creator's own description of the channel: {profile['description']}")
    meta = profile.get("meta") or {}
    if meta.get("title"):
        parts.append(f"Channel name: {meta['title']}")
    if meta.get("description"):
        parts.append(f"Channel public description: {meta['description']}")
    auto = profile.get("auto_profile") or {}
    if auto:
        if auto.get("tone"):
            parts.append(f"Detected tone: {auto['tone']}")
        if auto.get("audience"):
            parts.append(f"Detected audience: {auto['audience']}")
        if auto.get("themes"):
            parts.append(f"Recurring themes: {', '.join(auto['themes'])}")
        if auto.get("title_pattern"):
            parts.append(f"Common title pattern: {auto['title_pattern']}")
        if auto.get("color_palette"):
            parts.append(f"Thumbnail color palette: {auto['color_palette']}")
        if auto.get("typography_style"):
            parts.append(f"Thumbnail typography style: {auto['typography_style']}")
        if auto.get("face_presence"):
            parts.append(f"Face/person presence in thumbnails: {auto['face_presence']}")
        if auto.get("composition_pattern"):
            parts.append(f"Recurring thumbnail composition: {auto['composition_pattern']}")
        if auto.get("visual_summary"):
            parts.append(f"Visual style summary: {auto['visual_summary']}")
        if auto.get("recent_titles"):
            parts.append("Recent video titles for reference:\n - " + "\n - ".join(auto["recent_titles"][:10]))
    if profile.get("url"):
        parts.append(f"Channel URL: {profile['url']}")
    if not parts:
        return ""
    return (
        "\n\n[CHANNEL CONTEXT — tailor the output to fit this creator's existing brand, tone, and audience]\n"
        + "\n".join(parts)
    )


async def get_channel_profile(user_id: str) -> Optional[dict]:
    return await db.channel_profiles.find_one({"user_id": user_id})


# ---------------- Channel Profile Routes ----------------
@api.get("/profile/channel")
async def get_profile(user=Depends(get_current_user)):
    prof = await get_channel_profile(user["id"])
    if not prof:
        return {"description": "", "url": "", "meta": None, "auto_profile": None}
    return {
        "description": prof.get("description", ""),
        "url": prof.get("url", ""),
        "name": prof.get("name", ""),
        "meta": prof.get("meta"),
        "auto_profile": prof.get("auto_profile"),
        "updated_at": prof.get("updated_at"),
    }


@api.post("/profile/channel")
async def save_profile(data: ChannelProfileIn, user=Depends(get_current_user)):
    meta = None
    if data.url and data.url.strip():
        meta = await fetch_channel_page(data.url.strip())
    doc = {
        "user_id": user["id"],
        "description": (data.description or "").strip(),
        "url": (data.url or "").strip(),
        "name": (data.name or "").strip(),
        "meta": meta,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.channel_profiles.update_one(
        {"user_id": user["id"]},
        {"$set": doc, "$setOnInsert": {"created_at": doc["updated_at"]}},
        upsert=True,
    )
    return {"ok": True, "meta": meta}


@api.patch("/profile/channel/auto")
async def patch_auto_profile(data: AutoProfilePatch, user=Depends(get_current_user)):
    """P2a: User overrides any auto-profile field manually."""
    prof = await get_channel_profile(user["id"])
    if not prof:
        raise HTTPException(404, "Profil bulunamadı")
    current = prof.get("auto_profile") or {}
    patch = {k: v for k, v in data.model_dump().items() if v is not None}
    current.update(patch)
    current["edited_at"] = datetime.now(timezone.utc).isoformat()
    await db.channel_profiles.update_one(
        {"user_id": user["id"]},
        {"$set": {"auto_profile": current, "updated_at": current["edited_at"]}},
    )
    return {"ok": True, "auto_profile": current}


@api.post("/profile/channel/analyze")
async def analyze_channel(force: bool = False, user=Depends(get_current_user)):
    """Auto-analyze the saved channel URL. Cached for 24h unless force=true."""
    prof = await get_channel_profile(user["id"])
    if not prof or not prof.get("url"):
        raise HTTPException(400, "Önce kanal URL'sini kaydet")

    # P2b: 24h cache
    existing = prof.get("auto_profile") or {}
    if not force and existing.get("analyzed_at"):
        try:
            ts = datetime.fromisoformat(existing["analyzed_at"])
            if (datetime.now(timezone.utc) - ts) < timedelta(hours=72):
                return {"ok": True, "auto_profile": existing, "videos": [], "meta": prof.get("meta"), "cached": True}
        except Exception:
            pass

    meta = prof.get("meta") or await fetch_channel_page(prof["url"])
    channel_id = meta.get("channel_id", "")
    if not channel_id:
        raise HTTPException(400, "Kanal kimliği bulunamadı (URL geçerli bir YouTube kanal sayfası olmalı)")

    videos = await fetch_channel_recent_videos(channel_id, limit=10)
    if not videos:
        raise HTTPException(400, "Bu kanal için son videolar alınamadı")

    titles = [v["title"] for v in videos]

    # Download thumbnails in parallel for multimodal analysis
    thumb_b64_list: List[str] = []
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as c:
        for v in videos:
            if not v.get("thumbnail"):
                continue
            try:
                r = await c.get(v["thumbnail"])
                if r.status_code == 200 and len(r.content) < 800_000:
                    thumb_b64_list.append(base64.b64encode(r.content).decode())
            except Exception:
                pass
            if len(thumb_b64_list) >= 10:
                break

    system = "You are a YouTube channel brand strategist with deep visual design expertise. Respond ONLY with valid JSON."
    visual_section = ""
    if thumb_b64_list:
        visual_section = (
            f"\n\nAlso attached are {len(thumb_b64_list)} thumbnail images from this channel's recent videos. "
            "Analyze the VISUAL fingerprint across them: dominant colors, typography style, "
            "whether faces/people are typically present, composition patterns, and any recurring graphic elements."
        )
    prompt = f"""Analyze this YouTube channel.

Channel name: {meta.get('title','')}
Public description: {meta.get('description','')}

Recent video titles:
{chr(10).join('- ' + t for t in titles)}{visual_section}

Return ONLY this JSON shape (no markdown):
{{
  "tone": "one short phrase",
  "audience": "one short phrase",
  "themes": ["theme1","theme2","theme3","theme4"],
  "title_pattern": "the recurring formula in one sentence",
  "color_palette": "specific dominant colors from the actual thumbnails (e.g. 'deep navy + neon orange accents, white text')",
  "typography_style": "describe the text style on thumbnails (e.g. 'bold sans-serif, all caps, heavy outline')",
  "face_presence": "always | usually | sometimes | rarely | never",
  "composition_pattern": "describe recurring layout (e.g. 'subject on right, big title left, product object center')",
  "visual_summary": "1-sentence visual style summary that a designer could replicate",
  "summary": "2-sentence overall channel summary"
}}
Use the channel's likely native language for text fields."""

    chat_kwargs = {"text": prompt}
    if thumb_b64_list:
        chat_kwargs["file_contents"] = [ImageContent(b) for b in thumb_b64_list]

    chat = _new_chat(f"channel-{uuid.uuid4()}", system)
    try:
        resp = await chat.send_message(UserMessage(**chat_kwargs))
    except Exception as e:
        logger.exception("channel analyze failed")
        raise HTTPException(500, f"Analiz başarısız: {str(e)[:120]}")
    parsed = _extract_json(resp) or {}
    parsed["recent_titles"] = titles
    parsed["thumbnails_analyzed"] = len(thumb_b64_list)
    parsed["analyzed_at"] = datetime.now(timezone.utc).isoformat()

    await db.channel_profiles.update_one(
        {"user_id": user["id"]},
        {"$set": {"meta": meta, "auto_profile": parsed, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return {
        "ok": True,
        "auto_profile": parsed,
        "videos": videos,
        "meta": meta,
    }


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

    channel_block = ""
    if data.use_channel_context:
        channel_block = _channel_context_block(await get_channel_profile(user["id"]))

    prompt = f"""Generate YouTube SEO assets for a video.

Topic: {data.topic}
Target keywords: {data.keywords or 'auto-detect from topic'}
Audience: {data.audience or 'general'}{advanced_block}{channel_block}

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

    prompt = f"""Brainstorm {count} fresh, click-worthy YouTube video ideas for the niche: {data.niche}.{reference_block}{_channel_context_block(await get_channel_profile(user["id"])) if data.use_channel_context else ""}

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

    channel_hint = ""
    if data.use_channel_context:
        prof = await get_channel_profile(user["id"])
        if prof:
            auto = prof.get("auto_profile") or {}
            visual_bits = []
            if auto.get("visual_summary"):
                visual_bits.append(auto["visual_summary"])
            if auto.get("color_palette"):
                visual_bits.append(f"Use colors: {auto['color_palette']}")
            if auto.get("typography_style"):
                visual_bits.append(f"Title typography: {auto['typography_style']}")
            if auto.get("face_presence") in ("always", "usually"):
                visual_bits.append("Include a face/person prominently — it's a recurring element of this channel")
            elif auto.get("face_presence") == "never":
                visual_bits.append("Do NOT include a face/person — this channel never uses people in thumbnails")
            if auto.get("composition_pattern"):
                visual_bits.append(f"Composition: {auto['composition_pattern']}")
            if visual_bits:
                channel_hint = " The thumbnail must match this creator's visual brand: " + " | ".join(visual_bits) + "."
            else:
                desc = prof.get("description") or ((prof.get("meta") or {}).get("description") or "")
                if desc:
                    channel_hint = f" Match this creator's brand: {desc[:300]}."

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
            f"dramatic contrast, high saturation, sharp focus.{title_part}{channel_hint}"
        )
    elif n == 1:
        final_prompt = (
            f"Use the person/subject from the provided reference image and place them in a new YouTube thumbnail composition. "
            f"Keep the subject's face and identifying features clearly recognizable. "
            f"16:9 widescreen, 1280x720, eye-catching click-worthy design. "
            f"Scene/context: {data.prompt}. Style: {style_desc}. "
            f"Composition: rule of thirds, expressive face, dramatic contrast, high saturation, sharp focus.{title_part}{channel_hint}"
        )
    else:
        final_prompt = (
            f"You are given {n} reference images. Creatively combine and remix elements from ALL of them — "
            f"main subject(s), background, mood, color palette, objects — into ONE new cohesive YouTube thumbnail. "
            f"Keep faces recognizable if people are present. "
            f"16:9 widescreen, 1280x720, eye-catching click-worthy design. "
            f"Scene/context the user wants: {data.prompt}. Style: {style_desc}. "
            f"Composition: rule of thirds, dramatic contrast, high saturation, sharp focus.{title_part}{channel_hint}"
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
