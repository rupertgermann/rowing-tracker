'use client';

import React, { useState, useMemo } from 'react';
import { useRowingStore } from '@/lib/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { TrendingUp, Clock, Zap, Activity, Flame, Target, Calendar, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react';

type Period = 'week' | 'month' | 'quarter' | 'year';
type Metric = 'distance' | 'duration' | 'energy' | 'power' | 'pace' | 'strokeRate';
type ChartType = 'bar' | 'line' | 'area';

const metrics: { value: Metric; label: string; icon: React.ElementType; color: string; unit: string }[] = [
  { value: 'distance', label: 'Distance', icon: TrendingUp, color: '#3b82f6', unit: 'm' },
  { value: 'duration', label: 'Duration', icon: Clock, color: '#06b6d4', unit: 'm' },
  { value: 'energy', label: 'Energy', icon: Flame, color: '#ef4444', unit: 'kCal' },
  { value: 'power', label: 'Avg Power', icon: Zap, color: '#f59e0b', unit: 'W' },
  { value: 'pace', label: 'Avg Pace', icon: Target, color: '#10b981', unit: '/500m' },
  { value: 'strokeRate', label: 'Stroke Rate', icon: Activity, color: '#8b5cf6', unit: 'spm' },
];

const periods: { value: Period; label: string }[] = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Yearly' },
];

// Helper to format seconds into MM:SS or HH:MM:SS
const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

// Helper to format pace (seconds/500m)
const formatPace = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Helper to get ISO week number
function getWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getQuarter(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

export function MetricComparisonWidget() {
  const { getSessions, dashboardSettings, updateDashboardSettings } = useRowingStore();
  const sessions = getSessions();

  const { metric, period, chartType } = dashboardSettings.comparisonWidget;
  
  const setMetric = (m: Metric) => updateDashboardSettings({ metric: m });
  const setPeriod = (p: Period) => updateDashboardSettings({ period: p });
  const setChartType = (c: ChartType) => updateDashboardSettings({ chartType: c });

  const aggregatedData = useMemo(() => {
    if (!sessions.length) return [];

    // Group sessions
    const groups: Record<string, typeof sessions> = {};
    
    sessions.forEach(session => {
      const d = new Date(session.timestamp);
      let key = '';
      let sortKey = ''; // For sorting chronologically

      if (period === 'week') {
        const year = d.getFullYear();
        const week = getWeek(d);
        key = `W${week} ${year}`;
        sortKey = `${year}-${week.toString().padStart(2, '0')}`;
      } else if (period === 'month') {
        key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        sortKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (period === 'quarter') {
        const q = getQuarter(d);
        key = `Q${q} ${d.getFullYear()}`;
        sortKey = `${d.getFullYear()}-Q${q}`;
      } else if (period === 'year') {
        key = `${d.getFullYear()}`;
        sortKey = `${d.getFullYear()}`;
      }

      if (!groups[key]) groups[key] = [];
      // Attach sortKey to the array for later use if needed, or map differently
      // Actually, we'll map to an object that includes sortKey
      groups[key].push(session);
    });

    // Calculate metrics for each group
    const result = Object.entries(groups).map(([label, groupSessions]) => {
      let value = 0;
      const totalDist = groupSessions.reduce((sum, s) => sum + s.distance, 0);
      const totalDur = groupSessions.reduce((sum, s) => sum + s.duration, 0);
      
      switch (metric) {
        case 'distance':
          value = totalDist;
          break;
        case 'duration':
          value = totalDur / 60; // Minutes
          break;
        case 'energy':
          value = groupSessions.reduce((sum, s) => sum + s.energy, 0);
          break;
        case 'power':
          // Weighted average by duration
          const totalWork = groupSessions.reduce((sum, s) => sum + (s.avgPower * s.duration), 0);
          value = totalDur > 0 ? totalWork / totalDur : 0;
          break;
        case 'pace':
          // Weighted average pace: Total Time / (Total Distance / 500)
          value = totalDist > 0 ? totalDur / (totalDist / 500) : 0;
          break;
        case 'strokeRate':
           // Weighted average by duration
           const totalStrokes = groupSessions.reduce((sum, s) => sum + (s.avgStrokeRate * s.duration), 0);
           value = totalDur > 0 ? totalStrokes / totalDur : 0;
          break;
      }

      // Extract sortKey from the first session (approximate) - logic above was better
      // Let's re-derive sortKey from label or just use the first session's date logic
      // To be safe and sort correctly:
      const firstSessionDate = new Date(groupSessions[0].timestamp);
      let sortKey = '';
      if (period === 'week') {
        const year = firstSessionDate.getFullYear();
        const week = getWeek(firstSessionDate);
        sortKey = `${year}-${week.toString().padStart(2, '0')}`;
      } else if (period === 'month') {
         sortKey = `${firstSessionDate.getFullYear()}-${(firstSessionDate.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (period === 'quarter') {
         const q = getQuarter(firstSessionDate);
         sortKey = `${firstSessionDate.getFullYear()}-Q${q}`;
      } else {
         sortKey = `${firstSessionDate.getFullYear()}`;
      }

      return {
        label,
        value,
        count: groupSessions.length,
        sortKey,
        // Extra info for tooltip
        totalDist,
        totalDur
      };
    });

    return result.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [sessions, period, metric]);

  const activeMetric = metrics.find(m => m.value === metric)!;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          <p className="text-primary font-bold text-lg">
             {metric === 'pace' ? formatPace(data.value) : 
              metric === 'duration' ? formatDuration(data.value * 60) :
              Math.round(data.value).toLocaleString()}
             <span className="text-xs font-normal text-muted-foreground ml-1">{activeMetric.unit}</span>
          </p>
          <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
            <div className="flex justify-between gap-4">
              <span>Sessions:</span>
              <span className="font-medium">{data.count}</span>
            </div>
            {metric !== 'distance' && (
              <div className="flex justify-between gap-4">
                <span>Total Distance:</span>
                <span className="font-medium">{Math.round(data.totalDist).toLocaleString()} m</span>
              </div>
            )}
            {metric !== 'duration' && (
              <div className="flex justify-between gap-4">
                <span>Total Duration:</span>
                <span className="font-medium">{formatDuration(data.totalDur)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Y-Axis Formatter
  const formatYAxis = (val: number) => {
    if (metric === 'pace') return formatPace(val);
    if (metric === 'duration') return `${Math.round(val)}m`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return Math.round(val).toString();
  };

  const renderChart = () => {
    const ChartComponent = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart;
    const DataComponent = (chartType === 'line' ? Line : chartType === 'area' ? Area : Bar) as any;

    // Radius prop is only for Bar
    const barProps = chartType === 'bar' ? { radius: [4, 4, 0, 0] as [number, number, number, number] } : {};

    return (
      <ResponsiveContainer width="100%" height={350}>
        <ChartComponent data={aggregatedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
          <XAxis 
            dataKey="label" 
            stroke="#6b7280" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <YAxis 
            stroke="#6b7280" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={formatYAxis}
            domain={metric === 'pace' ? ['dataMin - 5', 'dataMax + 5'] : [0, 'auto']}
            reversed={metric === 'pace'} // Faster pace is lower number
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
          <DataComponent
            type="monotone"
            dataKey="value"
            stroke={activeMetric.color}
            fill={activeMetric.color}
            fillOpacity={chartType === 'area' ? 0.2 : 0.8}
            strokeWidth={2}
            animationDuration={500}
            {...barProps}
          />
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <Card className="w-full transition-all duration-200 hover:shadow-lg hover:scale-[1.01] border-t-4 border-t-primary/50">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
             <div className="p-2 rounded-md bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
             </div>
             <div>
                <CardTitle>Metric Comparison</CardTitle>
                <CardDescription>Compare {activeMetric.label.toLowerCase()} over time</CardDescription>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Type Toggles */}
            <div className="flex bg-muted p-1 rounded-md mr-2">
              <button
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-sm transition-all ${chartType === 'bar' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                title="Bar Chart"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-sm transition-all ${chartType === 'line' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                title="Line Chart"
              >
                <LineChartIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`p-1.5 rounded-sm transition-all ${chartType === 'area' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                title="Area Chart"
              >
                <AreaChartIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Period Select - Using Buttons for quick access */}
             <div className="flex bg-muted p-1 rounded-md">
                {periods.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${period === p.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {p.label}
                  </button>
                ))}
             </div>
          </div>
        </div>

        {/* Metric Select - Horizontal scrollable list or Grid */}
        <div className="flex flex-wrap gap-2 mt-4">
          {metrics.map(m => {
            const Icon = m.icon;
            const isActive = metric === m.value;
            return (
              <Button
                key={m.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setMetric(m.value)}
                className={`flex items-center gap-2 h-9 ${isActive ? '' : 'border-dashed'}`}
              >
                <Icon className="h-4 w-4" />
                {m.label}
              </Button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        {aggregatedData.length > 0 ? (
          <div className="mt-2">
            {renderChart()}
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
            <Calendar className="h-10 w-10 mb-2 opacity-20" />
            <p>No data available for comparison</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
