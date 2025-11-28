'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, MessageCircle, Brain, ExternalLink } from 'lucide-react';
import { useRowingStore } from '@/lib/store';
import { SettingsService } from '@/lib/settings';
import { chatStorage } from '@/lib/chatStorage';
import ReactMarkdown from 'react-markdown';

interface ExplainChartButtonProps {
  chartId: string;
  chartTitle: string;
  chartDescription: string;
  dataContext: string;
  fullData: any[];
  variant?: 'default' | 'compact';
}

export function ExplainChartButton({
  chartId,
  chartTitle,
  chartDescription,
  dataContext,
  fullData,
  variant = 'default'
}: ExplainChartButtonProps) {
  const router = useRouter();
  const { chartExplanations, setPendingChartExplanation, removeChartExplanationsBySessionId } = useRowingStore();

  // Check if explanation is valid (session still exists)
  const isExplanationValid = useCallback(() => {
    const explanation = chartExplanations[chartId];
    if (!explanation) return false;
    const session = chatStorage.getSession(explanation.chatSessionId);
    if (!session) {
      removeChartExplanationsBySessionId(explanation.chatSessionId);
      return false;
    }
    return true;
  }, [chartExplanations, chartId, removeChartExplanationsBySessionId]);

  const handleExplainChart = useCallback(async () => {
    const aiSettings = SettingsService.getInstance().getAISettings();
    const explainChartPrompt = aiSettings.explainChartPrompt || '';

    const prompt = `I'm looking at my "${chartTitle}" chart. ${chartDescription}

Here's what the data shows:
${dataContext}

${explainChartPrompt}`;

    // Store the pending chart explanation data
    setPendingChartExplanation({
      chartId,
      chartTitle,
      prompt,
      screenshot: undefined,
      fullData: JSON.stringify(fullData, null, 2)
    });

    // Navigate to chat
    router.push('/chat?fromChart=true');
  }, [chartId, chartTitle, chartDescription, dataContext, fullData, setPendingChartExplanation, router]);

  const explanation = chartExplanations[chartId];
  const hasValidExplanation = isExplanationValid();

  return (
    <div className="flex items-center gap-2">
      {/* Show saved explanation indicator */}
      {hasValidExplanation && explanation && (
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-green-500 hover:text-green-600"
                onClick={() => router.push(`/chat?session=${explanation.chatSessionId}`)}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-lg xl:max-w-3xl max-h-[28rem] xl:max-h-[calc(100vh-6rem)] min-h-[12rem] xl:min-h-[20rem] overflow-y-auto p-4 bg-popover text-popover-foreground border shadow-lg">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <Brain className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">AI Analysis</span>
              </div>
              <div className="text-popover-foreground text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:font-bold [&_h3]:text-primary [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ul]:ml-4 [&_ul]:list-disc [&_li]:my-1 [&_strong]:text-cyan-400 [&_strong]:font-semibold">
                <ReactMarkdown>
                  {explanation.fullResponse || explanation.summary}
                </ReactMarkdown>
              </div>
              <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Click the green icon to view full chat
              </div>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      )}
      
      {/* Explain button */}
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExplainChart}
            >
              <HelpCircle className="h-4 w-4" />
              {variant === 'default' && <span className="ml-1">Explain</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ask AI to explain this chart</p>
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
    </div>
  );
}
