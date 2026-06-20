import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

const MAX_CHART_POINTS = 240;

function downsample<T>(items: T[], maxItems: number): T[] {
  if (items.length <= maxItems) return items;
  if (maxItems <= 1) return items.slice(0, 1);

  const lastIndex = items.length - 1;
  const step = lastIndex / (maxItems - 1);
  const result: T[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < maxItems; i++) {
    const index = Math.round(i * step);
    if (!seen.has(index)) {
      seen.add(index);
      result.push(items[index]);
    }
  }

  return result;
}

/**
 * GET /api/analytics
 *
 * Returns pre-computed chart data for analytics page.
 * This endpoint is optimized for fast loading - it only fetches
 * the fields needed for charts, not full session data.
 *
 * Query params:
 * - metrics: comma-separated list of metrics (optional, defaults to all)
 *   Options: distance,pace,power,strokeRate,energy,duration,consistencyScore
 *
 * Response includes:
 * - chartData: { [metric]: Array<{date, value, sessionId}> }
 * - summary: { totalDistance, totalDuration, sessionCount, ... }
 * - sessionsRevision: for cache invalidation
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const metricsParam = searchParams.get('metrics');
    const requestedMetrics = metricsParam
      ? metricsParam.split(',')
      : ['distance', 'pace', 'power', 'strokeRate', 'energy', 'duration', 'consistencyScore'];

    // Fetch only the fields needed for charts (no strokeData!)
    const [sessions, settings] = await Promise.all([
      prisma.rowingSession.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          timestamp: true,
          distance: true,
          duration: true,
          energy: true,
          avgPower: true,
          avgSplit: true,
          avgStrokeRate: true,
          avgStrokeLength: true,
          consistencyScore: true,
        },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { sessionsRevision: true },
      }),
    ]);

    // Format date for chart display
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    // Build chart data for each requested metric
    const chartData: Record<string, Array<{ date: string; fullDate: string; sessionId: string; value: number }>> = {};

    for (const metric of requestedMetrics) {
      chartData[metric] = [];
    }

    // Single pass through sessions to build all chart data
    for (const s of sessions) {
      const date = formatDate(new Date(s.timestamp));
      const fullDate = s.timestamp.toISOString();
      const sessionId = s.id;

      if (requestedMetrics.includes('distance')) {
        chartData.distance.push({ date, fullDate, sessionId, value: s.distance });
      }
      if (requestedMetrics.includes('pace')) {
        chartData.pace.push({ date, fullDate, sessionId, value: s.avgSplit });
      }
      if (requestedMetrics.includes('power')) {
        chartData.power.push({ date, fullDate, sessionId, value: s.avgPower });
      }
      if (requestedMetrics.includes('strokeRate')) {
        chartData.strokeRate.push({ date, fullDate, sessionId, value: s.avgStrokeRate });
      }
      if (requestedMetrics.includes('energy')) {
        chartData.energy.push({ date, fullDate, sessionId, value: s.energy });
      }
      if (requestedMetrics.includes('duration')) {
        chartData.duration.push({ date, fullDate, sessionId, value: s.duration });
      }
      if (requestedMetrics.includes('consistencyScore') && s.consistencyScore !== null) {
        chartData.consistencyScore.push({ date, fullDate, sessionId, value: s.consistencyScore });
      }
    }

    // Compute summary statistics
    const sessionCount = sessions.length;
    const summary = {
      sessionCount,
      totalDistance: sessions.reduce((sum, s) => sum + s.distance, 0),
      totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0),
      totalEnergy: sessions.reduce((sum, s) => sum + s.energy, 0),
      avgPace: sessionCount > 0 ? sessions.reduce((sum, s) => sum + s.avgSplit, 0) / sessionCount : 0,
      avgPower: sessionCount > 0 ? sessions.reduce((sum, s) => sum + s.avgPower, 0) / sessionCount : 0,
      avgStrokeRate: sessionCount > 0 ? sessions.reduce((sum, s) => sum + s.avgStrokeRate, 0) / sessionCount : 0,
    };

    // Scatter plot data for correlations
    const scatterData = sessions.map(s => ({
      sessionId: s.id,
      date: formatDate(new Date(s.timestamp)),
      distance: s.distance,
      duration: s.duration,
      durationMinutes: Math.round(s.duration / 60),
      power: s.avgPower,
      pace: s.avgSplit,
      strokeRate: s.avgStrokeRate,
      energy: s.energy,
      strokeLength: s.avgStrokeLength,
    }));

    // Available dates for date picker
    const availableDates = sessions.map(s => s.timestamp.toISOString());
    const downsampledChartData = Object.fromEntries(
      Object.entries(chartData).map(([metric, values]) => [
        metric,
        downsample(values, MAX_CHART_POINTS),
      ]),
    );

    return NextResponse.json({
      chartData: downsampledChartData,
      summary,
      scatterData: downsample(scatterData, MAX_CHART_POINTS),
      availableDates,
      sessionsRevision: settings?.sessionsRevision ?? 0,
      sessionCount,
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
