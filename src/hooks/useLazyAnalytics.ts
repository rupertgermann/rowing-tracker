'use client';

/**
 * useLazyAnalytics Hook
 *
 * Fetches analytics data directly from the API, bypassing the Zustand store.
 * This allows the analytics page to load independently and quickly.
 *
 * Features:
 * - Fetches from /api/analytics endpoint (fast, no strokeData)
 * - Caches data in localStorage for instant subsequent loads
 * - Validates cache against sessionsRevision
 * - Supports lazy loading individual metrics
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChartMetric } from '@/lib/store';
import {
  getCachedAnalytics,
  cacheAnalyticsData,
  clearAnalyticsCache,
  type CachedAnalyticsData,
} from '@/lib/services/analyticsCache';

export interface ChartDataPoint {
  date: string;
  fullDate: string;
  sessionId: string;
  value: number;
  smoothedValue?: number | null;
}

export interface AnalyticsSummary {
  sessionCount: number;
  totalDistance: number;
  totalDuration: number;
  totalEnergy: number;
  avgPace: number;
  avgPower: number;
  avgStrokeRate: number;
}

export interface AnalyticsData {
  chartData: Record<ChartMetric, ChartDataPoint[]>;
  summary: AnalyticsSummary;
  scatterData: any[];
  availableDates: string[];
  sessionsRevision: number;
  sessionCount: number;
}

interface UseLazyAnalyticsResult {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  refresh: () => void;
}

const emptyData: AnalyticsData = {
  chartData: {
    distance: [],
    pace: [],
    power: [],
    strokeRate: [],
    energy: [],
    duration: [],
    splitTime: [],
    consistencyScore: [],
  },
  summary: {
    sessionCount: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalEnergy: 0,
    avgPace: 0,
    avgPower: 0,
    avgStrokeRate: 0,
  },
  scatterData: [],
  availableDates: [],
  sessionsRevision: 0,
  sessionCount: 0,
};

export function useLazyAnalytics(): UseLazyAnalyticsResult {
  // Always start with null to match SSR, then load cache in useEffect
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const fetchedRef = useRef(false);
  const refreshCounter = useRef(0);
  const initialLoadRef = useRef(false);

  const fetchData = useCallback(async (skipCache = false) => {
    console.log('[useLazyAnalytics] fetchData called, skipCache:', skipCache);
    setIsLoading(true);
    setError(null);

    // Check cache first (unless skipping)
    if (!skipCache) {
      const cached = getCachedAnalytics();
      console.log('[useLazyAnalytics] Cache check result:', cached ? 'FOUND' : 'NOT FOUND');
      
      if (cached) {
        console.log('[useLazyAnalytics] Cached data details:', {
          sessionsRevision: cached.sessionsRevision,
          sessionCount: cached.sessionCount,
          cachedAt: new Date(cached.cachedAt).toISOString(),
          ageMinutes: Math.round((Date.now() - cached.cachedAt) / 1000 / 60)
        });

        // Quick validation - fetch just the revision
        try {
          console.log('[useLazyAnalytics] Validating cache against /api/sessions/list...');
          const revResponse = await fetch('/api/sessions/list');
          if (revResponse.ok) {
            const revData = await revResponse.json();
            console.log('[useLazyAnalytics] Server revision data:', {
              sessionsRevision: revData.sessionsRevision,
              count: revData.count
            });
            console.log('[useLazyAnalytics] Comparison:', {
              revisionMatch: cached.sessionsRevision === revData.sessionsRevision,
              countMatch: cached.sessionCount === revData.count,
              cachedRevision: cached.sessionsRevision,
              serverRevision: revData.sessionsRevision,
              cachedCount: cached.sessionCount,
              serverCount: revData.count
            });
            
            if (
              cached.sessionsRevision === revData.sessionsRevision &&
              cached.sessionCount === revData.count
            ) {
              console.log('[useLazyAnalytics] ✅ Cache VALID - using cached data');
              setData({
                chartData: cached.chartData as Record<ChartMetric, ChartDataPoint[]>,
                summary: cached.summary,
                scatterData: cached.scatterData,
                availableDates: cached.availableDates,
                sessionsRevision: cached.sessionsRevision,
                sessionCount: cached.sessionCount,
              });
              setFromCache(true);
              setIsLoading(false);
              return;
            } else {
              console.log('[useLazyAnalytics] ❌ Cache INVALID - revision or count mismatch');
            }
          } else {
            console.log('[useLazyAnalytics] ❌ Validation request failed:', revResponse.status);
          }
        } catch (e) {
          console.log('[useLazyAnalytics] ❌ Cache validation error:', e);
        }

        console.log('[useLazyAnalytics] Clearing stale cache...');
        clearAnalyticsCache();
      } else {
        console.log('[useLazyAnalytics] No cached data found, will fetch fresh');
      }
    } else {
      console.log('[useLazyAnalytics] Skipping cache check (skipCache=true)');
    }

    // Fetch fresh data from API
    try {
      console.log('[useLazyAnalytics] 📡 Fetching from /api/analytics...');
      const response = await fetch('/api/analytics');

      if (!response.ok) {
        console.log('[useLazyAnalytics] ❌ Analytics API failed:', response.status);
        throw new Error('Failed to fetch analytics data');
      }

      const apiData = await response.json();
      console.log('[useLazyAnalytics] ✅ Analytics API response:', {
        sessionCount: apiData.sessionCount,
        sessionsRevision: apiData.sessionsRevision,
        hasChartData: !!apiData.chartData,
        chartMetrics: Object.keys(apiData.chartData || {})
      });

      const analyticsData: AnalyticsData = {
        chartData: apiData.chartData,
        summary: apiData.summary,
        scatterData: apiData.scatterData,
        availableDates: apiData.availableDates,
        sessionsRevision: apiData.sessionsRevision,
        sessionCount: apiData.sessionCount,
      };

      // Cache the fresh data
      const cacheData: CachedAnalyticsData = {
        chartData: apiData.chartData,
        summary: apiData.summary,
        scatterData: apiData.scatterData,
        availableDates: apiData.availableDates,
        sessionsRevision: apiData.sessionsRevision,
        sessionCount: apiData.sessionCount,
        cachedAt: Date.now(),
      };
      console.log('[useLazyAnalytics] 💾 Caching analytics data...');
      cacheAnalyticsData(cacheData);

      setData(analyticsData);
      setFromCache(false);
      console.log('[useLazyAnalytics] ✅ Loaded', apiData.sessionCount, 'sessions from API');
    } catch (err) {
      console.error('[useLazyAnalytics] ❌ Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(emptyData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load - try cache first, then fetch if needed
  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    
    console.log('[useLazyAnalytics] Initial load effect');
    
    // Try to load from cache immediately
    const cached = getCachedAnalytics();
    if (cached) {
      console.log('[useLazyAnalytics] Loading from cache immediately');
      setData({
        chartData: cached.chartData as Record<ChartMetric, ChartDataPoint[]>,
        summary: cached.summary,
        scatterData: cached.scatterData,
        availableDates: cached.availableDates,
        sessionsRevision: cached.sessionsRevision,
        sessionCount: cached.sessionCount,
      });
      setFromCache(true);
      setIsLoading(false);
      
      // Validate in background
      (async () => {
        try {
          const revResponse = await fetch('/api/sessions/list');
          if (revResponse.ok) {
            const revData = await revResponse.json();
            if (cached.sessionsRevision !== revData.sessionsRevision || 
                cached.sessionCount !== revData.count) {
              console.log('[useLazyAnalytics] Cache stale, fetching fresh data...');
              await fetchData(true);
            }
          }
        } catch (e) {
          console.log('[useLazyAnalytics] Background validation failed:', e);
        }
      })();
    } else {
      // No cache, fetch immediately
      console.log('[useLazyAnalytics] No cache, fetching data...');
      fetchData();
    }
  }, [fetchData]);

  // Refresh function
  const refresh = useCallback(() => {
    clearAnalyticsCache();
    fetchedRef.current = false;
    refreshCounter.current++;
    fetchData(true);
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    fromCache,
    refresh,
  };
}

/**
 * Apply smoothing to chart data
 */
export function applySmoothingToData(
  data: ChartDataPoint[],
  smoothing: number
): ChartDataPoint[] {
  if (smoothing === 0 || data.length === 0) {
    return data;
  }

  const values = data.map((d) => d.value);
  const smoothedValues = values.map((_, index) => {
    if (index < smoothing - 1) return null;
    const window = values.slice(index - smoothing + 1, index + 1);
    return window.reduce((a, b) => a + b, 0) / smoothing;
  });

  return data.map((d, i) => ({
    ...d,
    smoothedValue: smoothedValues[i],
  }));
}
