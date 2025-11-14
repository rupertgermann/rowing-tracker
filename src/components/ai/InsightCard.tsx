import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Insight } from '@/lib/aiAnalysis';
import { useInsightFeedback } from '@/hooks/useAIInsights';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Trophy, 
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  CheckCircle
} from 'lucide-react';

interface InsightCardProps {
  insight: Insight;
  onFeedback?: (insightId: string, feedback: 'helpful' | 'not_helpful' | 'action_taken') => void;
}

export function InsightCard({ insight, onFeedback }: InsightCardProps) {
  const { recordFeedback, getFeedback } = useInsightFeedback();
  const existingFeedback = getFeedback(insight.id);

  const getInsightIcon = () => {
    switch (insight.type) {
      case 'trend':
        return insight.description.includes('improving') ? 
          <TrendingUp className="h-5 w-5" /> : 
          <TrendingDown className="h-5 w-5" />;
      case 'anomaly':
        return <AlertTriangle className="h-5 w-5" />;
      case 'achievement':
        return <Trophy className="h-5 w-5" />;
      case 'recommendation':
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getInsightColor = () => {
    switch (insight.type) {
      case 'trend':
        return insight.description.includes('improving') ? 'text-green-600' : 'text-orange-600';
      case 'anomaly':
        return 'text-red-600';
      case 'achievement':
        return 'text-yellow-600';
      case 'recommendation':
      default:
        return 'text-blue-600';
    }
  };

  const getPriorityBadgeVariant = () => {
    switch (insight.priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
      default:
        return 'secondary';
    }
  };

  const handleFeedback = (feedback: 'helpful' | 'not_helpful' | 'action_taken') => {
    recordFeedback(insight.id, feedback);
    onFeedback?.(insight.id, feedback);
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={getInsightColor()}>
              {getInsightIcon()}
            </div>
            <CardTitle className="text-lg">{insight.title}</CardTitle>
          </div>
          <Badge variant={getPriorityBadgeVariant()}>
            {insight.priority}
          </Badge>
        </div>
        <CardDescription>
          {new Date(insight.dateGenerated).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.description}
        </p>
        
        {insight.actionable && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <Lightbulb className="h-3 w-3" />
            <span>Actionable recommendation</span>
          </div>
        )}

        {!existingFeedback && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Was this helpful?</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('helpful')}
                className="h-6 px-2 text-xs hover:text-green-600"
              >
                <ThumbsUp className="h-3 w-3 mr-1" />
                Helpful
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFeedback('not_helpful')}
                className="h-6 px-2 text-xs hover:text-red-600"
              >
                <ThumbsDown className="h-3 w-3 mr-1" />
                Not helpful
              </Button>
              {insight.actionable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFeedback('action_taken')}
                  className="h-6 px-2 text-xs hover:text-blue-600"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Took action
                </Button>
              )}
            </div>
          </div>
        )}

        {existingFeedback && (
          <div className="flex items-center gap-2 pt-2 border-t text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span>Feedback recorded</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
