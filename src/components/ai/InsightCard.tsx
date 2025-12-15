import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Insight } from '@/lib/aiAnalysis';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { CloudInsight } from '@/lib/cloudAI';
import { useInsightFeedback } from '@/hooks/useAIInsights';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Trophy, 
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Cloud,
  Brain,
  Archive,
  Trash2
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// Helper function to safely format dates from insights
const formatInsightDate = (dateGenerated: Date | string): string => {
  try {
    // If it's a string, try to parse it
    const d = dateGenerated instanceof Date ? dateGenerated : new Date(dateGenerated);
    if (isNaN(d.getTime())) {
      return 'Recent';
    }
    return formatDateOnly(d);
  } catch (error) {
    console.warn('Failed to format insight date:', error);
    return 'Recent';
  }
};

interface InsightCardProps {
  insight: Insight | CloudInsight;
  onFeedback?: (insightId: string, feedback: 'helpful' | 'not_helpful' | 'action_taken') => void;
  isArchived?: boolean;
  onArchive?: (insightId: string) => void;
  onDelete?: (insightId: string) => void;
}

export function InsightCard({ insight, onFeedback, isArchived = false, onArchive, onDelete }: InsightCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { recordFeedback, getFeedback } = useInsightFeedback();
  const existingFeedback = getFeedback(insight.id);
  const isCloudInsight = 'confidence' in insight && insight.id && insight.id.startsWith('cloud-');

  const getInsightIcon = () => {
    const type = insight.type;
    
    switch (type) {
      case 'trend':
        return insight.description.includes('improving') ? 
          <TrendingUp className="h-5 w-5" /> : 
          <TrendingDown className="h-5 w-5" />;
      case 'anomaly':
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'achievement':
        return <Trophy className="h-5 w-5" />;
      case 'performance':
        return <Brain className="h-5 w-5" />;
      case 'recommendation':
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getInsightColor = () => {
    const type = insight.type;
    
    switch (type) {
      case 'trend':
        return insight.description.includes('improving') ? 'text-green-600' : 'text-orange-600';
      case 'anomaly':
      case 'warning':
        return 'text-red-600';
      case 'achievement':
        return 'text-yellow-600';
      case 'performance':
        return 'text-blue-600';
      case 'recommendation':
      default:
        return 'text-blue-600';
    }
  };

  const getPriorityBadgeVariant = () => {
    const priority = insight.priority;
    
    switch (priority) {
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

  const handleArchive = () => {
    onArchive?.(insight.id);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete?.(insight.id);
    setShowDeleteConfirm(false);
  };

  const getConfidenceDisplay = () => {
    if (!isCloudInsight) return null;
    
    const confidence = (insight as CloudInsight).confidence;
    const confidenceLevel = confidence > 0.8 ? 'High' : confidence > 0.6 ? 'Medium' : 'Low';
    const confidenceColor = confidence > 0.8 ? 'text-green-600' : confidence > 0.6 ? 'text-yellow-600' : 'text-red-600';
    
    return (
      <div className={`text-xs ${confidenceColor} flex items-center gap-1`}>
        <span>Confidence: {confidenceLevel}</span>
        <span>({Math.round(confidence * 100)}%)</span>
      </div>
    );
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
            {isCloudInsight && (
              <Cloud className="h-6 w-6 mr-2 text-blue-500" />
            )}
          </div>
          <Badge variant={getPriorityBadgeVariant()}>
            {insight.priority}
          </Badge>
        </div>
        <CardDescription className="flex items-center justify-between">
          <span>{formatInsightDate(insight.dateGenerated)}</span>
          {getConfidenceDisplay()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {insight.description}
        </p>
        
        {/* Show evidence for cloud insights */}
        {isCloudInsight && (insight as CloudInsight).evidence.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Evidence:</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {(insight as CloudInsight).evidence.map((evidence, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span className="text-blue-500">•</span>
                  <span>{evidence}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
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
              {onArchive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleArchive}
                  className="h-6 px-2 text-xs hover:text-orange-600"
                >
                  <Archive className="h-3 w-3 mr-1" />
                  {isArchived ? 'Unarchive' : 'Archive'}
                </Button>
              )}
              {isArchived && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="h-6 px-2 text-xs hover:text-red-600"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
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

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Insight"
        description="Are you sure you want to permanently delete this insight? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </Card>
  );
}
