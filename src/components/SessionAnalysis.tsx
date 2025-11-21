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
import { StrokeData } from '@/types/session';

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

      {/* Stroke Length Consistency */}
      <Card>
        <CardHeader>
          <CardTitle>Stroke Length Consistency</CardTitle>
          <CardDescription>Distance covered per stroke (meters)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="strokeIndex" label={{ value: 'Stroke #', position: 'insideBottomRight', offset: -10 }} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} label={{ value: 'Length (m)', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="strokeLength" 
                  name="Stroke Length" 
                  unit="m"
                  stroke="#0891b2" 
                  dot={false} 
                  strokeWidth={2} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Power Distribution Histogram */}
      <Card>
        <CardHeader>
          <CardTitle>Power Distribution</CardTitle>
          <CardDescription>Number of strokes in each power zone</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={(() => {
                  // Create buckets of 25W
                  const buckets: Record<string, number> = {};
                  const bucketSize = 25;
                  data.forEach(d => {
                    const bucket = Math.floor(d.power / bucketSize) * bucketSize;
                    const label = `${bucket}-${bucket + bucketSize}W`;
                    buckets[label] = (buckets[label] || 0) + 1;
                  });
                  
                  return Object.entries(buckets)
                    .map(([range, count]) => ({ range, count, min: parseInt(range.split('-')[0]) }))
                    .sort((a, b) => a.min - b.min);
                })()}
                margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="range" angle={-45} textAnchor="end" height={60} interval={0} fontSize={12} />
                <YAxis allowDecimals={false} label={{ value: 'Strokes', angle: -90, position: 'insideLeft' }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Bar dataKey="count" name="Strokes" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Technique Map: Rate vs Power */}
      <Card>
        <CardHeader>
          <CardTitle>Technique Map: Rate vs Power</CardTitle>
          <CardDescription>Correlation between stroke rate and power output</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                 {/* Hack for scatter plot using LineChart with only dots */}
                 <XAxis 
                   dataKey="strokeRate" 
                   type="number" 
                   domain={['dataMin - 2', 'dataMax + 2']} 
                   label={{ value: 'Stroke Rate (SPM)', position: 'insideBottom', offset: -5 }}
                   allowDecimals={false}
                 />
                 <YAxis label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                 <Tooltip 
                   cursor={{ strokeDasharray: '3 3' }}
                   content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-lg text-xs">
                            <p>Stroke #{d.strokeIndex}</p>
                            <p>{d.strokeRate} SPM @ {Math.round(d.power)}W</p>
                          </div>
                        );
                      }
                      return null;
                   }}
                 />
                 <Line 
                   dataKey="power" 
                   stroke="none" 
                   dot={{ fill: '#8b5cf6', r: 3, opacity: 0.6 }} 
                   activeDot={{ r: 5 }} 
                   isAnimationActive={false}
                 />
               </LineChart>
            </ResponsiveContainer>
            {/* ScatterChart is better but LineChart with dots works for simple correlation if sorted. 
                However, for true X-Y scatter where X is not ordered index, we need ScatterChart from Recharts.
                Let's switch to ScatterChart for this one specifically. 
            */}
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
