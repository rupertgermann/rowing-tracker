'use client';

import Link from 'next/link';
import { Brain, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InsightCard } from '@/components/ai/InsightCard';
import { useAIInsights } from '@/hooks/useAIInsights';
import type { Insight } from '@/lib/aiAnalysis';
import type { CloudInsight } from '@/lib/cloudAI';
import { formatDateOnly } from '@/lib/dateTimeUtils';

interface DashboardInsightsSectionProps {
  sessionCount: number;
}

export function DashboardInsightsSection({ sessionCount }: DashboardInsightsSectionProps) {
  const {
    insights,
    isAnalyzable,
    lastAnalyzed,
    refreshInsights,
    archivedInsights,
    archiveInsight,
    isGenerating,
    cloudAIError,
    isCloudAIConfigured
  } = useAIInsights();

  if (!isAnalyzable && sessionCount === 0) {
    return null;
  }

  if (!isAnalyzable) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Brain className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {cloudAIError && !isCloudAIConfigured ? 'AI Not Configured' : 'AI Insights Coming Soon'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {cloudAIError && !isCloudAIConfigured
                ? cloudAIError
                : 'Complete at least 5 sessions to unlock personalized AI recommendations and insights.'}
            </p>
            {cloudAIError && !isCloudAIConfigured ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings#aiSettings">
                  Configure AI Settings
                </Link>
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground">
                Sessions needed: {sessionCount}/5
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            AI Insights
          </h2>
          <p className="text-muted-foreground">
            Personalized recommendations based on your training data
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshInsights}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex items-center gap-2 text-xs"
          >
            <Link href="/insights">
              View All ({(insights?.length || 0) + (archivedInsights?.length || 0)})
            </Link>
          </Button>
          {lastAnalyzed && (
            <div className="text-xs text-muted-foreground">
              Last analyzed: {formatDateOnly(lastAnalyzed)}
            </div>
          )}
        </div>
      </div>

      {(insights ?? [])?.length > 0 ? (
        (() => {
          const insightsList = insights ?? [];
          const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          const sorted = [...insightsList].sort((a, b) =>
            (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
          );
          const [featured, ...rest] = sorted;

          return (
            <div className="space-y-4">
              {featured && (
                <InsightCard
                  key={featured.id || 'featured'}
                  insight={featured}
                  onFeedback={() => {}}
                  isArchived={false}
                  onArchive={archiveInsight}
                />
              )}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {rest.map((insight: Insight | CloudInsight, index: number) => (
                    <InsightCard
                      key={insight.id || `local-${insight.type}-${index}`}
                      insight={insight}
                      onFeedback={() => {}}
                      isArchived={false}
                      onArchive={archiveInsight}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Generating Insights...
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    AI is analyzing your training patterns. This may take a moment.
                  </p>
                </>
              ) : (
                <>
                  <div className="bg-muted rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Brain className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {cloudAIError && !isCloudAIConfigured ? 'AI Not Configured' : 'No Current Insights'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {cloudAIError && !isCloudAIConfigured
                      ? cloudAIError
                      : 'Click Refresh to generate new personalized insights.'}
                  </p>
                  {cloudAIError && !isCloudAIConfigured && (
                    <Button variant="outline" size="sm" asChild className="mb-4">
                      <Link href="/settings#aiSettings">
                        Configure AI Settings
                      </Link>
                    </Button>
                  )}
                </>
              )}
              {(archivedInsights?.length || 0) > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/insights">
                    View {archivedInsights?.length} Archived Insights
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
