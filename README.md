![Rowing Tracker Header](docs/images/rowing-tracker_header.png)

# Rowing Tracker

An AI-powered web application for tracking rowing workouts with analytics, training plans, and achievement tracking. Built for rowers who use SmartRow equipment. This app was completely written by AI.

## Overview

Rowing Tracker is a modern, AI-powered web app built specifically for rowers who use SmartRow equipment. Upload your CSV exports and unlock the power of artificial intelligence to analyze your performance, generate personalized training plans, and receive expert coaching insights. With multi-user support and secure authentication, each rower gets their own private workspace with data stored in PostgreSQL (local or cloud).

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
- **Advanced Analytics**: Detailed breakdown of performance, split trends, stroke rate, and training adherence
- **Interactive Chart Explanations**: Click "Explain" on any chart (analytics page AND session details) to get AI-powered analysis—explanations are saved in tooltips for quick reference with "Back to chart" navigation
- **Time-Range Aware Explanations**: Analytics chart explanations are cached per time range—switching between "Last 7 days" and "Last 30 days" generates separate, context-appropriate AI analyses
- **Structured AI Explanations**: Chart explanations follow a clear format: "Why This Chart Matters" (practical value), "What I See In Your Data" (patterns/trends), and "What This Means For You" (actionable insights)
- **Performance Correlations**: Explore scatter plots showing relationships between power/pace, stroke rate/pace, duration/distance, energy/duration, and more
- **Sessions List**: Browse, filter, and sort all your rowing sessions with advanced search
- **Session Details**: Deep dive into individual workout metrics with interactive charts and AI explanations across all analysis modules:
  - *Overview*: Power & Stroke Rate
  - *Performance Graphs*: Pace Analysis, Work per Stroke, Stroke Length, Heart Rate
  - *Segments*: Segment Analysis (100m/500m), Rolling Power Average, Rolling Split Average
  - *Deep Analysis*: Power Distribution, Rhythm Distribution, Rate vs Power, Rate vs Split
- **Stroke-by-Stroke Analysis**: Upload SmartRow stroke exports to unlock power/rhythm distributions, stroke-length consistency, and technique maps for every stroke
- **Personal Records**: Automatic tracking of your best times and performances across all distances

### 🔐 Multi-User & Authentication

- **Secure Authentication**: Email/password login with email verification (double opt-in)
- **Magic Link Login**: Passwordless authentication via email
- **Google OAuth**: Optional sign-in with Google (when configured)
- **User Profiles**: Manage your account, change password, and update profile information
- **Data Isolation**: Each user's data is completely isolated and private

### 💾 Data & Storage

- **CSV Import**: Simple drag-and-drop upload for SmartRow CSV files
- **PostgreSQL Database**: Robust, scalable data storage with full ACID compliance
- **Local Development**: Docker-based PostgreSQL for easy local development
- **Cloud Ready**: Supabase support for production deployments
- **Memory System**: Upload and store PDFs and images for AI analysis
- **Data Privacy**: Your data is encrypted and isolated per user

### 🎨 User Experience

- **Dark Theme**: Modern, easy-on-the-eyes interface
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Offline-First**: All features work offline except AI-powered capabilities
- **Rich Tooltips**: AI explanations display in beautifully formatted tooltips with markdown rendering, responsive sizing, and smooth scrolling
- **Smart Navigation**: "Back to chart" links from chat explanations navigate directly to the source chart (both analytics and session detail pages) with automatic scroll-to-view

### 🏅 Gamification & Motivation

- **Dynamic Awards System**: Earn achievements for session milestones (First Splash, Century Club, Year of Rowing), total distance (Million Meter Club), streaks, duration, power output, pace improvements, and more
- **Improvement Awards**: Track percentage gains in power (up to +100% Double Power) and pace compared to your baseline to unlock progressive tier awards
- **Streak Milestones**: Stay consistent with notifications for 7-, 14-, 21-, 45-, 60-, and 100-day streaks
- **Live Award Notifications**: Celebrate wins instantly with animated overlays whenever you unlock something new
- **High-Tier Stretch Goals**: Long-term achievements including 750k meters, 1 Million meters, 100 hours rowing, 300W power, and sub-1:35/500m pace

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **Charts**: Recharts
- **AI Integration**: OpenAI API
- **Authentication**: NextAuth.js v4
- **Database**: PostgreSQL with Prisma v7
- **State Management**: Zustand with persist middleware
- **Storage**: 
  - PostgreSQL for user data, sessions, plans, and achievements
  - File system for award images
- **CSV Parsing**: papaparse
- **Email**: Nodemailer with Mailpit (local) or SMTP (production)
- **Rate Limiting**: Upstash Redis for API protection
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
   - Enter your OpenAI API Key to enable Chat and Training Plans
   - Add your Personal Context to inform the AI about medical conditions, preferences, or goals
   - Customize the AI prompts in the Advanced Configuration section

## SmartRow CSV Export Guide

### How to Export Your Data

1. **Connect to SmartRow App**
   - Open the SmartRow mobile app
   - Ensure you're logged in and synced

2. **Export Sessions**
   - Go to Settings/Profile
   - Find "Export Data" or "CSV Export"
   - Select the date range you want to export
   - Choose CSV format
   - Download the file to your device

3. **Upload to Rowing Tracker**
   - Open the Rowing Tracker web app
   - Drag and drop your CSV file or click to browse
   - Wait for processing (typically instant for most files)
   - Your data will be automatically analyzed and stored

### CSV Format Requirements

The app expects SmartRow CSV exports with the following format:
- **Delimiter**: Semicolon (;)
- **Decimal Format**: Comma (,) - European format
- **Timestamp**: YYYY-MM-DD HH:MM:SS.mmm (UTC)
- **Time Field**: Seconds

### Required Columns

Your CSV must include these columns:
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
# Start local Docker services
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

# Open Prisma Studio (database GUI)
npm run db:studio

# Push schema without migration (dev only)
npm run db:push
```

## Architecture Overview

```
rowing-tracker/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (routes)/          # Route groups
│   │   │   ├── page.tsx       # Dashboard
│   │   │   ├── sessions/      # Sessions pages
│   │   │   ├── prs/           # Personal records
│   │   │   ├── upload/        # CSV upload
│   │   │   ├── analytics/     # Advanced analytics
│   │   │   ├── chat/          # AI Coach chat
│   │   │   ├── plans/         # Training plans
│   │   │   ├── profile/       # User profile
│   │   │   └── settings/      # App settings
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   └── user/          # User management
│   │   ├── auth/              # Auth pages
│   │   │   ├── login/         # Login page
│   │   │   ├── register/      # Registration
│   │   │   └── verify-email/  # Email verification
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable UI components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utility functions & services
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── db/prisma.ts       # Prisma client singleton
│   │   ├── services/          # Service singletons
│   │   ├── ai/                # AI configuration & prompts
│   │   └── utils/             # Utilities (CSV parser, awards, etc.)
│   └── types/                 # TypeScript type definitions
├── prisma/                    # Database schema & migrations
│   └── schema.prisma
├── docs/                      # Documentation
│   ├── DATABASE_SCHEMA.md
│   ├── design-system.md
│   ├── prd.md
│   └── csvs/                  # Sample SmartRow CSV files
└── docker-compose.yml         # Local PostgreSQL & Mailpit
```

### Data Flow

1. **Authentication**: User registers/logs in → NextAuth validates → JWT session created
2. **Upload**: User drops CSV file → papaparse processes → validation → saved to PostgreSQL
3. **Storage**: 
   - User data, sessions, plans → PostgreSQL via Prisma
   - Award images → File system
   - Client state → Zustand store (ephemeral)
4. **Display**: Components fetch from database → calculate metrics → render charts
5. **Analysis**: Real-time PR calculations, trend analysis, aggregations
6. **AI Features**: Context retrieved from database → sent to OpenAI → response streamed
7. **Data Isolation**: All queries filtered by authenticated user ID

## Development

### Available Scripts

**Development:**
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

**Database:**
- `npm run db:start` - Start PostgreSQL & Mailpit
- `npm run db:stop` - Stop Docker services
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run db:push` - Push schema (dev only)
- `npm run db:reset` - Reset database

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

The app uses PostgreSQL with Prisma ORM. Key models:

**User Management:**
- `User` - User accounts with authentication
- `Account` - OAuth provider accounts
- `AuthSession` - Active sessions
- `VerificationToken` - Email verification tokens
- `UserSettings` - User preferences and configuration
- `UserApiKey` - Encrypted API keys (OpenAI, etc.)

**Rowing Data:**
- `RowingSession` - Workout sessions with metrics
- `StrokeData` - Stroke-by-stroke analysis data
- `PersonalRecord` - Best performances per distance

**Achievements:**
- `EarnedAward` - Unlocked achievements
- `AIAwardSuggestion` - AI-suggested custom awards
- `GeneratedAchievement` - AI-generated award stories/images

**Training:**
- `TrainingPlan` - Multi-week training programs
- `TrainingWeek` - Weekly training structure
- `TrainingSession` - Individual planned workouts
- `TrainingSessionLink` - Links planned to actual sessions

**AI & Memory:**
- `ChatSession` - AI coach conversations
- `ChatMessage` - Individual chat messages
- `AIInsight` - Generated performance insights
- `MemoryDocument` - Uploaded PDFs/images for AI context
- `MemoryBlob` - Binary data storage
- `ChartExplanation` - Cached chart explanations

See `prisma/schema.prisma` for complete schema or `docs/DATABASE_SCHEMA.md` for detailed documentation.

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
- `/api/auth/register` - Prevents registration spam
- `/api/chat` (POST) - Controls AI usage costs
- `/api/user/delete` - Protects account deletion
- `/api/user/export` - Prevents data export abuse

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
