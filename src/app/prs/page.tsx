'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Target, Zap, TrendingUp, Medal, Crown, Flame, BarChart3 } from 'lucide-react';
import { calculateAdvancedStats } from '@/lib/analysisUtils';
import { AwardsList } from '@/components/AwardsList';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { cardStyles, getCardClassName, getShadowStyle } from '@/lib/cardStyles';

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
  const { getPersonalRecords, getSessions, getStats } = useRowingStore();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const personalRecords = getPersonalRecords();
  const sessions = getSessions();
  const stats = getStats();

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

  // Calculate consistency records from sessions with stroke data
  const consistencyRecords = (() => {
    const sessionsWithStrokeData = sessions.filter(s => s.strokeData && s.strokeData.length > 0);
    
    if (sessionsWithStrokeData.length === 0) {
      return {
        bestScore: 0,
        bestScoreSession: null as typeof sessions[0] | null,
        avgScore: 0,
        excellentCount: 0,
        trend: 0,
        totalWithData: 0
      };
    }

    // Calculate consistency scores for all sessions
    const sessionScores = sessionsWithStrokeData.map(session => ({
      session,
      score: calculateAdvancedStats(session.strokeData!).consistencyScore,
      timestamp: new Date(session.timestamp).getTime()
    })).sort((a, b) => a.timestamp - b.timestamp);

    // Best consistency score
    const best = sessionScores.reduce((max, curr) => curr.score > max.score ? curr : max, sessionScores[0]);

    // Average consistency
    const avgScore = sessionScores.reduce((sum, s) => sum + s.score, 0) / sessionScores.length;

    // Sessions with excellent consistency (≥80)
    const excellentCount = sessionScores.filter(s => s.score >= 75).length;

    // Trend: compare last 2 weeks avg vs 2 weeks from 3 months ago
    let trend = 0;
    let hasTrendData = false;
    const now = Date.now();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;
    
    // Last 2 weeks
    const recentStart = now - twoWeeksMs;
    const recentSessions = sessionScores.filter(s => s.timestamp >= recentStart);
    
    // 2 weeks from 3 months ago (between 3 months ago and 3 months - 2 weeks ago)
    const oldEnd = now - threeMonthsMs;
    const oldStart = oldEnd - twoWeeksMs;
    const oldSessions = sessionScores.filter(s => s.timestamp >= oldStart && s.timestamp < oldEnd);
    
    if (recentSessions.length > 0 && oldSessions.length > 0) {
      const recentAvg = recentSessions.reduce((sum, s) => sum + s.score, 0) / recentSessions.length;
      const oldAvg = oldSessions.reduce((sum, s) => sum + s.score, 0) / oldSessions.length;
      trend = recentAvg - oldAvg;
      hasTrendData = true;
    }

    return {
      bestScore: best.score,
      bestScoreSession: best.session,
      avgScore,
      excellentCount,
      trend,
      hasTrendData,
      totalWithData: sessionsWithStrokeData.length
    };
  })();

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
                    <Link
                      key={record.distance}
                      href={record.sessionId ? `/sessions/${record.sessionId}` : '#'}
                      className={record.sessionId ? 'block' : 'pointer-events-none'}
                    >
                      <Card className={getCardClassName('gold', !!record.sessionId)} style={getShadowStyle('gold')}>
                        <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-gold-200/60 to-transparent rounded-bl-full opacity-80" />
                        <CardHeader className="pb-4 relative z-10">
                          <div className="flex items-center justify-between">
                            <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.gold.titleColor}`}>
                              <Trophy className={`h-5 w-5 ${cardStyles.gold.iconColor}`} />
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
                            <Calendar className={`h-4 w-4 ${cardStyles.gold.accentColor}`} />
                            <span>Achieved: {formatDateOnly(record.date)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Best Average Power */}
                <Card className={getCardClassName('amber')} style={getShadowStyle('amber')}>
                  <CardHeader>
                    <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.amber.titleColor}`}>
                      <Zap className={`h-5 w-5 ${cardStyles.amber.iconColor}`} />
                      Best Average Power
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      {bestPower.avgPower > 0 ? `${Math.round(bestPower.avgPower)}W` : '--'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className={`h-4 w-4 ${cardStyles.amber.accentColor}`} />
                      <span>Session: {formatDateOnly(bestPower.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Best Streak Record */}
                <Card className={getCardClassName('amber')} style={getShadowStyle('amber')}>
                  <CardHeader>
                    <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.amber.titleColor}`}>
                      <Flame className={`h-5 w-5 ${cardStyles.amber.iconColor}`} />
                      Best Streak Record
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      {stats.bestStreak > 0 ? `${stats.bestStreak} days` : '--'}
                    </div>
                    {stats.currentStreak >= stats.bestStreak && stats.bestStreak > 0 ? (
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500">
                        Current Record!
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className={`h-4 w-4 ${cardStyles.amber.accentColor}`} />
                        <span>Current: {stats.currentStreak} days</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Best Stroke Rate */}
                <Card className={getCardClassName('amber')} style={getShadowStyle('amber')}>
                  <CardHeader>
                    <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.amber.titleColor}`}>
                      <Target className={`h-5 w-5 ${cardStyles.amber.iconColor}`} />
                      Best Stroke Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-3xl font-bold">
                      {bestStrokeRate.avgStrokeRate > 0 ? `${Math.round(bestStrokeRate.avgStrokeRate)} SPM` : '--'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className={`h-4 w-4 ${cardStyles.amber.accentColor}`} />
                      <span>Session: {formatDateOnly(bestStrokeRate.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Consistency Records */}
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-teal-500" />
                Consistency Records
              </h2>
              
              {consistencyRecords.totalWithData > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Best Consistency Score */}
                  <Link
                    href={consistencyRecords.bestScoreSession ? `/sessions/${consistencyRecords.bestScoreSession.id}` : '#'}
                    className={consistencyRecords.bestScoreSession ? 'block' : 'pointer-events-none'}
                  >
                    <Card className={getCardClassName('teal', !!consistencyRecords.bestScoreSession)} style={getShadowStyle('teal')}>
                      <CardHeader>
                        <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.teal.titleColor}`}>
                          <Trophy className={`h-5 w-5 ${cardStyles.teal.iconColor}`} />
                          Best Consistency
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-3xl font-bold">
                          {Math.round(consistencyRecords.bestScore)}/100
                        </div>
                        {consistencyRecords.bestScoreSession && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className={`h-4 w-4 ${cardStyles.teal.accentColor}`} />
                            <span>{formatDateOnly(consistencyRecords.bestScoreSession.timestamp)}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Average Consistency */}
                  <Card className={getCardClassName('teal')} style={getShadowStyle('teal')}>
                    <CardHeader>
                      <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.teal.titleColor}`}>
                        <Target className={`h-5 w-5 ${cardStyles.teal.iconColor}`} />
                        Average Consistency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        {Math.round(consistencyRecords.avgScore)}/100
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Across {consistencyRecords.totalWithData} sessions
                      </div>
                    </CardContent>
                  </Card>

                  {/* Excellent Sessions Count */}
                  <Card className={getCardClassName('teal')} style={getShadowStyle('teal')}>
                    <CardHeader>
                      <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.teal.titleColor}`}>
                        <Medal className={`h-5 w-5 ${cardStyles.teal.iconColor}`} />
                        Excellent Sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-3xl font-bold">
                        {consistencyRecords.excellentCount}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sessions with score ≥75
                      </div>
                    </CardContent>
                  </Card>

                  {/* Consistency Trend */}
                  <Card className={getCardClassName('teal')} style={getShadowStyle('teal')}>
                    <CardHeader>
                      <CardTitle className={`text-lg flex items-center gap-2 ${cardStyles.teal.titleColor}`}>
                        <TrendingUp className={`h-5 w-5 ${cardStyles.teal.iconColor}`} />
                        Consistency Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {consistencyRecords.hasTrendData ? (
                        <>
                          <div className={`text-3xl font-bold ${consistencyRecords.trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            {consistencyRecords.trend >= 0 ? '+' : ''}{Math.round(consistencyRecords.trend)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Last 2 weeks vs 3 months ago
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-3xl font-bold text-muted-foreground">--</div>
                          <div className="text-sm text-muted-foreground">
                            Need data from last 2 weeks and 3 months ago
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <p>No consistency data yet.</p>
                      <p className="text-sm">Upload stroke-by-stroke data for your sessions to see consistency records.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
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
