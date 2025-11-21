'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
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
import { ArrowUpDown, Calendar, TrendingUp, Clock, Zap, Target, ArrowUp, ArrowDown, Filter, X, Trophy } from 'lucide-react';

// Filter options
interface FilterConfig {
  dateRange: 'all' | '7days' | '30days' | '90days';
  distanceRange: 'all' | '100' | '500' | '1000' | '2000' | '5000+';
}

const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' }
];

const distanceRangeOptions = [
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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Sort configuration
type SortField = 'date' | 'distance' | 'pace' | 'power';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export default function SessionsPage() {
  const { getSessions, getPersonalRecords, sessionsViewSettings, updateSessionsViewSettings } = useRowingStore();
  const sessions = getSessions();
  const personalRecords = getPersonalRecords();
  
  // Helper function to check if session is a personal record
  const isPersonalRecord = (session: any): { isPR: boolean; distances: string[] } => {
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
              <Link href="/upload" className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Upload Your Data
              </Link>
            </Button>
          </div>
        ) : (
          // Sessions content
          <div className="space-y-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date Range Filter */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">Date Range</label>
                    <div className="flex flex-wrap gap-2">
                      {dateRangeOptions.map((option) => (
                        <Button
                          key={option.value}
                          variant={filters.dateRange === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSessionsViewSettings({ dateRange: option.value as any })}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Distance Range Filter */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">Distance</label>
                    <div className="flex flex-wrap gap-2">
                      {distanceRangeOptions.map((option) => (
                        <Button
                          key={option.value}
                          variant={filters.distanceRange === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSessionsViewSettings({ distanceRange: option.value as any })}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
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
                                <Calendar className="h-4 w-4" />
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
                                <TrendingUp className="h-4 w-4" />
                                Distance
                                {getSortIcon('distance')}
                              </div>
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4" />
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
                                <Target className="h-4 w-4" />
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
                                <Zap className="h-4 w-4" />
                                Avg Power
                                {getSortIcon('power')}
                              </div>
                            </Button>
                          </TableHead>
                          <TableHead className="text-right">
                            <div className="flex items-center justify-end gap-2 text-muted-foreground">
                              <ArrowUpDown className="h-4 w-4" />
                              Stroke Rate
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSessions.map((session) => {
                          const prInfo = isPersonalRecord(session);
                          return (
                            <TableRow 
                              key={session.id} 
                              className={`cursor-pointer hover:bg-muted/50 ${prInfo.isPR ? 'bg-primary/5' : ''}`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Link 
                                    href={`/sessions/${session.id}`}
                                    className="text-sm font-medium hover:underline"
                                  >
                                    {formatDate(session.timestamp)}
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
                              <Badge variant="secondary">
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
