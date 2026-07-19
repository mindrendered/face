# Standard Operating Procedure — AI Faceless Video Platform

This document provides step-by-step instructions for the most common workflows in the platform.

---

## Table of Contents

1. [Creating a Content Series](#1-creating-a-content-series)
2. [Generating a Video from a Series](#2-generating-a-video-from-a-series)
3. [Previewing and Downloading a Video](#3-previewing-and-downloading-a-video)
4. [Deleting an Unwanted Video](#4-deleting-an-unwanted-video)
5. [Using AI Studio for Ad-Hoc Generation](#5-using-ai-studio-for-ad-hoc-generation)
6. [Saving AI Studio Output to a Series](#6-saving-ai-studio-output-to-a-series)
7. [Scheduling Posts](#7-scheduling-posts)
8. [Connecting a Social Account](#8-connecting-a-social-account)
9. [Configuring Language (English / Malayalam)](#9-configuring-language-english--malayalam)
10. [Monitoring Background Generation](#10-monitoring-background-generation)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Creating a Content Series

### Purpose
Define a recurring content theme so the platform can generate consistent scripts, visuals, and captions.

### Steps

1. Log in and open **Dashboard**.
2. Click **New series** or navigate to **My series → New series**.
3. On **Step 1 — Pick your niche**:
   - Select the **Language** for narration and captions (English, Malayalam, etc.).
   - Pick a **Niche** from the list or enter a custom niche.
   - Click **Continue**.
4. On **Step 2 — Style your series**:
   - Choose **Visual style** (Cinematic, Minimalist, Dark & Dramatic, etc.).
   - Choose **Narrating voice**, **Music style**, and **Caption style**.
   - Set the **Series name**.
   - Click **Continue**.
5. On **Step 3 — Posting schedule**:
   - Select **Posting frequency**: Beginner (3×/week), Daily, or Pro.
   - Pick **Posting days**.
   - Pick **Post time** from the presets or enter a custom time.
6. Review the summary and click **Create series**.

### Expected Result
A new series card appears in **My series** with status **active**.

### Quality Check
- The language shown on the series card matches your selection.
- The niche and custom niche are not both empty.

---

## 2. Generating a Video from a Series

### Purpose
Produce a complete AI-generated Short/Reel tied to a series.

### Steps

1. Open **My series** and click a series card (or **View videos**).
2. On the series detail page, click **Generate video**.
3. The platform:
   - Calls the `generate-script` Edge Function to write a hook-value-CTA script.
   - Creates a `videos` record with status `generating_video`.
   - Submits the cinematic prompt to Kling AI.
   - Starts background polling via `GenerationContext`.
4. Wait for the generation card to show **Complete**.

### Expected Result
A new video entry appears in the series video list with status **Ready**.

### Quality Check
- Script text should be in the selected language.
- The video duration is 5s or 10s (API-valid values).

---

## 3. Previewing and Downloading a Video

### Steps

1. In the series video list, click **Preview** on a ready video.
2. The preview modal opens with the video player and script.
3. To watch in a new tab, click **Watch in browser**.
4. To save locally, click **Download MP4**.

### Expected Result
The MP4 file downloads or plays from its public URL.

---

## 4. Deleting an Unwanted Video

### Purpose
Remove generated videos that are not needed, freeing up the series list and dashboard counts.

### Steps

1. Go to the series detail page containing the video.
2. Find the video card and click **Delete**.
3. A confirmation dialog shows the video title.
4. Click **Delete** to confirm, or **Cancel** to keep the video.

### Expected Result
- The video card disappears from the list.
- Dashboard counts update on the next load.

### Note
Deleting the record does **not** currently remove the underlying file from Supabase Storage. Storage cleanup may be added later.

---

## 5. Using AI Studio for Ad-Hoc Generation

### Purpose
Create one-off videos or images without setting up a full series.

### Steps

1. Navigate to **AI Studio** from the sidebar.
2. Choose the **Video** or **Image** tab.
3. Select a preset prompt chip or type your own prompt.
4. For video:
   - Choose **Aspect ratio** (9:16 recommended for Shorts/Reels).
   - Choose **Duration** (5s or 10s).
5. Click **Generate**.
6. Watch the progress card until status shows **Complete**.

### Expected Result
A generated video or image URL appears with download and **New** actions.

---

## 6. Saving AI Studio Output to a Series

### Steps

1. In AI Studio, before generating, open the **Save to series** selector.
2. Pick an existing series (or leave as **None** for a standalone result).
3. Generate the video/image as normal.
4. On success, a toast confirms the media was saved to the series and provides a **View series** link.

### Expected Result
The generated asset appears in the selected series’ video list with status **Ready**.

---

## 7. Scheduling Posts

### Purpose
Plan when ready videos will be published.

### Steps

1. Navigate to **Schedule**.
2. For each series, set:
   - **Frequency** (3× per week / Daily / Max output).
   - **Post time**.
   - **Posting days** by toggling Mon–Sun buttons.
3. Changes save automatically; a spinner indicates the save is in progress.
4. Use the 30-day calendar to review upcoming slots.
5. Filter the calendar by series if needed.

### Expected Result
Posting settings persist and upcoming slots appear on the calendar.

### Note
The current scheduling UI stores the plan. Full automatic publishing to social platforms requires additional OAuth/posting engine integration.

---

## 8. Connecting a Social Account

### Purpose
Prepare the platform to post on your behalf.

### Steps

1. Go to **Connections**.
2. Click **Connect Instagram** or **Connect YouTube**.
3. Complete the OAuth flow.
4. The connected account appears in the list with status **Connected**.

### Expected Result
The account is stored in `social_connections` and `social_credentials` with a valid access token.

---

## 9. Configuring Language (English / Malayalam)

### Purpose
Ensure all generated narration, on-screen text, and captions are readable in the target language.

### Steps

1. When creating a series, select **English** or **Malayalam** in **Step 1**.
2. Generate a video from the series.
3. Open the video preview and inspect the **Script** section.

### Expected Result
- If **English** is selected, all script text, captions, and CTAs are in English.
- If **Malayalam** is selected, all script text, captions, and CTAs are in Malayalam script (മലയാളം).

### Quality Check
- The script must not contain mixed languages.
- The `video_prompt` field is always in English because the AI video model uses English prompts, but it includes a note to render Malayalam on-screen text when applicable.

---

## 10. Monitoring Background Generation

### Steps

1. After clicking **Generate video**, a background job card appears on the series detail page.
2. The card shows the number of active jobs, current stage, and progress percentage.
3. You can navigate away; polling continues.
4. When a job completes or fails, the video list refreshes automatically.

### Expected Result
The video status changes from `Generating video` → `Ready` or `Failed`.

---

## 11. Troubleshooting

### Video generation failed
- Check the **error_message** in the video preview/details.
- Retry the video by clicking **Retry** on a failed card.
- Verify the series language and niche are valid.

### Language is wrong in the script
- Confirm the series **Language** setting is correct.
- The `generate-script` Edge Function enforces the selected language; re-deploy it if changes were made.

### “Duration value invalid” error
- Ensure the selected duration is **5** or **10** seconds. The frontend and edge function clamp invalid values, but direct API calls should not send 15.

### Delete button does nothing
- Confirm the video is not currently in a generating state.
- Check the browser console for Supabase RLS errors; verify the user owns the video.

### Background job stuck
- Background polling runs every 12 seconds for up to several minutes.
- If the Kling task times out, the status will eventually update to **Failed**.
- Refresh the page to force a fresh state.

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-08 | Platform AI | Initial SOP covering series creation, generation, deletion, scheduling, and language setup. |
