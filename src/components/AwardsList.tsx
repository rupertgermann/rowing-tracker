'use client';

import { useState } from 'react';
import { useRowingStore } from '@/lib/store';
import { useAchievementStore } from '@/lib/achievementStore';
import { AWARDS } from '@/lib/awards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { AchievementGallery } from './AchievementGallery';
import { Sparkles } from 'lucide-react';

export function AwardsList() {
  const { earnedAwards } = useRowingStore();
  const { hasGeneratedContent } = useAchievementStore();
  const earnedIds = new Set(earnedAwards.map(a => a.awardId));
  
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);

  const handleAwardClick = (awardId: string, isEarned: boolean) => {
    if (isEarned) {
      setSelectedAwardId(awardId);
      setGalleryOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {AWARDS.map((award) => {
          const isEarned = earnedIds.has(award.id);
          const Icon = award.icon;
          const earnedInfo = earnedAwards.find(a => a.awardId === award.id);
          const hasContent = hasGeneratedContent(award.id);
          
          return (
            <Card 
              key={award.id} 
              onClick={() => handleAwardClick(award.id, isEarned)}
              className={cn(
                "transition-all duration-200 h-full",
                isEarned 
                  ? "border-primary/20 bg-secondary/10 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02]" 
                  : "opacity-60 grayscale border-dashed bg-muted/30",
                hasContent && "ring-2 ring-purple-500/30"
              )}
            >
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 gap-2">
                <div className={cn(
                  "p-2 rounded-full",
                  isEarned ? "bg-background shadow-sm" : "bg-transparent"
                )}>
                  <Icon 
                    className={cn(
                      "h-6 w-6", 
                      isEarned ? award.color : "text-muted-foreground"
                    )} 
                  />
                </div>
                <div className="flex items-center gap-1">
                  {hasContent && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Sparkles className="h-3 w-3 mr-0.5" />
                      AI
                    </Badge>
                  )}
                  {isEarned && earnedInfo && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border">
                      {formatDateOnly(new Date(earnedInfo.earnedAt))}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base mb-1 leading-tight">{award.title}</CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {award.description}
                </p>
                {isEarned && (
                  <p className="text-[10px] text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to view & generate story
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <AchievementGallery 
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        initialAwardId={selectedAwardId}
      />
    </>
  );
}
