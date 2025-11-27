'use client';

import { BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react';

type ChartType = 'line' | 'bar' | 'area';

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
}

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="flex bg-muted p-1 rounded-md">
      <button
        onClick={() => onChange('bar')}
        className={`p-1.5 rounded-sm transition-all ${value === 'bar' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
        title="Bar Chart"
        aria-label="Switch to bar chart"
        aria-pressed={value === 'bar'}
      >
        <BarChart3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('line')}
        className={`p-1.5 rounded-sm transition-all ${value === 'line' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
        title="Line Chart"
        aria-label="Switch to line chart"
        aria-pressed={value === 'line'}
      >
        <LineChartIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('area')}
        className={`p-1.5 rounded-sm transition-all ${value === 'area' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
        title="Area Chart"
        aria-label="Switch to area chart"
        aria-pressed={value === 'area'}
      >
        <AreaChartIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
