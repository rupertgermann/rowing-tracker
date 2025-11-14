'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, TrendingUp, Clock, Zap, Target, Activity, Flame, Gauge } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';

// Time range options
type TimeRange = '7days' | '30days' | '90days' | 'all';

// Chart type options
type ChartType = 'line' | 'bar' | 'area';

interface TimeRangeOption {
  value: TimeRange;
  label: string;
  days?: number;
}

const timeRangeOptions: TimeRangeOption[] = [
  { value: '7days', label: '7 Days', days: 7 },
  { value: '30days', label: '30 Days', days: 30 },
  { value: '90days', label: '90 Days', days: 90 },
  { value: 'all', label: 'All Time' }
];

// Chart configuration options
type ChartMetric = 'distance' | 'pace' | 'power' | 'strokeRate' | 'energy' | 'duration';

interface ChartConfig {
  metric: ChartMetric;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fillOpacity?: number;
  formatter: (value: number) => string;
  yAxisFormatter: (value: number) => string;
  unit: string;
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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Prepare chart data for distance over time
function prepareChartData(sessions: any[]) {
  return sessions
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(session => ({
      date: new Date(session.timestamp).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      }),
      distance: session.distance,
      fullDate: session.timestamp
    }));
}

export default function DashboardPage() {
  const { getSessions, getStats } = useRowingStore();
  const sessions = getSessions();
  const stats = getStats();
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [enabledCharts, setEnabledCharts] = useState<ChartMetric[]>(['distance', 'power', 'pace']);
  const [chartType, setChartType] = useState<ChartType>('line');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter sessions based on selected time range
  const filteredSessions = sessions.filter(session => {
    if (timeRange === 'all') return true;
    
    const sessionDate = new Date(session.timestamp);
    const now = new Date();
    const daysAgo = timeRangeOptions.find(option => option.value === timeRange)?.days;
    
    if (!daysAgo) return true;
    
    const cutoffDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    return sessionDate >= cutoffDate;
  });

  // Calculate filtered stats
  const filteredStats = filteredSessions.reduce((acc, session) => {
    return {
      totalDistance: acc.totalDistance + session.distance,
      totalTime: acc.totalTime + session.duration,
      totalPower: acc.totalPower + session.avgPower,
      sessionCount: acc.sessionCount + 1
    };
  }, { totalDistance: 0, totalTime: 0, totalPower: 0, sessionCount: 0 });

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
    return sessions.map(session => ({
      date: formatDate(new Date(session.timestamp)),
      [metric]: getMetricValue(session, metric),
      fullDate: session.timestamp
    }));
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
      default: return 0;
    }
  };

  // Toggle chart visibility
  const toggleChart = (metric: ChartMetric) => {
    setEnabledCharts(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  // Prepare chart data for each enabled metric
  const chartDataMap = enabledCharts.reduce((acc, metric) => {
    acc[metric] = hasFilteredData ? prepareChartData(filteredSessions, metric) : [];
    return acc;
  }, {} as Record<ChartMetric, any[]>);

  // Render chart based on selected type
  const renderChart = (metric: ChartMetric, chartData: any[], config: ChartConfig) => {
    const commonProps = {
      width: '100%' as const,
      height: 300,
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    const commonChartElements = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          stroke="#6b7280"
          tick={{ fill: '#6b7280' }}
        />
        <YAxis 
          className="text-xs"
          stroke="#6b7280"
          tick={{ fill: '#6b7280' }}
          tickFormatter={config.yAxisFormatter}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            color: '#111827'
          }}
          formatter={(value: number) => [config.formatter(value), config.label]}
        />
      </>
    );

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {commonChartElements}
            <Bar 
              dataKey={metric} 
              fill={config.color}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {commonChartElements}
            <Area 
              type="monotone" 
              dataKey={metric} 
              stroke={config.color}
              fill={config.color}
              fillOpacity={config.fillOpacity}
              strokeWidth={2}
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
              dot={{ fill: config.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {!mounted ? (
          // Loading placeholder to match server/client
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-4"></div>
            <div className="h-4 bg-muted rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
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
          // Dashboard content
          <div className="space-y-8">
            {/* Time Range Selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Dashboard Analytics
                </h2>
                <p className="text-muted-foreground">
                  Track your rowing performance and progress
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground mr-2">Time Range:</span>
                <div className="flex gap-1">
                  {timeRangeOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant={timeRange === option.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeRange(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Key Metrics
                {timeRange !== 'all' && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    ({timeRangeOptions.find(opt => opt.value === timeRange)?.label})
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatDistance(filteredStats.totalDistance)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {filteredStats.sessionCount} sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Time</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {formatDuration(filteredStats.totalTime)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All sessions
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Pace</CardTitle>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary font-mono">
                      {formatPace(avgPace)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per 500 meters
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Power</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">
                      {Math.round(avgPower)}W
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average output
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Total Sessions</CardTitle>
                  <CardDescription>
                    Number of workouts tracked
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {stats.totalSessions}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Streak</CardTitle>
                  <CardDescription>
                    Consecutive days with sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {stats.currentStreak}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Best: {stats.bestStreak} days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Average Stroke Rate</CardTitle>
                  <CardDescription>
                    Typical strokes per minute
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {stats.avgStrokeRate > 0 ? `${Math.round(stats.avgStrokeRate)} SPM` : '--'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart Configuration */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Performance Charts
                    {timeRange !== 'all' && (
                      <span className="text-lg font-normal text-muted-foreground ml-2">
                        ({timeRangeOptions.find(opt => opt.value === timeRange)?.label})
                      </span>
                    )}
                  </h2>
                  <p className="text-muted-foreground">
                    Customize which metrics to visualize over time
                  </p>
                </div>
              </div>
              
              {/* Chart Selector */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-primary" />
                        Select Charts to Display
                      </CardTitle>
                      <CardDescription>
                        Choose which metrics to track over time
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground mr-2">Chart Type:</span>
                      <div className="flex gap-1">
                        <Button
                          variant={chartType === 'line' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChartType('line')}
                          className="text-xs"
                        >
                          Line
                        </Button>
                        <Button
                          variant={chartType === 'bar' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChartType('bar')}
                          className="text-xs"
                        >
                          Bar
                        </Button>
                        <Button
                          variant={chartType === 'area' ? "default" : "outline"}
                          size="sm"
                          onClick={() => setChartType('area')}
                          className="text-xs"
                        >
                          Area
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(chartConfigs).map(([metric, config]) => {
                      const Icon = config.icon;
                      const isEnabled = enabledCharts.includes(metric as ChartMetric);
                      
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
                    {enabledCharts.length === 0 
                      ? "No charts selected. Select at least one metric to visualize."
                      : `Showing ${enabledCharts.length} chart${enabledCharts.length > 1 ? 's' : ''} as ${chartType} visualization${chartType !== 'line' ? 's' : ''}`
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Configurable Charts */}
            {enabledCharts.length > 0 && (
              <div className="space-y-6">
                {enabledCharts.map(metric => {
                  const config = chartConfigs[metric];
                  const Icon = config.icon;
                  const chartData = chartDataMap[metric];
                  
                  return (
                    <Card key={metric}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-md bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {config.label} Over Time
                            </CardTitle>
                            <CardDescription>
                              Track your {config.label.toLowerCase()} progress
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
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
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Empty State for Charts */}
            {enabledCharts.length === 0 && (
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/sessions" className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  View All Sessions
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/prs" className="flex items-center justify-center gap-2">
                  <Target className="h-4 w-4" />
                  Personal Records
                </Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/upload" className="flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4" />
                  Add More Data
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
