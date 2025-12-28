/**
 * Analytics Cache Service
 *
 * Caches pre-computed chart data for the analytics page.
 * This stores the FINAL chart data points, not raw sessions.
 *
 * Key insight: Analytics charts only need {date, value} pairs.
 * By caching these computed values, we avoid:
 * 1. Fetching large session payloads on every page load
 * 2. Re-computing derived values (consistency scores, etc.)
 * 3. Processing hundreds of sessions client-side
 */

import { ChartMetric } from '@/lib/store';

// Chart data point as displayed in charts
export interface ChartDataPoint {
  date: string;
  fullDate: string | Date;
  sessionId: string;
  value: number;
  smoothedValue?: number | null;
}

// Summary statistics for the analytics page
export interface AnalyticsSummary {
  totalDistance: number;
  totalDuration: number;
  totalEnergy: number;
  totalPower: number;
  sessionCount: number;
  avgPace: number;
  avgPower: number;
  avgStrokeRate: number;
}

// Cached analytics data structure
export interface CachedAnalyticsData {
  // Chart data for each metric
  chartData: Record<ChartMetric, ChartDataPoint[]>;
  // Summary statistics
  summary: AnalyticsSummary;
  // Scatter plot data
  scatterData: Array<{
    sessionId: string;
    date: string;
    distance: number;
    duration: number;
    durationMinutes: number;
    power: number;
    pace: number;
    strokeRate: number;
    energy: number;
    strokeLength: number;
  }>;
  // Available dates for date picker
  availableDates: string[];
  // Version info for cache invalidation
  sessionsRevision: number;
  sessionCount: number;
  cachedAt: number;
}

const ANALYTICS_CACHE_KEY = 'rowing_analytics_cache';
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days max

/**
 * Get cached analytics data from localStorage
 */
export function getCachedAnalytics(): CachedAnalyticsData | null {
  if (typeof window === 'undefined') {
    console.log('[AnalyticsCache] getCachedAnalytics: window undefined (SSR)');
    return null;
  }

  try {
    const cached = localStorage.getItem(ANALYTICS_CACHE_KEY);
    console.log('[AnalyticsCache] getCachedAnalytics: localStorage key exists?', !!cached);
    
    if (!cached) {
      console.log('[AnalyticsCache] getCachedAnalytics: No cache found in localStorage');
      return null;
    }

    const data: CachedAnalyticsData = JSON.parse(cached);
    console.log('[AnalyticsCache] getCachedAnalytics: Parsed cache data:', {
      sessionsRevision: data.sessionsRevision,
      sessionCount: data.sessionCount,
      cachedAt: new Date(data.cachedAt).toISOString(),
      ageMs: Date.now() - data.cachedAt,
      maxAgeMs: MAX_CACHE_AGE_MS
    });

    // Check if cache is too old
    if (Date.now() - data.cachedAt > MAX_CACHE_AGE_MS) {
      console.log('[AnalyticsCache] getCachedAnalytics: Cache too old, clearing');
      clearAnalyticsCache();
      return null;
    }

    console.log('[AnalyticsCache] getCachedAnalytics: Returning valid cache');
    return data;
  } catch (error) {
    console.error('[AnalyticsCache] Error reading cache:', error);
    clearAnalyticsCache();
    return null;
  }
}

/**
 * Save analytics data to cache
 */
export function cacheAnalyticsData(data: CachedAnalyticsData): void {
  if (typeof window === 'undefined') {
    console.log('[AnalyticsCache] cacheAnalyticsData: window undefined (SSR), skipping');
    return;
  }

  try {
    const jsonString = JSON.stringify(data);
    const sizeKB = Math.round(jsonString.length / 1024);
    console.log('[AnalyticsCache] cacheAnalyticsData: Attempting to cache', {
      sessionsRevision: data.sessionsRevision,
      sessionCount: data.sessionCount,
      sizeKB: sizeKB,
      cachedAt: new Date(data.cachedAt).toISOString()
    });
    
    localStorage.setItem(ANALYTICS_CACHE_KEY, jsonString);
    console.log('[AnalyticsCache] ✅ Successfully cached analytics data');
  } catch (error) {
    console.error('[AnalyticsCache] ❌ Error writing cache:', error);
    // If quota exceeded, clear and don't cache
    clearAnalyticsCache();
  }
}

/**
 * Clear the analytics cache
 */
export function clearAnalyticsCache(): void {
  if (typeof window === 'undefined') return;

  try {
    console.log('[AnalyticsCache] clearAnalyticsCache: Clearing cache');
    localStorage.removeItem(ANALYTICS_CACHE_KEY);
    console.log('[AnalyticsCache] ✅ Cache cleared');
  } catch (error) {
    console.error('[AnalyticsCache] ❌ Error clearing cache:', error);
  }
}

/**
 * Check if cache is valid based on revision and session count
 */
export function isAnalyticsCacheValid(
  cached: CachedAnalyticsData | null,
  currentRevision: number,
  currentSessionCount: number
): boolean {
  if (!cached) return false;

  // Cache is valid if revision matches AND session count matches
  return (
    cached.sessionsRevision === currentRevision &&
    cached.sessionCount === currentSessionCount
  );
}

/**
 * Fetch the current sessions revision from the server
 */
export async function fetchSessionsRevision(): Promise<{ revision: number; count: number }> {
  try {
    const response = await fetch('/api/sessions/list');
    if (!response.ok) {
      throw new Error('Failed to fetch sessions revision');
    }
    const data = await response.json();
    return {
      revision: data.sessionsRevision ?? 0,
      count: data.count ?? 0,
    };
  } catch (error) {
    console.error('[AnalyticsCache] Error fetching revision:', error);
    return { revision: -1, count: -1 };
  }
}
