'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Target, Zap, TrendingUp, Medal, Crown } from 'lucide-react';
import { AwardsList } from '@/components/AwardsList';
import { formatDateOnly } from '@/lib/dateTimeUtils';

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


export default function PRsPage() {
  const { getPersonalRecords, getSessions } = useRowingStore();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Show loading placeholder during hydration
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-4"></div>
            <div className="h-4 bg-muted rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex flex-col items-center justify-center px-6 py-4 rounded-2xl bg-gradient-to-br from-gold-100 via-background to-transparent border border-gold-200/60 shadow-[0_25px_60px_-35px_rgba(255,215,0,0.8)]">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="h-8 w-8 text-[#d4af37] drop-shadow" />
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Personal Records</h1>
              <Trophy className="h-8 w-8 text-[#d4af37] drop-shadow" />
            </div>
            <p className="text-muted-foreground text-base mt-3">
              Celebrate your standout performances across every distance
            </p>
          </div>
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
                    <Card
                      key={record.distance}
                      className="relative overflow-hidden border border-gold-200/40 bg-gradient-to-br from-gold-50/60 via-background to-transparent shadow-[0_20px_45px_-25px_rgba(255,215,0,0.9)]"
                    >
                      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-gold-200/60 to-transparent rounded-bl-full opacity-80" />
                      <CardHeader className="pb-4 relative z-10">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2 text-gold-700">
                            <Trophy className="h-5 w-5 text-[#d4af37] fill-[#f7e5a5]" />
                            {formatDistance(record.distance)}
                          </CardTitle>
                          <Badge className="bg-gradient-to-r from-gold-400 to-amber-500 text-gold-950 text-xs border border-gold-500 shadow-sm">
                            BEST TIME
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 relative z-10">
                        <div className="text-3xl font-bold text-foreground font-mono">
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
                          <Calendar className="h-4 w-4 text-gold-500" />
                          <span>Achieved: {formatDateOnly(record.date)}</span>
                        </div>
                        
                        {record.sessionId && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-full border-gold-300 text-gold-700 hover:bg-gold-50"
                          >
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
                      <p className="text-sm">Complete sessions at 100m, 500m, 1000m, 2000m, or 5000m to set records.</p>
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
                <Card className="border border-gold-200/60 bg-gradient-to-br from-amber-50 via-background to-transparent">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-gold-700">
                      <Zap className="h-5 w-5 text-gold-500" />
                      Best Average Power
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      {bestPower.avgPower > 0 ? `${Math.round(bestPower.avgPower)}W` : '--'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 text-yellow-500" />
                      <span>Session: {formatDateOnly(bestPower.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Best Stroke Rate */}
                <Card className="border border-yellow-200/60 bg-gradient-to-br from-amber-50 via-background to-transparent">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-yellow-700">
                      <Target className="h-5 w-5 text-yellow-500" />
                      Best Stroke Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      {bestStrokeRate.avgStrokeRate > 0 ? `${Math.round(bestStrokeRate.avgStrokeRate)} SPM` : '--'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 text-yellow-500" />
                      <span>Session: {formatDateOnly(bestStrokeRate.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Achievements Section */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                Achievements
              </h2>
              <AwardsList />
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
