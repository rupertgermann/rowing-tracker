'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, TrendingUp, Clock, Zap, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Time range options
type TimeRange = '7days' | '30days' | '90days' | 'all';

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
  
  // Prepare chart data with filtered sessions
  const chartData = hasFilteredData ? prepareChartData(filteredSessions) : [];

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

            {/* Distance Over Time Chart */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6">
                Distance Over Time
                {timeRange !== 'all' && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    ({timeRangeOptions.find(opt => opt.value === timeRange)?.label})
                  </span>
                )}
              </h2>
              {hasFilteredData ? (
                <Card>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          className="text-xs"
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          className="text-xs"
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(value) => `${value}m`}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px'
                          }}
                          formatter={(value: number) => [`${value}m`, 'Distance']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="distance" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground py-8">
                      <p>No sessions found in the selected time range.</p>
                      <p className="text-sm">Try selecting a different time range or upload more data.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

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
