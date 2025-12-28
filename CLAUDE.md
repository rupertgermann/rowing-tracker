# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run lint             # Run ESLint

# Database (Prisma + PostgreSQL)
npm run docker:up        # Start PostgreSQL + Mailpit containers
npm run docker:down      # Stop Docker services
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (dev)
npm run db:migrate:deploy # Run migrations (production)
npm run db:studio        # Open Prisma Studio GUI
npm run db:push          # Push schema without migration (dev only)
npm run db:reset         # Reset database (WARNING: deletes all data)

# Admin
npm run admin:promote    # Promote user to admin role
```

## Architecture Overview

### Tech Stack
- **Next.js 15** with App Router (src/app/)
- **TypeScript** with strict mode
- **Prisma v7** with PostgreSQL adapter
- **Zustand** for client state with DB sync
- **NextAuth.js v4** for authentication
- **TailwindCSS v4** + shadcn/ui components
- **OpenAI API** for AI features (chat, insights, training plans)

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/               # 35+ API routes (all require auth)
│   └── (routes)/          # Page components
├── components/            # React components (shadcn/ui base)
├── hooks/                 # Custom hooks (useSettings, useChat, useAIInsights, etc.)
├── lib/
│   ├── db/prisma.ts      # Prisma client singleton with connection pooling
│   ├── services/         # Service singletons (SettingsService, CloudAIService, etc.)
│   ├── ai/               # AI configuration and prompts
│   └── utils/            # Utilities (csvParser, awards, validation, etc.)
└── types/                 # TypeScript interfaces
```

### Key Architectural Patterns

**1. DB-First with Local Cache**
- PostgreSQL is source of truth, localStorage is synchronous cache
- SettingsService debounces DB syncs (1s) to prevent API spam
- `lib/services/dataSync.ts` handles bidirectional sync

**2. Service Singleton Pattern**
All services use `getInstance()` pattern:
- `SettingsService` (lib/services/settings.ts) - 1,000+ LOC
- `CloudAIService` (lib/services/cloudAI.ts) - 1,900+ LOC
- `ChatStorageService`, `MemoryStorageService`, `TrainingPlansService`

**3. Zustand Store with DB Persistence**
- Main store: `lib/services/store.ts` - sessions, PRs, awards, chart settings
- Achievement store: `lib/services/achievementStore.ts` - generated achievements
- Awards recomputed on every session addition for consistency

**4. Chart Explanation Caching**
- AI explanations stored in Zustand with chartId key
- Time-range aware (separate explanations per date range)
- Saved to DB via ChartExplanation model

### Database Models (prisma/schema.prisma)

**User & Auth**: User, Account, AuthSession, VerificationToken, UserSettings, UserApiKey

**Rowing Data**: RowingSession (31 metrics), StrokeData (stroke-by-stroke), PersonalRecord

**AI & Memory**: ChatSession, ChatMessage, AIInsight, MemoryDocument, ChartExplanation

**Awards**: EarnedAward, AIAwardSuggestion, GeneratedAchievement

**Training**: TrainingPlan, TrainingWeek, TrainingSession, TrainingSessionLink

### API Route Patterns
All API routes in `src/app/api/`:
- Require NextAuth session validation
- Filter all queries by `userId` from session
- Return proper HTTP status codes (401, 404, 500)
- Use Zod for input validation

### Authentication Flow
- NextAuth.js with Credentials, Email (magic link), and Google providers
- Middleware (`src/middleware.ts`) protects routes
- Role-based access: user vs admin
- All user data isolated by userId

### State Management Flow
```
User Action → Zustand Store → API Route → Prisma → PostgreSQL
                   ↓
            localStorage (cache)
```

### Key Files for Common Tasks

| Task | Key Files |
|------|-----------|
| Add new API route | `src/app/api/[route]/route.ts` |
| Add database model | `prisma/schema.prisma`, then `npm run db:migrate` |
| Add UI component | `src/components/`, use shadcn/ui patterns |
| Modify settings | `src/lib/services/settings.ts`, `src/lib/validations/settings.ts` |
| Add award type | `src/lib/utils/awards.ts` |
| Modify AI prompts | `src/lib/ai/aiPromptDefaults.ts` |
| Add chart | Use Recharts, see `src/components/analytics/` |

### SmartRow CSV Format
The app parses SmartRow CSV exports:
- Semicolon delimiter, European decimal format (comma)
- Key columns: timestamp, distance, time, energy, stroke count, power, split, stroke rate
- Parser: `src/lib/utils/csvParser.ts`

### Environment Variables
Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth signing key
- `NEXTAUTH_URL` - App URL
- `EMAIL_SERVER`, `EMAIL_FROM` - SMTP for verification emails

Optional:
- `UPSTASH_REDIS_REST_URL/TOKEN` - Rate limiting
- OpenAI API key stored per-user in localStorage (never in DB)
