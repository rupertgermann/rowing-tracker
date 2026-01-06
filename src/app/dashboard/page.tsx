'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRowingStore, ChartMetric } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, TrendingUp, Clock, Zap, Target, Activity, Flame, Gauge, Brain, RefreshCw, Trophy, Medal, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { InsightCard } from '@/components/ai/InsightCard';
import { useAIInsights } from '@/hooks/useAIInsights';
import { SettingsService } from '@/lib/settings';
import { SplitTimeChart } from '@/components/SplitTimeChart';
import { Insight } from '@/lib/aiAnalysis';
import { calculateAdvancedStats } from '@/lib/analysisUtils';
import { formatChartDate, formatSessionDate, formatDateOnly, formatTime } from '@/lib/dateTimeUtils';
import { chartTheme } from '@/lib/chartUtils';
import { CloudInsight } from '@/lib/cloudAI';
import { MigrationPrompt } from '@/components/MigrationPrompt';

import { MetricComparisonWidget } from '@/components/MetricComparisonWidget';
import { PeriodComparisonStats } from '@/components/PeriodComparisonStats';
import { TimeRangeSelector, defaultTimeRangeOptions, type TimeRange } from '@/components/ui/time-range-selector';

// Chart type options
type ChartType = 'line' | 'bar' | 'area';

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
    unit: 'score (0-100)'
  }
};

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

// Custom tooltip component with full styling control
const CustomTooltip = ({ active, payload, label, config }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={chartTheme.tooltip.contentStyle}>
        <p style={chartTheme.tooltip.labelStyle}>{label}</p>
        <p style={chartTheme.tooltip.itemStyle}>
          {config.formatter(payload[0].value)} - {config.label}
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const router = useRouter();
  const { getSessions, getStats, getChartSettings, updateChartSettings, dashboardSettings, updateDashboardSettings } = useRowingStore();
  const sessions = getSessions();
  const stats = getStats();

  const chartSettings = getChartSettings();
  const [mounted, setMounted] = useState(false);

  const timeRange = dashboardSettings.timeRange;
  const setTimeRange = (range: TimeRange) => updateDashboardSettings({ timeRange: range });

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
    setIsArchivedView,
    isGenerating,
    cloudAIError,
    isCloudAIConfigured
  } = useAIInsights();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter sessions based on selected time range
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      if (timeRange === 'all') return true;

      const sessionDate = new Date(session.timestamp);
      const now = new Date();
      const daysAgo = defaultTimeRangeOptions.find(option => option.value === timeRange)?.days;

      if (!daysAgo) return true;

      const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      return sessionDate >= cutoffDate;
    });
  }, [sessions, timeRange]);

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

  // Prepare chart data for different metrics
  const prepareChartData = (sessions: any[], metric: ChartMetric) => {
    return sessions
      .map(session => ({
        date: formatChartDate(new Date(session.timestamp)),
        [metric]: getMetricValue(session, metric),
        fullDate: session.timestamp,
        sessionId: session.id
      }))
      // Filter out sessions without data (e.g., consistency score requires strokeData)
      .filter(dataPoint => dataPoint[metric] !== -1);
  };

  // Get metric value from session based on metric type
  const getMetricValue = (session: any, metric: ChartMetric): number => {
    switch (metric) {
      case 'distance': return session.distance;
      case 'pace': return session.avgSplit;
      case 'power': return session.avgPower;
      case 'strokeRate': return session.avgStrokeRate;
      case 'energy': return session.energy;
      case 'duration': return session.duration;
      case 'splitTime': return session.avgSplit;
      case 'consistencyScore': {
        // Calculate consistency score from stroke data if available
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
    const currentCharts = chartSettings.enabledCharts;
    const updatedCharts = currentCharts.includes(metric)
      ? currentCharts.filter(m => m !== metric)
      : [...currentCharts, metric];

    updateChartSettings({ enabledCharts: updatedCharts });
  };

  // Prepare chart data for each enabled metric
  const chartDataMap = useMemo(() => {
    return chartSettings.enabledCharts.reduce((acc, metric) => {
      acc[metric] = hasFilteredData ? prepareChartData(filteredSessions, metric) : [];
      return acc;
    }, {} as Record<ChartMetric, any[]>);
  }, [filteredSessions, chartSettings.enabledCharts, hasFilteredData]);

  // Handle chart data point click
  const handleChartClick = (data: any, chartData: any[]) => {
    if (data && data.activeIndex !== undefined && chartData[data.activeIndex]) {
      const dataPoint = chartData[data.activeIndex];
      if (dataPoint.sessionId) {
        router.push(`/sessions/${dataPoint.sessionId}`);
      }
    }
  };

  // Render chart based on selected type
  const renderChart = (metric: ChartMetric, chartData: any[], config: ChartConfig) => {
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
          stroke={chartTheme.axis.strokeColor}
          tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
        />
        <YAxis
          stroke={chartTheme.axis.strokeColor}
          tick={{ fill: chartTheme.axis.tickColor, fontSize: chartTheme.axis.fontSize }}
          tickFormatter={config.yAxisFormatter}
        />
        <Tooltip content={<CustomTooltip config={config} />} />
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
                  // For Line charts, payload is the data point, but let's be safe and use index lookup
                  const dataIndex = chartData.findIndex(item => item.date === payload.date);
                  if (dataIndex !== -1) {
                    handleChartClick({ activeIndex: dataIndex }, chartData);
                  }
                }
              }}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <MigrationPrompt />

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
              <Link href="/sync" className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Your Data
              </Link>
            </Button>
          </div>
        ) : (
          // Dashboard content
          <div className="space-y-8">
            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Dashboard Analytics
                </h2>
                <p className="text-muted-foreground">
                  Track your rowing performance and progress
                </p>
              </div>
              <TimeRangeSelector
                value={timeRange}
                onChange={setTimeRange}
                showLabel
              />
            </div>

            {/* Key Metrics */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
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
                      <TrendingUp className="h-4 w-4 text-blue-500 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground transition-colors duration-200">
                      {formatDistance(filteredStats.totalDistance)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filteredStats.sessionCount} sessions
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-cyan-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Time</CardTitle>
                    <div className="p-2 bg-cyan-500/10 rounded-full">
                      <Clock className="h-4 w-4 text-cyan-500 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground transition-colors duration-200">
                      {formatDuration(filteredStats.totalTime)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      All sessions
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-emerald-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Pace</CardTitle>
                    <div className="p-2 bg-emerald-500/10 rounded-full">
                      <Target className="h-4 w-4 text-emerald-500 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground transition-colors duration-200">
                      {formatPace(avgPace)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Per 500m
                    </p>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-l-4 border-l-amber-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Power</CardTitle>
                    <div className="p-2 bg-amber-500/10 rounded-full">
                      <Zap className="h-4 w-4 text-amber-500 transition-transform duration-200 group-hover:scale-110" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground transition-colors duration-200">
                      {avgPower > 0 ? `${Math.round(avgPower)}W` : '--'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Average output
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Summary Stats & Awards */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Achievements & Stats
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-t-4 border-t-primary bg-gradient-to-br from-card to-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Total Sessions
                    </CardTitle>
                    <CardDescription>
                      Lifetime workout count
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-foreground">
                      {stats.totalSessions}
                    </div>
                  </CardContent>
                </Card>

                <Card className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 border-t-4 border-t-orange-500 bg-gradient-to-br from-card to-orange-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Current Streak
                    </CardTitle>
                    <CardDescription>
                      Consecutive days active
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-bold text-foreground">
                        {stats.currentStreak}
                      </div>
                      <span className="text-muted-foreground font-medium">days</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Best Streak - Trophy Card */}
                <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 border-none ring-2 ring-yellow-500/50 bg-gradient-to-br from-yellow-500/10 via-background to-yellow-500/5">
                  <div className="absolute top-0 right-0 p-3 opacity-10 rotate-12">
                    <Trophy className="h-24 w-24 text-yellow-500" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                      <Trophy className="h-5 w-5 fill-yellow-500" />
                      Best Streak Record
                    </CardTitle>
                    <CardDescription>
                      Longest consecutive streak
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-bold text-foreground">
                        {stats.bestStreak}
                      </div>
                      <span className="text-muted-foreground font-medium">days</span>
                    </div>
                    {stats.currentStreak >= stats.bestStreak && stats.bestStreak > 0 && (
                      <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500">
                        Current Record!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Monthly Comparison Header Cards */}
            <PeriodComparisonStats />

            {/* AI Insights Section */}
            {isAnalyzable && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
                      <Brain className="h-6 w-6 text-blue-600" />
                      AI Insights
                    </h2>
                    <p className="text-muted-foreground">
                      Personalized recommendations based on your training data
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshInsights}
                      className="flex items-center gap-2 text-xs"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex items-center gap-2 text-xs"
                    >
                      <Link href="/insights">
                        View All ({(insights?.length || 0) + (archivedInsights?.length || 0)})
                      </Link>
                    </Button>
                    {lastAnalyzed && (
                      <div className="text-xs text-muted-foreground">
                        Last analyzed: {formatDateOnly(lastAnalyzed)}
                      </div>
                    )}
                  </div>
                </div>

                {(insights ?? [])?.length > 0 ? (
                  (() => {
                    const insightsList = insights ?? [];
                    // Sort by priority to find the highest priority insight
                    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
                    const sorted = [...insightsList].sort((a, b) =>
                      (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
                    );
                    const [featured, ...rest] = sorted;

                    return (
                      <div className="space-y-4">
                        {/* Featured (highest priority) insight - full width */}
                        {featured && (
                          <InsightCard
                            key={featured.id || 'featured'}
                            insight={featured}
                            onFeedback={() => { }}
                            isArchived={false}
                            onArchive={archiveInsight}
                          />
                        )}
                        {/* Remaining insights in 2 columns */}
                        {rest.length > 0 && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {rest.map((insight: Insight | CloudInsight, index: number) => (
                              <InsightCard
                                key={insight.id || `local-${insight.type}-${index}`}
                                insight={insight}
                                onFeedback={() => { }}
                                isArchived={false}
                                onArchive={archiveInsight}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        {isGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              Generating Insights...
                            </h3>
                            <p className="text-muted-foreground mb-4">
                              AI is analyzing your training patterns. This may take a moment.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                              <Brain className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              {cloudAIError && !isCloudAIConfigured ? 'AI Not Configured' : 'No Current Insights'}
                            </h3>
                            <p className="text-muted-foreground mb-4">
                              {cloudAIError && !isCloudAIConfigured
                                ? cloudAIError
                                : 'Click Refresh to generate new personalized insights.'
                              }
                            </p>
                            {cloudAIError && !isCloudAIConfigured && (
                              <Button variant="outline" size="sm" asChild className="mb-4">
                                <Link href="/settings#aiSettings">
                                  Configure AI Settings
                                </Link>
                              </Button>
                            )}
                          </>
                        )}
                        {(archivedInsights?.length || 0) > 0 && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/insights">
                              View {archivedInsights?.length} Archived Insights
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Empty State for AI Insights */}
            {!isAnalyzable && sessions.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Brain className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {cloudAIError && !isCloudAIConfigured ? 'AI Not Configured' : 'AI Insights Coming Soon'}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {cloudAIError && !isCloudAIConfigured
                        ? cloudAIError
                        : 'Complete at least 5 sessions to unlock personalized AI recommendations and insights.'
                      }
                    </p>
                    {cloudAIError && !isCloudAIConfigured ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/settings#aiSettings">
                          Configure AI Settings
                        </Link>
                      </Button>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Sessions needed: {sessions.length}/5
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metric Comparison Widget */}
            <MetricComparisonWidget />

          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
