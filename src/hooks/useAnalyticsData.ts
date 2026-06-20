'use client';

/**
 * useAnalyticsData Hook
 *
 * Provides cached analytics data for the analytics page.
 * Caches computed chart data in localStorage to avoid reprocessing on every page load.
 *
 * Strategy:
 * 1. On mount, check localStorage for cached chart data
 * 2. Validate cache against current sessionsRevision from server
 * 3. If valid, return cached data immediately (instant load)
 * 4. If invalid or missing, compute from sessions and cache
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRowingStore, ChartMetric, type SmoothingOption } from '@/lib/store';
import { formatChartDate } from '@/lib/dateTimeUtils';
import {
  getCachedAnalytics,
  cacheAnalyticsData,
  clearAnalyticsCache,
  isAnalyticsCacheValid,
  fetchSessionsRevision,
  type CachedAnalyticsData,
  type ChartDataPoint,
  type AnalyticsSummary,
} from '@/lib/services/analyticsCache';

// Chart data computation helpers
const calculateMovingAverage = (values: number[], windowSize: number): (number | null)[] => {
  if (windowSize === 0) return values;

  return values.map((_, index) => {
    if (index < windowSize - 1) return null;
    const window = values.slice(index - windowSize + 1, index + 1);
    return window.reduce((a, b) => a + b, 0) / windowSize;
  });
};

export interface UseAnalyticsDataResult {
  // Chart data for each metric
  chartData: Record<ChartMetric, ChartDataPoint[]>;
  // Summary statistics
  summary: AnalyticsSummary;
  // Scatter plot data
  scatterData: any[];
  // Available dates for date picker
  availableDates: Date[];
  // Loading state
  isLoading: boolean;
  // Whether data came from cache
  fromCache: boolean;
  // Session count
  sessionCount: number;
  // Force refresh
  refresh: () => void;
}

const emptyChartData: Record<ChartMetric, ChartDataPoint[]> = {
  distance: [],
  pace: [],
  power: [],
  strokeRate: [],
  energy: [],
  duration: [],
  splitTime: [],
  consistencyScore: [],
};

const emptySummary: AnalyticsSummary = {
  totalDistance: 0,
  totalDuration: 0,
  totalEnergy: 0,
  totalPower: 0,
  sessionCount: 0,
  avgPace: 0,
  avgPower: 0,
  avgStrokeRate: 0,
};

export function useAnalyticsData(): UseAnalyticsDataResult {
  const sessions = useRowingStore((state) => state.sessions);
  const [isLoading, setIsLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [cachedData, setCachedData] = useState<CachedAnalyticsData | null>(null);
  const isInitialized = useRef(false);
  const refreshCounter = useRef(0);

  // Check cache validity and load data
  useEffect(() => {
    const loadData = async () => {
      // Check localStorage cache first
      const cached = getCachedAnalytics();

      if (cached) {
        // Validate against server revision
        const { revision, count } = await fetchSessionsRevision();

        if (isAnalyticsCacheValid(cached, revision, count)) {
          console.log('[useAnalyticsData] Cache hit - using cached chart data');
          setCachedData(cached);
          setFromCache(true);
          setIsLoading(false);
          isInitialized.current = true;
          return;
        } else {
          console.log('[useAnalyticsData] Cache invalid - will recompute');
          clearAnalyticsCache();
        }
      }

      // No valid cache - wait for sessions to load from store
      setFromCache(false);
      setIsLoading(false);
      isInitialized.current = true;
    };

    loadData();
  }, [refreshCounter.current]);

  // Compute chart data from sessions (only when cache is invalid)
  const computedData = useMemo(() => {
    // If we have valid cached data, don't recompute
    if (cachedData && fromCache) {
      return null;
    }

    // If no sessions, return empty data
    if (!sessions || sessions.length === 0) {
      return {
        chartData: emptyChartData,
        summary: emptySummary,
        scatterData: [],
        availableDates: [],
      };
    }

    console.log('[useAnalyticsData] Computing chart data from', sessions.length, 'sessions');

    // Sort sessions by date
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Compute chart data for each metric
    const chartData: Record<ChartMetric, ChartDataPoint[]> = {
      distance: [],
      pace: [],
      power: [],
      strokeRate: [],
      energy: [],
      duration: [],
      splitTime: [],
      consistencyScore: [],
    };

    // Single pass to compute all metrics
    for (const session of sortedSessions) {
      const date = formatChartDate(new Date(session.timestamp));
      const fullDate = session.timestamp;
      const sessionId = session.id;

      chartData.distance.push({ date, fullDate, sessionId, value: session.distance });
      chartData.pace.push({ date, fullDate, sessionId, value: session.avgSplit });
      chartData.power.push({ date, fullDate, sessionId, value: session.avgPower });
      chartData.strokeRate.push({ date, fullDate, sessionId, value: session.avgStrokeRate });
      chartData.energy.push({ date, fullDate, sessionId, value: session.energy });
      chartData.duration.push({ date, fullDate, sessionId, value: session.duration });
      chartData.splitTime.push({ date, fullDate, sessionId, value: session.avgSplit });

      // Use pre-computed consistency score
      if (session.consistencyScore !== null && session.consistencyScore !== undefined) {
        chartData.consistencyScore.push({
          date,
          fullDate,
          sessionId,
          value: session.consistencyScore,
        });
      }
    }

    // Compute summary statistics
    const summary: AnalyticsSummary = {
      totalDistance: sortedSessions.reduce((sum, s) => sum + s.distance, 0),
      totalDuration: sortedSessions.reduce((sum, s) => sum + s.duration, 0),
      totalEnergy: sortedSessions.reduce((sum, s) => sum + s.energy, 0),
      totalPower: sortedSessions.reduce((sum, s) => sum + s.avgPower, 0),
      sessionCount: sortedSessions.length,
      avgPace:
        sortedSessions.length > 0
          ? sortedSessions.reduce((sum, s) => sum + s.avgSplit, 0) / sortedSessions.length
          : 0,
      avgPower:
        sortedSessions.length > 0
          ? sortedSessions.reduce((sum, s) => sum + s.avgPower, 0) / sortedSessions.length
          : 0,
      avgStrokeRate:
        sortedSessions.length > 0
          ? sortedSessions.reduce((sum, s) => sum + s.avgStrokeRate, 0) / sortedSessions.length
          : 0,
    };

    // Compute scatter plot data
    const scatterData = sortedSessions.map((session) => ({
      sessionId: session.id,
      date: formatChartDate(new Date(session.timestamp)),
      distance: session.distance,
      duration: session.duration,
      durationMinutes: Math.round(session.duration / 60),
      power: session.avgPower,
      pace: session.avgSplit,
      strokeRate: session.avgStrokeRate,
      energy: session.energy,
      strokeLength: session.avgStrokeLength,
    }));

    // Available dates for date picker
    const availableDates = sortedSessions.map((s) =>
      new Date(s.timestamp).toISOString()
    );

    return { chartData, summary, scatterData, availableDates };
  }, [sessions, cachedData, fromCache]);

  // Cache computed data when ready
  useEffect(() => {
    const cacheData = async () => {
      if (!computedData || fromCache || !isInitialized.current) return;
      if (sessions.length === 0) return;

      // Fetch current revision for cache key
      const { revision, count } = await fetchSessionsRevision();
      if (revision < 0) return; // Fetch failed

      const dataToCache: CachedAnalyticsData = {
        chartData: computedData.chartData,
        summary: computedData.summary,
        scatterData: computedData.scatterData,
        availableDates: computedData.availableDates,
        sessionsRevision: revision,
        sessionCount: count,
        cachedAt: Date.now(),
      };

      cacheAnalyticsData(dataToCache);
    };

    cacheData();
  }, [computedData, fromCache, sessions.length]);

  // Force refresh function
  const refresh = useCallback(() => {
    clearAnalyticsCache();
    setCachedData(null);
    setFromCache(false);
    refreshCounter.current++;
  }, []);

  // Return cached or computed data
  const result = cachedData && fromCache ? cachedData : computedData;

  return {
    chartData: result?.chartData ?? emptyChartData,
    summary: result?.summary ?? emptySummary,
    scatterData: result?.scatterData ?? [],
    availableDates: (result?.availableDates ?? []).map((d) =>
      typeof d === 'string' ? new Date(d) : d
    ),
    isLoading,
    fromCache,
    sessionCount: result?.summary?.sessionCount ?? 0,
    refresh,
  };
}

/**
 * Apply smoothing to chart data
 */
export function applySmoothingToChartData(
  data: ChartDataPoint[],
  smoothing: SmoothingOption
): ChartDataPoint[] {
  if (smoothing === 0 || data.length === 0) {
    return data;
  }

  const values = data.map((d) => d.value);
  const smoothedValues = calculateMovingAverage(values, smoothing);

  return data.map((d, i) => ({
    ...d,
    smoothedValue: smoothedValues[i],
  }));
}
