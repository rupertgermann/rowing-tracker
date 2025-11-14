'use client';

import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Target, Zap, TrendingUp, Medal } from 'lucide-react';

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
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function PRsPage() {
  const { getPersonalRecords, getSessions } = useRowingStore();
  const personalRecords = getPersonalRecords();
  const sessions = getSessions();

  const hasData = sessions.length > 0;
  const hasPRs = personalRecords.length > 0;

  // Find best overall stats for additional metrics
  const bestPower = sessions.reduce((best, session) => 
    session.avgPower > best.avgPower ? session : best, 
    sessions[0] || { avgPower: 0, timestamp: new Date() }
  );

  const bestStrokeRate = sessions.reduce((best, session) => 
    session.avgStrokeRate > best.avgStrokeRate ? session : best, 
    sessions[0] || { avgStrokeRate: 0, timestamp: new Date() }
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Personal Records</h1>
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Your best performances across standard distances and metrics
          </p>
        </div>

        {!hasData ? (
          // Empty state
          <div className="text-center py-16">
            <div className="bg-muted rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Trophy className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              No Records Yet
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Upload your SmartRow CSV data to start tracking your personal records and achievements.
            </p>
            <Button asChild size="lg">
              <Link href="/upload" className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Upload Your Data
              </Link>
            </Button>
          </div>
        ) : (
          // Personal Records
          <div className="space-y-8">
            {/* Distance Records */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Medal className="h-6 w-6 text-primary" />
                Distance Records
              </h2>
              
              {hasPRs ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {personalRecords.map((record) => (
                    <Card key={record.distance} className="relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-bl-full" />
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-primary" />
                            {formatDistance(record.distance)}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            BEST TIME
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-3xl font-bold text-primary font-mono">
                          {formatDuration(record.bestTime)}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Avg Pace:</span>
                            <div className="font-mono font-semibold">
                              {formatPace(record.bestPace)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Avg Power:</span>
                            <div className="font-semibold">
                              {record.avgPower > 0 ? `${Math.round(record.avgPower)}W` : '--'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Achieved: {formatDate(record.date)}</span>
                        </div>
                        
                        {record.sessionId && (
                          <Button asChild variant="outline" size="sm" className="w-full">
                            <Link href={`/sessions/${record.sessionId}`}>
                              View Session
                            </Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <p>No distance records yet.</p>
                      <p className="text-sm">Complete sessions at 500m, 1000m, 2000m, or 5000m to set records.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Performance Records */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                Performance Records
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Best Average Power */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Best Average Power
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-primary">
                      {bestPower.avgPower > 0 ? `${Math.round(bestPower.avgPower)}W` : '--'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Session: {formatDate(bestPower.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Best Stroke Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Best Stroke Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold text-primary">
                      {bestStrokeRate.avgStrokeRate > 0 ? `${Math.round(bestStrokeRate.avgStrokeRate)} SPM` : '--'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Session: {formatDate(bestStrokeRate.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Summary */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Based on {sessions.length} sessions • Records update automatically as you improve
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
