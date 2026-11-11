# Dependency advisory triage (#124)

Audited 2026-11-11 on the isolated audit worktree, using Node 24.18.0 and the npm advisory feed. Counts describe affected dependency nodes, including propagated findings; they are not counts of demonstrated exploits.

## Decision and scope

Baseline `npm audit --json`: 53 nodes (4 critical, 34 high, 15 moderate). After targeted upgrades (npm 11.16.0): 7 moderate nodes, no high or critical. `npm audit --omit=dev --json`: **0** affected nodes. No force-fix, beta Auth.js migration, production service, deployed environment, or real credentials were used.

| Dependency | Selected version | Reason / compatibility |
| --- | --- | --- |
| Next.js | 16.4.6 | Same major; patched framework, image optimizer and rendering advisories. |
| next-auth | 4.24.15 | Stable v4 patch fixes default email normalization; retains existing API/session integration. |
| @auth/prisma-adapter | 2.11.3 | Same major; resolves patched @auth/core 0.41.3. |
| Prisma client, pg adapter and CLI | 7.10.1 | Upgrade as a matched set; regenerated client and exercised disposable PostgreSQL. Removes old Prisma development-server overrides. |
| Nodemailer | 10.5.0 | Explicit security-driven major update; Node >=20 requirement fits project Node >=24. Retains existing transport/sendMail usage and override for auth dependencies. Mail test confirms recipient/envelope/link. |
| Zod | 4.6.7 | Same major; constrained collection exhaustion patch, existing route validation tests pass. |
| @vercel/blob | 2.4.0 (pinned) | Compatible incremental update; undici refreshed within its declared range. Newer 2.9.0 adds CLI/OIDC dependencies with vulnerable Zod 3, so avoided. Revisit pin when that dependency chain is patched. |
| PostCSS override | 8.5.32 | Same major; resolves source map path traversal. |

The lockfile also updates compatible vulnerable transitive packages (including undici, sharp, js-yaml, brace-expansion, and humanfs). Existing eslint-config-next 16.0.3 is retained. A narrow override retains the baseline eslint-plugin-react-hooks 7.0.1: 7.1.1 introduces 31 unrelated new lint errors. Its vulnerable Zod dependency is patched by the root Zod upgrade. Upgrade the lint rules in a separate deliberate code migration.

## Reachability classification

| Advisory family | Application evidence and applicability |
| --- | --- |
| Auth.js Unicode email normalization | **Directly reachable**: src/lib/auth.ts enables EmailProvider without a custom normalizer. A handler test reproduced a homoglyph address reaching the delivery boundary before the patch, then verified rejection afterward. Upstream labels this high; npm labels it critical. [Upstream advisory](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-7rqj-j65f-68wh). |
| Auth.js bearer parsing / OAuth cookie binding | Password/JWT and optional Google provider are configured. No application getToken calls were found; Google is conditional on credentials, with one OAuth provider. Upgrading removes affected versions regardless of the narrower deployment-specific reachability. Adapter's @auth/core is a transitive dependency; the active handler uses next-auth v4. |
| Next.js / sharp | App Router rendering and next/image are used, so framework/image fixes are priority. No use-cache directives, server actions, next/og ImageResponse, custom server, or rewrites were found. Windows-specific advisory applicability depends on the host. No exploit claim is made for inactive features. Production image optimization and login rendering were exercised after upgrade. |
| Nodemailer | EmailProvider and forgot-password route send mail; user addresses reach email parsing. SMTP host/from configuration is server-owned. No caller-controlled attachments or legacy resolveContent usage found; those sub-advisories are not demonstrated paths. Patched transport is tested locally without sending external mail. |
| Zod | Used at HTTP validation/storage boundaries, so runtime collection validation is relevant. Existing route/storage tests exercise these paths after upgrade. |
| Vercel Blob / undici | Mocap cloud storage uses Blob SDK HTTP requests. No application use of undici WebSocket/EventSource/retry-interceptor/cookie helpers found. HTTP/TLS transport fixes still warranted; actual cloud credentials/delivery were not exercised. |
| Prisma-related development servers, MySQL, Hono | Prisma is installed under dependencies, but this app uses PostgreSQL via adapter-pg. Prisma local dev server/MySQL paths are tooling/transitive exposure, not the app's SQL request path. Updated matched Prisma releases remove those flagged versions. |
| Babel, ESLint, Tailwind/PostCSS, browser-data and glob/YAML tooling | Build/lint processing of repository-owned files. They are not HTTP request handlers; processing untrusted projects/configuration could still expose tooling. Compatible updates patch all except the minimatch family below. |

## Remaining advisories

The only root advisory is [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): minimatch globparts amplification, moderate. The installed TypeScript ESLint parser declares minimatch `^10.2.2`; the feed's fixed range begins at 11.0.1. Updating within current declared ranges leaves the finding. Do not force a major minimatch override into the parser solely to zero the count.

Seven affected nodes: minimatch, @typescript-eslint/typescript-estree, @typescript-eslint/parser, @typescript-eslint/utils, @typescript-eslint/type-utils, @typescript-eslint/eslint-plugin, typescript-eslint. These are **development-only lint dependencies**, with input from project files/glob configuration. There is no application request path into this parser. Residual risk: linting attacker-controlled configurations or repositories can consume excessive resources. Revisit when TypeScript ESLint publishes a compatible patched dependency range. The production-only audit is clean; that does not establish absence of unknown vulnerabilities.

## Verification

Install/build/test commands and the final audit used Node 24.18.0 / npm 11.16.0. The initial npm 10.9.9 audit reported the baseline; npm 10 also propagates the remaining finding to eslint-config-next (8 nodes), while npm 11 reports 7. This reporting difference does not change the root advisory or runtime applicability. npm cache and Prisma XDG cache were isolated under /tmp. Prisma generated against the current integration schema, including sessionVersion.

- **PASS red → green**: `node --import tsx --test tests/dependencyAuthCompatibility.test.ts`. Before upgrade the Unicode-address test failed because mail was delivered; ordinary email and password sign-in passed. After upgrade all five cases pass: rejection, ordinary email normalization/delivery, wrong/correct password + session, Nodemailer envelope/link, optional Google provider discovery.
- **PASS**: `npm test`: 360 tests after a clean final npm ci, including all five auth compatibility cases. Includes existing storage, registration, route, and persistence checks.
- **PASS**: `TEST_DATABASE_URL=<disposable localhost rowing_ticket129> node --import tsx --test tests/integration/sessionRevocation.test.ts`: seven real PostgreSQL/Prisma/pg-adapter and session tests, including reset/change/delete/revocation and database failure. Test fixtures clean up their own records; the existing test enforces this database name.
- **PASS**: production `npm run build` with synthetic NEXTAUTH_SECRET, localhost NEXTAUTH_URL, and an unused localhost DATABASE_URL. No environment files were copied. Existing dynamic filesystem tracing warnings in achievement image routes remain.
- **PASS**: isolated production server on 127.0.0.1:43124: HTTP 200 for /auth/login, /api/auth/providers, /api/auth/csrf; actual /_next/image transformation of a synthetic local PNG returned image bytes. Server stopped and temporary image removed.
- **PASS**: `npm run lint` with the retained baseline hooks plugin; `npx tsc --noEmit`; `git diff --check`.
- **UNAVAILABLE**: real Google OAuth consent/callback, external SMTP delivery, and Vercel Blob service integration. No real accounts, secrets or external delivery used. OAuth discovery and local mail/route/storage boundaries are covered, but these do not prove provider interoperability end to end.

Raw audit snapshots and command logs are in the local execution evidence directory `/tmp/rowing-audit-implementation` (audit-124-before.json, audit-124-after.json, audit-124-runtime.json, auth-124-red.log, database-124.log, build-124.log, tests-124-final.log). They are ephemeral execution evidence; this document preserves the findings and limitations.
