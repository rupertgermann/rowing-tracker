# AGENTS.md

This file provides guidance for AI coding agents working in this repository.

## Project Overview

**Rowing Tracker** - A Next.js 15 application for tracking rowing workouts with AI-powered insights, training plans, and achievement tracking.

**Tech Stack:**
- Next.js 15 with App Router (src/app/)
- TypeScript with strict mode
- Prisma v7 with PostgreSQL
- Zustand for client state with DB persistence
- NextAuth.js v4 for authentication
- TailwindCSS v4 + shadcn/ui components
- OpenAI API for AI features

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server (localhost:3000)

# Building
npm run build            # Production build
npm run start            # Start production server

# Linting & Type Checking
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

**Running a Single Test:**
```bash
# Run tests in watch mode (if Jest/Vitest is configured)
npm run test              # Run all tests
npm run test -- --watch  # Watch mode for development

# Run a specific test file
npm run test -- path/to/test.ts
```

## Code Style Guidelines

### Imports

**Use absolute imports (configured in tsconfig.json):**
```typescript
import { useState } from 'react';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { settings } from '@/lib/settings';
```

**Import order:**
1. React/Next.js imports (react, next/navigation, etc.)
2. Third-party library imports (recharts, papaparse, etc.)
3. Internal imports from @/ (components, lib, hooks, types)

**Avoid:**
```typescript
// ❌ Bad - relative imports
import { Button } from '../../../components/ui/button';
import { settings } from '../../../lib/settings';

// ❌ Bad - importing entire libraries unnecessarily
import * as React from 'react';
import * as ReactIcons from 'lucide-react';

// ✅ Good
import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings } from 'lucide-react';
```

### Formatting

**Use TailwindCSS utility classes:**
```tsx
<div className="p-4 rounded-lg border shadow-md">
  <Button variant="outline" size="sm" className="w-full">
    Click Me
  </Button>
</div>
```

**Use shadcn/ui components for consistent styling:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

**Use `cn()` utility for dynamic class merging:**
```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  isActive && "active-class",  // Conditional classes
  props.className  // Merge with props.className
)}>
```

### Types & Type Safety

**Define interfaces in `src/types/` directory:**
```typescript
// src/types/session.ts
export interface Session {
  id: string;
  timestamp: Date;
  distance: number;
  duration: number;
  energy: number;
  strokeCount: number;
  avgPower: number;
  maxPower: number;
  avgSplit: number;
  minSplit: number;
  avgStrokeRate: number;
  maxStrokeRate: number;
}

export interface ImportResult {
  totalRows: number;
  importedSessions: number;
  duplicatesSkipped: number;
  errors: string[];
  totalDistance: number;
  totalTime: number;
}
```

**Type for component props:**
```typescript
interface MyComponentProps {
  title: string;
  onAction?: () => void;
  disabled?: boolean;
}

function MyComponent({ title, onAction, disabled = false }: MyComponentProps) {
  // ...
}
```

**Use explicit types for return values:**
```typescript
// ❌ Avoid implicit any
function parseData(data: unknown) {
  return JSON.parse(data); // Returns any
}

// ✅ Use explicit types
function parseData(data: string): Session[] {
  return JSON.parse(data) as Session[];
}

// ✅ Or use type guards
function isSession(obj: unknown): obj is Session {
  return typeof obj === 'object' && 'id' in obj && 'timestamp' in obj;
}
```

### Naming Conventions

**Files and Directories:**
- **Components**: PascalCase (`UserProfile.tsx`, `AwardsList.tsx`)
- **Hooks**: `use{Purpose}` (`useSettings.ts`, `useChat.ts`, `useAIInsights.ts`)
- **Utilities/Services**: camelCase (`settings.ts`, `dataSync.ts`, `cloudAI.ts`)
- **Types**: PascalCase interfaces (`Session.ts`, `ImportResult.ts`)
- **API Routes**: `route.ts` (located in `src/app/api/[route]/route.ts`)

**Variables and Functions:**
- **Variables**: camelCase (`userData`, `isLoading`, `setSettings`)
- **Constants**: UPPER_SNAKE_CASE (`DATABASE_URL`, `API_TIMEOUT_MS`)
- **React Components**: PascalCase (`function UserProfile() { }`)
- **Interface Properties**: camelCase (`userEmail`, `sessionId`, `isLoading`)

**Event Handlers:**
- Prefix with `handle` or `on`: `handleSubmit`, `onCancel`, `handleFileUpload`

**Boolean State:**
- Prefix with `is`, `has`, `should`:
  - `isLoading`, `isAuthenticated`, `hasError`, `shouldShowDialog`

### Error Handling

**Always use try-catch for async operations:**
```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    setError('Failed to load data');
    return null;
  }
}
```

**Error display to users:**
```typescript
// ❌ Bad - expose raw errors
catch (error) {
  alert(error.message);
}

// ✅ Good - provide user-friendly messages
catch (error) {
  setError('Failed to load data. Please try again later.');
  console.error('Detailed error:', error);
}
```

**API routes - return proper HTTP status codes:**
```typescript
// src/app/api/sessions/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // ... logic
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
```

**Status codes:**
- `200` - Success
- `201` - Created
- `400` - Bad request (validation error)
- `401` - Unauthorized (no session)
- `404` - Not found
- `500` - Server error

**Validation:**
```typescript
// Use Zod for input validation
import { z } from 'zod';

const settingsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  theme: z.enum(['light', 'dark', 'system'])
});

// In API route
const body = await req.json();
const result = settingsSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json(
    { error: 'Invalid input', details: result.error },
    { status: 400 }
  );
}
```

### State Management

**Use hooks for accessing Zustand store:**
```typescript
// ✅ Good - use custom hooks
const { sessions, addSessions } = useRowingStore();
const { settings, updateSettings } = useSettings();
const { chat, sendMessage } = useChat();

// ❌ Bad - direct store access
import { useRowingStore } from '@/lib/store';
const store = useRowingStore.getState();
```

**Settings - use SettingsService, not direct localStorage:**
```typescript
// ✅ Good - use useSettings hook
import { useSettings } from '@/hooks/useSettings';

function MyComponent() {
  const { settings, updateSettings, isLoading } = useSettings();

  return (
    <div>
      {settings?.theme}
      <Button onClick={() => updateSettings({ theme: 'dark' })}>
        Update Theme
      </Button>
    </div>
  );
}

// ❌ Bad - direct SettingsService or localStorage access
import { settings } from '@/lib/settings';

function MyComponent() {
  const data = settings.getSettings(); // Not reactive, won't update on changes
}
```

**Service Singleton Pattern:**
All services use `getInstance()`:
- `SettingsService.getInstance()` (lib/services/settings.ts)
- `CloudAIService.getInstance()` (lib/services/cloudAI.ts)
- `ChatStorageService.getInstance()` (lib/services/chatStorage.ts)
- `MemoryStorageService.getInstance()` (lib/services/memoryStorage.ts)
- `TrainingPlansService.getInstance()` (lib/services/trainingPlans.ts)

### Component Structure

**Use functional components with hooks:**
```typescript
'use client'; // Required for client-side interactivity

import { useState, useEffect } from 'react';

export default function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Effect logic
  }, []);

  return <div>...</div>;
}
```

**Extract complex logic into custom hooks:**
```typescript
// Create custom hook in src/hooks/useMyFeature.ts
import { useState, useEffect } from 'react';

export function useMyFeature() {
  const [state, setState] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Logic...
  return { state, isLoading, setState };
}
```

**Component composition:**
```typescript
// Build complex UI from smaller components
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconComponent } from '@/components/IconComponent';

export default function ComplexFeature() {
  return (
    <Card>
      <CardHeader>
        <IconComponent />
      </CardHeader>
      <CardContent>
        <Button>Action</Button>
      </CardContent>
    </Card>
  );
}
```

### File Organization

**Page Components:** `src/app/(routes)/page.tsx`
- Keep page logic minimal
- Extract complex features to separate components

**Reusable Components:** `src/components/`
- UI components: `src/components/ui/` (shadcn/ui)
- Feature components: `src/components/` (e.g., `SessionList.tsx`, `AwardsList.tsx`)

**API Routes:** `src/app/api/[route]/route.ts`
- Each route is a separate folder with route.ts
- Keep business logic in API routes, validation at the edge

**Hooks:** `src/hooks/`
- Custom React hooks for reusable logic
- Hook names: `use{Purpose}` (e.g., `useSettings`, `useChat`, `useAIInsights`)

**Utilities/Services:** `src/lib/`
- `services/`: Service singletons with `getInstance()` pattern
- `utils/`: Pure utility functions
- `ai/`: AI configuration and prompts
- `validations/`: Zod schemas

**Types:** `src/types/`
- All TypeScript interfaces
- No implementation code, just type definitions

## Architecture Patterns

### DB-First with Local Cache

**Pattern:** PostgreSQL is source of truth, localStorage is synchronous cache

```typescript
// SettingsService (lib/services/settings.ts)
class SettingsService {
  async initializeFromDB(): Promise<void> {
    const response = await fetch('/api/settings');
    const dbSettings = await response.json();

    // Preserve sensitive data from localStorage
    const currentLocalSettings = localStorage.getItem(this.STORAGE_KEY);
    const apiKey = currentLocalSettings?.aiSettings?.openaiApiKey || '';

    // Merge DB settings with localStorage
    const mergedSettings = { ...dbSettings, aiSettings: { openaiApiKey: apiKey } };

    // Cache in localStorage for synchronous access
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(mergedSettings));
  }

  getSettings(): Settings {
    // Return from localStorage (fast, synchronous)
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
  }

  updateSettings(updates: Partial<Settings>): void {
    const settings = this.getSettings();
    const newSettings = { ...settings, ...updates };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newSettings));
    this.debouncedSyncToDatabase(newSettings); // Debounced DB sync
  }
}
```

**Use hooks to access settings:**
```typescript
import { useSettings } from '@/hooks/useSettings';

function MyComponent() {
  const { settings, updateSettings, isLoading } = useSettings();

  // Wait for initialization before accessing
  if (isLoading || !settings) {
    return <div>Loading...</div>;
  }

  // Access settings reactively
  return <div>{settings.theme}</div>;
}
```

### Service Singleton Pattern

All services use `getInstance()` pattern:

```typescript
// lib/services/settings.ts
export class SettingsService {
  private static instance: SettingsService;

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  private constructor() { } // Private to prevent direct instantiation
}
```

**Services:**
- `SettingsService` - User settings with DB sync
- `CloudAIService` - OpenAI API integration
- `ChatStorageService` - Chat history persistence
- `MemoryStorageService` - Memory document storage
- `TrainingPlansService` - Training plan management

### API Route Patterns

**Authentication:**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Filter all queries by userId
  const userId = session.user.id;
  // ... business logic
}
```

**Input validation with Zod:**
```typescript
import { z } from 'zod';
import { settingsUpdateSchema } from '@/lib/validations/settings';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const result = settingsUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 });
  }

  // ... business logic
}
```

### SmartRow CSV Integration

**Auto-detect delimiter (comma vs semicolon):**
```typescript
function detectDelimiter(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}
```

**European decimal format:**
```typescript
function parseEuropeanNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.trim().replace(',', '.'); // Comma to dot
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
```

**Always validate CSV before parsing:**
```typescript
export async function validateSmartRowCsv(file: File): Promise<{ isValid: boolean; error?: string }> {
  // Try both semicolon and comma delimiters
  // Check for required columns: Time stamp (UTC), Distance (m), Time
}
```

## Common Tasks and Key Files

### Adding a New API Route

1. Create route: `src/app/api/[feature]/route.ts`
2. Add validation schema in `src/lib/validations/[feature].ts`
3. Require authentication and filter by userId
4. Use proper HTTP status codes
5. Return JSON responses

Example:
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { featureSchema } from '@/lib/validations/feature';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const result = featureSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = await prisma.someModel.create({
    data: { ...result.data, userId: session.user.id }
  });

  return NextResponse.json({ success: true, data });
}
```

### Adding a New UI Component

1. Create in `src/components/[ComponentName].tsx`
2. Use existing shadcn/ui components when possible
3. Use TailwindCSS classes
4. Extract complex logic to custom hooks
5. Use TypeScript interfaces for props

Example:
```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  title: string;
  onSave: (data: any) => void;
}

export function MyComponent({ title, onSave }: MyComponentProps) {
  const [data, setData] = useState(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
        <Button onClick={() => onSave(data)}>Save</Button>
      </CardContent>
    </Card>
  );
}
```

### Modifying Settings

1. Update interface in `src/types/session.ts` (settings-related types in `src/lib/settings.ts`)
2. Add update method in `SettingsService` class (lib/services/settings.ts)
3. Add callback in `useSettings` hook
4. Update UI in Settings page (src/app/settings/page.tsx)
5. Ensure sensitive data is preserved in localStorage on DB initialization

Example for adding new setting:
```typescript
// 1. Update interface in src/lib/settings.ts
export interface MyFeatureSettings {
  enabled: boolean;
  config: string;
}

export interface Settings {
  // ... existing
  myFeatureSettings: MyFeatureSettings;
}

// 2. Add to defaults
private defaultSettings: Settings = {
  // ... existing
  myFeatureSettings: {
    enabled: false,
    config: 'default'
  }
};

// 3. Add update method
updateMyFeatureSettings(updates: Partial<MyFeatureSettings>): void {
  const settings = this.getSettings();
  settings.myFeatureSettings = { ...settings.myFeatureSettings, ...updates };
  settings.updatedAt = new Date();
  this.saveSettings(settings);
}

// 4. Add callback in useSettings hook
const updateMyFeatureSettings = useCallback((updates: Partial<MyFeatureSettings>) => {
  try {
    setError(null);
    settingsService.updateMyFeatureSettings(updates);
    setSettings(settingsService.getSettings());
  } catch (err) {
    setError('Failed to update feature settings');
  }
}, [settingsService]);

// 5. Return from hook
return {
  // ... existing
  updateMyFeatureSettings,
};
```

### Database Changes

1. Update schema in `prisma/schema.prisma`
2. Run `npm run db:generate` to regenerate Prisma client
3. Run `npm run db:migrate` to create migration
4. Test migration locally
5. Update TypeScript types if needed

**Never run `db:reset` on production!**

### Working with Settings

**Critical pattern - always use hooks:**
```typescript
// ✅ Correct
import { useSettings } from '@/hooks/useSettings';

function MyComponent() {
  const { settings, updateSettings, isLoading } = useSettings();

  // Wait for initialization
  if (isLoading || !settings) {
    return <div>Loading settings...</div>;
  }

  const smartRowSettings = settings.smartRowSettings;
  const handleSave = () => {
    updateSettings({
      myFeatureSettings: { ...settings.myFeatureSettings, enabled: true }
    });
  };

  return <div>...</div>;
}

// ❌ Incorrect
import { settings } from '@/lib/settings';

function MyComponent() {
  const data = settings.getSettings(); // Not reactive, no initialization handling
  const handleSave = () => {
    settings.updateMyFeatureSettings({ enabled: true }); // No React state update
  };
  return <div>...</div>;
}
```

**Preserving sensitive settings on DB initialization:**
```typescript
// In _doInitializeFromDB() method
const dbSettings = await response.json();

// Get current localStorage to preserve sensitive data
const currentLocalSettings = localStorage.getItem(this.STORAGE_KEY);
let currentApiKey = '';
let currentSmartRowSettings = null;

if (currentLocalSettings) {
  try {
    const parsed = JSON.parse(currentLocalSettings);
    currentApiKey = parsed.aiSettings?.openaiApiKey || '';
    currentSmartRowSettings = parsed.smartRowSettings || null;
  } catch {
    console.warn('Failed to parse localStorage');
  }
}

// Transform DB settings
const appSettings = this.transformDBToAppSettings(dbSettings);
const migrated = this.migrateSettings(appSettings);

// Preserve from localStorage
if (currentApiKey) {
  migrated.aiSettings.openaiApiKey = currentApiKey;
}
if (currentSmartRowSettings) {
  migrated.smartRowSettings = currentSmartRowSettings;
}

// Save merged settings
localStorage.setItem(this.STORAGE_KEY, JSON.stringify(migrated));
```

## Testing Strategy

**Note:** This project uses Playwright for E2E testing.

```bash
# Run all E2E tests
npm run test

# Run specific test file
npm run test -- path/to/test.spec.ts

# Run tests in watch mode
npm run test -- --watch
```

**Testing patterns:**
1. Test API routes with authentication
2. Test settings persistence across page reloads
3. Test CSV parsing with both EU and US formats
4. Test file uploads and error handling
5. Test state management hooks

## Important Notes

### Security

1. **Never store API keys in database** - Always use localStorage only
2. **All API routes require authentication** - Use `getServerSession()` and filter by `userId`
3. **Input validation on all API routes** - Use Zod schemas
4. **Rate limiting** - Use Upstash Redis when configured

### Performance

1. **Debounce database syncs** - SettingsService uses 1s debounce
2. **Use connection pooling** - Prisma client in `lib/db/prisma.ts`
3. **Lazy load heavy components** - Use `LazyChart` component for charts
4. **Optimize re-renders** - Use `useMemo` and `useCallback` appropriately

### CSV Format Handling

**SmartRow exports can be comma or semicolon delimited:**
- EU format: semicolon delimiter (;), comma decimal (,)
- US format: comma delimiter (,), period decimal (.)

**Always auto-detect delimiter:**
```typescript
function detectDelimiter(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}
```

### Common Patterns

**Page reload flow:**
1. Settings page: Direct `settings` import → Calls `settings.getSettings()` → Shows data
2. Other pages: `useSettings` hook → Waits for initialization → Shows data

**Always prefer the hook pattern for new features.**

**File uploads:**
1. Validate file type and size before processing
2. Show progress during processing
3. Handle errors gracefully with user-friendly messages
4. Clean up temporary resources

**Component patterns:**
1. Use `'use client'` directive for components with interactivity
2. Server components can access backend directly
3. Client components use hooks for state management
4. Extract repeated UI into reusable components

### Environment Variables

**Required in `.env`:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Auth signing key
- `NEXTAUTH_URL` - App URL
- `EMAIL_SERVER`, `EMAIL_FROM` - SMTP for verification emails

**Optional:**
- `UPSTASH_REDIS_REST_URL/TOKEN` - Rate limiting
- OpenAI API key stored per-user in localStorage (never in DB)

### Database Migrations

**Prisma migration workflow:**
```bash
# 1. Update schema in prisma/schema.prisma
# 2. Generate Prisma client
npm run db:generate
# 3. Create migration
npm run db:migrate
# 4. Test locally
npm run dev
# 5. Deploy migration (production)
npm run db:migrate:deploy
```

**Never delete or modify migrations** - They're immutable records of schema changes.

## Debugging

**Console logging patterns:**
```typescript
// Error logging
console.error('[MODULE_NAME] Error message:', error);

// Warning logging
console.warn('[MODULE_NAME] Warning message:', details);

// Info logging
console.log('[MODULE_NAME] Action completed:', result);
```

**Browser console debugging:**
1. Use React DevTools for component state
2. Use Network tab for API requests/responses
3. Use Application tab for localStorage inspection
4. Check Console for errors and warnings

## Key Files Reference

| Purpose | File Path |
|---------|------------|
| Authentication config | `src/lib/auth.ts` |
| Database client | `src/lib/db/prisma.ts` |
| Settings service | `src/lib/services/settings.ts` |
| Settings hook | `src/hooks/useSettings.ts` |
| Chat service | `src/lib/services/cloudAI.ts` |
| Chat hook | `src/hooks/useChat.ts` |
| Main store | `src/lib/services/store.ts` |
| Achievement store | `src/lib/services/achievementStore.ts` |
| CSV parser | `src/lib/csvParser.ts` |
| Stroke parser | `src/lib/strokeParser.ts` |
| ZIP parser | `src/lib/zipParser.ts` |
| Validation | `src/lib/validation.ts` |
| Data sync | `src/lib/dataSync.ts` |
| SmartRow sync | `src/app/api/smartrow/sync/route.ts` |
