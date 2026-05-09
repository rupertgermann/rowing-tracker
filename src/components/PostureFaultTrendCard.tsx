'use client';

import { useEffect, useState } from 'react';
import { useRowingStore } from '@/lib/store';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle } from 'lucide-react';
import type { PostureFaultType } from '@/lib/mocap/analysis/types';
import type { PostureTrendResult, FaultTrendPoint, SessionFaultInput } from '@/lib/mocap/postureTrendAggregation';

const FAULT_LABELS: Record<PostureFaultType, string> = {
  rounded_back_at_catch: 'Rounded Back',
  early_arm_bend: 'Early Arm Bend',
  back_opens_before_legs_drive: 'Back Opens Early',
  excessive_layback: 'Excessive Layback',
  slow_recovery_ratio: 'Slow Recovery',
};

const FAULT_COLORS: Record<PostureFaultType, string> = {
  rounded_back_at_catch: '#ef4444',
  early_arm_bend: '#f97316',
  back_opens_before_legs_drive: '#eab308',
  excessive_layback: '#8b5cf6',
  slow_recovery_ratio: '#06b6d4',
};

interface ChartPoint {
  date: string;
  lowQuality?: boolean;
  [faultType: string]: number | string | boolean | undefined;
}

function buildChartData(data: PostureTrendResult): ChartPoint[] {
  const dateMap = new Map<string, ChartPoint>();

  for (const trend of data.trends) {
    for (const point of trend.points) {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, { date: point.date });
      }
      const row = dateMap.get(point.date)!;
      row[trend.faultType] = point.count;
      if (point.lowQuality) row.lowQuality = true;
    }
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function lowQualitySessionDates(data: PostureTrendResult): Set<string> {
  const dates = new Set<string>();
  for (const trend of data.trends) {
    for (const point of trend.points) {
      if (point.lowQuality) dates.add(point.date);
    }
  }
  return dates;
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}) {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload?.lowQuality) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="none"
      stroke="#f59e0b"
      strokeWidth={2}
      strokeDasharray="3 2"
    />
  );
}

type PostureTrendApiResponse = PostureTrendResult & { sessions?: Array<SessionFaultInput & { sessionDate: string }> };

function deserializeSessions(raw: PostureTrendApiResponse['sessions']): SessionFaultInput[] {
  if (!raw) return [];
  return raw.map((s) => ({ ...s, sessionDate: new Date(s.sessionDate) }));
}

export function PostureFaultTrendCard() {
  const [data, setData] = useState<PostureTrendResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const evaluatePostureAwards = useRowingStore((s) => s.evaluatePostureAwards);

  useEffect(() => {
    fetch('/api/mocap/posture-trend')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load posture trend data');
        return r.json() as Promise<PostureTrendApiResponse>;
      })
      .then((response) => {
        const { sessions: rawSessions, ...trendResult } = response;
        setData(trendResult);
        const sessions = deserializeSessions(rawSessions);
        if (sessions.length > 0) evaluatePostureAwards(sessions);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, [evaluatePostureAwards]);

  const lowQualityDates = data ? lowQualitySessionDates(data) : new Set<string>();
  const chartData = data ? buildChartData(data) : [];
  const activeFaultTypes = data?.trends.map((t) => t.faultType) ?? [];

  return (
    <div className="w-full p-1 rounded-xl border bg-card/30 mb-6 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50 mb-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-base">Posture Fault Frequency</h3>
        {lowQualityDates.size > 0 && (
          <span
            className="ml-auto flex items-center gap-1 text-xs text-amber-500"
            title="Some sessions have low capture quality. Dashed circles mark affected data points."
          >
            <AlertTriangle className="h-3 w-3" />
            {lowQualityDates.size} low-quality session{lowQualityDates.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="px-3 pb-3">
        {loading && (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-48 text-rose-500 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && data?.totalSessions === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground text-sm gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <p>No linked mocap sessions found.</p>
            <p className="text-xs">Link a motion capture session to a training session to track posture trends.</p>
          </div>
        )}

        {!loading && !error && data && data.totalSessions > 0 && data.trends.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground text-sm gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <p>No posture faults recorded yet.</p>
            <p className="text-xs">Faults will appear here as mocap sessions are analyzed.</p>
          </div>
        )}

        {!loading && !error && data && data.trends.length > 0 && (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    value,
                    FAULT_LABELS[name as PostureFaultType] ?? name,
                  ]}
                  labelFormatter={(label: string) => {
                    const isLQ = lowQualityDates.has(label);
                    return `${label}${isLQ ? ' ⚠ low quality' : ''}`;
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    FAULT_LABELS[value as PostureFaultType] ?? value
                  }
                  wrapperStyle={{ fontSize: 11 }}
                />
                {activeFaultTypes.map((ft) => (
                  <Line
                    key={ft}
                    type="monotone"
                    dataKey={ft}
                    stroke={FAULT_COLORS[ft]}
                    strokeWidth={2}
                    dot={<CustomDot />}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-1 px-1">
              Fault counts per session · {data.linkedSessionsWithFaults} of {data.totalSessions} session{data.totalSessions !== 1 ? 's' : ''} have recorded faults
              {lowQualityDates.size > 0 && ' · Dashed circles = low capture quality'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
