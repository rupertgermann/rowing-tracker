# SaaS Readiness Plan - Rowing Tracker

**Created:** December 28, 2025
**Status:** Planning Phase

---

## Executive Summary

The multi-user implementation is **functionally complete** (~95%). Data isolation, authentication, and database-first architecture are solid. This document outlines what's needed to launch as a SaaS product for SmartRow equipment users.

---

## Current State Assessment

### What's Done Well

| Area | Status | Notes |
|------|--------|-------|
| Database Architecture | ✅ Complete | PostgreSQL with Prisma, proper FKs and cascades |
| Authentication | ✅ Complete | NextAuth.js with credentials, magic links, Google OAuth |
| Data Isolation | ✅ Complete | All queries filtered by `userId` |
| Email Verification | ✅ Complete | Production requires verified email |
| Role-Based Access | ✅ Complete | Admin/user roles with middleware protection |
| Migration Tools | ✅ Complete | localStorage → database migration flow |
| Admin Panel | ✅ Complete | User management, password reset, role toggle |
| Settings Sync | ✅ Complete | DB-first with retry logic and fallbacks |
| API Key Encryption | ✅ Complete | Encrypted storage for AI provider keys |

### Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| No rate limiting | High | Pending |
| No user self-delete | Medium | Pending |
| No data export | Medium | Pending |
| Outdated docs | Low | Pending |
| localStorage remnants on logout | Low | Pending |
| No subscription/billing | Critical | Not started |
| No legal pages | High | Not started |

---

## Implementation Roadmap

### Phase 1: Quick Wins (Immediate)

These can be implemented immediately with minimal complexity:

- [x] Update `MULTI_USER_IMPLEMENTATION_STATUS.md` to reflect actual state
- [x] Clear localStorage on logout to prevent stale data
- [x] Add user self-delete endpoint (`/api/user/delete`)
- [x] Add data export endpoint (`/api/user/export`)
- [x] Add basic rate limiting with `@upstash/ratelimit`

---

### Phase 2: Compliance & Legal (Before Launch)

**Required for GDPR and legal compliance:**

1. **Terms of Service Page**
   - `/terms` route
   - Clear usage terms
   - Liability limitations
   - Acceptable use policy

2. **Privacy Policy Page**
   - `/privacy` route
   - Data collection disclosure
   - Third-party services (AI providers)
   - Cookie usage
   - User rights (access, rectification, deletion)

3. **Cookie Consent Banner**
   - GDPR-compliant consent mechanism
   - Essential vs. analytics cookies
   - Consent persistence

4. **Data Processing Agreement**
   - For B2B/enterprise customers
   - GDPR Article 28 compliance

---

### Phase 3: Subscription & Billing (Core Revenue)

**Stripe Integration:**

1. **Pricing Tiers**
   ```
   Free Tier:
   - 50 rowing sessions
   - Basic analytics
   - No AI features

   Pro Tier ($9.99/month or $99/year):
   - Unlimited sessions
   - Full AI coach access
   - Training plan generation
   - Priority support

   Team Tier ($29.99/month):
   - Multiple users
   - Coach dashboard
   - Team analytics
   ```

2. **Implementation Components**
   - Stripe Customer creation on signup
   - Stripe Checkout for subscriptions
   - Webhook handler for subscription events
   - Usage tracking for AI features
   - Subscription management UI in settings
   - Payment method management
   - Invoice history

3. **Database Changes**
   ```prisma
   model Subscription {
     id                String   @id @default(cuid())
     userId            String   @unique
     user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     stripeCustomerId  String   @unique
     stripeSubscriptionId String? @unique
     stripePriceId     String?
     status            String   // active, canceled, past_due, etc.
     currentPeriodEnd  DateTime?
     cancelAtPeriodEnd Boolean  @default(false)
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt
   }

   model UsageRecord {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     type      String   // ai_tokens, sessions_uploaded, etc.
     amount    Int
     createdAt DateTime @default(now())
   }
   ```

4. **Feature Gating**
   - Middleware to check subscription status
   - Graceful degradation for expired subscriptions
   - Clear upgrade prompts in UI

---

### Phase 4: User Experience Improvements

1. **Onboarding Flow**
   - Welcome wizard after registration
   - Sample data option for exploration
   - Quick feature tour
   - SmartRow CSV export instructions

2. **Email Communications**
   - Welcome email series
   - Weekly/monthly progress summaries
   - PR achievement notifications
   - Subscription reminders
   - Re-engagement emails

3. **Error Handling & Monitoring**
   - Sentry integration for error tracking
   - User-friendly error messages
   - Automatic error reporting

4. **Analytics**
   - PostHog or Mixpanel integration
   - Funnel tracking (signup → upload → engagement)
   - Feature usage analytics
   - Churn prediction

---

### Phase 5: Marketing & Growth

1. **Landing Page**
   - Public marketing page at `/`
   - Feature highlights with screenshots
   - Pricing section
   - Testimonials (once available)
   - SmartRow compatibility badge
   - Demo video

2. **SEO & Content**
   - Blog with rowing tips
   - SmartRow integration guides
   - Training plan templates

3. **Social Features (Optional)**
   - Public profile option
   - Shareable achievements
   - Community leaderboards

---

### Phase 6: Enterprise & Integrations

1. **API Access**
   - Public API for power users
   - API key management
   - Rate limiting per tier

2. **Integrations**
   - Strava export
   - Apple Health / Google Fit
   - Direct SmartRow API (if available)

3. **Team/Coach Features**
   - Multi-athlete management
   - Team analytics dashboard
   - Workout assignments

---

## Technical Debt to Address

1. **localStorage Cleanup**
   - `activePlanId` in `trainingPlans.ts`
   - `currentChatSessionId` in `useChat.ts`
   - These should be user-specific in DB or cleared on logout

2. **Testing**
   - Unit tests for API routes
   - Integration tests for auth flows
   - E2E tests with Playwright

3. **Performance**
   - API response caching
   - Image optimization
   - Bundle size analysis

---

## Cost Projections

| Service | Free Tier | Estimated Cost at Scale |
|---------|-----------|------------------------|
| Vercel | Hobby free | Pro $20/mo |
| Supabase | Free tier | Pro $25/mo |
| Upstash | 10k requests/day | Pay as you go |
| OpenAI API | N/A | ~$0.002/1k tokens |
| Stripe | 2.9% + $0.30/tx | Same |
| Sentry | 5k events/mo | $26/mo |
| Resend/SendGrid | 100 emails/day | $20/mo |

**Break-even estimate:** ~50 Pro subscribers at $9.99/mo

---

## Success Metrics

| Metric | Target (Month 1) | Target (Month 6) |
|--------|------------------|------------------|
| Registered users | 100 | 1,000 |
| Paid subscribers | 10 | 100 |
| Monthly Active Users | 50 | 500 |
| Sessions uploaded | 1,000 | 20,000 |
| Churn rate | < 10% | < 5% |
| NPS | > 30 | > 50 |

---

## Next Steps

1. Complete Phase 1 quick wins
2. Set up Stripe account and test environment
3. Draft Terms of Service and Privacy Policy
4. Design landing page
5. Beta launch to SmartRow community

---

## Resources

- [Stripe Next.js Integration](https://stripe.com/docs/payments/accept-a-payment?platform=web&ui=checkout)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Upstash Rate Limiting](https://upstash.com/docs/oss/sdks/ts/ratelimit/overview)
- [GDPR Compliance Checklist](https://gdpr.eu/checklist/)
