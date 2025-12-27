# Database & Multi-User Implementation Plan (Condensed)

Purpose: one-stop, current plan for database + multi-user stack, reflecting final migration status.

## Quick Start
- **Dev (Docker Postgres)**: `docker-compose up -d` → `npx prisma generate` → `npx prisma migrate dev --name init` → optional `docker-compose --profile tools up -d` (pgAdmin).
- **Prod (Supabase example)**: set `DATABASE_URL` / `DIRECT_URL`, then `npx prisma generate` → `npx prisma migrate deploy`.

## Current State (from final migration reports)
- PostgreSQL + Prisma is the source of truth; localStorage persistence removed from the main store.
- Data sync infra live: `/api/sessions`, `/api/prs`, `/api/awards`, `/api/settings`, `/api/training-plans`, `/api/insights`, `/api/chat`, `/api/ai-config`, `/api/ai-config/api-key`, `/api/memory`, `/api/test/settings-sync`.
- Store/bootstrap: `useDataSync` initializes on login; `store.ts` writes to DB on mutations.
- Security: NextAuth on all routes, userId scoping, AES-256-GCM for API keys, HTTPS in prod.
- Remaining hygiene: keep offline/localStorage fallback only as graceful degrade; prefer DB paths.

## Implementation Steps (what matters now)
1) **Env & schema**
   - Set `.env` with `DATABASE_URL`/`DIRECT_URL`, `NEXTAUTH_*`, `OPENAI_API_KEY` (server-side only).
   - Prisma schema lives in `prisma/schema.prisma` (see `DATABASE_SCHEMA.md` for table list).
   - Commands: `npx prisma generate`, `npx prisma migrate dev` (dev) / `npx prisma migrate deploy` (prod).

2) **Auth**
   - NextAuth adapter uses Prisma; JWT strategy.
   - Protect app routes via `src/middleware.ts`.

3) **Data sync flows**
   - AuthProvider wraps `useDataSync` to load all entities on login.
   - Mutations call DB save helpers; optimistic UI allowed, rollback on failure.
   - APIs enforce userId filters and return user-scoped data only.

4) **Migration/Import**
   - Local migration utility exports legacy localStorage/IndexedDB payloads.
   - `/api/migrate` ingests per-user within a transaction (sessions, awards, plans, insights, chat, settings, memory docs).
   - After successful import, clear legacy stores.

5) **Testing checklist**
   - Auth (register/login), session import, multi-device visibility, training plans CRUD, chat history, AI insights, settings sync (incl. API key round-trip), memory upload/blobs, awards/PR recalculation, migration endpoint, logout/session clear.

## Ops & Maintenance
- Backups: enable managed backups; PITR if available.
- Monitoring: DB error logging, Prisma errors, API latency; alert on encryption failures for API keys.
- Rollback: keep feature-flagged localStorage fallback only for emergency read; disable DB via env if needed.

## References
- Detailed schema: `docs/DATABASE_SCHEMA.md`
- Final status/details: `docs/DATABASE_MIGRATION_FINAL_REPORT.md`, `docs/DATABASE_SYNC_FINAL_STATUS.md`, `docs/SETTINGS_MIGRATION_COMPLETE.md`
