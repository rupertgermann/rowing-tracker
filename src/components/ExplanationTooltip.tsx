'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, Brain, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ExplanationTooltipProps {
  chatSessionId: string;
  content: string;
}

export function ExplanationTooltip({ chatSessionId, content }: ExplanationTooltipProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Backdrop blur overlay when tooltip is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 animate-in fade-in-0 duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      <TooltipProvider>
        <UITooltip open={isOpen} onOpenChange={setIsOpen}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-green-500 hover:text-green-600 relative z-50"
              onClick={() => router.push(`/chat?session=${chatSessionId}`)}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-lg xl:max-w-3xl max-h-[28rem] xl:max-h-[calc(100vh-6rem)] min-h-[12rem] xl:min-h-[20rem] overflow-y-auto p-4 bg-popover text-popover-foreground border shadow-lg z-50">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <Brain className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">AI Analysis</span>
            </div>
            <div className="text-popover-foreground text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:font-bold [&_h3]:text-primary [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ul]:ml-4 [&_ul]:list-disc [&_li]:my-1 [&_strong]:text-cyan-400 [&_strong]:font-semibold">
              <ReactMarkdown>
                {content}
              </ReactMarkdown>
            </div>
            <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Click the green icon to view full chat
            </div>
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
    </>
  );
}
