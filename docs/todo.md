# Rowing Tracker MVP - Implementation Plan

## Overview
Build a stunning web app to visualize SmartRow CSV exports with beautiful analytics, trends, and personal records.

**Target:** MVP in ~8 days
**Tech Stack:** Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui, Recharts, localStorage + Zustand

---

## Phase 1: Foundation & Setup (Days 1-2)

### Documentation
- [x] Create comprehensive README.md
  - Project overview
  - Tech stack
  - Setup instructions
  - SmartRow CSV export guide
  - Architecture overview

### Project Setup
- [ ] Initialize Next.js project with TypeScript (`npx create-next-app@latest`)
- [ ] TailwindCSS (auto-configured during Next.js setup)
- [ ] Install shadcn/ui CLI (`npx shadcn@latest init`)
- [ ] Install Recharts (`npm install recharts`)
- [ ] Install Zustand (`npm install zustand`)
- [ ] Set up App Router structure: `app/(routes)`, `components/`, `lib/`, `types/`
- [ ] Configure dark mode with Tailwind (class strategy)

### Data Layer
- [ ] Create TypeScript interfaces in `types/session.ts`
- [ ] Build CSV parser in `lib/csvParser.ts`
  - Use `papaparse` library for CSV parsing (`npm install papaparse`)
  - Handle semicolon delimiter
  - Parse European decimal format (comma to dot)
  - Parse timestamp format (YYYY-MM-DD HH:MM:SS.mmm)
  - Map all SmartRow CSV columns
- [ ] Create Zustand store in `lib/store.ts`
  - Use `persist` middleware for localStorage
  - Store sessions array
  - Duplicate detection helper (timestamp + distance + duration)
  - Actions: addSessions, clearSessions
- [ ] Add CSV validation helpers in `lib/validation.ts`
  - Check required columns exist
  - Validate data types
  - Return user-friendly error messages

---

## Phase 2: CSV Import Flow (Day 3)

### Upload UI
- [ ] Create welcome/landing page
  - Hero section with tagline
  - Instructions for CSV export from SmartRow
  - Clear CTA button
- [ ] Build file upload component
  - Drag-and-drop zone
  - File picker fallback
  - File type validation (.csv only)
- [ ] Implement upload flow
  - "Processing..." loading state with progress indicator
  - Parse CSV with papaparse
  - Store in Zustand (auto-persists to localStorage)
  - Detect and skip duplicates
- [ ] Create import success screen
  - Show total sessions imported
  - Show duplicates skipped
  - Display total distance and time
  - "Go to Dashboard" button
- [ ] Add error handling
  - Invalid CSV format errors
  - Empty file handling
  - Detailed error messages

---

## Phase 3: Dashboard (Days 4-5)

### Layout & Navigation
- [ ] Create `app/layout.tsx` with root layout
- [ ] Add shadcn components: `npx shadcn@latest add button card`
- [ ] Create simple top navigation (no sidebar for MVP simplicity)
  - Header with app title and navigation links
  - Mobile: horizontal scroll or dropdown menu
- [ ] Set up App Router routes:
  - `app/page.tsx` - Dashboard
  - `app/sessions/page.tsx` - Sessions list
  - `app/sessions/[id]/page.tsx` - Session detail
  - `app/prs/page.tsx` - Personal records
  - `app/upload/page.tsx` - Upload page

### Key Metrics Cards
- [ ] Total distance card
  - All-time total
  - Last 30 days
  - Icon and visual styling
- [ ] Total time card
  - All-time total
  - Last 30 days
  - Format as hours:minutes
- [ ] Average pace card
  - Last 30 days average
  - Format as min:sec / 500m
- [ ] Average power card
  - Last 30 days average
  - Display in watts
- [ ] Current streak card
  - Calculate consecutive days with sessions
  - Display current and best streak

### Charts
- [ ] Volume over time chart using Recharts
  - Use `ResponsiveContainer` for auto-sizing
  - `LineChart` or `BarChart` for distance/duration
  - Built-in `Tooltip` component for hover values
  - Filter data based on selected time range
- [ ] Time range selector with shadcn buttons
  - Buttons for: 7 days, 30 days, 90 days, All time
  - Use React state for selection (no persistence needed for MVP)
  - Filter sessions array based on selection

### Data Calculations
- [ ] Implement helper functions
  - Calculate totals for date ranges
  - Calculate averages (pace, power, stroke rate)
  - Calculate streaks (consecutive days)
  - Format time/pace/distance display

---

## Phase 4: Sessions List (Day 6)

### Sessions Table
- [ ] Add shadcn table: `npx shadcn@latest add table`
- [ ] Build sessions list in `app/sessions/page.tsx`
  - Use shadcn Table component
  - Columns: Date, Distance, Time, Avg Pace, Avg Power, Stroke Rate
  - Client-side sorting with React state
  - Hover styles with Tailwind
  - Click row to navigate using Next.js Link
- [ ] Simple pagination (for MVP: show all, add pagination if >100 sessions)

### Filtering
- [ ] Date range filter
  - Date picker for start/end dates
  - Quick filters: Last week, Last month, Last 3 months
- [ ] Distance filter
  - Dropdown or slider: 500m, 1000m, 2000m+, All
- [ ] Clear filters button

### Sorting
- [ ] Sort by date (default: newest first)
- [ ] Sort by distance (ascending/descending)
- [ ] Sort by pace (fastest/slowest)
- [ ] Sort by power (highest/lowest)
- [ ] Visual indicator for active sort

---

## Phase 5: Session Detail (Day 7)

### Detail Page
- [ ] Create session detail route with ID parameter
- [ ] Build detail page layout
- [ ] Display session metadata
  - Date and time
  - Distance and duration
  - Average and minimum split
  - Average and max power
  - Stroke count and rates
  - Energy (kCal)
  - Stroke length

### Statistics Grid
- [ ] Create metric cards for detail view
  - Pace (avg and min)
  - Power (avg and max)
  - Stroke rate (avg and max)
  - Stroke length
  - Energy and work

### Navigation
- [ ] Back button to sessions list
- [ ] Previous/Next session buttons
- [ ] Breadcrumb navigation

### Future Enhancement Placeholders
- [ ] Add placeholder for charts (when interval data available)
- [ ] Add placeholder for session comparison

---

## Phase 6: Personal Records (Day 8)

### PR Calculations
- [ ] Implement PR calculation logic
  - Best (fastest) time for 500m
  - Best time for 1000m
  - Best time for 2000m
  - Best time for 5000m
  - Track date of each PR
- [ ] Calculate best average power
- [ ] Calculate best stroke rate

### PR Display
- [ ] Create PRs page
- [ ] Build PR cards
  - Distance category
  - Best time
  - Date achieved
  - Average pace
  - Average power
  - Visual styling (gold/trophy theme)
- [ ] Show "No PR yet" for uncompleted distances

### PR Badges
- [ ] Add PR badges to sessions list
  - Small icon/badge for sessions with PRs
  - Tooltip showing which PR was achieved
- [ ] Highlight PR sessions in table

---

## Phase 7: Polish & Responsive Design (Day 8+)

### UI/UX Polish
- [ ] Implement dark theme styling
  - Dark background with contrast
  - Accent colors for charts and metrics
  - Good readability
- [ ] Add loading states
  - Skeleton loaders for charts
  - Spinner for data operations
- [ ] Add empty states
  - No sessions yet (before upload)
  - No sessions in filter range
  - Encouraging copy and CTAs
- [ ] Micro-interactions
  - Hover effects on cards
  - Smooth transitions
  - Button feedback

### Responsive Design
- [ ] Desktop layout (default)
  - Multi-column dashboard
  - Wide charts
- [ ] Tablet layout
  - Stack cards in 2 columns
  - Adjust chart sizes
- [ ] Mobile layout
  - Single column stack
  - Collapsible navigation
  - Touch-friendly buttons
  - Horizontal scroll for table

### Accessibility
- [ ] Keyboard navigation
- [ ] ARIA labels
- [ ] Color contrast validation
- [ ] Focus states

### Performance
- [ ] Use React.useMemo for expensive calculations (PR calculations, aggregations)
- [ ] Recharts automatically optimizes with ResponsiveContainer
- [ ] Next.js App Router handles code splitting automatically
- [ ] Zustand is already optimized (no re-renders on unrelated state changes)

---

## Features Deferred to Post-MVP

### Not in MVP (add later)
- ❌ Unit/integration tests
- ❌ Heart rate charts (data not available in CSV)
- ❌ Interval breakdown (not in CSV)
- ❌ Session comparison view
- ❌ Period comparisons (this month vs last)
- ❌ Training load calculations
- ❌ Automated insights/recommendations
- ❌ Data export functionality
- ❌ Settings/preferences page
- ❌ Light theme toggle
- ❌ Weekly/monthly trend charts
- ❌ Session type tagging
- ❌ Similar session suggestions
- ❌ Advanced consistency analytics

---

## Technical Notes

### SmartRow CSV Format
```
Delimiter: semicolon (;)
Decimal: comma (,) - European format
Timestamp: YYYY-MM-DD HH:MM:SS.mmm (UTC)
Time field: seconds
```

### Key Columns
- Time stamp (UTC)
- Distance (m)
- Time (seconds)
- Energy (kCal)
- Stroke count (#)
- Average power (W)
- Maximum power (W)
- Average split (s) - per 500m
- Minimum split (s)
- Average stroke rate (SPM)
- Maximum stroke rate (SPM)

### Data Model
```typescript
interface Session {
  id: string;
  timestamp: Date;
  distance: number; // meters
  duration: number; // seconds
  energy: number; // kCal
  strokeCount: number;
  avgPower: number; // watts
  maxPower: number;
  wattPerKg: number;
  avgSplit: number; // seconds per 500m
  minSplit: number;
  avgWork: number; // joules
  avgStrokeLength: number; // meters
  avgStrokeRate: number; // SPM
  maxStrokeRate: number;
}
```

---

## Success Criteria

### MVP is complete when:
1. ✅ User can upload SmartRow CSV
2. ✅ Dashboard shows key metrics and volume chart
3. ✅ Sessions list is browsable and filterable
4. ✅ Session detail view displays all metadata
5. ✅ PRs are calculated and displayed
6. ✅ UI is modern, dark-themed, and responsive
7. ✅ No data corruption or loss
8. ✅ Duplicate imports are handled gracefully

### Quality Gates:
- Dashboard loads in < 2 seconds with 100+ sessions
- CSV import handles 500+ sessions without issues
- All pages are mobile-responsive
- No console errors in production build
- Graceful error handling with user feedback

---

## Estimated Timeline

- **Day 1:** README, Project setup, CSV parser
- **Day 2:** Zustand store with persist, Data validation
- **Day 3:** Upload UI, Import flow
- **Day 4:** Dashboard layout, Metric cards
- **Day 5:** Dashboard charts, Time range filters
- **Day 6:** Sessions list, Filtering, Sorting
- **Day 7:** Session detail page
- **Day 8:** PRs calculation, Polish, Responsive design

**Total: 8 days** (single developer, full-time)

---

## Architecture Decisions & Simplifications

### ✅ Validated Choices (based on latest docs & best practices)

**1. Next.js 15 App Router**
- ✅ Modern, stable approach (v15 released Nov 2024)
- ✅ File-based routing reduces boilerplate
- ✅ Automatic code splitting and optimization
- ✅ Server components by default (add 'use client' only when needed)

**2. Zustand + persist middleware (instead of IndexedDB)**
- ✅ Much simpler API than Redux or IndexedDB
- ✅ Built-in localStorage persistence with one line of code
- ✅ No re-render issues, minimal boilerplate
- ✅ Perfect for client-side apps with <10,000 records
- ✅ Example: `persist((set) => ({sessions: []}), {name: 'rowing-data'})`

**3. shadcn/ui Components**
- ✅ CLI-driven install: `npx shadcn@latest add button card table`
- ✅ Components live in your codebase (full control)
- ✅ Built on Radix UI (accessible) + Tailwind (customizable)
- ✅ No runtime dependency bloat

**4. Recharts for Data Visualization**
- ✅ Declarative React components
- ✅ `ResponsiveContainer` handles all sizing automatically
- ✅ Built-in Tooltip, Legend, CartesianGrid components
- ✅ Works great with TypeScript

**5. papaparse for CSV Parsing**
- ✅ Battle-tested library (10M+ weekly downloads)
- ✅ Handles edge cases (quotes, newlines, different delimiters)
- ✅ Streaming support for large files
- ✅ Type detection and header parsing

### 🎯 Key Simplifications Made

**Removed:**
- ❌ IndexedDB → Use Zustand persist (localStorage)
  - *Reason:* IndexedDB is overkill for <10K sessions. localStorage limit is 5-10MB = ~50K sessions
- ❌ Sidebar navigation → Simple top nav
  - *Reason:* Fewer UI components to build, better mobile UX
- ❌ Time range persistence → React state only
  - *Reason:* KISS principle - user can re-select on page load
- ❌ Pagination → Show all (defer until >100 sessions)
  - *Reason:* Premature optimization. Add when actually needed.
- ❌ Complex state management → Minimal Zustand store
  - *Reason:* App is mostly read-heavy. Don't need Redux complexity.

### 📦 Minimal Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "zustand": "^5.0.0",
    "recharts": "^2.12.0",
    "papaparse": "^5.4.0",
    "@radix-ui/*": "via shadcn",
    "tailwindcss": "^3.4.0"
  }
}
```

**Total: ~6 main dependencies** (vs 15+ with IndexedDB + Redux approach)

### 🚀 Quick Start Commands

```bash
# 1. Create project
npx create-next-app@latest rowing-tracker --typescript --tailwind --app

# 2. Install shadcn
cd rowing-tracker
npx shadcn@latest init

# 3. Install dependencies
npm install zustand recharts papaparse
npm install --save-dev @types/papaparse

# 4. Add shadcn components
npx shadcn@latest add button card table badge

# Ready to code! 🎉
```

### ⚡ Performance Strategy

**Built-in optimizations (no extra work needed):**
- Next.js App Router: Automatic code splitting
- Zustand: Selective re-renders (only components using changed state)
- Recharts: Virtualized rendering for large datasets
- TailwindCSS: Purges unused styles automatically

**Add only when needed:**
- `React.useMemo` for expensive calculations (PRs, aggregations)
- `React.memo` for expensive renders (charts with many data points)

### 🛡️ Error Handling Strategy

**Simple & reliable:**
1. Try-catch around CSV parsing
2. Zod schema validation for TypeScript types (optional)
3. Toast notifications for user feedback (shadcn toast component)
4. Error boundaries for React crashes

**No need for:**
- Complex error tracking (Sentry, etc.) in MVP
- Retry logic or offline queues
- Advanced logging infrastructure
