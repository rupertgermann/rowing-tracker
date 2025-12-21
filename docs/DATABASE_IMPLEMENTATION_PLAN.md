# Database & Multi-User Implementation Plan

## Quick Start

### Option 1: Local Docker PostgreSQL (Recommended for Development)

```bash
# 1. Start the database
docker-compose up -d

# 2. Generate Prisma client
npx prisma generate

# 3. Run migrations
npx prisma migrate dev --name init

# 4. (Optional) Open database UI
docker-compose --profile tools up -d  # Starts pgAdmin at http://localhost:5050
```

### Option 2: Supabase (Recommended for Production)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings > Database** and copy the connection strings
3. Update `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
   ```
4. Run migrations:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

---

## Summary of Current Architecture

### Current Storage Mechanisms

| Data Type | Storage | Key/Store Name |
|-----------|---------|----------------|
| Sessions, PRs, Awards, Chart Settings | Zustand + localStorage | `rowing-tracker-storage` |
| Achievement Generator | Zustand + localStorage | `rowing-achievement-generator` |
| Chat Sessions | localStorage | `rowing_ai_chat_sessions` |
| Training Plans | localStorage | `rowing_training_plans` |
| AI Insights | localStorage | `rowing_ai_insights_cache`, `rowing_ai_insights_archive` |
| Memory Documents | IndexedDB | `rowing_memory_db` |
| Settings | localStorage | `rowing_app_settings` |
| Award Images | Filesystem | `public/assets/awards/` |

### Key Files to Modify

```
src/lib/
├── store.ts              # Main Zustand store → DB service
├── achievementStore.ts   # Achievement store → DB service
├── chatStorage.ts        # Chat storage → DB service
├── trainingPlans.ts      # Training plans → DB service
├── memoryStorage.ts      # Memory storage → DB service
├── settings.ts           # Settings → DB service
├── imageStorage.ts       # Image storage → Cloud storage
└── [NEW] db/
    ├── prisma.ts         # Prisma client singleton
    ├── sessions.ts       # Session DB operations
    ├── awards.ts         # Awards DB operations
    ├── plans.ts          # Training plans DB operations
    ├── chat.ts           # Chat DB operations
    ├── insights.ts       # Insights DB operations
    ├── memory.ts         # Memory documents DB operations
    └── settings.ts       # Settings DB operations
```

---

## Phase 1: Database Setup (Day 1)

### 1.1 Install Dependencies

```bash
npm install prisma @prisma/client
npm install next-auth @auth/prisma-adapter
npm install bcryptjs
npm install -D @types/bcryptjs
```

### 1.2 Initialize Prisma

```bash
npx prisma init
```

### 1.3 Configure Database Connection

Create `.env.local`:
```env
DATABASE_URL="postgresql://user:password@host:5432/rowing_tracker?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

### 1.4 Create Prisma Schema

Copy schema from `DATABASE_SCHEMA.md` to `prisma/schema.prisma`

### 1.5 Run Initial Migration

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Phase 2: Authentication (Day 2-3)

### 2.1 Create Auth Configuration

**File: `src/lib/auth.ts`**
```typescript
import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image
        };
      }
    }),
    // Optional: Google OAuth
    // GoogleProvider({
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    // })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/login",
    signUp: "/auth/register"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  }
};
```

### 2.2 Create Auth API Routes

**File: `src/app/api/auth/[...nextauth]/route.ts`**
```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**File: `src/app/api/auth/register/route.ts`**
```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash
      }
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
```

### 2.3 Create Auth Pages

- `src/app/auth/login/page.tsx` - Login form
- `src/app/auth/register/page.tsx` - Registration form
- `src/components/AuthProvider.tsx` - Session provider wrapper

### 2.4 Protect Routes with Middleware

**File: `src/middleware.ts`**
```typescript
import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/login"
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sessions/:path*",
    "/analytics/:path*",
    "/prs/:path*",
    "/plans/:path*",
    "/chat/:path*",
    "/settings/:path*"
  ]
};
```

---

## Phase 3: Database Service Layer (Day 4-6)

### 3.1 Prisma Client Singleton

**File: `src/lib/db/prisma.ts`**
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### 3.2 Session Service

**File: `src/lib/db/sessions.ts`**
```typescript
import { prisma } from "./prisma";
import { Session } from "@/types/session";

export async function getUserSessions(userId: string) {
  return prisma.rowingSession.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    include: { strokeData: true }
  });
}

export async function createSessions(userId: string, sessions: Session[]) {
  return prisma.rowingSession.createMany({
    data: sessions.map(s => ({
      userId,
      timestamp: s.timestamp,
      distance: s.distance,
      duration: s.duration,
      energy: s.energy,
      strokeCount: s.strokeCount,
      avgPower: s.avgPower,
      maxPower: s.maxPower,
      wattPerKg: s.wattPerKg,
      avgSplit: s.avgSplit,
      minSplit: s.minSplit,
      avgWork: s.avgWork,
      avgStrokeLength: s.avgStrokeLength,
      avgStrokeRate: s.avgStrokeRate,
      maxStrokeRate: s.maxStrokeRate
    })),
    skipDuplicates: true
  });
}

export async function deleteSession(userId: string, sessionId: string) {
  return prisma.rowingSession.deleteMany({
    where: { id: sessionId, userId }
  });
}

// ... more operations
```

### 3.3 Create API Routes for Each Entity

Structure:
```
src/app/api/
├── sessions/
│   ├── route.ts          # GET all, POST new
│   └── [id]/route.ts     # GET, PUT, DELETE single
├── awards/
│   ├── route.ts
│   └── [id]/route.ts
├── plans/
│   ├── route.ts
│   └── [id]/route.ts
├── chat/
│   ├── route.ts
│   └── [id]/route.ts
├── insights/
│   ├── route.ts
│   └── [id]/route.ts
├── memory/
│   ├── route.ts
│   └── [id]/route.ts
└── settings/
    └── route.ts
```

---

## Phase 4: Frontend Integration (Day 7-9)

### 4.1 Create API Client

**File: `src/lib/api/client.ts`**
```typescript
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "API request failed");
  }

  return res.json();
}

export const api = {
  sessions: {
    getAll: () => fetchAPI<Session[]>("/sessions"),
    create: (sessions: Session[]) => 
      fetchAPI<void>("/sessions", {
        method: "POST",
        body: JSON.stringify(sessions)
      }),
    delete: (id: string) => 
      fetchAPI<void>(`/sessions/${id}`, { method: "DELETE" })
  },
  // ... other entities
};
```

### 4.2 Update Zustand Stores

Modify stores to:
1. Fetch initial data from API on mount
2. Sync changes to API
3. Handle optimistic updates
4. Manage loading/error states

**Example pattern:**
```typescript
export const useRowingStore = create<RowingStore>()(
  (set, get) => ({
    sessions: [],
    isLoading: false,
    error: null,

    // Fetch from API
    fetchSessions: async () => {
      set({ isLoading: true, error: null });
      try {
        const sessions = await api.sessions.getAll();
        set({ sessions, isLoading: false });
      } catch (error) {
        set({ error: error.message, isLoading: false });
      }
    },

    // Add with API sync
    addSessions: async (newSessions) => {
      // Optimistic update
      set(state => ({
        sessions: [...state.sessions, ...newSessions]
      }));

      try {
        await api.sessions.create(newSessions);
      } catch (error) {
        // Rollback on failure
        set(state => ({
          sessions: state.sessions.filter(
            s => !newSessions.find(ns => ns.id === s.id)
          ),
          error: error.message
        }));
      }
    }
  })
);
```

---

## Phase 5: Data Migration (Day 10-11)

### 5.1 Create Migration Utility

**File: `src/lib/migration/exportLocalData.ts`**
```typescript
export function exportLocalStorageData() {
  const data = {
    sessions: JSON.parse(localStorage.getItem("rowing-tracker-storage") || "{}"),
    achievements: JSON.parse(localStorage.getItem("rowing-achievement-generator") || "{}"),
    chatSessions: JSON.parse(localStorage.getItem("rowing_ai_chat_sessions") || "[]"),
    trainingPlans: JSON.parse(localStorage.getItem("rowing_training_plans") || "[]"),
    insightsCache: JSON.parse(localStorage.getItem("rowing_ai_insights_cache") || "{}"),
    insightsArchive: JSON.parse(localStorage.getItem("rowing_ai_insights_archive") || "[]"),
    settings: JSON.parse(localStorage.getItem("rowing_app_settings") || "{}")
  };

  return data;
}
```

### 5.2 Create Import API

**File: `src/app/api/migrate/route.ts`**
```typescript
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const userId = session.user.id;

  // Import in transaction
  await prisma.$transaction(async (tx) => {
    // Import sessions
    if (data.sessions?.state?.sessions) {
      await tx.rowingSession.createMany({
        data: data.sessions.state.sessions.map(s => ({
          userId,
          ...transformSession(s)
        })),
        skipDuplicates: true
      });
    }

    // Import awards, plans, etc.
    // ...
  });

  return NextResponse.json({ success: true });
}
```

### 5.3 Create Migration UI

Add migration button in Settings page that:
1. Exports localStorage data
2. Sends to migration API
3. Shows progress/success
4. Optionally clears localStorage after successful migration

---

## Phase 6: Testing & Deployment (Day 12-14)

### 6.1 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Session import from CSV works
- [ ] Sessions are isolated per user
- [ ] Training plans CRUD works
- [ ] Chat history persists
- [ ] AI insights generate and cache
- [ ] Settings persist
- [ ] Data migration works
- [ ] Logout clears session

### 6.2 Environment Variables for Production

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="production-secret"
OPENAI_API_KEY="..." # Optional: for server-side AI
```

### 6.3 Database Hosting Options

1. **Vercel Postgres** - Easy integration, managed
2. **Supabase** - Free tier, good DX
3. **Railway** - Simple, affordable
4. **PlanetScale** - MySQL, serverless
5. **Self-hosted** - Full control

---

## Rollback Plan

If issues arise:
1. Keep localStorage code paths available behind feature flag
2. Database can be disabled via environment variable
3. Export API allows users to download their data

---

## Future Enhancements

1. **Real-time sync** - WebSocket for multi-device sync
2. **Offline support** - Service worker + IndexedDB cache
3. **Data sharing** - Share sessions/achievements with others
4. **Team features** - Groups, leaderboards
5. **API access** - Public API for third-party integrations

