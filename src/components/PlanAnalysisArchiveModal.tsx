'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { chatStorage } from '@/lib/chatStorage';
import { ChatSession } from '@/lib/cloudAI';
import { formatChartDate } from '@/lib/dateTimeUtils';
import {
  TrendingUp,
  MessageCircle,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface PlanAnalysisArchiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId?: string;
  planTitle?: string;
}

export function PlanAnalysisArchiveModal({
  open,
  onOpenChange,
  planId,
  planTitle,
}: PlanAnalysisArchiveModalProps) {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (open) {
      // Load plan analysis sessions (async)
      const loadAnalyses = async () => {
        const planAnalysisSessions = await chatStorage.getPlanAnalysisSessions(planId);
        // Sort by date, newest first
        const sorted = planAnalysisSessions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAnalyses(sorted);
      };
      loadAnalyses();
    }
  }, [open, planId]);

  const handleViewAnalysis = (sessionId: string) => {
    onOpenChange(false);
    router.push(`/chat?session=${sessionId}`);
  };

  const getAnalysisSummary = (session: ChatSession): string => {
    // Get the first AI response as a summary preview
    const aiMessage = session.messages.find(m => m.role === 'assistant');
    if (aiMessage) {
      // Return first 150 characters
      return aiMessage.content.slice(0, 150) + (aiMessage.content.length > 150 ? '...' : '');
    }
    return 'Analysis pending...';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Plan Analysis History
          </DialogTitle>
          <DialogDescription>
            {planTitle
              ? `Previous analyses for "${planTitle}"`
              : 'View your training plan analysis history'}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[60vh] overflow-y-auto pr-4">
          {analyses.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Analyses Yet</h3>
              <p className="text-sm text-muted-foreground">
                Click &quot;Analyze Progress&quot; on your active training plan to generate your first analysis.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-4">
                {analyses.map((analysis, index) => (
                  <div key={analysis.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                        index === 0
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-background border-muted-foreground'
                      }`}
                    />

                    <div
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleViewAnalysis(analysis.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                              {analysis.title}
                            </h4>
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                                Latest
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatChartDate(new Date(analysis.createdAt))}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {analysis.messages.length} messages
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {getAnalysisSummary(analysis)}
                          </p>
                        </div>

                        <Button variant="ghost" size="sm" className="flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
