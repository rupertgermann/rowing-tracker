'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, Brain } from 'lucide-react';
import { useRowingStore } from '@/lib/store';
import { Insight } from '@/lib/aiAnalysis';
import { CloudInsight } from '@/lib/cloudAI';

interface ExplainInsightButtonProps {
  insight: Insight | CloudInsight;
  variant?: 'default' | 'compact' | 'inline';
}

export function ExplainInsightButton({
  insight,
  variant = 'default'
}: ExplainInsightButtonProps) {
  const router = useRouter();
  const { setPendingInsight } = useRowingStore();

  const handleDiscussInsight = useCallback(async () => {
    // Create a detailed prompt for discussing this insight
    const prompt = `I'd like to discuss this AI insight in more detail:

**Insight Title:** ${insight.title}
**Type:** ${insight.type}
**Priority:** ${insight.priority}

**Description:**
${insight.description}

**Context:**
- Generated on: ${new Date(insight.dateGenerated).toLocaleDateString()}
- This insight was identified as ${insight.actionable ? 'actionable' : 'informational'}
${'confidence' in insight ? `- Confidence level: ${Math.round((insight as CloudInsight).confidence * 100)}%` : ''}

Please provide:
1. A deeper explanation of what this insight means for my training
2. Specific actionable steps I can take based on this insight
3. How this insight fits into my overall training progression
4. Any potential concerns or areas I should monitor
5. Questions I should consider to get the most value from this insight`;

    // Store the pending insight data
    setPendingInsight({
      insightId: insight.id,
      insightTitle: insight.title,
      insightDescription: insight.description,
      insightType: insight.type,
      priority: insight.priority,
      prompt
    });

    // Navigate to chat
    router.push('/chat?fromInsight=true');
  }, [insight, setPendingInsight, router]);

  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant === 'inline' ? 'ghost' : 'outline'}
            size="sm"
            onClick={handleDiscussInsight}
            className={variant === 'inline' 
              ? "h-6 px-2 text-xs hover:text-blue-600"
              : "flex items-center gap-1"
            }
          >
            <MessageCircle className={variant === 'inline' ? "h-3 w-3 mr-1" : "h-4 w-4"} />
            {variant === 'default' && <span className="ml-1">Discuss with AI</span>}
            {variant === 'inline' && <span>Discuss</span>}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Discuss this insight in detail with your AI coach</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}
