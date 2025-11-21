'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StrokeData } from '@/lib/strokeParser';

interface SessionAnalysisProps {
  data: StrokeData[];
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatSplit = (seconds: number) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-medium mb-2">
          Stroke {payload[0].payload.strokeIndex} ({formatDuration(payload[0].payload.time)})
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="font-semibold">
              {entry.name}:
            </span>
            <span>
              {entry.name.includes('Split') 
                ? formatSplit(entry.value)
                : entry.name === 'Distance' 
                  ? `${entry.value}m` 
                  : Math.round(entry.value)}
              {entry.unit}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function SessionAnalysis({ data }: SessionAnalysisProps) {
  // Calculate some aggregated stats for distributions or summary if needed
  // But for now, we focus on charts.

  return (
    <div className="space-y-8">
      {/* Power & Stroke Rate Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Power & Stroke Rate</CardTitle>
          <CardDescription>Power output (Watts) and Stroke Rate (SPM) over the session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="distance" 
                  label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -10 }} 
                  tickFormatter={(val) => `${val}m`}
                />
                <YAxis yAxisId="left" label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'SPM', angle: 90, position: 'insideRight' }} domain={[15, 45]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="power" 
                  name="Power" 
                  unit="W"
                  stroke="#2563eb" 
                  dot={false} 
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="strokeRate" 
                  name="Stroke Rate" 
                  unit=" spm"
                  stroke="#dc2626" 
                  dot={false} 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Split Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Pace Analysis</CardTitle>
          <CardDescription>Actual vs Average Split (/500m)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="distance" 
                  tickFormatter={(val) => `${val}m`}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  reversed={true} // Lower split is better (higher on graph usually preferred for "better") - actually standard pace charts often invert Y
                  tickFormatter={(val) => formatDuration(val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="split" 
                  name="Actual Split" 
                  stroke="#16a34a" 
                  dot={false} 
                  strokeWidth={1.5} 
                />
                <Line 
                  type="monotone" 
                  dataKey="avgSplit" 
                  name="Avg Split" 
                  stroke="#9333ea" 
                  strokeDasharray="5 5" 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Work per Stroke */}
      <Card>
        <CardHeader>
          <CardTitle>Work per Stroke</CardTitle>
          <CardDescription>Energy expenditure (Joules) per stroke</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="distance" tickFormatter={(val) => `${val}m`} />
                <YAxis label={{ value: 'Work (J)', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="work" 
                  name="Work" 
                  unit="J"
                  stroke="#ea580c" 
                  fill="#ea580c" 
                  fillOpacity={0.2} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Heart Rate (if available) */}
      {data.some(d => d.heartRate) && (
        <Card>
          <CardHeader>
            <CardTitle>Heart Rate</CardTitle>
            <CardDescription>Heart Rate (BPM) over session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="time" tickFormatter={formatDuration} label={{ value: 'Time', position: 'insideBottomRight', offset: -10 }} />
                  <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="heartRate" 
                    name="Heart Rate" 
                    unit=" bpm"
                    stroke="#be123c" 
                    dot={false} 
                    strokeWidth={2} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
