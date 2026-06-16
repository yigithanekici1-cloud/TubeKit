# TubeKit — Product Requirements Document

## Original Problem Statement
"Youtube videolarım için thumbnail tasarımı yapan ve SEO uyumlu başlık ve açıklamalar yazan bir mini app oluştur. Uygulama yukarıda yazdığım tüm yeteneklere sahip olmasının yanında bana içerikler hakkında küçük fikirler de verebilsin." (Turkish)

A creator-tool mini-app for YouTubers: AI thumbnail design + canvas editor, SEO title/description writer, and content idea generator.

## User Personas
- **Solo YouTuber (TR/EN)** — needs fast thumbnails, click-worthy titles, and ideas between recordings.
- **Side-hustle creator** — wants a single dashboard for SEO + visuals without learning Photoshop.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) on port 8001, all routes prefixed with `/api`.
- **Auth:** bcrypt + JWT (HS256), Bearer token via `Authorization` header, stored in localStorage as `tk_token`.
- **LLM:** `emergentintegrations.llm.chat.LlmChat` with `EMERGENT_LLM_KEY`.
  - Text: `gemini-2.5-flash`
  - Image (thumbnails): `gemini-3.1-flash-image-preview` (Nano Banana)
- **Frontend:** React 19 + react-router-dom v7 + Tailwind CSS + sonner toasts.
- **Design:** Dark Swiss / brutalist (Cabinet Grotesk + IBM Plex), red accent `#FF3B30`.

## Core Requirements (Static)
1. Email/password auth (login + register)
2. AI thumbnail generation (16:9)
3. Manual thumbnail canvas editor (upload image, add text overlay, recolor, download)
4. SEO writer: 5 titles + 3-paragraph description + 10 tags + hashtags
5. Idea generator: niche-based, with hook/format/estimated views
6. Turkish + English output toggle (persisted)
7. Per-user history (thumbnails, SEO drafts, idea sessions)

## What's Been Implemented (2026-02)
- [x] JWT auth + admin seeding
- [x] AI thumbnail generation via Nano Banana
- [x] Canvas-based thumbnail editor (upload, text, color, position sliders, download, save)
- [x] SEO writer (titles, description, tags, hashtags) — TR + EN
- [x] Idea generator with viral-potential indicator — TR + EN
- [x] Dashboard with live stats + recent thumbnails + recent activity
- [x] Sidebar layout with TR/EN toggle + logout
- [x] Sonner toast notifications
- [x] Test coverage: 19/19 backend + frontend e2e (iteration_1.json)

## Backlog / Next Tasks
- **P1** — Persist Idea→Studio seed (use `tk_seed_prompt` from sessionStorage in Studio AI panel)
- **P1** — Inline regenerate-single-title button in SEO Writer
- **P2** — Thumbnail variants (3 in one go) + A/B compare
- **P2** — Drag-to-position text on canvas (currently sliders only)
- **P2** — YouTube channel URL import → auto-detect niche
- **P3** — Password reset flow & rate limiting on /auth/login
- **P3** — Per-thumbnail delete + share link
- **P3** — Stripe billing tier (free 10/mo → pro unlimited)
