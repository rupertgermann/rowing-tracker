![Rowing Tracker Header](docs/images/rowing-tracker_header.png)

# Rowing Tracker

An AI-powered web application for tracking rowing workouts with analytics, training plans, motion-capture posture analysis, and achievement tracking. Built for rowers who use SmartRow equipment. This app was completely written by AI.

## Overview

Rowing Tracker is a modern, AI-powered web app built specifically for rowers who use SmartRow equipment. Workouts are imported either via automated SmartRow.fit sync or manual CSV/ZIP upload, and the app turns them into deep analytics, personalized AI training plans, automated coaching insights, and webcam-based posture analysis. Each rower gets a private workspace with data stored in PostgreSQL (local or Supabase) and isolated by authenticated user.

## Features

### 🤖 AI-Powered Intelligence

- **AI Coach with Memory**: Chat with an intelligent rowing coach that remembers your conversation history, analyzes your training data, and references uploaded documents (PDFs, images) to provide personalized advice
- **Organized Conversations**: Filter chat sessions by type (regular chats vs. chart explanations) with visual indicators and quick navigation back to analyzed charts
- **Tool-Enabled Conversations**: The AI can automatically call tools like `get_sessions`, `get_achievements`, and `get_memory_documents` to fetch your workout history, streak progress, awards, and uploaded PDFs/images without you leaving the chat
- **AI Training Plans**: Generate fully personalized, multi-week training programs based on your fitness level, goals, and rowing history—or choose from proven templates
- **AI Performance Insights**: Receive automated, data-driven insights about your workouts, trends, and areas for improvement directly in your dashboard with archive search functionality
- **AI Personal Context**: Write a personal description or select documents from your memory to automatically create a system prompt addition that keeps your health considerations, limitations, and goals in mind across the AI Coach, training plans, and insights
- **Configurable AI System Prompts**: Fine-tune the base system prompt, chat prompt, training plan prompt, and insights prompt from the Settings → Advanced Configuration panel with one-click "reset to default" controls

### 📊 Analytics & Tracking

- **Dashboard**: Comprehensive overview with key metrics, volume charts, and trend analysis
- **Advanced Analytics** (`/analytics`): Detailed breakdown of performance, split trends, stroke rate, consistency score, and training adherence with a uniform legend (teal dot = individual sessions, orange line = 10-session moving average) and synchronized global smoothing controls
- **Insights View** (`/insights`): Dedicated page for browsing, filtering, archiving, and giving feedback (`helpful` / `not_helpful` / `action_taken`) on AI-generated performance insights, with full-text search across the archive
- **Interactive Chart Explanations**: Click "Explain" on any chart (analytics page AND session details) to get AI-powered analysis—explanations are cached server-side via `ChartExplanation`, displayed in tooltips for quick reference, and offer "Back to chart" navigation
- **Time-Range Aware Explanations**: Analytics chart explanations are cached per time range—switching between "Last 7 days" and "Last 30 days" yields separate, context-appropriate AI analyses
- **Structured AI Explanations**: Chart explanations follow a clear format: "Why This Chart Matters" (practical value), "What I See In Your Data" (patterns/trends), and "What This Means For You" (actionable insights)
- **Performance Correlations**: Scatter plots showing relationships between power/pace, stroke rate/pace, duration/distance, energy/duration, with Split Time always-on as a permanent correlation chart
- **Sessions List**: Browse, filter, and sort all your rowing sessions with advanced search
- **Session Details**: Deep dive into individual workout metrics with interactive charts and AI explanations across all analysis modules:
  - *Overview*: Power & Stroke Rate
  - *Performance Graphs*: Pace Analysis, Work per Stroke, Stroke Length, Heart Rate
  - *Segments*: Segment Analysis (100m/500m), Rolling Power Average, Rolling Split Average
  - *Deep Analysis*: Power Distribution, Rhythm Distribution, Rate vs Power, Rate vs Split
- **Stroke-by-Stroke Analysis**: Stroke data parsed from SmartRow detailed CSVs is persisted with each session, unlocking power/rhythm distributions, stroke-length consistency, technique maps, and a pre-computed `consistencyScore` per session
- **Personal Records**: Automatic tracking of best times and performances across all distances

### 🔐 Multi-User & Authentication

- **Secure Authentication**: Email/password login with email verification (double opt-in)
- **Magic Link Login**: Passwordless authentication via email
- **Google OAuth**: Optional sign-in with Google (when configured)
- **User Profiles**: Manage your account, change password, and update profile information
- **Data Isolation**: Each user's data is completely isolated and private

### � Data Import & Sync

- **Automated SmartRow Sync**: One-click sync from `smartrow.fit` directly inside `/sync`. A server-side Playwright session logs in with stored credentials, exports the workouts list (CSV) and the detailed-stroke archive (ZIP), and imports both in a single pass
- **CSV Drag-and-Drop**: Manual upload of any SmartRow CSV (sessions list or detailed stroke export)
- **ZIP Batch Import**: Upload the SmartRow archive ZIP to import many detailed-stroke sessions at once with progress reporting
- **Duplicate-Safe Imports**: Sessions are deduplicated by `(userId, timestamp, distance)`; existing sessions are updated, not duplicated
- **Last-Sync Timestamp**: SmartRow credentials and the most recent sync time are stored in `UserSettings.smartRowSettings`

### 💾 Data & Storage

- **PostgreSQL Database**: Robust, scalable data storage with full ACID compliance via Prisma
- **Local Development**: Docker-based PostgreSQL plus Mailpit for SMTP
- **Cloud Ready**: Supabase (pooler + direct URL) supported for production
- **Memory System**: Upload and store PDFs and images for AI analysis; files are kept on disk (or Vercel Blob in deployed environments) and referenced by `MemoryDocument.filePath`
- **Mocap Storage**: Recorded video and the `PoseFrameStream` binary blob are stored side-by-side on the same backend (local `storage/` directory or Vercel Blob), referenced by `MocapSession.videoStoragePath` and `MocapSession.poseStreamPath`
- **Data Privacy**: Workout data, mocap video, and pose data are scoped by user ID; AI keys are encrypted at rest

### 🎨 User Experience

- **Dark Theme**: Modern, easy-on-the-eyes interface
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Offline-First**: All features work offline except AI-powered capabilities
- **Rich Tooltips**: AI explanations display in beautifully formatted tooltips with markdown rendering, responsive sizing, and smooth scrolling
- **Smart Navigation**: "Back to chart" links from chat explanations navigate directly to the source chart (both analytics and session detail pages) with automatic scroll-to-view

### 🏅 Gamification & Motivation

- **Dynamic Awards System**: Earn achievements for session milestones (First Splash, Century Club, Year of Rowing), total distance (Million Meter Club), streaks, duration, power output, pace improvements, and more
- **Improvement Awards**: Track percentage gains in power (up to +100% Double Power) and pace compared to a baseline computed from the first 3 valid sessions
- **Streak Milestones**: Notifications for 7-, 14-, 21-, 45-, 60-, and 100-day streaks
- **AI Award Suggestions**: The AI proposes custom awards (`AIAwardSuggestion`) with structured criteria; once approved they auto-evaluate against your data
- **Generated Achievement Stories & Art**: Each unlocked award gets an AI-written story and optional generated image (`GeneratedAchievement`), with a configurable `colorPalette` for the artwork
- **Live Award Notifications**: Animated overlays the moment a new achievement unlocks
- **High-Tier Stretch Goals**: Long-term achievements including 750k meters, 1 Million meters, 100 hours rowing, 300W power, and sub-1:35/500m pace

### 🎥 Motion-Capture & Posture Analysis (Mocap)

- **Browser-Based Capture** (`/mocap`): Single-webcam recording with in-browser MediaPipe Pose Landmarker running in a Web Worker. Zero install, no cloud upload of video by default.
- **Side-View Capture Perspectives**: `side-left` or `side-right`. Front-view-only metrics (left/right asymmetry, knee-track deviation) are explicitly marked as `requires-multi-cam` rather than silently estimated.
- **Per-Session Calibration**: Two reference frames captured before recording (catch + finish) establish baselines for the current camera setup. Calibration is stored on the `MocapSession`, not on the user.
- **Pose Frame Stream**: A versioned binary `PoseFrameStream` blob (2D `{x, y, confidence}` keypoints + per-frame quality flags) is appended in chunks via `POST /api/mocap/sessions/:id/pose-stream` and finalized with `POST /api/mocap/sessions/:id/finalize`.
- **Stroke Segmentation**: `pose-segmented` boundaries during live capture; mandatory atomic re-segmentation to `csv-aligned` when a `MocapSession` is linked to a `RowingSession` via cross-correlation against `StrokeData`.
- **v1 Posture Fault Catalog**: Five stroke-granular faults computable from a 2D side view—`rounded_back_at_catch`, `early_arm_bend`, `back_opens_before_legs_drive`, `excessive_layback`, `slow_recovery_ratio`—each with `info` / `warning` / `critical` severity bands.
- **Configurable Thresholds**: Conservative hand-coded defaults (`postureThresholdsV1`) with auto-migration on version bumps; user customization stored in `UserSettings.postureThresholds` is preserved (`userOverridden: true`).
- **Live Coaching Cues**: Post-stroke cues (≤ 1 s after the stroke completes) via the `LiveCoachingEngine`, with optional spoken audio (`speakCue`) and configurable verbosity in `UserSettings.mocapPreferences`.
- **Auto-Link on CSV Import**: When a CSV import produces a `RowingSession` whose timestamp overlaps a `MocapSession` capture window by ±2 minutes, the user is prompted to link them (never silent). Linking is bidirectional, exclusive, and reversible (`/unlink` endpoint).
- **Re-Analysis Endpoint**: `POST /api/mocap/sessions/:id/reanalyze` re-runs the segmenter, metrics calculator, and fault detector with current rules so old sessions benefit from updated thresholds.
- **Cloud-AI Payload Tiers**: AI gets a `PostureFault` summary by default; per-stroke metrics are opt-in via `UserSettings.mocapDetailedAIShare`; raw frames never cross to cloud (see ADR-0004).

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 4
- **Components**: shadcn/ui (Radix UI primitives)
- **Charts**: Recharts 3
- **Animations**: Framer Motion
- **Markdown**: react-markdown + remark-gfm + Shiki for code highlighting
- **AI Integration**: OpenAI API (chat, image generation, condensation prompts)
- **Authentication**: NextAuth.js v4 (Credentials, Email magic link, optional Google OAuth)
- **Database**: PostgreSQL with Prisma v7 and `@prisma/adapter-pg`
- **State Management**: Zustand with persist middleware
- **Storage**:
  - PostgreSQL for user data, sessions, plans, achievements, mocap rows
  - File system (or Vercel Blob via `@vercel/blob`) for award images, memory documents, mocap video, and pose stream blobs
- **Pose Estimation**: `@mediapipe/tasks-vision` Pose Landmarker, Web Worker, WASM
- **CSV / ZIP Parsing**: `papaparse`, `jszip`
- **PDF Extraction**: `unpdf`
- **SmartRow Automation**: `playwright` (server-side login + export download for `/api/smartrow/sync`)
- **Email**: Nodemailer with Mailpit (local) or SMTP (production)
- **Rate Limiting**: Upstash Redis for API protection
- **Validation**: Zod
- **Development**: Docker Compose for local services

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker & Docker Compose (for local development)
- OpenAI API Key (optional, for AI features)
- PostgreSQL database (local via Docker or Supabase)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/rupertgermann/rowing-tracker
   cd rowing-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for local)
   - `EMAIL_SERVER` - SMTP server for emails (smtp://localhost:1025 for local)
   - `EMAIL_FROM` - Sender email address
   - `UPSTASH_REDIS_REST_URL` - Upstash Redis URL (optional, for rate limiting)
   - `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token (optional, for rate limiting)

4. **Start local services (PostgreSQL + Mailpit)**
   ```bash
   npm run db:start
   ```
   This starts:
   - PostgreSQL on port 5432
   - Mailpit SMTP on port 1025
   - Mailpit Web UI on http://localhost:9025

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

8. **Create an account**
   - Click "Register" to create your account
   - Check Mailpit (http://localhost:9025) for verification email
   - Click the verification link
   - Sign in with your credentials

9. **Configure AI (Optional)**
   - Go to Settings → AI Coach
   - Enter your OpenAI API Key to enable Chat, Insights, and Training Plans
   - Add your Personal Context to inform the AI about medical conditions, preferences, or goals
   - Customize the AI prompts (base, chat, training plan, insights) in Advanced Configuration with one-click "reset to default"

10. **Configure SmartRow Auto-Sync (Optional)**
    - Go to Settings → SmartRow
    - Enter your `smartrow.fit` email and password (stored per-user in `UserSettings.smartRowSettings`)
    - Visit `/sync` and click **Sync Now** to pull all workouts in one pass

11. **Promote a User to Admin (Optional)**
    ```bash
    npm run admin:promote -- <email>
    ```
    Admin users see the **Admin Panel** entry in the user menu and can access `/admin` to manage other users.

## Importing Your SmartRow Data

The `/sync` page offers three import paths. All three deduplicate against existing sessions and update changed records in place.

### 1. Automated Sync from smartrow.fit (recommended)

1. Save your SmartRow credentials in **Settings → SmartRow**.
2. Open `/sync` and click **Sync Now**.
3. The server runs a Playwright session against `https://smartrow.fit/my-workouts/`, downloads the workouts CSV and the detailed-stroke ZIP, and imports both. The `lastSync` timestamp is updated on completion.

### 2. Manual CSV Upload

Drag-and-drop a SmartRow CSV onto `/sync` or click to browse. Both the workouts-list CSV and individual detailed-stroke CSVs are accepted.

### 3. ZIP Batch Upload

Drop the SmartRow archive ZIP onto `/sync` to import many detailed-stroke sessions at once with progress reporting (`ZipProcessProgress`).

### CSV Format Requirements

SmartRow CSV exports use:
- **Delimiter**: Semicolon (`;`)
- **Decimal Format**: Comma (`,`) — European format
- **Timestamp**: `YYYY-MM-DD HH:MM:SS.mmm` (UTC)
- **Time Field**: Seconds

### Required Columns (workouts list)

- Time stamp (UTC)
- Distance (m)
- Time (seconds)
- Energy (kCal)
- Stroke count (#)
- Average power (W)
- Maximum power (W)
- Average split (s) — per 500m
- Minimum split (s)
- Average stroke rate (SPM)
- Maximum stroke rate (SPM)

### Detailed-Stroke CSV

Detailed-stroke files (one per session, contained in the SmartRow ZIP) are parsed by `src/lib/strokeParser.ts` into `StrokeData` rows. They drive stroke-by-stroke analysis and the precomputed `consistencyScore` on `RowingSession`.

## Deployment

### Supabase (Production)

1. **Create a Supabase project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and database password

2. **Configure environment variables**
   ```bash
   # In your .env or deployment platform
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
   NEXTAUTH_SECRET="your-production-secret"
   NEXTAUTH_URL="https://yourdomain.com"
   EMAIL_SERVER="smtp://your-smtp-server:587"
   EMAIL_FROM="noreply@yourdomain.com"

   # Rate Limiting (recommended for production)
   UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
   ```

3. **Run migrations**
   ```bash
   npm run db:migrate
   ```

4. **Deploy to Vercel/Netlify**
   - Connect your repository
   - Add environment variables
   - Deploy!

### Database Management

Available npm scripts:

```bash
# Start local Docker services (PostgreSQL + Mailpit)
npm run db:start

# Stop local Docker services
npm run db:stop

# Generate Prisma client
npm run db:generate

# Run migrations (development)
npm run db:migrate

# Run migrations (production)
npm run db:migrate:deploy

# Reset database (WARNING: deletes all data)
npm run db:reset

# Seed database (where a seed is configured)
npm run db:seed

# Open Prisma Studio (database GUI)
npm run db:studio

# Push schema without migration (dev only)
npm run db:push

# Promote a user to admin
npm run admin:promote -- <email>

# Backfill consistencyScore for existing sessions (one-off)
npx tsx scripts/backfill-consistency.ts
```

## Architecture Overview

```
rowing-tracker/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── dashboard/             # Main dashboard
│   │   ├── analytics/             # Advanced analytics page
│   │   ├── sessions/              # Session list and detail pages
│   │   ├── prs/                   # Personal records & achievements
│   │   ├── plans/                 # AI training plans
│   │   ├── chat/                  # AI Coach chat
│   │   ├── insights/              # AI insights archive & feedback
│   │   ├── mocap/                 # Webcam capture + posture replay
│   │   ├── sync/                  # SmartRow sync, CSV/ZIP upload
│   │   ├── profile/               # User profile
│   │   ├── settings/              # App settings (AI, SmartRow, posture, ...)
│   │   ├── admin/                 # Admin user management (admin role only)
│   │   ├── auth/                  # Login, register, verify-email, reset
│   │   ├── api/                   # API routes (NextAuth, sessions, mocap, smartrow, ...)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/               # Reusable UI components (shadcn/ui + custom)
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # Utilities & services
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── db/prisma.ts          # Prisma client singleton
│   │   ├── services/             # Service singletons
│   │   ├── mocap/                # Pose source, frame stream, analysis pipeline, coaching
│   │   │   ├── browserPoseSource.ts
│   │   │   ├── poseFrameStream.ts
│   │   │   ├── poseWorker.ts
│   │   │   ├── analysis/         # Pure functions: segmenter, metrics, fault detector, thresholds
│   │   │   └── coaching/         # LiveCoachingEngine, CoachingAdvisor, cue audio
│   │   ├── csvParser.ts
│   │   ├── strokeParser.ts
│   │   ├── zipParser.ts
│   │   ├── awards.ts
│   │   └── ...
│   ├── types/                    # TypeScript type definitions
│   └── middleware.ts             # Auth + admin route guards
├── prisma/                       # Database schema & migrations
│   └── schema.prisma
├── scripts/                      # One-off operational scripts
│   ├── promote-admin.ts
│   └── backfill-consistency.ts
├── tests/                        # Unit + Playwright e2e tests
│   ├── *.test.ts                 # tsx --test
│   ├── fixtures/mocap/           # Pose-frame fixtures
│   └── e2e/                      # Playwright specs
├── docs/
│   ├── DATABASE_SCHEMA.md
│   ├── design-system.md
│   ├── prd.md
│   ├── prd-mocap-posture.md      # Mocap PRD + locked decisions
│   ├── adr/                      # Architecture Decision Records (0001–0004)
│   ├── agents/                   # Agent docs (issue tracker, triage labels, domain)
│   └── csvs/                     # Sample SmartRow CSVs
├── CONTEXT.md                    # Domain glossary
├── AGENTS.md                     # Engineering rules
└── docker-compose.yml            # Local PostgreSQL & Mailpit
```

### Data Flow

1. **Authentication**: User registers/logs in → NextAuth validates (Credentials / Email magic link / Google OAuth) → JWT session created with `id` and `role`
2. **Import**:
   - **Sync**: `/api/smartrow/sync` runs Playwright against smartrow.fit → returns CSV + base64 ZIP → client parses with papaparse / jszip → saved to PostgreSQL
   - **Manual**: User drops CSV/ZIP → client-side validation → saved to PostgreSQL
3. **Mocap Capture**: Browser webcam → Pose Landmarker in Web Worker → chunked HTTP uploads of video and `PoseFrameStream` → finalize → stroke segmentation, metrics, and faults computed in browser; server only persists
4. **Storage**:
   - User data, sessions, plans, mocap rows → PostgreSQL via Prisma
   - Award images, memory documents, mocap video, pose stream blobs → file system or Vercel Blob
   - Client state → Zustand store (persisted to DB on key actions)
5. **Display**: Components fetch from database → calculate metrics → render charts; cache busts via `UserSettings.sessionsRevision` / `insightsRevision`
6. **Analysis**: Real-time PR calculations, trend analysis, consistency score, posture metrics, fault counts
7. **AI Features**: Context (sessions, achievements, memory documents, posture summary) retrieved from database → personal context injected from `UserSettings.userProfileContext` → sent to OpenAI → response streamed
8. **Linking**: When a `RowingSession` overlaps a `MocapSession` capture window by ±2 minutes, the user is prompted to link; linking triggers atomic re-segmentation to `csv-aligned`
9. **Data Isolation**: All queries filtered by authenticated user ID; admin endpoints additionally gated via `src/lib/adminAuth.ts`

## Development

### Available Scripts

**Development:**
- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint

**Database:**
- `npm run db:start` — Start PostgreSQL & Mailpit
- `npm run db:stop` — Stop Docker services
- `npm run db:generate` — Generate Prisma client
- `npm run db:migrate` — Run migrations (dev)
- `npm run db:migrate:deploy` — Apply migrations (prod)
- `npm run db:studio` — Open Prisma Studio
- `npm run db:push` — Push schema without migration (dev only)
- `npm run db:seed` — Seed database (when configured)
- `npm run db:reset` — Reset database (destructive)

**Tests:**
- `npm test` — Run unit tests via `tsx --test` (covers `tests/*.test.ts`, including `mocapAnalysis`, `poseFrameStream`, `liveCoachingEngine`, `aiPayload`, etc.)
- `npm run test:e2e` — Run Playwright end-to-end tests (`tests/e2e/`, e.g. `mocap-capture.spec.ts`)

**Operations:**
- `npm run admin:promote -- <email>` — Promote a user to admin
- `npx tsx scripts/backfill-consistency.ts` — Backfill `consistencyScore` for existing sessions and bump `sessionsRevision` for affected users

### Project Structure

- **App Router**: Uses Next.js 16's App Router for file-based routing
- **Server Components**: Default for better performance
- **Client Components**: Mark with `'use client'` when needed
- **State Management**: Zustand with DB persistence
- **Styling**: TailwindCSS with dark theme support

### Adding Components

```bash
# Add shadcn/ui components
npx shadcn@latest add button card table badge

# Components are added to your components/ directory
```

## Data Model

PostgreSQL with Prisma ORM. Key models:

**User Management:**
- `User` — User accounts with authentication and `role` (`user` / `admin`)
- `Account` — OAuth provider accounts
- `AuthSession` — Active sessions
- `VerificationToken` — Email verification + magic-link tokens
- `PasswordResetToken` — Password reset flow
- `UserSettings` — Preferences, AI config, SmartRow credentials, posture thresholds, mocap preferences, dashboard/sessions/analytics view state, cache-busting revisions
- `UserApiKey` — Encrypted per-provider API keys (e.g. OpenAI)

**Rowing Data:**
- `RowingSession` — Workout sessions with metrics and pre-computed `consistencyScore`
- `StrokeData` — Stroke-by-stroke analysis data (with optional `strokeLength`)
- `PersonalRecord` — Best performance per distance

**Mocap (Posture Analysis):**
- `MocapSession` — One capture per session with video + pose stream paths, `capturePerspective`, calibration frames, `qualityScore`, status
- `StrokePostureMetric` — Per-stroke posture metrics with `segmentationSource` (`pose-segmented` or `csv-aligned`)
- `PostureFault` — Detected faults with `faultType`, `severity`, `phase`, `evidenceJson`

**Achievements:**
- `EarnedAward` — Unlocked achievements
- `AIAwardSuggestion` — AI-suggested custom awards with structured criteria
- `GeneratedAchievement` — AI-generated story + optional image with `colorPalette`

**Training:**
- `TrainingPlan` — Multi-week training programs with adherence tracking
- `TrainingWeek` — Weekly structure
- `TrainingSession` — Individual planned workouts with target zones
- `TrainingSessionLink` — Links planned sessions to actual `RowingSession` rows

**AI & Memory:**
- `ChatSession` — AI coach conversations grouped by `category` (`chat`, `explanation`, `plan_analysis`, `insight_discussion`)
- `ChatMessage` — Individual messages with optional attachments
- `AIInsight` — Generated performance insights with `priority`, `confidence`, `evidence`, `feedback`
- `MemoryDocument` — Uploaded PDFs / images / training plans / notes referenced by `filePath`
- `ChartExplanation` — Cached chart explanations keyed by `(userId, chartId)`

See `prisma/schema.prisma` for the complete, authoritative schema, and `docs/DATABASE_SCHEMA.md` for the annotated reference.

## Privacy & Data

- **User Isolation**: Each user's data is completely isolated in the database
- **Secure Authentication**: Passwords hashed with bcrypt, JWT sessions
- **Email Verification**: Double opt-in ensures account ownership
- **Data Encryption**: Sensitive data encrypted at rest (database level)
- **Privacy First**: Your workout data is never shared with other users
- **GDPR Ready**: User data can be exported or deleted on request
- **API Keys**: OpenAI keys encrypted in database, never exposed to client

## API Rate Limiting

The app includes built-in rate limiting using [Upstash Redis](https://upstash.com/) to protect against abuse and ensure fair usage.

### Rate Limit Tiers

| Endpoint Type | Limit | Description |
|---------------|-------|-------------|
| **General API** | 100 req/min | Standard API endpoints |
| **Authentication** | 10 req/min | Login, register, password reset |
| **AI/Chat** | 20 req/min | AI coach, chat endpoints |
| **Upload** | 30 req/min | CSV file uploads |
| **Sensitive** | 5 req/min | Account deletion, data export |

### Configuration

Rate limiting is optional but recommended for production. To enable:

1. **Create an Upstash account** at [upstash.com](https://upstash.com)
2. **Create a Redis database** (free tier available)
3. **Add environment variables**:
   ```bash
   UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
   UPSTASH_REDIS_REST_TOKEN="your-token"
   ```

### Behavior

- **When configured**: Requests exceeding limits receive a `429 Too Many Requests` response with `Retry-After` header
- **When not configured**: Rate limiting is disabled (graceful degradation for development)
- **Rate limit headers**: Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`

### Protected Endpoints

Rate limiting is applied to:
- `/api/auth/register` — Prevents registration spam
- `/api/auth/forgot-password`, `/api/auth/reset-password` — Limits password-reset abuse
- `/api/chat` (POST) — Controls AI usage costs
- `/api/smartrow/sync` — Limits Playwright-driven SmartRow scrapes
- `/api/mocap/sessions/*` (upload + finalize) — Caps mocap capture write volume
- `/api/user/delete` — Protects account deletion
- `/api/user/export` — Prevents data export abuse

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues:

1. Check that your CSV file matches the required format
2. Ensure all required columns are present
3. Verify Docker services are running (`npm run db:start`)
4. Open an issue on GitHub with details about your problem

---

**Built with ❤️ for the rowing community**
