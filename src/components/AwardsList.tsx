'use client';

import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRowingStore, AIAwardSuggestion } from '@/lib/store';
import { useAchievementStore } from '@/lib/achievementStore';
import { AWARDS, Award } from '@/lib/awards';
import { getAchievementImage } from '@/lib/imageStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getShadowStyle, getCardClassName } from '@/lib/cardStyles';
import { formatDateOnly } from '@/lib/dateTimeUtils';
import { AchievementGallery } from './AchievementGallery';
import { Trash2, Sparkles, CheckCircle2 } from 'lucide-react';

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
  const { earnedAwards, aiAwardSuggestions, deleteAIAwardSuggestion, markAIAwardEarned } = useRowingStore();
  const { hasGeneratedContent, generatedAchievements } = useAchievementStore();
  const earnedIds = new Set(earnedAwards.map(a => a.awardId));

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, string>>({});

  // Load images from filesystem for awards that have them
  useEffect(() => {
    const loadImages = async () => {
      const imagePromises = AWARDS.filter(award => {
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

      const results = await Promise.all(imagePromises);
      const imageMap: Record<string, string> = {};
      results.forEach(({ awardId, imageData }) => {
        if (imageData) {
          imageMap[awardId] = imageData;
        }
      });
      setLoadedImages(imageMap);
    };

    loadImages();
  }, [generatedAchievements]);

  // Build unified list: static awards + AI goals (approved or earned)
  const displayAwards = useMemo((): DisplayAward[] => {
    const staticAwardIds = new Set(AWARDS.map(a => a.id));

    // Static awards from AWARDS array
    const staticItems: DisplayAward[] = AWARDS.map(award => {
      const isEarned = earnedIds.has(award.id);
      const earnedInfo = earnedAwards.find(a => a.awardId === award.id);
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
        hasGeneratedContent: false
      }));

    return [...staticItems, ...aiItems];
  }, [earnedIds, earnedAwards, aiAwardSuggestions, hasGeneratedContent, loadedImages]);

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
                      <span className="text-[10px] text-purple-500 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
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
                      <span className="text-[10px] text-green-500 font-mono bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
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
                  {item.isEarned && item.earnedAt && (
                    <span className="text-[10px] text-muted-foreground font-mono bg-background/80 px-1.5 py-0.5 rounded border backdrop-blur-sm">
                      {formatDateOnly(new Date(item.earnedAt))}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <CardTitle className="text-base mb-1 leading-tight">{item.title}</CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
                {item.isAIGoal && item.aiSuggestion?.targetDate && (
                  <p className="text-[10px] text-purple-500 mt-1">
                    Target: {formatDateOnly(new Date(item.aiSuggestion.targetDate))}
                  </p>
                )}
                {item.isEarned && (
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
