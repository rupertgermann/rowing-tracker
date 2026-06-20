'use client';

import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRowingStore, AIAwardSuggestion } from '@/lib/store';
import { useAchievementStore } from '@/lib/achievementStore';
import { AWARDS, Award } from '@/lib/awards';
import { getAchievementImage } from '@/lib/imageStorage';
import { calculateAwardPredictions, formatPrediction, AwardPrediction } from '@/lib/awardPredictions';
import { computeEarnedAwards } from '@/lib/rowingSessionProjections';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getShadowStyle, getCardClassName } from '@/lib/cardStyles';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { AchievementGallery } from './AchievementGallery';
import { Trash2, Sparkles, CheckCircle2, TrendingUp } from 'lucide-react';

// Unified display item for both static awards and AI-generated goals
interface DisplayAward {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  isEarned: boolean;
  earnedAt?: Date;
  isAIGoal: boolean;
  aiSuggestion?: AIAwardSuggestion;
  hasGeneratedContent: boolean;
  imageUrl?: string;
  sourceAward?: Award;
}

export function AwardsList() {
  const { earnedAwards, aiAwardSuggestions, deleteAIAwardSuggestion, markAIAwardEarned, sessions } = useRowingStore();
  const { hasGeneratedContent, generatedAchievements } = useAchievementStore();
  const rowingSessionEarnedAwards = useMemo(
    () => computeEarnedAwards(sessions),
    [sessions],
  );
  const displayEarnedAwards = useMemo(() => {
    const byId = new Map(rowingSessionEarnedAwards.map((award) => [award.awardId, award]));
    earnedAwards.forEach((award) => {
      if (!byId.has(award.awardId)) {
        byId.set(award.awardId, award);
      }
    });
    return Array.from(byId.values());
  }, [earnedAwards, rowingSessionEarnedAwards]);
  const earnedIds = useMemo(
    () => new Set(displayEarnedAwards.map(a => a.awardId)),
    [displayEarnedAwards],
  );

  // Calculate predictions for un-earned awards
  const predictions = useMemo(() => {
    return calculateAwardPredictions(sessions, earnedIds);
  }, [sessions, earnedIds]);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, string>>({});

  // Load images from filesystem for awards that have them (static + AI)
  useEffect(() => {
    const loadImages = async () => {
      // Static awards with images
      const staticPromises = AWARDS.filter(award => {
        const achievement = generatedAchievements[award.id];
        return achievement?.hasImage || achievement?.imageUrl;
      }).map(async (award) => {
        const achievement = generatedAchievements[award.id];
        if (achievement?.imageUrl) {
          return { awardId: award.id, imageData: achievement.imageUrl };
        }
        const imagePath = await getAchievementImage(award.id);
        return { awardId: award.id, imageData: imagePath };
      });

      // AI awards with images (earned ones that might have generated content)
      const earnedAIAwards = aiAwardSuggestions.filter(s => s.status === 'earned');
      const aiPromises = earnedAIAwards.filter(aiAward => {
        const achievement = generatedAchievements[aiAward.id];
        return achievement?.hasImage || achievement?.imageUrl;
      }).map(async (aiAward) => {
        const achievement = generatedAchievements[aiAward.id];
        if (achievement?.imageUrl) {
          return { awardId: aiAward.id, imageData: achievement.imageUrl };
        }
        const imagePath = await getAchievementImage(aiAward.id);
        return { awardId: aiAward.id, imageData: imagePath };
      });

      const results = await Promise.all([...staticPromises, ...aiPromises]);
      const imageMap: Record<string, string> = {};
      results.forEach(({ awardId, imageData }) => {
        if (imageData) {
          imageMap[awardId] = imageData;
        }
      });
      setLoadedImages(imageMap);
    };

    loadImages();
  }, [generatedAchievements, aiAwardSuggestions]);

  // Build unified list: static awards + AI goals (approved or earned)
  const displayAwards = useMemo((): DisplayAward[] => {
    const staticAwardIds = new Set(AWARDS.map(a => a.id));

    // Static awards from AWARDS array
    const staticItems: DisplayAward[] = AWARDS.map(award => {
      const isEarned = earnedIds.has(award.id);
      const earnedInfo = displayEarnedAwards.find(a => a.awardId === award.id);
      return {
        id: award.id,
        title: award.title,
        description: award.description,
        icon: award.icon,
        color: award.color,
        isEarned,
        earnedAt: earnedInfo?.earnedAt,
        isAIGoal: false,
        hasGeneratedContent: hasGeneratedContent(award.id),
        imageUrl: loadedImages[award.id],
        sourceAward: award
      };
    });

    // AI-generated goals (approved or earned, not already in static awards)
    const aiGoals = aiAwardSuggestions.filter(s => s.status === 'approved' || s.status === 'earned');
    const aiItems: DisplayAward[] = aiGoals
      .filter(goal => !staticAwardIds.has(goal.id))
      .map(goal => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        icon: Sparkles,
        color: 'text-purple-500',
        isEarned: goal.status === 'earned',
        earnedAt: goal.earnedAt,
        isAIGoal: true,
        aiSuggestion: goal,
        hasGeneratedContent: hasGeneratedContent(goal.id),
        imageUrl: loadedImages[goal.id]
      }));

    return [...staticItems, ...aiItems];
  }, [earnedIds, displayEarnedAwards, aiAwardSuggestions, hasGeneratedContent, loadedImages]);

  const handleAwardClick = (item: DisplayAward) => {
    // Open gallery for any earned award (static or AI)
    if (item.isEarned) {
      setSelectedAwardId(item.id);
      setGalleryOpen(true);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayAwards.map((item, index) => {
          const Icon = item.icon;
          
          return (
            <Card 
              key={item.id} 
              onClick={() => handleAwardClick(item)}
              className={cn(
                "group transition-all duration-200 relative overflow-hidden",
                item.isEarned 
                  ? getCardClassName('purple', true)
                  : item.isAIGoal
                    ? "border-purple-500/30 bg-purple-500/5 border-dashed"
                    : "opacity-60 grayscale border-dashed bg-muted/30",
                item.hasGeneratedContent && "ring-2 ring-purple-500/30"
              )}
              style={item.isEarned ? getShadowStyle('purple') : undefined}
            >
              {/* Background Image with Gradient Overlay */}
              {item.imageUrl && item.isEarned && (
                <>
                  <div className="absolute inset-0">
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      className="object-cover"
                      quality={60}
                      priority={index < 4}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/10 opacity-90 transition-opacity duration-200 group-hover:opacity-70" />
                </>
              )}
              
              {/* Card Content */}
              <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0 gap-2 relative z-10">
                <div className={cn(
                  "p-2 rounded-full",
                  item.isEarned ? "bg-background/80 shadow-sm backdrop-blur-sm" : "bg-transparent"
                )}>
                  <Icon 
                    className={cn(
                      "h-6 w-6", 
                      item.isEarned ? item.color : item.isAIGoal ? "text-purple-500" : "text-muted-foreground"
                    )} 
                  />
                </div>
                <div className="flex items-center gap-1">
                  {item.isAIGoal && !item.isEarned && (
                    <>
                      <span className="text-xs text-purple-500 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                        AI Goal
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAIAwardEarned(item.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-green-500/10"
                        title="Mark as earned"
                      >
                        <CheckCircle2 className="h-3 w-3 text-muted-foreground hover:text-green-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAIAwardSuggestion(item.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </>
                  )}
                  {item.isAIGoal && item.isEarned && (
                    <>
                      <span className="text-xs text-green-500 font-mono bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                        Earned
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteAIAwardSuggestion(item.id);
                        }}
                        className="h-6 w-6 p-0 hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <CardTitle className={cn(
                  "text-base mb-1 leading-tight",
                  !item.isEarned && "text-foreground/80"
                )}>{item.title}</CardTitle>
                <p className={cn(
                  "text-xs line-clamp-2",
                  item.isEarned ? "text-muted-foreground" : "text-muted-foreground/80"
                )}>
                  {item.description}
                </p>
                {/* AI Goal target date - only show for un-earned AI goals, styled like static awards */}
                {item.isAIGoal && !item.isEarned && item.aiSuggestion?.targetDate && (() => {
                  const targetDate = new Date(item.aiSuggestion.targetDate);
                  const now = new Date();
                  const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  
                  // Format relative time like static awards
                  let relativeTime = '';
                  if (daysRemaining <= 0) {
                    relativeTime = 'due now';
                  } else if (daysRemaining <= 7) {
                    relativeTime = `~${daysRemaining} day${daysRemaining === 1 ? '' : 's'} away`;
                  } else if (daysRemaining <= 30) {
                    const weeks = Math.round(daysRemaining / 7);
                    relativeTime = `~${weeks} week${weeks === 1 ? '' : 's'} away`;
                  } else if (daysRemaining <= 365) {
                    const months = Math.round(daysRemaining / 30);
                    relativeTime = `~${months} month${months === 1 ? '' : 's'} away`;
                  } else {
                    const years = Math.round(daysRemaining / 365 * 10) / 10;
                    relativeTime = `~${years} year${years === 1 ? '' : 's'} away`;
                  }
                  
                  return (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/80">
                      <TrendingUp className="h-3 w-3" />
                      <span>Target: {formatDateOnly(targetDate)} ({relativeTime})</span>
                    </div>
                  );
                })()}
                {/* Prediction for un-earned static awards - aligned with AI suggestions format */}
                {!item.isEarned && !item.isAIGoal && predictions.has(item.id) && (() => {
                  const pred = predictions.get(item.id)!;
                  return (
                    <div className="mt-2 space-y-1">
                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary/60 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, pred.currentProgress)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground/80 font-mono">
                          {Math.round(pred.currentProgress)}%
                        </span>
                      </div>
                      {/* Target date and time estimate */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground/80">
                        <TrendingUp className="h-3 w-3" />
                        {pred.targetDate ? (
                          <span>
                            Target: {formatDateOnly(pred.targetDate)} ({formatPrediction(pred)})
                          </span>
                        ) : (
                          <span>{formatPrediction(pred)}</span>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {item.isEarned && (
                  <div className="mt-2 space-y-1">
                    {item.earnedAt && (
                      <p className="text-xs text-muted-foreground">
                        Earned: {formatDateOnly(new Date(item.earnedAt))}
                      </p>
                    )}
                    <p className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to view & generate story
                    </p>
                  </div>
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
