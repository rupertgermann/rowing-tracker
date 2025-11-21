'use client';

import React, { useMemo, useState } from 'react';
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
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StrokeData } from '@/types/session';
import { calculateAdvancedStats } from '@/lib/analysisUtils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Assuming these exist or standard tabs

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
                  : entry.name.includes('Length')
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
  // Enrich data if strokeLength is missing (backward compatibility for previously uploaded sessions)
  const enrichedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Check if we need to calculate strokeLength
    const needsCalculation = typeof data[0].strokeLength === 'undefined';
    
    if (!needsCalculation) {
       return data;
    }

    console.log('Calculating stroke lengths on the fly for visualization...');
    // Sort by index to ensure correct delta calculation
    const sorted = [...data].sort((a, b) => a.strokeIndex - b.strokeIndex);
    
    return sorted.map((stroke, i) => {
      const prevDistance = i > 0 ? sorted[i-1].distance : 0;
      const length = stroke.distance - prevDistance;
      return {
        ...stroke,
        strokeLength: Math.max(0, parseFloat(length.toFixed(2)))
      };
    });
  }, [data]);

  const stats = useMemo(() => calculateAdvancedStats(enrichedData), [enrichedData]);
  const [activeTab, setActiveTab] = useState('overview');

  // Prepare histogram data
  const distributions = useMemo(() => {
    const powerBuckets: Record<string, number> = {};
    const spmBuckets: Record<string, number> = {};
    
    enrichedData.forEach(d => {
      // Power (25W buckets)
      const pBucket = Math.floor(d.power / 25) * 25;
      const pLabel = `${pBucket}-${pBucket + 25}`;
      powerBuckets[pLabel] = (powerBuckets[pLabel] || 0) + 1;

      // SPM (1 SPM buckets)
      const sBucket = Math.round(d.strokeRate);
      spmBuckets[sBucket] = (spmBuckets[sBucket] || 0) + 1;
    });

    return {
      power: Object.entries(powerBuckets)
        .map(([range, count]) => ({ range, count, min: parseInt(range.split('-')[0]) }))
        .sort((a, b) => a.min - b.min),
      spm: Object.entries(spmBuckets)
        .map(([rate, count]) => ({ rate: parseInt(rate), count }))
        .sort((a, b) => a.rate - b.rate)
    };
  }, [enrichedData]);

  return (
    <div className="space-y-8">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="overview">Overview & Stats</TabsTrigger>
          <TabsTrigger value="charts">Performance Graphs</TabsTrigger>
          <TabsTrigger value="analysis">Deep Analysis</TabsTrigger>
        </TabsList>

        {/* TAB: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          {/* Advanced Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consistency Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(stats.consistencyScore)}/100</div>
                <p className="text-xs text-muted-foreground">Based on power variance</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fastest 5 Strokes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatSplit(stats.fastest5StrokesPace)}</div>
                <p className="text-xs text-muted-foreground">Avg Power: {Math.round(stats.fastest5StrokesPower)}W</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Efficiency Factor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                    {stats.wattsPerHeartRate > 0 ? stats.wattsPerHeartRate.toFixed(2) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Watts per Heart Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fade / Drift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.powerDropoff > 5 ? 'text-red-500' : 'text-green-500'}`}>
                    {stats.powerDropoff > 0 ? '-' : '+'}{Math.abs(Math.round(stats.powerDropoff))}%
                </div>
                <p className="text-xs text-muted-foreground">Power change 1st vs 2nd half</p>
              </CardContent>
            </Card>
          </div>

          {/* Primary Chart: Power & Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Power & Stroke Rate</CardTitle>
              <CardDescription>Power output (Watts) and Stroke Rate (SPM) over the session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="distance" 
                      label={{ value: 'Distance (m)', position: 'insideBottomRight', offset: -10 }} 
                      tickFormatter={(val) => `${val}m`}
                    />
                    <YAxis yAxisId="left" label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'SPM', angle: 90, position: 'insideRight' }} domain={[10, 50]} />
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
        </TabsContent>

        {/* TAB: GRAPHS */}
        <TabsContent value="charts" className="space-y-8">
          {/* Pace Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Pace Analysis</CardTitle>
              <CardDescription>Actual vs Average Split (/500m)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis 
                      dataKey="distance" 
                      tickFormatter={(val) => `${val}m`}
                    />
                    <YAxis 
                      domain={['dataMin - 5', 'dataMax + 5']} 
                      reversed={true} 
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
                  <AreaChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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

          {/* Stroke Length */}
          <Card>
            <CardHeader>
              <CardTitle>Stroke Length Consistency</CardTitle>
              <CardDescription>Distance covered per stroke (meters)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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

          {/* Heart Rate (if available) */}
          {enrichedData.some(d => d.heartRate) && (
            <Card>
              <CardHeader>
                <CardTitle>Heart Rate Response</CardTitle>
                <CardDescription>Heart Rate (BPM) over session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={enrichedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
        </TabsContent>

        {/* TAB: ANALYSIS */}
        <TabsContent value="analysis" className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Power Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Power Distribution</CardTitle>
                <CardDescription>Strokes per power zone</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributions.power} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="range" angle={-45} textAnchor="end" height={60} interval={0} fontSize={12} />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="count" name="Strokes" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* SPM Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Rhythm Distribution</CardTitle>
                <CardDescription>Strokes per Stroke Rate (SPM)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributions.spm} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="rate" />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                      <Bar dataKey="count" name="Strokes" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Technique Map: Rate vs Power */}
            <Card>
              <CardHeader>
                <CardTitle>Rate vs Power</CardTitle>
                <CardDescription>Do higher rates yield more power?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis type="number" dataKey="strokeRate" name="Rate" unit="spm" domain={['auto', 'auto']} />
                        <YAxis type="number" dataKey="power" name="Power" unit="W" domain={['auto', 'auto']} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter name="Rate vs Power" data={enrichedData} fill="#8b5cf6" fillOpacity={0.6} />
                     </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Rate vs Split Efficiency */}
            <Card>
               <CardHeader>
                 <CardTitle>Rate vs Split</CardTitle>
                 <CardDescription>Efficiency check: Faster rate should equal faster split</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                         <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                         <XAxis type="number" dataKey="strokeRate" name="Rate" unit="spm" domain={['auto', 'auto']} />
                         <YAxis 
                           type="number" 
                           dataKey="split" 
                           name="Split" 
                           unit="s" 
                           domain={['auto', 'auto']} 
                           reversed={true}
                           tickFormatter={(val) => formatDuration(val)} 
                         />
                         <Tooltip 
                           cursor={{ strokeDasharray: '3 3' }} 
                           formatter={(value: any, name: any) => [
                             name === 'Split' ? formatDuration(value) : value,
                             name
                           ]}
                         />
                         <Scatter name="Rate vs Split" data={enrichedData} fill="#10b981" fillOpacity={0.6} />
                      </ScatterChart>
                   </ResponsiveContainer>
                 </div>
               </CardContent>
             </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
