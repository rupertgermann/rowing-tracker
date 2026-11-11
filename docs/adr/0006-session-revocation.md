# ADR 0006: Revoke JWT sessions through a database session version

Status: Accepted

Every server session check compares the JWT's `sessionVersion` with the current
User row. Password recovery, authenticated password changes, and administrator
password resets atomically increment that version with the password update. All
previous sessions, including the requesting session, lose access on their next
server request. Account deletion revokes sessions because the User no longer
exists. Requests already authorized before the change may finish.

New logins use the current version. Missing-version tokens (including cookies
issued before this migration), mismatched versions, deleted accounts, and
unavailable database lookups fail closed. Session updates cannot upgrade a stale
token. Versions live in PostgreSQL, so revocation applies across server instances.

The page proxy only decodes cookies and may allow a revoked cookie to open a page
shell. Protected data routes use `getServerSession(authOptions)`, which performs
the database check before granting access. Do not use proxy JWT decoding as data
authorization.

Deploy the additive `20261111220000_add_session_version` migration before the app
code. Existing cookies require a fresh login. The tradeoff is one User lookup per
server session check and loss of authenticated access during database outages.

Validation uses the real NextAuth session-cookie path and application route
handlers with separate Prisma clients against disposable PostgreSQL. Run migrations
on a local disposable `rowing_ticket129` database, then:

```sh
TEST_DATABASE_URL=postgresql://postgres:password@127.0.0.1:55439/rowing_ticket129 \
  npx tsx --test tests/integration/sessionRevocation.test.ts
```
