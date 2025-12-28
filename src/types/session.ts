/**
 * SmartRow session data interface
 * Represents a single rowing session parsed from CSV export
 */

export interface Session {
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
  consistencyScore?: number | null; // Pre-computed consistency score (0-100)
  strokeData?: StrokeData[]; // Optional detailed stroke data
}

export interface StrokeData {
  strokeIndex: number;
  time: number; // Second (#)
  timestamp: string;
  distance: number; // Cumulative distance
  work: number;
  power: number; // Actual power
  avgPower: number;
  split: number; // Actual split (s) - likely per 500m
  avgSplit: number;
  strokeRate: number;
  heartRate: number | null;
  strokeLength?: number; // Calculated distance per stroke
}

/**
 * Raw CSV row interface for parsing SmartRow data
 * Maps directly to CSV column names
 */
export interface RawCsvRow {
  'Time stamp (UTC)': string;
  'Distance (m)': string;
  'Time': string;                    // seconds (not "Time (seconds)")
  'Energy (kCal)': string;
  'Stroke count (#)': string;
  'Average power (W)': string;
  'Maximum power (W)': string;
  'Watt per beat': string;
  'Watt per KG': string;
  'Average heart rate (bpm)': string;
  'Average split (s)': string;
  'Minimum split (s)': string;
  'Average work (J)': string;
  'Average stroke length (m)': string;
  'Average stroke time (s)': string;
  'Average stroke rate (SPM)': string;
  'Maximum stroke rate (SPM)': string;
  'Rower age': string;
  'Rower weight (kg)': string;
}

/**
 * Personal Record interface for tracking best performances
 */
export interface PersonalRecord {
  distance: number;        // meters (500, 1000, 2000, 5000)
  bestTime: number;        // seconds
  bestPace: number;        // seconds per 500m
  date: Date;             // when achieved
  avgPower: number;       // watts
  sessionId: string;      // reference to the session
}

/**
 * Aggregated statistics for dashboard
 */
export interface SessionStats {
  totalDistance: number;    // meters
  totalTime: number;        // seconds
  totalSessions: number;
  avgPace: number;          // seconds per 500m
  avgPower: number;         // watts
  avgStrokeRate: number;    // SPM
  currentStreak: number;    // consecutive days
  bestStreak: number;       // best consecutive days
}

/**
 * Chart data point for time series visualizations
 */
export interface ChartDataPoint {
  date: string;            // formatted date string
  distance: number;        // meters
  duration: number;        // seconds
  pace: number;           // seconds per 500m
  power: number;          // watts
  strokeRate: number;     // SPM
}

/**
 * Filter options for sessions list
 */
export interface SessionFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  distanceRange?: {
    min: number;
    max: number;
  };
  sortBy?: 'date' | 'distance' | 'pace' | 'power';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Import result from CSV processing
 */
export interface ImportResult {
  totalRows: number;
  importedSessions: number;
  duplicatesSkipped: number;
  errors: string[];
  totalDistance: number;   // meters
  totalTime: number;       // seconds
}
