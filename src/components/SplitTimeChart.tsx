'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { chartTheme } from '@/lib/chartUtils';

interface Session {
  id: string;
  timestamp: Date;
  avgSplit: number;
  avgStrokeRate: number;
}

interface SplitTimeChartProps {
  sessions: Session[];
}

// Color mapping for stroke rate (20-30 SPM)
const getStrokeRateColor = (strokeRate: number): string => {
  // Map stroke rate to color gradient (blue for low, red for high)
  const minRate = 20;
  const maxRate = 30;
  const normalized = (strokeRate - minRate) / (maxRate - minRate);

  if (normalized <= 0.25) return '#3b82f6'; // blue-500
  if (normalized <= 0.5) return '#10b981'; // emerald-500
  if (normalized <= 0.75) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
};

// Calculate 3-session moving average
const calculateMovingAverage = (sessions: Session[]): (Session & { movingAvg?: number })[] => {
  return sessions.map((session, index) => {
    if (index < 2) {
      return { ...session, movingAvg: undefined };
    }

    const lastThree = sessions.slice(index - 2, index + 1);
    const avgSplit = lastThree.reduce((sum, s) => sum + s.avgSplit, 0) / 3;

    return { ...session, movingAvg: avgSplit };
  });
};

// Custom dot component with stroke rate coloring
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;

  if (!payload || payload.avgStrokeRate === undefined) {
    return null;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={getStrokeRateColor(payload.avgStrokeRate)}
      stroke="#fff"
      strokeWidth={1}
    />
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={chartTheme.tooltip.contentStyle}>
        <p style={chartTheme.tooltip.labelStyle}>{label}</p>
        <p style={chartTheme.tooltip.itemStyle}>
          Split: {data.avgSplit.toFixed(1)}s / 500m
        </p>
        {data.movingAvg && (
          <p style={chartTheme.tooltip.itemStyle}>
            3-Session Avg: {data.movingAvg.toFixed(1)}s / 500m
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <div
            className="w-3 h-3 rounded-full border border-white"
            style={{ backgroundColor: getStrokeRateColor(data.avgStrokeRate) }}
          />
          <p style={chartTheme.tooltip.itemStyle}>
            Stroke Rate: {data.avgStrokeRate.toFixed(0)} SPM
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export const SplitTimeChart = ({ sessions }: SplitTimeChartProps) => {
  // Prepare chart data
  const chartData = useMemo(() => {
    if (!sessions.length) return [];

    // Sort sessions by date
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate moving averages
    const withMovingAvg = calculateMovingAverage(sortedSessions);

    // Format for chart
    return withMovingAvg.map(session => ({
      date: new Date(session.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      avgSplit: session.avgSplit,
      movingAvg: session.movingAvg,
      avgStrokeRate: session.avgStrokeRate,
      sessionId: session.id
    }));
  }, [sessions]);

  // Calculate Y-axis domain with padding
  const yDomain = useMemo(() => {
    if (!chartData.length) return [120, 180];

    const splits = chartData.map(d => d.avgSplit);
    const movingAvgs = chartData.map(d => d.movingAvg).filter((avg): avg is number => avg !== undefined);
    const allValues = [...splits, ...movingAvgs];

    const min = Math.floor(Math.min(...allValues) - 5);
    const max = Math.ceil(Math.max(...allValues) + 5);

    return [min, max];
  }, [chartData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">
              Split Time Over Date (Lower is Better)
            </CardTitle>
            <CardDescription>
              Track your pace progression with 3-session moving average
            </CardDescription>
          </div>
        </div>

        {/* Legend for stroke rate colors */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Stroke Rate:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>20-22.5 SPM</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>22.5-25 SPM</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>25-27.5 SPM</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>27.5-30 SPM</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                />
                <YAxis
                  className="text-xs"
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  domain={yDomain}
                  reversed={true}
                  label={{
                    value: 'Average Split (s)',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: '#6b7280', fontSize: 12 }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Individual session data points */}
                <Line
                  type="monotone"
                  dataKey="avgSplit"
                  stroke="transparent"
                  dot={<CustomDot />}
                  name="Split Time"
                />

                {/* 3-session moving average line */}
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  stroke="#f97316" // orange-500
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  name="3-Session Moving Avg"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>No data available for split time chart.</p>
            <p className="text-sm">Upload some sessions to see your pace progression.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
