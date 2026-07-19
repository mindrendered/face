# Site Map & Data Flow — Faceless Video Platform

This document defines the application pages, routes, user flows, and the movement of data between the React frontend, Supabase backend, AI gateways, and storage.

---

## 1. Site Map

### 1.1 Page Hierarchy

```mermaid
flowchart TD
    ROOT["/"]
    ROOT --> LANDING["/ Landing Page"]
    ROOT --> AUTH["/auth Auth Page"]

    subgraph "Protected Application"
        DASH["/dashboard Dashboard"]
        CREATE["/create-series Create Series"]
        SERIES["/series My Series"]
        DETAIL["/series/:id Series Detail"]
        STUDIO["/studio AI Studio"]
        SCHEDULE["/schedule Schedule"]
        CONNECTIONS["/connections Connections"]
        ANALYTICS["/analytics Analytics"]
        SETTINGS["/settings Settings"]
        ADMIN["/admin Admin"]
    end

    LANDING -->|Sign in| AUTH
    AUTH -->|Authenticated| DASH
    DASH --> CREATE
    DASH --> SERIES
    DASH --> DETAIL
    DASH --> STUDIO
    DASH --> SCHEDULE
    DASH --> CONNECTIONS
    DASH --> ANALYTICS
    DASH --> SETTINGS
    DASH --> ADMIN
    SERIES --> DETAIL
    DETAIL --> STUDIO
```

### 1.2 Route Reference

| Route | Page | Visibility | Purpose |
|-------|------|------------|---------|
| `/` | `LandingPage` | Public | Marketing / product overview |
| `/auth` | `AuthPage` | Public | Sign up / sign in (Supabase Auth) |
| `/dashboard` | `DashboardPage` | Protected | Overview stats, active series, recent videos |
| `/create-series` | `CreateSeriesPage` | Protected | Multi-step series creation wizard |
| `/series` | `SeriesPage` | Protected | List, pause/resume, archive series |
| `/series/:id` | `SeriesDetailPage` | Protected | Generate videos, view series videos, delete videos, toggle auto-posting |
| `/studio` | `StudioPage` | Protected | AI Studio for ad-hoc video/image generation |
| `/schedule` | `SchedulePage` | Protected | Per-series posting schedule + 30-day calendar |
| `/connections` | `ConnectionsPage` | Protected | Connect Instagram / YouTube accounts |
| `/analytics` | `AnalyticsPage` | Protected | View growth metrics and engagement charts |
| `/settings` | `SettingsPage` | Protected | User profile and account settings |
| `/admin` | `AdminPage` | Protected (admin only) | Platform settings and admin controls |

---

## 2. Data Flow Overview

### 2.1 High-Level Architecture

```mermaid
flowchart LR
    subgraph "Frontend"
        UI["React + Tailwind + shadcn/ui"]
        CTX["GenerationContext"]
        API["services/api.ts\nservices/generation.ts"]
    end

    subgraph "Supabase"
        AUTH["Auth"]
        PG["Postgres"]
        EF["Edge Functions"]
        STG["Storage\ngenerated-media"]
    end

    subgraph "AI Gateways"
        LLM["generate-script\nGemini LLM"]
        VID["kling-omni-video-*\nKling AI Video"]
        IMG["image-generation-*\nImage Generation"]
    end

    subgraph "External Platforms"
        IG["Instagram"]
        YT["YouTube"]
    end

    UI -->|Supabase client| AUTH
    UI -->|CRUD| PG
    UI -->|invoke| EF
    EF -->|proxy| LLM
    EF -->|proxy| VID
    EF -->|proxy| IMG
    VID -->|MP4 URL| STG
    IMG -->|Image URL| STG
    PG -->|reads/writes| STG
    PG -->|scheduled posts| IG
    PG -->|scheduled posts| YT
    CTX -.->|polls status| EF
    API -.->|queries| PG
```

---

## 3. User Flows & Data Flows

### 3.1 Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as AuthPage
    participant S as Supabase Auth
    participant P as profiles

    U->>F: Enter email / password
    F->>S: signInWithPassword / signUp
    S->>P: Trigger handle_new_user()
    P-->>S: Profile created
    S-->>F: Session + user object
    F->>F: Store session in AuthContext
    F->>U: Redirect to /dashboard
```

### 3.2 Create Series Flow

```mermaid
sequenceDiagram
    participant U as User
    participant P as CreateSeriesPage
    participant A as seriesApi
    participant DB as series table

    U->>P: Select language, niche, style, schedule
    P->>P: Validate steps
    U->>P: Click Create series
    P->>A: seriesApi.create(payload)
    A->>DB: INSERT INTO series
    DB-->>A: New series row
    A-->>P: Series object
    P->>U: Redirect to /series
```

### 3.3 Generate Video Flow

```mermaid
sequenceDiagram
    participant U as User
    participant D as SeriesDetailPage
    participant G as generationApi
    participant GS as generate-script Edge Function
    participant LLM as Gemini LLM
    participant VA as videosApi
    participant DB as videos table
    participant KS as kling-omni-video-submit
    participant K as Kling AI
    participant C as GenerationContext
    participant KQ as kling-omni-video-query

    U->>D: Click Generate video
    D->>G: generateScript({niche, language, visual_style})
    G->>GS: Invoke Edge Function
    GS->>LLM: Send structured prompt
    LLM-->>GS: JSON {title, script, video_prompt}
    GS-->>G: ScriptResult
    G-->>D: Script data
    D->>VA: videosApi.create({series_id, title})
    VA->>DB: INSERT video (status='queued')
    DB-->>VA: Video row
    D->>G: submitVideo({prompt, duration, external_task_id})
    G->>KS: Invoke Edge Function
    KS->>K: Submit prompt + 5s/10s duration
    K-->>KS: task_id
    KS-->>G: {task_id, task_status}
    D->>C: startJob({videoId, seriesId, taskId})
    loop Poll every 12s
        C->>KQ: Query task status
        KQ->>K: GET task
        K-->>KQ: task_status + result URL
        KQ-->>C: Status update
        alt succeed
            C->>DB: UPDATE video_url, status='ready'
        else failed
            C->>DB: UPDATE status='failed', error_message
        end
    end
    C->>D: Refresh video list on completion
```

### 3.4 AI Studio Flow

```mermaid
sequenceDiagram
    participant U as User
    participant S as StudioPage / AIStudio
    participant EF as Edge Functions
    participant K as Kling AI / Image API
    participant DB as videos table

    U->>S: Select preset or type prompt
    U->>S: Choose aspect ratio / duration
    U->>S: Click Generate
    S->>EF: Invoke video/image function
    EF->>K: Submit prompt
    K-->>EF: task_id
    S->>S: Poll for result
    K-->>S: Result URL
    alt Save to series selected
        S->>DB: INSERT video row (status='ready')
    end
    S->>U: Show preview + download
```

### 3.5 Delete Video Flow

```mermaid
sequenceDiagram
    participant U as User
    participant D as SeriesDetailPage
    participant VA as videosApi
    participant DB as videos table

    U->>D: Click Delete on video card
    D->>D: Show confirmation dialog
    U->>D: Confirm delete
    D->>VA: videosApi.delete(videoId)
    VA->>DB: DELETE FROM videos WHERE id = ?
    DB-->>VA: Success
    VA-->>D: Confirmation
    D->>D: Remove card from UI
```

### 3.6 Schedule Flow

```mermaid
sequenceDiagram
    participant U as User
    participant S as SchedulePage
    participant A as seriesApi
    participant DB as series table

    U->>S: Change frequency / time / posting days
    S->>A: seriesApi.update(seriesId, {field, value})
    A->>DB: UPDATE series
    DB-->>A: Success
    A-->>S: Updated row
    S->>S: Re-render calendar
```

### 3.7 Connections Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as ConnectionsPage
    participant A as connectionsApi / credentialsApi
    participant DB as social_connections / social_credentials

    U->>C: Click Connect Instagram / YouTube
    C->>A: Start OAuth / upsert connection
    A->>DB: INSERT/UPDATE connection + credentials
    DB-->>A: Saved row
    A-->>C: Connection list
    C->>U: Show connected account
```

---

## 4. Data Sources per Page

| Page | Reads From | Writes To | Key Interactions |
|------|------------|-----------|------------------|
| Dashboard | `profiles`, `series`, `videos`, `social_connections` | `analytics` (demo seed) | Stats cards, recent videos, active series |
| Create Series | constants/types | `series` | Multi-step form |
| My Series | `series` | `series` (status update, archive) | List + actions |
| Series Detail | `series`, `videos` | `videos`, `series` (auto-post toggle) | Generate, preview, delete, retry |
| AI Studio | `series` (selector) | `videos` (optional save) | Edge function video/image generation |
| Schedule | `series`, `scheduled_posts` | `series`, `scheduled_posts` | Calendar + posting settings |
| Connections | `social_connections` | `social_connections`, `social_credentials` | OAuth linking |
| Analytics | `analytics` | — | Charts and metrics |
| Settings | `profiles` | `profiles` | Profile update |
| Admin | `platform_settings`, `profiles` | `platform_settings` | Admin-only configuration |

---

## 5. Edge Function Call Map

| Edge Function | Called From | Purpose | Upstream |
|---------------|-------------|---------|----------|
| `generate-script` | `SeriesDetailPage`, `services/generation.ts` | Create title, script, and cinematic video prompt | Gemini LLM gateway |
| `kling-omni-video-submit` | `SeriesDetailPage`, `AIStudio` | Submit video prompt and receive task ID | Kling AI |
| `kling-omni-video-query` | `GenerationContext`, `AIStudio` | Poll task status and fetch result URL | Kling AI |
| `image-generation-submit` | `AIStudio` | Submit image prompt | Image generation gateway |
| `image-generation-query` | `AIStudio` | Poll image task status | Image generation gateway |
| `large-language-model` | (generic) | Generic LLM passthrough | Gemini LLM gateway |

---

## 6. Background Job Architecture

`GenerationContext` maintains an in-memory list of generation jobs and polls the upstream every 12 seconds.

```mermaid
flowchart TD
    A[startJob] --> B["Add job to state\nstatus=generating\nprogress=10"]
    B --> C[setInterval 12s]
    C --> D[Query kling-omni-video-query]
    D --> E{task_status}
    E -->|submitted / processing| F[Update progress + stage]
    F --> C
    E -->|succeed| G[Update video_url + status=ready]
    G --> H[Stop polling]
    E -->|failed| I[Update status=failed + error_message]
    I --> H
    H --> J[Refresh video list]
```

---

## 7. Notable Data Rules

- **Language enforcement:** `generate-script` instructs the LLM to produce `title`, `script`, and `keywords` in the series language; `video_prompt` is always in English for the Kling AI model.
- **Duration clamping:** Only `5` and `10` second durations are accepted by Kling; invalid values are clamped server-side.
- **RLS:** All tables use Row Level Security; users can only access their own records except for public storage reads and admin-managed `platform_settings`.
- **Cascade deletes:** Deleting a profile cascades to `series`, `videos`, `social_connections`, etc. Deleting a series cascades to its videos. Deleting a video sets related `scheduled_posts.video_id` to `NULL`.
