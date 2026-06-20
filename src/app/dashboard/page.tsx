'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, TrendingUp, Clock, Zap, Target, Activity, Flame, Trophy } from 'lucide-react';
import { MigrationPrompt } from '@/components/MigrationPrompt';

import { PeriodComparisonStats } from '@/components/PeriodComparisonStats';
import { TimeRangeSelector, defaultTimeRangeOptions, type TimeRange } from '@/components/ui/time-range-selector';

const DeferredDashboardWidget = () => (
  <div className="h-64 w-full animate-pulse rounded-xl border bg-muted/30" />
);

const MetricComparisonWidget = dynamic(
  () => import('@/components/MetricComparisonWidget').then((mod) => mod.MetricComparisonWidget),
  { ssr: false, loading: DeferredDashboardWidget }
);

const PostureFaultTrendCard = dynamic(
  () => import('@/components/PostureFaultTrendCard').then((mod) => mod.PostureFaultTrendCard),
  { ssr: false, loading: DeferredDashboardWidget }
);

const DashboardInsightsSection = dynamic(
  () => import('@/components/dashboard/DashboardInsightsSection').then((mod) => mod.DashboardInsightsSection),
  { ssr: false, loading: DeferredDashboardWidget }
);

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

const Dashboard = () => {
  const { getSessions, getStats, dashboardSettings, updateDashboardSettings } = useRowingStore();
  const sessions = getSessions();
  const stats = getStats();

  const [mounted, setMounted] = useState(false);
  const [showDeferredWidgets, setShowDeferredWidgets] = useState(false);

  const timeRange = dashboardSettings.timeRange;
  const setTimeRange = (range: TimeRange) => updateDashboardSettings({ timeRange: range });

  useEffect(() => {
    setMounted(true);
    const timer = window.setTimeout(() => {
      setShowDeferredWidgets(true);
    }, 1500);

    return () => window.clearTimeout(timer);
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

            {/* Posture Fault Frequency Trend */}
            {showDeferredWidgets ? <PostureFaultTrendCard /> : <DeferredDashboardWidget />}

            {showDeferredWidgets ? <DashboardInsightsSection sessionCount={sessions.length} /> : <DeferredDashboardWidget />}

            {/* Metric Comparison Widget */}
            {showDeferredWidgets ? <MetricComparisonWidget /> : <DeferredDashboardWidget />}

          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
