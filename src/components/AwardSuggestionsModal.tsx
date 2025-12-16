'use client';

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRowingStore } from '@/lib/store';
import { settings } from '@/lib/settings';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { Loader2, Sparkles, Trash2, CheckCircle2 } from 'lucide-react';

interface AwardSuggestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AwardSuggestionsModal({ open, onOpenChange }: AwardSuggestionsModalProps) {
  const {
    sessions,
    earnedAwards,
    aiAwardSuggestions,
    upsertAIAwardSuggestion,
    approveAIAwardSuggestion,
    deleteAIAwardSuggestion
  } = useRowingStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const aiSettings = settings.getAISettings();

      const response = await fetch('/api/achievements/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: sessions.map(s => ({
            timestamp: new Date(s.timestamp).toISOString(),
            distance: s.distance,
            duration: s.duration,
            avgSplit: s.avgSplit,
            avgPower: s.avgPower,
            avgStrokeRate: s.avgStrokeRate
          })),
          earnedAwards: earnedAwards.map(a => ({
            awardId: a.awardId,
            earnedAt: a.earnedAt instanceof Date ? a.earnedAt.toISOString() : a.earnedAt
          })),
          maxSuggestions: 5,
          customPrompt: aiSettings.awardSuggestionsPrompt,
          apiKey: aiSettings.openaiApiKey || undefined,
          model: aiSettings.awardSuggestions?.model,
          reasoning: aiSettings.awardSuggestions?.reasoning,
          verbosity: aiSettings.awardSuggestions?.verbosity
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const details = typeof data.details === 'string'
          ? data.details
          : data.details?.message || '';
        const message = details ? `${data.error || 'Request failed'}: ${details}` : (data.error || 'Failed to generate award suggestions');
        throw new Error(message);
      }

      const data = await response.json();
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

      for (const s of suggestions) {
        const targetDate = s.targetDate ? new Date(s.targetDate) : undefined;
        upsertAIAwardSuggestion({
          id: s.id,
          title: s.title,
          description: s.description,
          status: 'suggested',
          rationale: s.rationale,
          targetDate,
          model: aiSettings.awardSuggestions?.model
        });
      }

      if (suggestions.length === 0) {
        setError('No new achievement ideas generated. Try again later.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const suggestedList = useMemo(() => {
    const seen = new Set<string>();
    return aiAwardSuggestions
      .filter(s => s.status === 'suggested')
      .filter(s => {
        if (!s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
  }, [aiAwardSuggestions]);

  const approvedList = useMemo(() => {
    const seen = new Set<string>();
    return aiAwardSuggestions
      .filter(s => s.status === 'approved')
      .filter(s => {
        if (!s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
  }, [aiAwardSuggestions]);

  const hasAny = suggestedList.length + approvedList.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Award Suggestions
          </DialogTitle>
          <DialogDescription>
            Generate creative new achievement ideas based on your rowing progress. Approve to add them to your goals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Generate New Award Ideas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Sessions available for analysis: {sessions.length}
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <div>
                <Button onClick={handleGenerate} disabled={isGenerating || sessions.length === 0} className="flex items-center gap-2">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {hasAny && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Suggested ({suggestedList.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suggestedList.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No pending suggestions.</div>
                  ) : (
                    suggestedList.map((s) => (
                      <div key={s.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm">{s.title}</div>
                            <div className="text-xs text-muted-foreground">{s.description}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">AI</Badge>
                        </div>

                        {s.targetDate && (
                          <div className="text-xs text-muted-foreground">
                            Target: {formatDateOnly(new Date(s.targetDate))}
                          </div>
                        )}

                        <div className="text-xs">{s.rationale}</div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveAIAwardSuggestion(s.id)}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteAIAwardSuggestion(s.id)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Approved ({approvedList.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {approvedList.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No approved AI goals yet.</div>
                  ) : (
                    approvedList.map((s) => (
                      <div key={s.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm">{s.title}</div>
                            <div className="text-xs text-muted-foreground">{s.description}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">Approved</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Added: {formatDateOnly(new Date(s.approvedAt || s.suggestedAt))}
                        </div>
                        {s.targetDate && (
                          <div className="text-xs text-muted-foreground">
                            Target: {formatDateOnly(new Date(s.targetDate))}
                          </div>
                        )}
                        <div className="text-xs">{s.rationale}</div>
                        <div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteAIAwardSuggestion(s.id)}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
