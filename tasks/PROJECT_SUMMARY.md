# Project Summary — AI-Powered Faceless Video Automation Platform

## 1. Overview
This is a React + Supabase web application that helps solo creators build and run faceless Instagram Reels and YouTube Shorts channels. Users define a content series (niche, language, visual style, voice, music, captions, posting schedule), then generate AI-written scripts, AI-generated video clips, thumbnails, and schedule posts — all from one dashboard.

## 2. Business Goal
Lower the barrier to consistent, monetisable short-form content creation by automating script writing, video generation, and publishing workflows for faceless channels.

## 3. Target Users
- Solo creators and side-hustle entrepreneurs building faceless content channels.
- Influencer-agency operators managing multiple series/niches.
- Non-technical users who need a guided, step-by-step workflow.

## 4. Core Modules

### 4.1 Authentication & Profiles
- Supabase Auth (email/password or OAuth) with profile extension.
- Profiles store plan tier, video usage, and admin flag.
- Three subscription tiers: Beginner, Daily, Pro.

### 4.2 Series Management
- Create a content series with niche, language, visual style, voice, music style, caption style, and posting schedule.
- List, archive, pause/resume, and view series details.
- Supported languages include English, Malayalam, Spanish, French, Portuguese, German, Italian, Dutch, Polish, Japanese, and Korean.

### 4.3 AI Video Generation
- `generate-script` Edge Function uses a large language model to write hook-value-CTA scripts and a cinematic English video prompt.
- Script and captions are enforced to the series language (English or Malayalam).
- `kling-omni-video-submit` Edge Function submits prompts to Kling AI for 9:16 video generation.
- Background polling (`GenerationContext`) tracks generation progress and updates the video record when ready.
- Valid durations: 5 or 10 seconds; invalid values are clamped by the edge function.

### 4.4 AI Image Generation
- `image-generation-submit` Edge Function creates thumbnails, covers, banners, and backgrounds.
- Preset prompt library inside `AIStudio.tsx` for one-click high-quality outputs.

### 4.5 AI Studio
- Standalone `/studio` page for ad-hoc video and image generation.
- Series selector lets users auto-save generated media to an existing series.
- Preset prompts, aspect-ratio controls, and duration selector.

### 4.6 Scheduling & Posting
- Per-series posting frequency, post time, and posting days.
- Calendar view of upcoming 30 days.
- Auto-posting toggle on the series detail page.
- Scheduled posts table links videos to platforms and times.

### 4.7 Social Connections
- Connect Instagram and YouTube accounts.
- Store tokens and account metadata in `social_credentials`.
- Disconnect or delete connections.

### 4.8 Analytics
- Dashboard stats: videos generated, ready to post, scheduled, connected accounts.
- Daily snapshots of views, followers, engagement, likes, comments, shares, watch hours.
- Demo data seeding for first-time users.

### 4.9 Admin
- Admin flag on profiles.
- `platform_settings` table for plans, pricing, timeouts, supported languages, and maintenance mode.

## 5. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite (rolldown-vite), React Router v7 |
| Styling | Tailwind CSS, shadcn/ui components, Radix UI primitives |
| State | React hooks + `GenerationContext` for background job tracking |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, Realtime) |
| AI/ML | Kling AI Omni Video, image generation gateway, Gemini LLM gateway |
| Linting | Biome, custom `tsgo` + Tailwind build checks |

## 6. Database Schema (key tables)
- `profiles` — extends `auth.users`, stores plan, usage, admin flag.
- `series` — content series configuration and schedule.
- `videos` — generated videos, scripts, URLs, status, progress, errors.
- `social_connections` / `social_credentials` — platform account linking.
- `analytics` — daily platform metrics.
- `scheduled_posts` — planned posts linking series, video, platform, and time.
- `notifications` — user alerts for ready/failed videos and posts.
- `platform_settings` — global admin-managed configuration.

## 7. Edge Functions
- `generate-script` — LLM script + video prompt generation.
- `kling-omni-video-submit` — submit video prompt to Kling AI.
- `kling-omni-video-query` — poll task status and fetch result URL.
- `image-generation-submit` — submit image prompt.
- `image-generation-query` — poll image task status.
- `large-language-model` — generic LLM passthrough.

## 8. Recent Changes (v9)
- Added **Delete** action for videos in the series detail view with confirmation dialog.
- Added **Malayalam** to supported languages.
- Enforced language rule in `generate-script`: all script text and captions must be in the selected language (English or Malayalam script).
- Clamped Kling video duration to API-valid values (5s / 10s).

## 9. Constraints & Notes
- Only 5s and 10s video durations are accepted by the Kling Omni API; 15s is rejected.
- Generated text overlays are controlled by the language setting; English prompts are always used for the AI video model itself.
- Deleting a video removes the database record but does not currently delete the underlying file in Supabase Storage.

## 10. Next Suggested Improvements
- Bulk delete for series video lists.
- Language preview before generation.
- Add Tamil / Hindi language support.
- Storage cleanup when videos are deleted.
- Publish engine implementation to complete auto-posting loop.
