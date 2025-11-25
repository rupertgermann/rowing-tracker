'use client';

import { useRowingStore } from '@/lib/store';
import { AWARDS } from '@/lib/awards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils'; // Assuming cn exists in utils, typical shadcn setup
import { formatDateOnly } from '@/lib/dateTimeUtils';

export function AwardsList() {
  const { earnedAwards } = useRowingStore();
  const earnedIds = new Set(earnedAwards.map(a => a.awardId));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {AWARDS.map((award) => {
        const isEarned = earnedIds.has(award.id);
        const Icon = award.icon;
        const earnedInfo = earnedAwards.find(a => a.awardId === award.id);
        
        return (
          <Card 
            key={award.id} 
            className={cn(
              "transition-all duration-200 h-full",
              isEarned 
                ? "border-primary/20 bg-secondary/10 shadow-sm" 
                : "opacity-60 grayscale border-dashed bg-muted/30"
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
              {isEarned && (
                <span className="text-[10px] text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded border">
                  {formatDateOnly(new Date(earnedInfo!.earnedAt))}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-1 leading-tight">{award.title}</CardTitle>
              <p className="text-xs text-muted-foreground line-clamp-3">
                {award.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
