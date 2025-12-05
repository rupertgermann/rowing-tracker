'use client';

import { useEffect, useState, useMemo, useRef, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRowingStore, ChartMetric, type SmoothingOption, type AnalyticsChartSettings } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, TrendingUp, Clock, Zap, Target, Activity, Flame, Gauge, Brain, RefreshCw, BarChart3, Waypoints, HelpCircle, ExternalLink, MessageCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InsightCard } from '@/components/ai/InsightCard';
import { useAIInsights } from '@/hooks/useAIInsights';
import { SettingsService } from '@/lib/settings';
import { SplitTimeChart } from '@/components/SplitTimeChart';
import { ConsistencyScoreChart } from '@/components/ConsistencyScoreChart';
import { Insight } from '@/lib/aiAnalysis';
import { calculateAdvancedStats } from '@/lib/analysisUtils';
import { formatChartDate } from '@/lib/dateTimeUtils';
import { CloudInsight } from '@/lib/cloudAI';
import { chartTheme } from '@/lib/chartUtils';
import { TimeRangeSelector, defaultTimeRangeOptions, type TimeRange } from '@/components/ui/time-range-selector';
import { ChartTypeSelector } from '@/components/ui/chart-type-selector';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { chatStorage } from '@/lib/chatStorage';
import { ExplanationTooltip } from '@/components/ExplanationTooltip';

// Chart type options
type ChartType = 'line' | 'bar' | 'area' | 'scatter';

// Chart configuration options

interface ChartConfig {
  metric: ChartMetric;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fillOpacity?: number;
  formatter: (value: number) => string;
  yAxisFormatter: (value: number) => string;
  unit: string;
  isSpecial?: boolean; // For charts that don't follow standard metric pattern
}

const chartConfigs: Record<ChartMetric, ChartConfig> = {
  distance: {
    metric: 'distance',
    label: 'Distance',
    icon: TrendingUp,
    color: '#3b82f6', // Blue-500
    fillOpacity: 0.3,
    formatter: (value: number) => `${value}m`,
    yAxisFormatter: (value: number) => `${value}m`,
    unit: 'meters'
  },
  pace: {
    metric: 'pace',
    label: 'Average Pace',
    icon: Target,
    color: '#10b981', // Emerald-500
    fillOpacity: 0.3,
    formatter: (value: number) => formatPace(value),
    yAxisFormatter: (value: number) => formatPace(value),
    unit: 'time per 500m'
  },
  power: {
    metric: 'power',
    label: 'Average Power',
    icon: Zap,
    color: '#f59e0b', // Amber-500
    fillOpacity: 0.3,
    formatter: (value: number) => `${Math.round(value)}W`,
    yAxisFormatter: (value: number) => `${Math.round(value)}W`,
    unit: 'watts'
  },
  strokeRate: {
    metric: 'strokeRate',
    label: 'Stroke Rate',
    icon: Activity,
    color: '#8b5cf6', // Violet-500
    fillOpacity: 0.3,
    formatter: (value: number) => `${Math.round(value)} SPM`,
    yAxisFormatter: (value: number) => `${Math.round(value)}`,
    unit: 'strokes per minute'
  },
  energy: {
    metric: 'energy',
    label: 'Energy',
    icon: Flame,
    color: '#ef4444', // Red-500
    fillOpacity: 0.3,
    formatter: (value: number) => `${Math.round(value)} kCal`,
    yAxisFormatter: (value: number) => `${Math.round(value)}`,
    unit: 'kilocalories'
  },
  duration: {
    metric: 'duration',
    label: 'Duration',
    icon: Clock,
    color: '#06b6d4', // Cyan-500
    fillOpacity: 0.3,
    formatter: (value: number) => formatDuration(value),
    yAxisFormatter: (value: number) => `${Math.round(value / 60)}m`,
    unit: 'minutes'
  },
  splitTime: {
    metric: 'splitTime',
    label: 'Pace Analysis',
    icon: Target,
    color: '#f97316', // Orange-500
    fillOpacity: 0.3,
    formatter: (value: number) => formatPace(value),
    yAxisFormatter: (value: number) => formatPace(value),
    unit: 'time per 500m',
    isSpecial: true
  },
  consistencyScore: {
    metric: 'consistencyScore',
    label: 'Consistency Score',
    icon: BarChart3,
    color: '#14b8a6', // Teal-500
    fillOpacity: 0.3,
    formatter: (value: number) => `${Math.round(value)}/100`,
    yAxisFormatter: (value: number) => `${Math.round(value)}`,
    unit: 'score (0-100)',
    isSpecial: true
  }
};

// Order reference for charts to keep buttons and diagrams aligned
const chartOrder = Object.keys(chartConfigs) as ChartMetric[];

// Helper functions for formatting data
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters}m`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

function formatPace(secondsPer500m: number): string {
  if (secondsPer500m <= 0) return '--:--';
  const minutes = Math.floor(secondsPer500m / 60);
  const seconds = Math.floor(secondsPer500m % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} / 500m`;
}

function formatPower(watts: number): string {
  if (watts <= 0) return '--W';
  return `${Math.round(watts)}W`;
}


// Prepare chart data for distance over time
function prepareChartData(sessions: any[]) {
  return sessions
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(session => ({
      date: formatChartDate(new Date(session.timestamp)),
      distance: session.distance,
      fullDate: session.timestamp
    }));
}

// Smoothing options for charts (shared across all charts)
const smoothingOptions: { value: SmoothingOption; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 3, label: '3' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
];

// Default analytics settings for migration
const defaultAnalyticsSettings: AnalyticsChartSettings = {
  dateRangeFrom: null,
  dateRangeTo: null,
  smoothing: {
    distance: 0,
    pace: 0,
    power: 0,
    strokeRate: 0,
    energy: 0,
    duration: 0,
    splitTime: 3,
    consistencyScore: 0
  }
};

// Calculate moving average for smoothing
const calculateMovingAverage = (data: number[], windowSize: number): (number | null)[] => {
  if (windowSize === 0) return data;
  
  return data.map((_, index) => {
    if (index < windowSize - 1) return null;
    
    const window = data.slice(index - windowSize + 1, index + 1);
    const sum = window.reduce((acc, d) => acc + d, 0);
    return sum / windowSize;
  });
};

// Custom tooltip component with full styling control
const CustomTooltip = ({ active, payload, label, config, smoothing }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const smoothedValue = data.smoothedValue;
    return (
      <div style={chartTheme.tooltip.contentStyle}>
        <p style={chartTheme.tooltip.labelStyle}>{label}</p>
        <p style={chartTheme.tooltip.itemStyle}>
          {config.formatter(payload[0].value)} - {config.label}
        </p>
        {smoothing > 0 && smoothedValue !== null && smoothedValue !== undefined && (
          <p style={chartTheme.tooltip.itemStyle}>
            {smoothing}-Session Avg: {config.formatter(smoothedValue)}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const Analytics = () => {
  const router = useRouter();
  const { getSessions, getStats, getChartSettings, updateChartSettings, dashboardSettings, updateDashboardSettings, getChartExplanation, chartExplanations, setPendingChartExplanation, removeChartExplanationsBySessionId } = useRowingStore();

  // Helper to check if a chart explanation is valid (its chat session still exists)
  const isExplanationValid = useCallback((chartId: string) => {
    const explanation = chartExplanations[chartId];
    if (!explanation) return false;
    // Verify the linked chat session still exists
    const session = chatStorage.getSession(explanation.chatSessionId);
    if (!session) {
      // Clean up orphaned explanation
      removeChartExplanationsBySessionId(explanation.chatSessionId);
      return false;
    }
    return true;
  }, [chartExplanations, removeChartExplanationsBySessionId]);
  const sessions = getSessions();
  const stats = getStats();

  const chartSettings = getChartSettings();
  const [mounted, setMounted] = useState(false);
  
  // Refs for chart containers (for screenshot capture)
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const timeRange = dashboardSettings.timeRange;
  const setTimeRange = (range: TimeRange) => updateDashboardSettings({ timeRange: range });

  // Analytics settings (with fallback for migration)
  const analyticsSettings = chartSettings.analyticsSettings ?? defaultAnalyticsSettings;
  
  // Convert stored date range to DateRange object
  const dateRange: DateRange | undefined = useMemo(() => {
    if (!analyticsSettings.dateRangeFrom) return undefined;
    return {
      from: new Date(analyticsSettings.dateRangeFrom),
      to: analyticsSettings.dateRangeTo ? new Date(analyticsSettings.dateRangeTo) : undefined
    };
  }, [analyticsSettings.dateRangeFrom, analyticsSettings.dateRangeTo]);

  // Update date range handler
  const setDateRange = useCallback((range: DateRange | undefined) => {
    updateChartSettings({
      analyticsSettings: {
        ...analyticsSettings,
        dateRangeFrom: range?.from ? range.from.toISOString() : null,
        dateRangeTo: range?.to ? range.to.toISOString() : null
      }
    });
  }, [analyticsSettings, updateChartSettings]);

  // Derive a single smoothing value shared across all charts (aligned like the date selector)
  const smoothingValue = useMemo<SmoothingOption>(() => {
    if ('smoothingAll' in analyticsSettings && analyticsSettings.smoothingAll !== undefined) {
      return analyticsSettings.smoothingAll as SmoothingOption;
    }
    // Fallback: prefer existing splitTime default (3) then distance (0)
    return (analyticsSettings.smoothing?.splitTime ??
      analyticsSettings.smoothing?.distance ??
      0) as SmoothingOption;
  }, [analyticsSettings]);

  // Update smoothing globally for every metric to keep selectors in sync
  const setSmoothing = useCallback((value: SmoothingOption) => {
    const nextSmoothing = Object.keys(analyticsSettings.smoothing ?? chartConfigs)
      .reduce((acc, key) => {
        acc[key as ChartMetric] = value;
        return acc;
      }, {} as Record<ChartMetric, SmoothingOption>);

    updateChartSettings({
      analyticsSettings: {
        ...analyticsSettings,
        smoothingAll: value,
        smoothing: nextSmoothing
      }
    });
  }, [analyticsSettings, updateChartSettings]);

  // Precompute derived session values to avoid repeated heavy calculations in renders
  // Cache expensive per-session calculations (e.g., consistency score) across renders
  const consistencyCache = useRef(new Map<string, { dataRef: any; score: number }>());

  const computedSessions = useMemo(() => {
    return sessions.map(session => {
      const timestamp = session.timestamp instanceof Date ? session.timestamp : new Date(session.timestamp);

      let consistencyScore = -1;
      if (session.strokeData && session.strokeData.length > 0) {
        const cacheKey = session.id;
        const cached = consistencyCache.current.get(cacheKey);
        if (cached && cached.dataRef === session.strokeData) {
          consistencyScore = cached.score;
        } else {
          consistencyScore = calculateAdvancedStats(session.strokeData).consistencyScore;
          consistencyCache.current.set(cacheKey, { dataRef: session.strokeData, score: consistencyScore });
        }
      }

      return {
        ...session,
        _timestamp: timestamp,
        _timestampMs: timestamp.getTime(),
        _formattedDate: formatChartDate(timestamp),
        _consistencyScore: consistencyScore
      };
    });
  }, [sessions]);

  // Get all session dates for the date picker
  const availableDates = useMemo(() => {
    return computedSessions.map(s => s._timestamp);
  }, [computedSessions]);

  // Handle anchor links to scroll to specific charts
  useEffect(() => {
    if (!mounted) return;
    
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1); // Remove the #
      if (hash && chartRefs.current[hash]) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          chartRefs.current[hash]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 100);
      }
    };

    // Check on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [mounted]);

  // Helper function to capture chart screenshot and navigate to chat
  const handleExplainChart = useCallback(async (
    chartId: string, 
    chartTitle: string, 
    chartDescription: string, 
    dataContext: string,
    fullData: any[]
  ) => {
    // Get the custom explain chart prompt from settings
    const aiSettings = SettingsService.getInstance().getAISettings();
    const explainChartPrompt = aiSettings.explainChartPrompt || '';
    
    const prompt = `I'm looking at my "${chartTitle}" chart in my rowing analytics. ${chartDescription}

Here's what the data shows:
${dataContext}

${explainChartPrompt}`;

    // Try to capture screenshot by converting SVG to PNG (OpenAI only supports png/jpeg/gif/webp)
    let screenshot: string | undefined;
    const chartElement = chartRefs.current[chartId];
    if (chartElement) {
      try {
        // Find the SVG element inside the chart (Recharts renders to SVG)
        const svgElement = chartElement.querySelector('svg');
        if (svgElement) {
          // Clone and serialize the SVG
          const svgClone = svgElement.cloneNode(true) as SVGElement;
          
          // Set explicit dimensions
          const bbox = svgElement.getBoundingClientRect();
          const width = bbox.width * 2; // 2x scale for quality
          const height = bbox.height * 2;
          svgClone.setAttribute('width', String(width));
          svgClone.setAttribute('height', String(height));
          
          // Add white background for visibility
          const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          bgRect.setAttribute('width', '100%');
          bgRect.setAttribute('height', '100%');
          bgRect.setAttribute('fill', '#1f2937'); // Dark background
          svgClone.insertBefore(bgRect, svgClone.firstChild);
          
          // Serialize to string
          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgClone);
          
          // Convert SVG to PNG via canvas
          const img = new Image();
          const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          screenshot = await new Promise<string | undefined>((resolve) => {
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#1f2937';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              } else {
                resolve(undefined);
              }
              URL.revokeObjectURL(url);
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              resolve(undefined);
            };
            img.src = url;
          });
        }
      } catch (err) {
        console.error('Failed to capture chart screenshot:', err);
        // Continue without screenshot - the data will still be sent
      }
    }

    // Store the pending chart explanation data
    setPendingChartExplanation({
      chartId,
      chartTitle,
      prompt,
      screenshot,
      fullData: JSON.stringify(fullData, null, 2)
    });

    // Navigate to chat
    router.push('/chat?fromChart=true');
  }, [setPendingChartExplanation, router]);

  // Helper to generate data context for metric charts
  const getMetricDataContext = (metric: ChartMetric, chartData: any[]) => {
    if (chartData.length === 0) return 'No data available for this time period.';
    
    const values = chartData.map(d => d[metric]).filter(v => v !== undefined && v !== -1);
    if (values.length === 0) return 'No valid data points available.';
    
    const config = chartConfigs[metric];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[values.length - 1];
    const earliest = values[0];
    
    return `- Time period: ${timeRange === 'all' ? 'All time' : defaultTimeRangeOptions.find(o => o.value === timeRange)?.label}
- Data points: ${values.length} sessions
- Range: ${config.formatter(min)} to ${config.formatter(max)}
- Average: ${config.formatter(avg)}
- Earliest value: ${config.formatter(earliest)}
- Latest value: ${config.formatter(latest)}
- Trend: ${latest > earliest ? 'Increasing' : latest < earliest ? 'Decreasing' : 'Stable'}`;
  };

  // Helper to generate data context for scatter plots
  const getScatterDataContext = (xLabel: string, yLabel: string, data: any[], xKey: string, yKey: string) => {
    if (data.length === 0) return 'No data available for this time period.';
    
    const xValues = data.map(d => d[xKey]).filter(v => v !== undefined);
    const yValues = data.map(d => d[yKey]).filter(v => v !== undefined);
    
    if (xValues.length === 0) return 'No valid data points available.';
    
    return `- Time period: ${timeRange === 'all' ? 'All time' : defaultTimeRangeOptions.find(o => o.value === timeRange)?.label}
- Data points: ${data.length} sessions
- ${xLabel} range: ${Math.min(...xValues).toFixed(1)} to ${Math.max(...xValues).toFixed(1)}
- ${yLabel} range: ${Math.min(...yValues).toFixed(1)} to ${Math.max(...yValues).toFixed(1)}`;
  };

  // AI Insights hook
  const {
    insights,
    trends,
    trainingLoad,
    anomalies,
    isAnalyzable,
    lastAnalyzed,
    refreshInsights,
    archivedInsights,
    archiveInsight,
    unarchiveInsight,
    deleteInsight,
    isArchivedView,
    setIsArchivedView
  } = useAIInsights();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter sessions based on custom date range (if set) or time range
  const filteredSessions = useMemo(() => {
    return computedSessions.filter(session => {
      const sessionDate = session._timestamp;
      
      // If custom date range is set, use it
      if (dateRange?.from) {
        if (sessionDate < dateRange.from) return false;
        // Check end date if set and different from start
        if (dateRange.to && dateRange.from.getTime() !== dateRange.to.getTime()) {
          // Add 1 day to include the end date fully
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (sessionDate > endOfDay) return false;
        }
        return true;
      }
      
      // Otherwise use the fixed time range
      if (timeRange === 'all') return true;

      const now = new Date();
      const daysAgo = defaultTimeRangeOptions.find(option => option.value === timeRange)?.days;

      if (!daysAgo) return true;

      const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return session._timestampMs >= cutoffDate.getTime();
    });
  }, [computedSessions, timeRange, dateRange]);

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    return filteredSessions.reduce((acc, session) => {
      return {
        totalDistance: acc.totalDistance + session.distance,
        totalTime: acc.totalTime + session.duration,
        totalPower: acc.totalPower + session.avgPower,
        sessionCount: acc.sessionCount + 1
      };
    }, { totalDistance: 0, totalTime: 0, totalPower: 0, sessionCount: 0 });
  }, [filteredSessions]);

  const avgPace = filteredStats.sessionCount > 0 && filteredStats.totalDistance > 0
    ? (filteredStats.totalTime / (filteredStats.totalDistance / 500))
    : 0;
  const avgPower = filteredStats.sessionCount > 0
    ? filteredStats.totalPower / filteredStats.sessionCount
    : 0;

  // Check if user has data
  const hasData = sessions.length > 0;
  const hasFilteredData = filteredSessions.length > 0;

  // Prepare chart data for different metrics (with smoothing)
  const prepareChartDataWithSmoothing = useCallback((sessions: any[], metric: ChartMetric, smoothing: SmoothingOption) => {
    const baseData = sessions
      .map(session => ({
        date: session._formattedDate ?? formatChartDate(new Date(session.timestamp)),
        [metric]: getMetricValue(session, metric),
        fullDate: session.timestamp,
        sessionId: session.id
      }))
      // Filter out sessions without data (e.g., consistency score requires strokeData)
      .filter(dataPoint => dataPoint[metric] !== -1);
    
    // Add smoothed values if smoothing is enabled
    if (smoothingValue > 0 && baseData.length > 0) {
      const values = baseData.map(d => d[metric] as number);
      const smoothedValues = calculateMovingAverage(values, smoothingValue);
      return baseData.map((d, i) => ({
        ...d,
        smoothedValue: smoothedValues[i]
      }));
    }
    
    return baseData;
  }, [smoothingValue]);

  // Get metric value from session based on metric type
  const getMetricValue = (session: any, metric: ChartMetric): number => {
    switch (metric) {
      case 'distance': return session.distance;
      case 'pace': return session.avgSplit;
      case 'power': return session.avgPower;
      case 'strokeRate': return session.avgStrokeRate;
      case 'energy': return session.energy;
      case 'duration': return session.duration;
      case 'splitTime': return session.avgSplit; // For compatibility, though splitTime uses special rendering
      case 'consistencyScore': {
        // Use precomputed value to avoid heavy recalculation
        if (session._consistencyScore !== undefined) return session._consistencyScore;
        if (session.strokeData && session.strokeData.length > 0) {
          const stats = calculateAdvancedStats(session.strokeData);
          return stats.consistencyScore;
        }
        return -1; // Return -1 to indicate no data available
      }
      default: return 0;
    }
  };

  // Toggle chart visibility
  const toggleChart = (metric: ChartMetric) => {
    if (metric === 'splitTime') return; // Split Time is always shown in correlations section
    const currentCharts = chartSettings.enabledCharts;
    const updatedCharts = currentCharts.includes(metric)
      ? currentCharts.filter(m => m !== metric)
      : [...currentCharts, metric];

    updateChartSettings({ enabledCharts: updatedCharts });
  };

  // Prepare chart data for each enabled metric (with smoothing)
  const orderedEnabledCharts = useMemo(() => {
    const orderMap = new Map(chartOrder.map((metric, index) => [metric, index]));
    return [...chartSettings.enabledCharts]
      .filter(metric => metric !== 'splitTime') // Always show Split Time separately in correlations section
      .sort((a, b) => {
        const aOrder = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
  }, [chartSettings.enabledCharts]);

  const chartDataMap = useMemo(() => {
    return orderedEnabledCharts.reduce((acc, metric) => {
      acc[metric] = hasFilteredData ? prepareChartDataWithSmoothing(filteredSessions, metric, smoothingValue) : [];
      return acc;
    }, {} as Record<ChartMetric, any[]>);
  }, [filteredSessions, orderedEnabledCharts, hasFilteredData, smoothingValue, prepareChartDataWithSmoothing]);

  // Dedicated Split Time chart data for correlations section (always visible)
  const splitTimeChartData = useMemo(() => {
    return hasFilteredData ? prepareChartDataWithSmoothing(filteredSessions, 'splitTime', smoothingValue) : [];
  }, [filteredSessions, hasFilteredData, prepareChartDataWithSmoothing, smoothingValue]);

  // Handle chart data point click
  const handleChartClick = (data: any, chartData: any[]) => {
    if (data && data.activeIndex !== undefined && chartData[data.activeIndex]) {
      const dataPoint = chartData[data.activeIndex];
      if (dataPoint.sessionId) {
        router.push(`/sessions/${dataPoint.sessionId}`);
      }
    }
  };

  // Prepare scatter plot data for correlations
  const scatterPlotData = useMemo(() => {
    return filteredSessions.map(session => ({
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
  }, [filteredSessions]);

  // Custom scatter tooltip component
  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={chartTheme.tooltip.contentStyle}>
          <p style={chartTheme.tooltip.labelStyle}>{data.date}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={chartTheme.tooltip.itemStyle}>
              {entry.name}: {
                entry.dataKey === 'pace' 
                  ? formatPace(entry.value)
                  : entry.dataKey === 'durationMinutes'
                    ? `${entry.value} min`
                    : entry.dataKey === 'distance'
                      ? `${entry.value}m`
                      : entry.dataKey === 'power'
                        ? `${Math.round(entry.value)}W`
                        : entry.dataKey === 'energy'
                          ? `${Math.round(entry.value)} kCal`
                          : entry.dataKey === 'strokeRate'
                            ? `${Math.round(entry.value)} SPM`
                            : entry.dataKey === 'strokeLength'
                              ? `${entry.value.toFixed(2)}m`
                              : entry.value
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render chart based on selected type
  const renderChart = (metric: ChartMetric, chartData: any[], config: ChartConfig) => {
    // Special handling for Pace Analysis (splitTime) - use SplitTimeChart component
    if (config.isSpecial && metric === 'splitTime') {
      return <SplitTimeChart sessions={filteredSessions} />;
    }

    const smoothing = smoothingValue;
    const hasSmoothing = smoothingValue > 0 && chartData.some(d => d.smoothedValue !== null && d.smoothedValue !== undefined);

    const commonProps = {
      width: '100%' as const,
      height: 300,
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    // Props for Bar/Area charts (need container onClick)
    const barAreaProps = {
      ...commonProps,
      onClick: (data: any) => handleChartClick(data, chartData)
    };

    const commonChartElements = (
      <>
        <CartesianGrid strokeDasharray={chartTheme.grid.strokeDasharray} stroke={chartTheme.grid.stroke} opacity={chartTheme.grid.opacity} />
        <XAxis
          dataKey="date"
          className="text-xs"
          stroke={chartTheme.axis.strokeColor}
          tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
        />
        <YAxis
          className="text-xs"
          stroke={chartTheme.axis.strokeColor}
          tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
          tickFormatter={config.yAxisFormatter}
        />
        <Tooltip content={<CustomTooltip config={config} smoothing={smoothing} />} />
      </>
    );

    switch (chartSettings.chartType) {
      case 'bar':
        return (
          <BarChart {...barAreaProps}>
            {commonChartElements}
            <Bar
              dataKey={metric}
              fill={config.color}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
            {hasSmoothing && (
              <Line
                type="monotone"
                dataKey="smoothedValue"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart {...barAreaProps}>
            {commonChartElements}
            <Area
              type="monotone"
              dataKey={metric}
              stroke={config.color}
              fill={config.color}
              fillOpacity={config.fillOpacity}
              strokeWidth={2}
              cursor="pointer"
            />
            {hasSmoothing && (
              <Line
                type="monotone"
                dataKey="smoothedValue"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </AreaChart>
        );
      default: // line
        return (
          <LineChart {...commonProps}>
            {commonChartElements}
            <Line
              type="monotone"
              dataKey={metric}
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, strokeWidth: 2, r: 4, cursor: 'pointer' }}
              activeDot={{
                r: 6,
                cursor: 'pointer',
                onClick: (e: any, payload: any) => {
                  const dataIndex = chartData.findIndex(item => item.date === payload.date);
                  if (dataIndex !== -1) {
                    handleChartClick({ activeIndex: dataIndex }, chartData);
                  }
                }
              }}
            />
            {hasSmoothing && (
              <Line
                type="monotone"
                dataKey="smoothedValue"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {!mounted ? (
          // Enhanced loading placeholder
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-2"></div>
            <div className="h-4 bg-muted rounded w-96 mb-8"></div>

            {/* Stats cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg"></div>
              ))}
            </div>

            {/* Chart skeleton */}
            <div className="h-8 bg-muted rounded w-48 mb-4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map(i => (
                <div key={i} className="h-80 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : !hasData ? (
          // Empty state
          <div className="text-center py-16">
            <div className="bg-muted rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Upload className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              No Data Yet
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your first SmartRow CSV file to see your rowing analytics and track your progress over time.
            </p>
            <Button asChild size="lg">
              <Link href="/upload" className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Your Data
              </Link>
            </Button>
          </div>
        ) : (
          // Analytics content
          <div className="space-y-8">
            {/* Analytics Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Performance Analytics
                  </h2>
                  <p className="text-muted-foreground">
                    Deep dive into your rowing performance metrics and trends
                  </p>
                </div>
              </div>
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
                showLabel
              />
            </div>

            {/* Key Metrics Summary */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Key Metrics
                {timeRange !== 'all' && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    ({defaultTimeRangeOptions.find(opt => opt.value === timeRange)?.label})
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-blue-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
                    <div className="p-2 bg-blue-500/10 rounded-full">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatDistance(filteredStats.totalDistance)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {filteredStats.sessionCount} sessions
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-violet-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Time</CardTitle>
                    <div className="p-2 bg-violet-500/10 rounded-full">
                      <Clock className="h-4 w-4 text-violet-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                      {formatDuration(filteredStats.totalTime)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All sessions
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-emerald-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Pace</CardTitle>
                    <div className="p-2 bg-emerald-500/10 rounded-full">
                      <Target className="h-4 w-4 text-emerald-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatPace(avgPace)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per 500m
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-amber-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Power</CardTitle>
                    <div className="p-2 bg-amber-500/10 rounded-full">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {avgPower > 0 ? `${Math.round(avgPower)}W` : '--'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average output
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Chart Configuration */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Performance Charts
                    {timeRange !== 'all' && (
                      <span className="text-lg font-normal text-muted-foreground ml-2">
                        ({defaultTimeRangeOptions.find(opt => opt.value === timeRange)?.label})
                      </span>
                    )}
                  </h2>
                  <p className="text-muted-foreground">
                    Customize which metrics to visualize over time
                  </p>
                </div>
              </div>

              {/* Chart Selector */}
              <Card className="mb-6 border-t-4 border-t-indigo-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-indigo-500" />
                        Select Charts to Display
                      </CardTitle>
                      <CardDescription>
                        Choose which metrics to track over time
                      </CardDescription>
                    </div>
                    <ChartTypeSelector
                      value={chartSettings.chartType}
                      onChange={(type) => updateChartSettings({ chartType: type })}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {Object.entries(chartConfigs)
                      .filter(([metric]) => metric !== 'splitTime') // Split Time now lives in Correlations section
                      .map(([metric, config]) => {
                      const Icon = config.icon;
                      const isEnabled = chartSettings.enabledCharts.includes(metric as ChartMetric);

                      return (
                        <Button
                          key={metric}
                          variant={isEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleChart(metric as ChartMetric)}
                          className="flex items-center gap-2 h-auto p-3 flex-col"
                        >
                          <Icon className="h-4 w-4 mb-1" />
                          <span className="text-xs font-medium">{config.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    {orderedEnabledCharts.length === 0
                      ? "No charts selected. Select at least one metric to visualize."
                      : `Showing ${orderedEnabledCharts.length} chart${orderedEnabledCharts.length > 1 ? 's' : ''} as ${chartSettings.chartType} visualization${chartSettings.chartType !== 'line' ? 's' : ''}`
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configurable Charts */}
            {orderedEnabledCharts.length > 0 && (
              <div className="space-y-6">
                {orderedEnabledCharts.map(metric => {
                  const config = chartConfigs[metric];
                  const Icon = config.icon;
                  const chartData = chartDataMap[metric];

                  if (config.isSpecial && metric === 'consistencyScore') {
                    return (
                      <div 
                        key={metric}
                        id={`metric-${metric}`}
                        ref={(el) => { chartRefs.current[`metric-${metric}`] = el; }}
                      >
                        <ConsistencyScoreChart
                          sessions={sessions}
                          chartType={chartSettings.chartType}
                          onExplainChart={handleExplainChart}
                          headerActions={
                            isExplanationValid(`metric-consistencyScore-${timeRange}`) ? (
                              <ExplanationTooltip
                                chatSessionId={chartExplanations[`metric-consistencyScore-${timeRange}`].chatSessionId}
                                content={chartExplanations[`metric-consistencyScore-${timeRange}`].fullResponse || chartExplanations[`metric-consistencyScore-${timeRange}`].summary}
                              />
                            ) : undefined
                          }
                        />
                      </div>
                    );
                  }

                  // Standard charts use the generic Card wrapper
                  return (
                    <Card 
                      key={metric}
                      id={`metric-${metric}`}
                      className="border-l-4" 
                      style={{ borderLeftColor: config.color }}
                      ref={(el) => { chartRefs.current[`metric-${metric}`] = el; }}
                    >
                      <>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md" style={{ backgroundColor: `${config.color}15` }}>
                                  <span style={{ color: config.color }}>
                                    <Icon className="h-5 w-5" />
                                  </span>
                                </div>
                                <div>
                                  <CardTitle className="text-lg">
                                    {config.label} Over Time
                                  </CardTitle>
                                  <CardDescription>
                                    {`Track your ${config.label.toLowerCase()} progress`}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Show saved explanation indicator */}
                                {isExplanationValid(`metric-${metric}-${timeRange}`) && (
                                  <ExplanationTooltip
                                    chatSessionId={chartExplanations[`metric-${metric}-${timeRange}`].chatSessionId}
                                    content={chartExplanations[`metric-${metric}-${timeRange}`].fullResponse || chartExplanations[`metric-${metric}-${timeRange}`].summary}
                                  />
                                )}
                                {/* Explain button */}
                                <TooltipProvider>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleExplainChart(
                                          `metric-${metric}-${timeRange}`,
                                          `${config.label} Over Time`,
                                          `This chart shows how my ${config.label.toLowerCase()} (${config.unit}) has changed over time.`,
                                          getMetricDataContext(metric, chartData),
                                          chartData
                                        )}
                                      >
                                        <HelpCircle className="h-4 w-4 mr-1" />
                                        Explain
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Ask AI to explain this chart</p>
                                    </TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {/* Controls row */}
                            <div className="flex flex-wrap items-center gap-4 mb-4 pb-4 border-b border-border">
                              {/* Date Range Picker */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Period:</span>
                                <DateRangePicker
                                  value={dateRange}
                                  onChange={setDateRange}
                                  placeholder="All time"
                                  availableDates={availableDates}
                                />
                              </div>

                              {/* Smoothing Selector */}
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Smooth:</span>
                                <div className="flex gap-1">
                                  {smoothingOptions.map((option) => (
                                    <Button
                                      key={option.value}
                                      variant={smoothingValue === option.value ? 'default' : 'outline'}
                                      size="sm"
                                      onClick={() => setSmoothing(option.value)}
                                      className="text-xs px-2"
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Legend (shown when smoothing is enabled) */}
                            {smoothingValue > 0 && (
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                                  <span>Individual Sessions</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-0.5 bg-orange-500" />
                                  <span>{smoothingValue}-Session Moving Average</span>
                                </div>
                              </div>
                            )}

                          {chartData.length > 0 ? (
                              <div className="w-full">
                                <ResponsiveContainer width="100%" height={300}>
                                  {renderChart(metric, chartData, config)}
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground py-8">
                                <p>No data available for {config.label.toLowerCase()} chart.</p>
                                <p className="text-sm">Try selecting a different time range or upload more data.</p>
                              </div>
                            )}
                          </CardContent>
                        </>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Empty State for Charts */}
            {chartSettings.enabledCharts.length === 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Gauge className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No Charts Selected
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Select metrics above to visualize your performance data over time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Correlations Section - Scatter Plots */}
            {scatterPlotData.length >= 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-3">
                    <Waypoints className="h-6 w-6 text-purple-500" />
                    Performance Correlations
                    {timeRange !== 'all' && (
                      <span className="text-lg font-normal text-muted-foreground">
                        ({defaultTimeRangeOptions.find(opt => opt.value === timeRange)?.label})
                      </span>
                    )}
                  </h2>
                  <p className="text-muted-foreground">
                    Explore relationships between different performance metrics
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Split Time Over Date (always visible) */}
                  <Card id="correlation-split-time" className="border-l-4 border-l-primary lg:col-span-2" ref={(el) => { chartRefs.current['correlation-split-time'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-primary/10">
                            <Target className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Split Time Over Date (Lower is Better)</CardTitle>
                            <CardDescription>
                              Pace progression with stroke-rate coloring and 3-session moving average
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid(`correlation-split-time-${timeRange}`) && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations[`correlation-split-time-${timeRange}`].chatSessionId}
                              content={chartExplanations[`correlation-split-time-${timeRange}`].fullResponse || chartExplanations[`correlation-split-time-${timeRange}`].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    `correlation-split-time-${timeRange}`,
                                    'Split Time Over Date',
                                    'This chart shows my split times (pace per 500m) over time with stroke rate color-coding and a 3-session moving average.',
                                    getMetricDataContext('splitTime', splitTimeChartData),
                                    splitTimeChartData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <SplitTimeChart sessions={filteredSessions} embedded />
                    </CardContent>
                  </Card>

                  {/* Power vs Pace */}
                  <Card id="scatter-power-pace" className="border-l-4 border-l-amber-500" ref={(el) => { chartRefs.current['scatter-power-pace'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-amber-500/10">
                            <Zap className="h-5 w-5 text-amber-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Power vs Pace</CardTitle>
                            <CardDescription>
                              Does more power lead to faster splits?
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid(`scatter-power-pace-${timeRange}`) && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations[`scatter-power-pace-${timeRange}`].chatSessionId}
                              content={chartExplanations[`scatter-power-pace-${timeRange}`].fullResponse || chartExplanations[`scatter-power-pace-${timeRange}`].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    `scatter-power-pace-${timeRange}`,
                                    'Power vs Pace',
                                    'This scatter plot shows the relationship between average power output (watts) and pace (time per 500m) across my sessions.',
                                    getScatterDataContext('Power (W)', 'Pace (s/500m)', scatterPlotData, 'power', 'pace'),
                                    scatterPlotData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={chartTheme.margin.scatter}>
                            <CartesianGrid 
                              strokeDasharray={chartTheme.grid.strokeDasharray} 
                              stroke={chartTheme.grid.stroke} 
                              opacity={chartTheme.grid.opacity} 
                            />
                            <XAxis 
                              type="number" 
                              dataKey="power" 
                              name="Power" 
                              unit="W"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="pace" 
                              name="Pace" 
                              domain={['auto', 'auto']}
                              reversed={true}
                              tickFormatter={(val) => formatPace(val)}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter 
                              name="Sessions" 
                              data={scatterPlotData} 
                              fill="#f59e0b" 
                              fillOpacity={0.7}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stroke Rate vs Pace */}
                  <Card className="border-l-4 border-l-violet-500" id="scatter-rate-pace" ref={(el) => { chartRefs.current['scatter-rate-pace'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-violet-500/10">
                            <Activity className="h-5 w-5 text-violet-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Stroke Rate vs Pace</CardTitle>
                            <CardDescription>
                              Efficiency check: Does higher rate mean faster splits?
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid(`scatter-rate-pace-${timeRange}`) && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations[`scatter-rate-pace-${timeRange}`].chatSessionId}
                              content={chartExplanations[`scatter-rate-pace-${timeRange}`].fullResponse || chartExplanations[`scatter-rate-pace-${timeRange}`].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    `scatter-rate-pace-${timeRange}`,
                                    'Stroke Rate vs Pace',
                                    'This scatter plot shows the relationship between stroke rate (SPM) and pace across my sessions to analyze efficiency.',
                                    getScatterDataContext('Stroke Rate (SPM)', 'Pace (s/500m)', scatterPlotData, 'strokeRate', 'pace'),
                                    scatterPlotData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={chartTheme.margin.scatter}>
                            <CartesianGrid 
                              strokeDasharray={chartTheme.grid.strokeDasharray} 
                              stroke={chartTheme.grid.stroke} 
                              opacity={chartTheme.grid.opacity} 
                            />
                            <XAxis 
                              type="number" 
                              dataKey="strokeRate" 
                              name="Stroke Rate" 
                              unit=" SPM"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="pace" 
                              name="Pace" 
                              domain={['auto', 'auto']}
                              reversed={true}
                              tickFormatter={(val) => formatPace(val)}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter 
                              name="Sessions" 
                              data={scatterPlotData} 
                              fill="#8b5cf6" 
                              fillOpacity={0.7}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Duration vs Distance */}
                  <Card className="border-l-4 border-l-blue-500" id="scatter-duration-distance" ref={(el) => { chartRefs.current['scatter-duration-distance'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-blue-500/10">
                            <Clock className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Duration vs Distance</CardTitle>
                            <CardDescription>
                              Session length patterns and consistency
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid(`scatter-duration-distance-${timeRange}`) && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations[`scatter-duration-distance-${timeRange}`].chatSessionId}
                              content={chartExplanations[`scatter-duration-distance-${timeRange}`].fullResponse || chartExplanations[`scatter-duration-distance-${timeRange}`].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    `scatter-duration-distance-${timeRange}`,
                                    'Duration vs Distance',
                                    'This scatter plot shows the relationship between session duration (minutes) and distance covered (meters).',
                                    getScatterDataContext('Duration (min)', 'Distance (m)', scatterPlotData, 'durationMinutes', 'distance'),
                                    scatterPlotData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={chartTheme.margin.scatter}>
                            <CartesianGrid 
                              strokeDasharray={chartTheme.grid.strokeDasharray} 
                              stroke={chartTheme.grid.stroke} 
                              opacity={chartTheme.grid.opacity} 
                            />
                            <XAxis 
                              type="number" 
                              dataKey="durationMinutes" 
                              name="Duration" 
                              unit=" min"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="distance" 
                              name="Distance" 
                              unit="m"
                              domain={['auto', 'auto']}
                              tickFormatter={(val) => formatDistance(val)}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter 
                              name="Sessions" 
                              data={scatterPlotData} 
                              fill="#3b82f6" 
                              fillOpacity={0.7}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Energy vs Duration */}
                  <Card className="border-l-4 border-l-red-500" id="scatter-energy-duration" ref={(el) => { chartRefs.current['scatter-energy-duration'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-red-500/10">
                            <Flame className="h-5 w-5 text-red-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Energy vs Duration</CardTitle>
                            <CardDescription>
                              Calorie burn rate across different session lengths
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid(`scatter-energy-duration-${timeRange}`) && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations[`scatter-energy-duration-${timeRange}`].chatSessionId}
                              content={chartExplanations[`scatter-energy-duration-${timeRange}`].fullResponse || chartExplanations[`scatter-energy-duration-${timeRange}`].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    `scatter-energy-duration-${timeRange}`,
                                    'Energy vs Duration',
                                    'This scatter plot shows the relationship between session duration (minutes) and calories burned (kCal).',
                                    getScatterDataContext('Duration (min)', 'Energy (kCal)', scatterPlotData, 'durationMinutes', 'energy'),
                                    scatterPlotData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={chartTheme.margin.scatter}>
                            <CartesianGrid 
                              strokeDasharray={chartTheme.grid.strokeDasharray} 
                              stroke={chartTheme.grid.stroke} 
                              opacity={chartTheme.grid.opacity} 
                            />
                            <XAxis 
                              type="number" 
                              dataKey="durationMinutes" 
                              name="Duration" 
                              unit=" min"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="energy" 
                              name="Energy" 
                              unit=" kCal"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter 
                              name="Sessions" 
                              data={scatterPlotData} 
                              fill="#ef4444" 
                              fillOpacity={0.7}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Power vs Stroke Rate */}
                  <Card className="border-l-4 border-l-emerald-500" id="scatter-power-rate" ref={(el) => { chartRefs.current['scatter-power-rate'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-emerald-500/10">
                            <Target className="h-5 w-5 text-emerald-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Power vs Stroke Rate</CardTitle>
                            <CardDescription>
                              Do you generate more power at higher stroke rates?
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid(`scatter-power-rate-${timeRange}`) && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations[`scatter-power-rate-${timeRange}`].chatSessionId}
                              content={chartExplanations[`scatter-power-rate-${timeRange}`].fullResponse || chartExplanations[`scatter-power-rate-${timeRange}`].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    `scatter-power-rate-${timeRange}`,
                                    'Power vs Stroke Rate',
                                    'This scatter plot shows the relationship between stroke rate (SPM) and power output (watts).',
                                    getScatterDataContext('Stroke Rate (SPM)', 'Power (W)', scatterPlotData, 'strokeRate', 'power'),
                                    scatterPlotData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={chartTheme.margin.scatter}>
                            <CartesianGrid 
                              strokeDasharray={chartTheme.grid.strokeDasharray} 
                              stroke={chartTheme.grid.stroke} 
                              opacity={chartTheme.grid.opacity} 
                            />
                            <XAxis 
                              type="number" 
                              dataKey="strokeRate" 
                              name="Stroke Rate" 
                              unit=" SPM"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="power" 
                              name="Power" 
                              unit="W"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter 
                              name="Sessions" 
                              data={scatterPlotData} 
                              fill="#10b981" 
                              fillOpacity={0.7}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Distance vs Power */}
                  <Card className="border-l-4 border-l-cyan-500" id="scatter-distance-power" ref={(el) => { chartRefs.current['scatter-distance-power'] = el; }}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-cyan-500/10">
                            <TrendingUp className="h-5 w-5 text-cyan-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Distance vs Power</CardTitle>
                            <CardDescription>
                              Power output at different session distances
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isExplanationValid('scatter-distance-power') && (
                            <ExplanationTooltip
                              chatSessionId={chartExplanations['scatter-distance-power'].chatSessionId}
                              content={chartExplanations['scatter-distance-power'].fullResponse || chartExplanations['scatter-distance-power'].summary}
                            />
                          )}
                          <TooltipProvider>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleExplainChart(
                                    'scatter-distance-power',
                                    'Distance vs Power',
                                    'This scatter plot shows the relationship between session distance (meters) and average power output (watts).',
                                    getScatterDataContext('Distance (m)', 'Power (W)', scatterPlotData, 'distance', 'power'),
                                    scatterPlotData
                                  )}
                                >
                                  <HelpCircle className="h-4 w-4 mr-1" />
                                  Explain
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Ask AI to explain this chart</p></TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={chartTheme.margin.scatter}>
                            <CartesianGrid 
                              strokeDasharray={chartTheme.grid.strokeDasharray} 
                              stroke={chartTheme.grid.stroke} 
                              opacity={chartTheme.grid.opacity} 
                            />
                            <XAxis 
                              type="number" 
                              dataKey="distance" 
                              name="Distance" 
                              unit="m"
                              domain={['auto', 'auto']}
                              tickFormatter={(val) => formatDistance(val)}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <YAxis 
                              type="number" 
                              dataKey="power" 
                              name="Power" 
                              unit="W"
                              domain={['auto', 'auto']}
                              stroke={chartTheme.axis.strokeColor}
                              tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
                            />
                            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter 
                              name="Sessions" 
                              data={scatterPlotData} 
                              fill="#06b6d4" 
                              fillOpacity={0.7}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
