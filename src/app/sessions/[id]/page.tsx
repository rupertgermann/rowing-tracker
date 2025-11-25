'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRowingStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseStrokeCsv } from '@/lib/strokeParser';
import { StrokeData } from '@/types/session';
import { SessionAnalysis } from '@/components/SessionAnalysis';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  TrendingUp,
  Clock,
  Zap,
  Target,
  Activity,
  Flame,
  Gauge,
  Upload
} from 'lucide-react';
import { formatSessionDetailDate } from '@/lib/dateTimeUtils';

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

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getSessions, updateSession } = useRowingStore();
  const sessions = getSessions();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [strokeData, setStrokeData] = useState<StrokeData[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Find previous and next sessions for navigation
  // We calculate this early so we can use it in the effect hook
  const sortedSessions = [...sessions].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Use the ID from params to find current index, even if session state isn't set yet
  const currentSessionId = params.id as string;
  const currentIndex = sortedSessions.findIndex(s => s.id === currentSessionId);
  const previousSession = currentIndex > 0 ? sortedSessions[currentIndex - 1] : null;
  const nextSession = currentIndex < sortedSessions.length - 1 ? sortedSessions[currentIndex + 1] : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only navigate if we are not loading and have a session (or at least valid params)
      // But mainly we just need the previous/next session to exist
      if (loading) return;

      if (e.key === 'ArrowLeft' && previousSession) {
        router.push(`/sessions/${previousSession.id}`);
      } else if (e.key === 'ArrowRight' && nextSession) {
        router.push(`/sessions/${nextSession.id}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previousSession, nextSession, router, loading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setAnalyzing(true);
    try {
      const result = await parseStrokeCsv(file);
      if (result.data.length > 0) {
        setStrokeData(result.data);
        // Persist the stroke data to the session
        const updatedSession = { ...session, strokeData: result.data };
        updateSession(updatedSession);
        setSession(updatedSession); // Update local state
      } else if (result.error) {
        // Simple alert for now, could be improved with a toast
        alert(result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to process file');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClearAnalysis = () => {
    if (!session) return;
    if (confirm('Are you sure you want to remove the detailed stroke analysis from this session?')) {
      const updatedSession = { ...session };
      delete updatedSession.strokeData;
      updateSession(updatedSession);
      setSession(updatedSession);
      setStrokeData(null);
    }
  };

  useEffect(() => {
    const sessionId = params.id as string;
    const foundSession = sessions.find(s => s.id === sessionId);

    if (foundSession) {
      setSession(foundSession);
      if (foundSession.strokeData) {
        setStrokeData(foundSession.strokeData);
      }
    }
    setLoading(false);
  }, [params.id, sessions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-4"></div>
            <div className="h-4 bg-muted rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Session Not Found
            </h1>
            <p className="text-muted-foreground mb-8">
              The session you're looking for doesn't exist or has been deleted.
            </p>
            <Button asChild>
              <Link href="/sessions">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Sessions
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/sessions" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Sessions
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Session Details
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-2">
              <Calendar className="h-4 w-4" />
              {formatSessionDetailDate(session.timestamp)}
            </p>
          </div>

          {/* Previous/Next Navigation */}
          <div className="flex items-center gap-2">
            {previousSession && (
              <Button variant="outline" asChild>
                <Link href={`/sessions/${previousSession.id}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Link>
              </Button>
            )}
            {nextSession && (
              <Button variant="outline" asChild>
                <Link href={`/sessions/${nextSession.id}`}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distance</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-full">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatDistance(session.distance)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
              <div className="p-2 bg-violet-500/10 rounded-full">
                <Clock className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {formatDuration(session.duration)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Pace</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-full">
                <Target className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatPace(session.avgSplit)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Power</CardTitle>
              <div className="p-2 bg-amber-500/10 rounded-full">
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {session.avgPower > 0 ? `${Math.round(session.avgPower)}W` : '--'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pace & Power */}
          <Card className="border-t-4 border-t-emerald-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-emerald-500" />
                Pace & Power
              </CardTitle>
              <CardDescription>
                Split times and power output
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Average Split</span>
                  <div className="text-lg font-semibold font-mono">
                    {formatPace(session.avgSplit)}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Best Split</span>
                  <div className="text-lg font-semibold font-mono">
                    {formatPace(session.minSplit)}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Average Power</span>
                  <div className="text-lg font-semibold">
                    {session.avgPower > 0 ? `${Math.round(session.avgPower)}W` : '--'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Maximum Power</span>
                  <div className="text-lg font-semibold">
                    {session.maxPower > 0 ? `${Math.round(session.maxPower)}W` : '--'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stroke Rate & Energy */}
          <Card className="border-t-4 border-t-rose-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-rose-500" />
                Stroke Rate & Energy
              </CardTitle>
              <CardDescription>
                Stroke metrics and energy expenditure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Average Stroke Rate</span>
                  <div className="text-lg font-semibold">
                    {session.avgStrokeRate > 0 ? `${Math.round(session.avgStrokeRate)} SPM` : '--'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Maximum Stroke Rate</span>
                  <div className="text-lg font-semibold">
                    {session.maxStrokeRate > 0 ? `${Math.round(session.maxStrokeRate)} SPM` : '--'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Energy Burned</span>
                  <div className="text-lg font-semibold">
                    {session.energy > 0 ? `${Math.round(session.energy)} kCal` : '--'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Total Work</span>
                  <div className="text-lg font-semibold">
                    {session.avgWork > 0 ? `${Math.round(session.avgWork)} J` : '--'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-l-4 border-l-cyan-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-500" />
                Stroke Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {session.strokeCount.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                Total strokes
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Stroke Length
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {session.avgStrokeLength > 0 ? `${session.avgStrokeLength.toFixed(2)}m` : '--'}
              </div>
              <p className="text-sm text-muted-foreground">
                Average length per stroke
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Power per KG
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {session.wattPerKg > 0 ? `${session.wattPerKg.toFixed(1)} W/kg` : '--'}
              </div>
              <p className="text-sm text-muted-foreground">
                Power-to-weight ratio
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Analysis Section */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Stroke Analysis
          </h2>

          {!strokeData ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <div className="p-4 rounded-full bg-muted">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Upload Stroke Data</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                      Upload a SmartRow CSV export to view detailed stroke-by-stroke analysis, charts, and metrics.
                    </p>
                  </div>
                  <div className="w-full max-w-xs">
                    <Label htmlFor="csv-upload" className="sr-only">Upload CSV</Label>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={analyzing}
                    />
                  </div>
                  {analyzing && <p className="text-sm text-muted-foreground">Analyzing data...</p>}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <SessionAnalysis data={strokeData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
