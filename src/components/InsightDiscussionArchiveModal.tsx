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
  Lightbulb,
  MessageCircle,
  Calendar,
  ChevronRight,
} from 'lucide-react';

interface InsightDiscussionArchiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insightId?: string;
  insightTitle?: string;
}

export function InsightDiscussionArchiveModal({
  open,
  onOpenChange,
  insightId,
  insightTitle,
}: InsightDiscussionArchiveModalProps) {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<ChatSession[]>([]);

  useEffect(() => {
    if (open) {
      // Load insight discussion sessions (async)
      const loadDiscussions = async () => {
        const insightDiscussionSessions = await chatStorage.getInsightDiscussionSessions(insightId);
        // Sort by date, newest first
        const sorted = insightDiscussionSessions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setDiscussions(sorted);
      };
      loadDiscussions();
    }
  }, [open, insightId]);

  const handleViewDiscussion = (sessionId: string) => {
    onOpenChange(false);
    router.push(`/chat?session=${sessionId}`);
  };

  const getDiscussionSummary = (session: ChatSession): string => {
    // Get the first AI response as a summary preview
    const aiMessage = session.messages.find(m => m.role === 'assistant');
    if (aiMessage) {
      // Return first 150 characters
      return aiMessage.content.slice(0, 150) + (aiMessage.content.length > 150 ? '...' : '');
    }
    return 'Discussion pending...';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            Insight Discussion History
          </DialogTitle>
          <DialogDescription>
            {insightTitle
              ? `Previous discussions for "${insightTitle}"`
              : 'View your insight discussion history'}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[60vh] overflow-y-auto pr-4">
          {discussions.length === 0 ? (
            <div className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Discussions Yet</h3>
              <p className="text-sm text-muted-foreground">
                Click "Discuss" on an AI insight to start your first discussion.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-4">
                {discussions.map((discussion, index) => (
                  <div key={discussion.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                        index === 0
                          ? 'bg-yellow-600 border-yellow-600'
                          : 'bg-background border-muted-foreground'
                      }`}
                    />

                    <div
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleViewDiscussion(discussion.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">
                              {discussion.title}
                            </h4>
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                Latest
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatChartDate(new Date(discussion.createdAt))}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {discussion.messages.length} messages
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {getDiscussionSummary(discussion)}
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
