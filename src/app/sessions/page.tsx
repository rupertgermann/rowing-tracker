'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRowingStore, type SessionsDistanceFilter } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Calendar, TrendingUp, Clock, Zap, Target, ArrowUp, ArrowDown, Filter, X, Trophy, Sparkles, Video } from 'lucide-react';
import { formatSessionDate } from '@/lib/dateTimeUtils';
import { cacheSessionsData } from '@/lib/services/sessionsCache';
import { TimeRangeSelector } from '@/components/ui/time-range-selector';
import type { Session } from '@/types/session';

const distanceRangeOptions: Array<{ value: SessionsDistanceFilter; label: string }> = [
  { value: 'all', label: 'All Distances' },
  { value: '100', label: '100m' },
  { value: '500', label: '500m' },
  { value: '1000', label: '1000m' },
  { value: '2000', label: '2000m' },
  { value: '5000+', label: '5000m+' }
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
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
}

function formatPace(secondsPer500m: number): string {
  if (secondsPer500m <= 0) return '--:--';
  const minutes = Math.floor(secondsPer500m / 60);
  const seconds = Math.floor(secondsPer500m % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Sort configuration
type SortField = 'date' | 'distance' | 'pace' | 'power';

export default function SessionsPage() {
  const { getSessions, getPersonalRecords, replaceSessionsInStore, sessionsViewSettings, updateSessionsViewSettings } = useRowingStore();
  const sessions = getSessions();
  const personalRecords = getPersonalRecords();
  const router = useRouter();

  // Helper function to check if session is a personal record
  const isPersonalRecord = (session: Session): { isPR: boolean; distances: string[] } => {
    const prDistances = personalRecords
      .filter(pr => pr.sessionId === session.id)
      .map(pr => formatDistance(pr.distance));

    return {
      isPR: prDistances.length > 0,
      distances: prDistances
    };
  };
  const [mounted, setMounted] = useState(false);

  const sortConfig = sessionsViewSettings.sortConfig;
  const filters = sessionsViewSettings.filters;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshSessions() {
      try {
        const response = await fetch('/api/sessions/list', { cache: 'no-store' });
        if (!response.ok) throw new Error(`${response.status}`);
        const data: {
          sessions?: Session[];
          sessionsRevision?: number;
        } = await response.json();
        const freshSessions = data.sessions ?? [];

        if (cancelled) return;
        replaceSessionsInStore(freshSessions);
        if (typeof data.sessionsRevision === 'number') {
          cacheSessionsData(freshSessions, data.sessionsRevision);
        }
      } catch (error) {
        console.error('[SessionsPage] Failed to refresh sessions:', error);
      }
    }

    refreshSessions();

    return () => {
      cancelled = true;
    };
  }, [replaceSessionsInStore]);

  // Apply filters to sessions
  const filteredSessions = sessions.filter(session => {
    // Date range filter
    if (filters.dateRange !== 'all') {
      const sessionDate = new Date(session.timestamp);
      const now = new Date();
      const daysToFilter = {
        '7days': 7,
        '30days': 30,
        '90days': 90
      }[filters.dateRange];

      if (daysToFilter) {
        const cutoffDate = new Date(now.getTime() - (daysToFilter * 24 * 60 * 60 * 1000));
        if (sessionDate < cutoffDate) return false;
      }
    }

    // Distance range filter
    if (filters.distanceRange !== 'all') {
      if (filters.distanceRange === '5000+') {
        if (session.distance < 5000) return false;
      } else {
        const targetDistance = parseInt(filters.distanceRange);
        if (session.distance !== targetDistance) return false;
      }
    }

    return true;
  });

  // Sort sessions based on current sort configuration
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const { field, direction } = sortConfig;

    let comparison = 0;

    switch (field) {
      case 'date':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'distance':
        comparison = a.distance - b.distance;
        break;
      case 'pace':
        comparison = a.avgSplit - b.avgSplit;
        break;
      case 'power':
        comparison = a.avgPower - b.avgPower;
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });

  const hasData = sessions.length > 0;
  const hasFilteredData = filteredSessions.length > 0;
  const hasActiveFilters = filters.dateRange !== 'all' || filters.distanceRange !== 'all';

  // Handle column sort
  const handleSort = (field: SortField) => {
    updateSessionsViewSettings({
      field,
      direction: sortConfig.field === field && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  // Get sort icon for column
  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === 'asc' ?
      <ArrowUp className="h-4 w-4" /> :
      <ArrowDown className="h-4 w-4" />;
  };

  // Clear all filters
  const clearFilters = () => {
    updateSessionsViewSettings({
      filters: {
        dateRange: 'all',
        distanceRange: 'all'
      }
    });
  };

  const handleRowNavigate = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {!mounted ? (
          // Loading placeholder to match server/client
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-32 mb-4"></div>
            <div className="h-4 bg-muted rounded w-64 mb-8"></div>
            <div className="h-96 bg-muted rounded"></div>
          </div>
        ) : !hasData ? (
          // Empty state
          <div className="text-center py-16">
            <div className="bg-muted rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              No Sessions Yet
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your SmartRow CSV data to see your workout history and detailed session information.
            </p>
            <Button asChild size="lg">
              <Link href="/sync" className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Upload Your Data
              </Link>
            </Button>
          </div>
        ) : (
          // Sessions content
          <div className="space-y-6">
            {/* Module Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Sessions
                </h2>
                <p className="text-muted-foreground">
                  View and filter your workout history
                </p>
              </div>
              <TimeRangeSelector
                value={filters.dateRange}
                onChange={(value) => updateSessionsViewSettings({ dateRange: value })}
                showLabel
              />
            </div>

            {/* Filter Controls */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Filters</CardTitle>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Distance Range Filter */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Distance</label>
                  <div className="flex flex-wrap gap-2">
                    {distanceRangeOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant={filters.distanceRange === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateSessionsViewSettings({ distanceRange: option.value })}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workout History</CardTitle>
                    <CardDescription>
                      Click any session to view detailed analytics
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {hasFilteredData ?
                        `${sortedSessions.length} of ${sessions.length} sessions` :
                        `${sortedSessions.length} sessions`
                      }
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {hasFilteredData ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort('date')}
                              className="h-auto p-0 font-semibold hover:bg-transparent"
                            >
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-500" />
                                Date
                                {getSortIcon('date')}
                              </div>
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort('distance')}
                              className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                            >
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-blue-500" />
                                Distance
                                {getSortIcon('distance')}
                              </div>
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4 text-violet-500" />
                              Time
                            </div>
                          </TableHead>
                          <TableHead className="text-right">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort('pace')}
                              className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                            >
                              <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-emerald-500" />
                                Avg Pace
                                {getSortIcon('pace')}
                              </div>
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <Button
                              variant="ghost"
                              onClick={() => handleSort('power')}
                              className="h-auto p-0 font-semibold hover:bg-transparent ml-auto"
                            >
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-500" />
                                Avg Power
                                {getSortIcon('power')}
                              </div>
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                              <ArrowUpDown className="h-4 w-4 text-rose-500" />
                              Stroke Rate
                            </div>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                              <Sparkles className="h-4 w-4 text-cyan-500" />
                              Stroke Data
                            </div>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                              <Video className="h-4 w-4 text-purple-500" />
                              Mocap
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSessions.map((session) => {
                          const prInfo = isPersonalRecord(session);
                          const hasStrokeData = Boolean(
                            (session.strokeData && session.strokeData.length > 0) ||
                            (session.strokeDataCount && session.strokeDataCount > 0)
                          );
                          return (
                            <TableRow
                              key={session.id}
                              tabIndex={0}
                              onClick={() => handleRowNavigate(session.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleRowNavigate(session.id);
                                }
                              }}
                              className={`cursor-pointer hover:bg-muted/50 focus:bg-muted/70 focus-visible:outline-none ${prInfo.isPR ? 'bg-primary/5' : ''}`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/sessions/${session.id}`}
                                    className="text-sm font-medium hover:underline"
                                  >
                                    {formatSessionDate(session.timestamp)}
                                  </Link>
                                  {prInfo.isPR && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800"
                                      title={`Personal Record: ${prInfo.distances.join(', ')}`}
                                    >
                                      <Trophy className="h-3 w-3 mr-1" />
                                      PR
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                                  {formatDistance(session.distance)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatDuration(session.duration)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">
                                {formatPace(session.avgSplit)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {session.avgPower > 0 ? `${Math.round(session.avgPower)}W` : '--'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {session.avgStrokeRate > 0 ? `${Math.round(session.avgStrokeRate)} SPM` : '--'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {hasStrokeData ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    Enhanced
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No stroke file</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm" onClick={(e) => e.stopPropagation()}>
                                {session.mocapSession ? (
                                  <Link href={`/mocap/sessions/${session.mocapSession.id}`}>
                                    <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20 cursor-pointer">
                                      <Video className="h-3 w-3 mr-1" />
                                      Mocap
                                    </Badge>
                                  </Link>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <Filter className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No sessions match your filters
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Try adjusting your filter criteria or clear all filters to see all sessions.
                    </p>
                    <Button variant="outline" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  </div>
                )}

                {/* Summary */}
                <div className="mt-6 text-center text-sm text-muted-foreground">
                  {hasActiveFilters ?
                    `Showing ${sortedSessions.length} filtered sessions` :
                    `Showing all ${sessions.length} sessions`
                  } • Sorted by {sortConfig.field} ({sortConfig.direction})
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
