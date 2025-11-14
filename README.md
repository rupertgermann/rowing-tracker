# Rowing Tracker

A stunning web application to visualize SmartRow CSV exports with beautiful analytics, trends, and personal records.

## Overview

Rowing Tracker is a modern, responsive web app built specifically for rowers who use SmartRow equipment. Upload your CSV exports and get instant access to comprehensive analytics, personal records tracking, and detailed session insights.

## Features

- **CSV Import**: Simple drag-and-drop upload for SmartRow CSV files
- **Dashboard**: Key metrics, volume charts, and trend analysis
- **Sessions List**: Browse, filter, and sort all your rowing sessions
- **Session Details**: Deep dive into individual workout metrics
- **Personal Records**: Track your best times and performances across distances
- **Dark Theme**: Modern, easy-on-the-eyes interface
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Local Storage**: Your data stays private and is stored locally in your browser

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **Charts**: Recharts
- **State Management**: Zustand with persist middleware
- **CSV Parsing**: papaparse
- **Data Storage**: Browser localStorage

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rowing-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

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

## Architecture Overview

```
rowing-tracker/
├── app/                    # Next.js App Router
│   ├── (routes)/          # Route groups
│   │   ├── page.tsx       # Dashboard
│   │   ├── sessions/      # Sessions pages
│   │   ├── prs/           # Personal records
│   │   └── upload/        # CSV upload
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
├── lib/                   # Utility functions
│   ├── csvParser.ts       # CSV parsing logic
│   ├── store.ts           # Zustand state management
│   ├── validation.ts      # Data validation
│   └── chartTheme.ts      # Chart theming
├── types/                 # TypeScript type definitions
│   └── session.ts         # Session interface
└── docs/                  # Documentation
    ├── prd.md             # Product requirements
    └── design-system.md   # Design guidelines
```

### Data Flow

1. **Upload**: User drops CSV file → papaparse processes → validation
2. **Storage**: Validated data → Zustand store → localStorage persistence
3. **Display**: Components read from store → calculate metrics → render charts
4. **Analysis**: Real-time PR calculations, trend analysis, aggregations

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

- **App Router**: Uses Next.js 15's App Router for file-based routing
- **Server Components**: Default for better performance
- **Client Components**: Mark with `'use client'` when needed
- **State Management**: Zustand with localStorage persistence
- **Styling**: TailwindCSS with dark theme support

### Adding Components

```bash
# Add shadcn/ui components
npx shadcn@latest add button card table badge

# Components are added to your components/ directory
```

## Data Model

```typescript
interface Session {
  id: string;
  timestamp: Date;
  distance: number;        // meters
  duration: number;        // seconds
  energy: number;          // kCal
  strokeCount: number;
  avgPower: number;        // watts
  maxPower: number;
  wattPerKg: number;
  avgSplit: number;        // seconds per 500m
  minSplit: number;
  avgWork: number;         // joules
  avgStrokeLength: number; // meters
  avgStrokeRate: number;   // SPM
  maxStrokeRate: number;
}
```

## Privacy & Data

- **Local Storage**: All data is stored locally in your browser
- **No Servers**: No data is sent to external servers
- **Privacy First**: Your workout data remains private
- **Export**: You can export your data at any time (future feature)

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
3. Verify your browser supports localStorage
4. Open an issue on GitHub with details about your CSV file and browser

---

**Built with ❤️ for the rowing community**
