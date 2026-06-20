'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const AnalyticsPageContent = dynamic(
  () => import('@/components/analytics/AnalyticsPageContent'),
  { ssr: false, loading: () => <AnalyticsShell /> }
);

function AnalyticsShell() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-8">
          <div>
            <div className="h-8 w-64 rounded bg-muted mb-3" />
            <div className="h-4 w-96 max-w-full rounded bg-muted" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-28 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-96 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowAnalytics(true);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, []);

  return showAnalytics ? <AnalyticsPageContent /> : <AnalyticsShell />;
}
